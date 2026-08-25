/**
 * Creates the first administrator.
 *
 * A fresh database has no users, and every administrative endpoint now requires
 * an authenticated admin — so without this there is no way in. Run once per
 * environment:
 *
 *   npm run seed:admin -- --email you@example.com --password 'Str0ng!Passw0rd' --name 'Your Name'
 *
 * Re-running promotes and reactivates the existing account rather than failing,
 * so it is safe to repeat. It never prints or logs the password.
 */

import mongoose from "mongoose";

import { connectDatabase, disconnectDatabase } from "../app/config/db";
import { User } from "../app/modules/user.model";

interface Args {
  email?: string;
  password?: string;
  name?: string;
  phone?: string;
}

function parseArgs(argv: string[]): Args {
  const args: Args = {};

  for (let i = 0; i < argv.length; i += 1) {
    const flag = argv[i];
    if (!flag?.startsWith("--")) continue;

    const key = flag.slice(2) as keyof Args;
    const value = argv[i + 1];

    if (value && !value.startsWith("--")) {
      args[key] = value;
      i += 1;
    }
  }

  return args;
}

/** Mirrors the API's creation policy so seeded credentials are not the weak link. */
function validatePassword(password: string): string[] {
  const problems: string[] = [];

  if (password.length < 12) problems.push("at least 12 characters");
  if (!/[a-z]/.test(password)) problems.push("a lowercase letter");
  if (!/[A-Z]/.test(password)) problems.push("an uppercase letter");
  if (!/\d/.test(password)) problems.push("a number");
  if (!/[^A-Za-z0-9]/.test(password)) problems.push("a symbol");

  return problems;
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));

  const email = (args.email ?? process.env.SEED_ADMIN_EMAIL ?? "").trim().toLowerCase();
  const password = args.password ?? process.env.SEED_ADMIN_PASSWORD ?? "";
  const name = (args.name ?? process.env.SEED_ADMIN_NAME ?? "TaoJoo Admin").trim();
  const phone = (args.phone ?? process.env.SEED_ADMIN_PHONE ?? "").trim();

  if (!email || !password) {
    console.error(
      "\nUsage: npm run seed:admin -- --email <email> --password <password> [--name <name>] [--phone <phone>]\n" +
        "Or set SEED_ADMIN_EMAIL and SEED_ADMIN_PASSWORD.\n",
    );
    process.exit(1);
  }

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    console.error(`\n"${email}" is not a valid email address.\n`);
    process.exit(1);
  }

  const problems = validatePassword(password);

  if (problems.length > 0) {
    console.error(`\nPassword is too weak — it needs ${problems.join(", ")}.\n`);
    process.exit(1);
  }

  await connectDatabase();

  const existing = await User.findOne({ email }).select("_id role status");

  if (existing) {
    existing.role = "admin";
    existing.status = "active";
    // Assigning the plain value lets the schema's pre-save hook hash it.
    existing.passwordHash = password;
    existing.tokensValidFrom = new Date();
    await existing.save();

    console.log(`\nUpdated existing account ${email} → role=admin, status=active, password reset.`);
  } else {
    await User.create({
      name,
      email,
      ...(phone ? { phone } : {}),
      passwordHash: password,
      role: "admin",
      status: "active",
    });

    console.log(`\nCreated administrator ${email}.`);
  }

  const adminCount = await User.countDocuments({ role: "admin" });
  console.log(`Administrators in ${mongoose.connection.name}: ${adminCount}\n`);

  await disconnectDatabase();
  process.exit(0);
}

main().catch(async (error) => {
  console.error("\nSeeding failed:", error instanceof Error ? error.message : error, "\n");
  await disconnectDatabase().catch(() => undefined);
  process.exit(1);
});
