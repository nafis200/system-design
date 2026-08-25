/**
 * Imports the front end's fixture data into MongoDB.
 *
 * The admin console now reads customers, products, orders and payments from the
 * API, so the database has to hold the records that used to be bundled JSON.
 * This reads those same files and upserts them, which means the console shows
 * exactly the data it showed before — only now paginated and searched by Mongo.
 *
 *   npm run seed:crm              # upsert, leaving anything already there
 *   npm run seed:crm -- --fresh   # wipe the CRM collections first
 *   npm run seed:crm -- --volume 250   # pad orders up to N for pagination testing
 *
 * Safe to re-run: every write is an upsert keyed on the business id.
 */

import fs from "fs";
import type { Model } from "mongoose";
import path from "path";

import { connectDatabase, disconnectDatabase } from "../app/config/db";
import {
  ActivityLog,
  Customer,
  Order,
  Payment,
  Product,
} from "../app/modules/crm/crm.model";
import { seedDemoUsers } from "./seedUsers";

/** The fixtures live in the front-end workspace; this is the only place we reach across. */
const FIXTURE_DIR = path.resolve(
  __dirname,
  "../../../frontend/src/db/taojooDB",
);

interface Args {
  fresh: boolean;
  volume: number;
}

function parseArgs(argv: string[]): Args {
  const args: Args = { fresh: false, volume: 0 };

  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === "--fresh") args.fresh = true;
    if (argv[i] === "--volume") {
      const value = Number(argv[i + 1]);
      if (Number.isFinite(value) && value > 0) args.volume = Math.floor(value);
    }
  }

  return args;
}

function readFixture<T>(name: string): T[] {
  const file = path.join(FIXTURE_DIR, `${name}.json`);

  if (!fs.existsSync(file)) {
    console.warn(`  ! fixture ${name}.json not found at ${file} — skipping`);
    return [];
  }

  return JSON.parse(fs.readFileSync(file, "utf8")) as T[];
}

/** Upserts by business id so re-running never duplicates or clobbers edits. */
async function upsertAll<TRow, TDoc>(
  label: string,
  model: Model<TDoc>,
  rows: TRow[],
  map: (row: TRow) => Record<string, unknown>,
): Promise<number> {
  if (rows.length === 0) return 0;

  const operations = rows.map((row) => {
    const doc = map(row);
    const _id = String(doc._id);
    const { _id: _omit, ...rest } = doc;

    return {
      updateOne: {
        filter: { _id },
        update: { $set: rest, $setOnInsert: { _id } },
        upsert: true,
      },
    };
  });

  // `timestamps: false` is essential: with Mongoose's automatic timestamps on,
  // it overwrites the seeded createdAt with the current time, so every record
  // lands on today's date and date-range filters match nothing.
  // The cast is contained here because these operations are built dynamically
  // from fixture rows rather than typed documents.
  await model.bulkWrite(operations as never, { timestamps: false });
  console.log(`  ${label.padEnd(12)} ${rows.length}`);

  return rows.length;
}

interface RawOrder {
  id: string;
  orderNumber: string;
  customerId: string;
  quotationId: string | null;
  salesUserId: string;
  status: string;
  items: { productId: string; quantity: number; unitPrice: number; unitCost: number; total: number }[];
  subtotal: number;
  discount: number;
  shippingCost: number;
  totalAmount: number;
  paymentStatus: string;
  courierId: string | null;
  notes: string;
  createdAt: string;
}

/**
 * The fixtures only carry five orders, which is not enough to exercise
 * server-side pagination. `--volume N` clones them deterministically up to N so
 * page 7 of the order list is a real query rather than an empty result.
 */
function padOrders(base: RawOrder[], target: number): RawOrder[] {
  if (base.length === 0 || target <= base.length) return [];

  const generated: RawOrder[] = [];
  const dayMs = 86_400_000;
  const epoch = Date.UTC(2026, 0, 1);

  for (let i = base.length; i < target; i += 1) {
    const source = base[i % base.length]!;
    const code = `ORD-3${String(10000 + i).slice(-5)}`;

    generated.push({
      ...source,
      id: code,
      orderNumber: code,
      // Spread across a year so date-range filters have something to bite on.
      createdAt: new Date(epoch + (i % 365) * dayMs).toISOString(),
    });
  }

  return generated;
}


async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));

  await connectDatabase();

  if (args.fresh) {
    console.log("\nClearing CRM collections…");
    await Promise.all([
      Customer.deleteMany({}),
      Product.deleteMany({}),
      Order.deleteMany({}),
      Payment.deleteMany({}),
      ActivityLog.deleteMany({}),
    ]);
  }

  // Shared with `seed:users` so the roster is defined once.
  console.log("\nSeeding demo accounts (one per role):");
  await seedDemoUsers();

  console.log("\nSeeding:");

  const customers = readFixture<Record<string, unknown>>("customers");
  const products = readFixture<Record<string, unknown>>("products");
  const payments = readFixture<Record<string, unknown>>("payments");

  await upsertAll("customers", Customer, customers, (row) => ({
    ...row,
    _id: row.id,
    lastOrderDate: row.lastOrderDate ? new Date(row.lastOrderDate as string) : null,
    createdAt: row.createdAt ? new Date(row.createdAt as string) : new Date(),
    updatedAt: new Date(),
    isArchived: false,
  }));

  await upsertAll("products", Product, products, (row) => ({
    ...row,
    _id: row.id,
    // Fixture images point at paths that were never shipped; leave blank so the
    // UI falls back to its placeholder instead of requesting a missing file.
    image: "",
    isArchived: false,
  }));

  // Orders live in mockData.ts rather than a JSON file, so they are inlined here.
  const baseOrders = readFixture<RawOrder>("orders");
  const orders =
    baseOrders.length > 0 ? baseOrders : (JSON.parse(ORDERS_FALLBACK) as RawOrder[]);

  const allOrders = [...orders, ...padOrders(orders, args.volume)];

  await upsertAll("orders", Order, allOrders as unknown as Record<string, unknown>[], (row) => ({
    ...row,
    _id: row.id,
    createdAt: row.createdAt ? new Date(row.createdAt as string) : new Date(),
    isArchived: false,
  }));

  await upsertAll("payments", Payment, payments, (row) => ({
    ...row,
    _id: row.id,
    paidAt: row.paidAt ? new Date(row.paidAt as string) : null,
    isArchived: false,
  }));

  // A little activity so the customer timeline is not empty on first look.
  const activity = customers.flatMap((customer, index) => {
    const customerId = String(customer.id);
    return [
      {
        _id: `ACT-S${index}1`,
        actorId: "USR-0001",
        action: "Customer record created",
        entityType: "customer" as const,
        entityId: customerId,
        customerId,
        ipAddress: "103.11.20.40",
        createdAt: customer.createdAt ? new Date(customer.createdAt as string) : new Date(),
      },
    ];
  });

  await upsertAll("activity", ActivityLog, activity as unknown as Record<string, unknown>[], (row) => ({
    ...row,
    _id: row._id,
  }));

  const [c, p, o, pay] = await Promise.all([
    Customer.countDocuments(),
    Product.countDocuments(),
    Order.countDocuments(),
    Payment.countDocuments(),
  ]);

  console.log(
    `\nTotals — customers ${c}, products ${p}, orders ${o}, payments ${pay}\n`,
  );

  await disconnectDatabase();
  process.exit(0);
}

/** Mirrors the five orders defined in the front end's mockData.ts. */
const ORDERS_FALLBACK = JSON.stringify([
  {
    id: "ORD-10001", orderNumber: "ORD-10001", customerId: "CUS-10001", quotationId: "QUO-10001",
    salesUserId: "USR-0002", status: "delivered",
    items: [
      { productId: "PRD-10001", quantity: 20, unitPrice: 1450, unitCost: 950, total: 29000 },
      { productId: "PRD-10002", quantity: 10, unitPrice: 1250, unitCost: 800, total: 12500 },
    ],
    subtotal: 41500, discount: 1500, shippingCost: 500, totalAmount: 40500,
    paymentStatus: "paid", courierId: "CUR-10002",
    notes: "Corporate bulk order delivered successfully.", createdAt: "2026-01-14T10:00:00Z",
  },
  {
    id: "ORD-10015", orderNumber: "ORD-10015", customerId: "CUS-10003", quotationId: null,
    salesUserId: "USR-0002", status: "shipped",
    items: [
      { productId: "PRD-10003", quantity: 15, unitPrice: 2850, unitCost: 1900, total: 42750 },
      { productId: "PRD-10004", quantity: 10, unitPrice: 1400, unitCost: 950, total: 14000 },
    ],
    subtotal: 56750, discount: 2000, shippingCost: 800, totalAmount: 55550,
    paymentStatus: "partial", courierId: "CUR-10001",
    notes: "Shipment in transit.", createdAt: "2026-08-04T09:45:00Z",
  },
  {
    id: "ORD-10018", orderNumber: "ORD-10018", customerId: "CUS-10002", quotationId: "QUO-10012",
    salesUserId: "USR-0002", status: "processing",
    items: [
      { productId: "PRD-10001", quantity: 50, unitPrice: 1450, unitCost: 950, total: 72500 },
      { productId: "PRD-10003", quantity: 15, unitPrice: 2850, unitCost: 1900, total: 42750 },
    ],
    subtotal: 115250, discount: 5000, shippingCost: 1000, totalAmount: 111250,
    paymentStatus: "paid", courierId: null,
    notes: "Fashion house bulk order being processed.", createdAt: "2026-08-06T14:10:00Z",
  },
  {
    id: "ORD-10021", orderNumber: "ORD-10021", customerId: "CUS-10001", quotationId: null,
    salesUserId: "USR-0002", status: "shipped",
    items: [{ productId: "PRD-10005", quantity: 20, unitPrice: 3250, unitCost: 2200, total: 65000 }],
    subtotal: 65000, discount: 1400, shippingCost: 600, totalAmount: 64200,
    paymentStatus: "unpaid", courierId: "CUR-10001",
    notes: "Premium blazer order shipped via Steadfast.", createdAt: "2026-08-08T10:30:00Z",
  },
  {
    id: "ORD-10020", orderNumber: "ORD-10020", customerId: "CUS-10004", quotationId: null,
    salesUserId: "USR-0002", status: "pending",
    items: [
      { productId: "PRD-10004", quantity: 5, unitPrice: 1400, unitCost: 950, total: 7000 },
      { productId: "PRD-10002", quantity: 3, unitPrice: 1250, unitCost: 800, total: 3750 },
    ],
    subtotal: 10750, discount: 500, shippingCost: 200, totalAmount: 10450,
    paymentStatus: "unpaid", courierId: null,
    notes: "New guest customer order pending confirmation.", createdAt: "2026-08-07T16:20:00Z",
  },
]);

main().catch(async (error) => {
  console.error("\nSeeding failed:", error instanceof Error ? error.message : error, "\n");
  await disconnectDatabase().catch(() => undefined);
  process.exit(1);
});
