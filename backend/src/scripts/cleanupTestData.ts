/**
 * Removes the records the smoke and UI test runs left behind.
 *
 * Those runs deliberately exercise create paths against the real database, so
 * the demo data ends up with a handful of obviously-synthetic rows. This drops
 * exactly those, matched on the names the harnesses use.
 *
 *   npx tsx src/scripts/cleanupTestData.ts
 */

import { connectDatabase, disconnectDatabase } from "../app/config/db";
import { Customer, Order, Payment } from "../app/modules/crm/crm.model";
import { Call, FollowUp, Lead, Message, Quotation } from "../app/modules/sales/sales.model";
import {
  Courier,
  Inventory,
  PurchaseOrder,
  Shipment,
  StockMovement,
  Supplier,
  Warehouse,
} from "../app/modules/supply/supply.model";
import { User } from "../app/modules/user.model";

const TEST_NAME = /^(Smoke |UI Driven |Probe |Clash$)/;

async function main(): Promise<void> {
  await connectDatabase();

  // Warehouses first: their id is needed to find the stock and POs beneath them.
  const warehouses = await Warehouse.find({
    $or: [{ name: TEST_NAME }, { code: /^SM[0-9A-F]{4}$|^SMK-99$/ }],
  })
    .select("_id")
    .lean<{ _id: string }[]>();

  const warehouseIds = warehouses.map((row) => row._id);

  const suppliers = await Supplier.find({ name: TEST_NAME }).select("_id").lean<{ _id: string }[]>();
  const supplierIds = suppliers.map((row) => row._id);

  // Orders raised by the quotation-approval checks, and everything hanging off
  // them, so no payment or shipment is left pointing at a deleted order.
  const quotations = await Quotation.find({ notes: /smoke/i, customerId: { $exists: true } })
    .select("_id orderId")
    .lean<{ _id: string; orderId: string | null }[]>();

  const results = await Promise.all([
    Lead.deleteMany({ name: TEST_NAME }),
    Customer.deleteMany({ name: TEST_NAME }),
    Call.deleteMany({ notes: "smoke" }),
    Message.deleteMany({ message: "smoke" }),
    FollowUp.deleteMany({ title: /^Smoke /}),
    Supplier.deleteMany({ name: TEST_NAME }),
    Warehouse.deleteMany({ _id: { $in: warehouseIds } }),
    Courier.deleteMany({ name: TEST_NAME }),
    Inventory.deleteMany({ warehouseId: { $in: warehouseIds } }),
    StockMovement.deleteMany({ warehouseId: { $in: warehouseIds } }),
    PurchaseOrder.deleteMany({ supplierId: { $in: supplierIds } }),
    User.deleteMany({ email: /^smoke\./ }),
  ]);

  const labels = [
    "leads",
    "customers",
    "calls",
    "messages",
    "follow-ups",
    "suppliers",
    "warehouses",
    "couriers",
    "inventory",
    "movements",
    "purchase orders",
    "users",
  ];

  console.log("\nRemoved test records:\n");
  results.forEach((result, index) => {
    if (result.deletedCount) console.log(`  ${labels[index]!.padEnd(16)} ${result.deletedCount}`);
  });

  // Quotations from the approval checks, plus the orders they raised.
  const orderIds = quotations.map((row) => row.orderId).filter((id): id is string => Boolean(id));

  if (orderIds.length > 0) {
    const [shipments, payments, orders] = await Promise.all([
      Shipment.deleteMany({ orderId: { $in: orderIds } }),
      Payment.deleteMany({ orderId: { $in: orderIds } }),
      Order.deleteMany({ _id: { $in: orderIds } }),
    ]);

    console.log(`  ${"orders".padEnd(16)} ${orders.deletedCount}`);
    console.log(`  ${"shipments".padEnd(16)} ${shipments.deletedCount}`);
    console.log(`  ${"payments".padEnd(16)} ${payments.deletedCount}`);
  }

  const removedQuotations = await Quotation.deleteMany({ _id: { $in: quotations.map((q) => q._id) } });
  if (removedQuotations.deletedCount) {
    console.log(`  ${"quotations".padEnd(16)} ${removedQuotations.deletedCount}`);
  }

  console.log("");
  await disconnectDatabase();
}

main().catch(async (error) => {
  console.error("\nCleanup failed:", error instanceof Error ? error.message : error, "\n");
  await disconnectDatabase().catch(() => undefined);
  process.exit(1);
});
