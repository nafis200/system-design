/**
 * Creates one demo account per role.
 *
 * The console authenticates against the API, so every role you want to sign in as
 * has to exist in MongoDB. This creates all five — admin, sales manager,
 * warehouse officer, financial manager and customer — with a single shared
 * password so the set is easy to hand to a reviewer.
 *
 *   npm run seed:users                          # create or update all five
 *   npm run seed:users -- --password 'Str0ng!Pass2026'
 *   SEED_DEMO_PASSWORD='...' npm run seed:users
 *
 * Idempotent, and it resets the password of an account it already owns so the
 * documented credentials always work. That is fine for demo accounts and wrong
 * for real ones, which is why every account it touches is listed below rather
 * than matched by pattern.
 */

import { connectDatabase, disconnectDatabase } from "../app/config/db";
import { User } from "../app/modules/user.model";
import type { TUserRole } from "../app/modules/user-interface";

export interface DemoAccount {
  name: string;
  email: string;
  phone: string;
  role: TUserRole;
  /** Where this role lands after signing in, for the printed summary. */
  workspace: string;
}

/** The demo roster. */
export const DEMO_ACCOUNTS: DemoAccount[] = [
  {
    name: "Taojoo Admin",
    email: "admin@taojoo.com",
    phone: "01711000001",
    role: "admin",
    workspace: "/admin",
  },
  {
    name: "Sadia Rahman",
    email: "sadia@taojoo.com",
    phone: "01711000002",
    role: "salesManager",
    workspace: "/sales",
  },
  {
    name: "Tanvir Hasan",
    email: "tanvir@taojoo.com",
    phone: "01711000003",
    role: "warehouseOfficer",
    workspace: "/warehouse",
  },
  {
    name: "Farhana Akter",
    email: "finance@taojoo.com",
    phone: "01711000005",
    role: "FinancialManager",
    workspace: "/finance",
  },
  {
    name: "Nusrat Jahan",
    email: "nusrat.fashion@gmail.com",
    phone: "01711000004",
    role: "customer",
    workspace: "/portal",
  },
];

/**
 * Default demo password. Meets the API's creation policy (12+ characters with
 * mixed classes) so these accounts are not the weakest link in a deployment that
 * forgot to change them.
 */
export const DEFAULT_DEMO_PASSWORD = "Taojoo!Demo2026";

/**
 * Creates or updates every demo account.
 *
 * Exported so `seed:crm` can call it rather than keeping a second copy of the
 * roster that drifts out of step.
 */
export async function seedDemoUsers(
  password: string = DEFAULT_DEMO_PASSWORD,
  log: (line: string) => void = (line) => console.log(line),
): Promise<void> {
  for (const account of DEMO_ACCOUNTS) {
    const existing = await User.findOne({ email: account.email }).select("_id");

    if (existing) {
      existing.name = account.name;
      existing.phone = account.phone;
      existing.role = account.role;
      existing.status = "active";
      // Assigning the plain value lets the schema's pre-save hook hash it.
      existing.passwordHash = password;
      // Ends any session issued before this reset.
      existing.tokensValidFrom = new Date();
      await existing.save();

      log(`  updated  ${account.email.padEnd(28)} ${account.role}`);
      continue;
    }

    await User.create({
      name: account.name,
      email: account.email,
      phone: account.phone,
      role: account.role,
      status: "active",
      passwordHash: password,
    });

    log(`  created  ${account.email.padEnd(28)} ${account.role}`);
  }
}

function parsePassword(argv: string[]): string {
  const flag = argv.indexOf("--password");

  if (flag !== -1) {
    const value = argv[flag + 1];
    if (value && !value.startsWith("--")) return value;
  }

  return process.env.SEED_DEMO_PASSWORD ?? DEFAULT_DEMO_PASSWORD;
}

/** Mirrors the API's creation policy so a weak override is caught here. */
function passwordProblems(password: string): string[] {
  const problems: string[] = [];

  if (password.length < 12) problems.push("at least 12 characters");
  if (!/[a-z]/.test(password)) problems.push("a lowercase letter");
  if (!/[A-Z]/.test(password)) problems.push("an uppercase letter");
  if (!/\d/.test(password)) problems.push("a number");
  if (!/[^A-Za-z0-9]/.test(password)) problems.push("a symbol");

  return problems;
}

async function main(): Promise<void> {
  const password = parsePassword(process.argv.slice(2));
  const problems = passwordProblems(password);

  if (problems.length > 0) {
    console.error(`\nPassword is too weak — it needs ${problems.join(", ")}.\n`);
    process.exit(1);
  }

  await connectDatabase();

  console.log("\nSeeding demo accounts (one per role):\n");
  await seedDemoUsers(password);

  const counts = await User.aggregate<{ _id: string; n: number }>([
    { $group: { _id: "$role", n: { $sum: 1 } } },
    { $sort: { _id: 1 } },
  ]);

  console.log("\nAccounts per role:");
  counts.forEach((row) => console.log(`  ${String(row._id).padEnd(20)} ${row.n}`));

  console.log("\nSign in with:\n");
  console.log(`  ${"Email".padEnd(28)} ${"Role".padEnd(18)} Workspace`);
  console.log(`  ${"-".repeat(28)} ${"-".repeat(18)} ${"-".repeat(40)}`);
  DEMO_ACCOUNTS.forEach((account) =>
    console.log(`  ${account.email.padEnd(28)} ${account.role.padEnd(18)} ${account.workspace}`),
  );
  console.log(`\n  Password for all of the above: ${password}`);
  console.log("  Change these before exposing the deployment to anyone.\n");

  await disconnectDatabase();
  process.exit(0);
}

// Only run when invoked directly, so `seed:crm` can import the seeder.
if (require.main === module) {
  main().catch(async (error) => {
    console.error("\nSeeding failed:", error instanceof Error ? error.message : error, "\n");
    await disconnectDatabase().catch(() => undefined);
    process.exit(1);
  });
}
