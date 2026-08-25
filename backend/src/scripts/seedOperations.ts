/**
 * Seeds the sales and supply collections.
 *
 * `seed:crm` covers customers, products, orders and payments. This covers
 * everything the rest of the PRD asks for — leads, calls, messages, follow-ups,
 * quotations, suppliers, warehouses, stock, purchase orders, couriers and
 * shipments — so a fresh database opens with every screen populated rather than
 * with fourteen empty tables.
 *
 *   npm run seed:ops              # upsert, leaving anything already there
 *   npm run seed:ops -- --fresh   # wipe these collections first
 *
 * Safe to re-run: every write is an upsert keyed on the business id. Dates are
 * generated relative to today so the dashboards, overdue counts and "this month"
 * KPI windows have something in them whenever this is run.
 */

import type { Model } from "mongoose";

import { connectDatabase, disconnectDatabase } from "../app/config/db";
import { Customer, Order, Product } from "../app/modules/crm/crm.model";
import type { TCustomer, TOrder, TProduct } from "../app/modules/crm/crm.interface";
import {
  Call,
  FollowUp,
  Lead,
  Message,
  Quotation,
} from "../app/modules/sales/sales.model";
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

const fresh = process.argv.includes("--fresh");

/** Days from now, so seeded data always straddles today. */
function daysFromNow(days: number, hour = 10): Date {
  const date = new Date();
  date.setDate(date.getDate() + days);
  date.setHours(hour, 0, 0, 0);
  return date;
}

/** Upserts by `_id`, so re-running never duplicates and never clobbers edits. */
async function upsertAll<T extends { _id: string }>(
  model: Model<T>,
  label: string,
  rows: T[],
): Promise<void> {
  if (rows.length === 0) return;

  await model.bulkWrite(
    rows.map((row) => ({
      updateOne: {
        filter: { _id: row._id } as never,
        update: { $setOnInsert: row } as never,
        upsert: true,
      },
    })) as never,
  );

  console.log(`  ${label.padEnd(16)} ${rows.length}`);
}

async function main(): Promise<void> {
  await connectDatabase();

  console.log("\nSeeding sales and supply collections\n");

  if (fresh) {
    await Promise.all([
      Lead.deleteMany({}),
      Call.deleteMany({}),
      Message.deleteMany({}),
      FollowUp.deleteMany({}),
      Quotation.deleteMany({}),
      Supplier.deleteMany({}),
      Warehouse.deleteMany({}),
      Inventory.deleteMany({}),
      StockMovement.deleteMany({}),
      PurchaseOrder.deleteMany({}),
      Courier.deleteMany({}),
      Shipment.deleteMany({}),
    ]);
    console.log("  wiped existing sales and supply records\n");
  }

  // Reference the records seed:crm already created rather than inventing new
  // ids, so every cross-reference below resolves to something real.
  const [customers, products, orders, staff] = await Promise.all([
    Customer.find().select("_id name phone").limit(10).lean<TCustomer[]>(),
    Product.find().select("_id purchasePrice sellingPrice").limit(10).lean<TProduct[]>(),
    // Only orders that have left the warehouse can carry a consignment, so
    // filter for those rather than taking the newest few and hoping some
    // qualify — which produced zero shipments on a database whose recent
    // orders were all still pending.
    Order.find({ status: { $in: ["shipped", "delivered"] } })
      .select("_id status")
      .sort({ createdAt: -1 })
      .limit(6)
      .lean<TOrder[]>(),
    User.find({ role: { $ne: "customer" } })
      .select("_id role")
      .lean<{ _id: unknown; role: string }[]>(),
  ]);

  if (customers.length === 0 || products.length === 0) {
    console.warn(
      "  ! No customers or products found. Run `npm run seed:crm` first — this script\n" +
        "    references those records rather than creating its own.\n",
    );
    await disconnectDatabase();
    return;
  }

  const salesUser =
    staff.find((account) => account.role === "salesManager") ?? staff[0];
  const warehouseUser =
    staff.find((account) => account.role === "warehouseOfficer") ?? staff[0];

  const salesId = salesUser ? String(salesUser._id) : "";
  const warehouseId = warehouseUser ? String(warehouseUser._id) : "";

  /*
   * Link the demo buyer's login to a customer record.
   *
   * The portal scopes every list to the customer attached to the signed-in
   * account, so without this link the demo buyer signs in successfully and then
   * sees an error on every screen — which reads as a broken portal rather than
   * as unseeded data.
   */
  const buyer = await User.findOne({ role: "customer" })
    .select("_id name")
    .lean<{ _id: unknown; name?: string } | null>();

  if (buyer) {
    const buyerId = String(buyer._id);
    const alreadyLinked = await Customer.findOne({ userId: buyerId }).select("_id").lean();

    if (!alreadyLinked) {
      const target = customers[0]!;

      await Customer.updateOne(
        { _id: target._id },
        { $set: { userId: buyerId, isRegistered: true, customerType: "registered" } },
      );

      console.log(`  linked portal account ${buyer.name ?? buyerId} → ${target._id}\n`);
    }
  }

  const productAt = (index: number) => products[index % products.length]!;
  const customerAt = (index: number) => customers[index % customers.length]!;

  /* ------------------------------------ Leads ----------------------------- */

  const leads = [
    {
      name: "Rezaul Karim",
      companyName: "Karim Traders",
      phone: "01712345601",
      email: "rezaul@karimtraders.com",
      source: "facebook" as const,
      status: "new" as const,
      priority: "high" as const,
      estimatedValue: 85000,
      nextFollowUp: daysFromNow(1),
      notes: "Saw the Eid campaign. Wants pricing on bulk shirts, 200+ units.",
    },
    {
      name: "Farhana Akter",
      companyName: null,
      phone: "01712345602",
      email: "farhana.akter@gmail.com",
      source: "whatsapp" as const,
      status: "contacted" as const,
      priority: "medium" as const,
      estimatedValue: 24000,
      nextFollowUp: daysFromNow(3),
      notes: "Boutique owner. Asked for the catalogue; sent it on WhatsApp.",
    },
    {
      name: "Imran Hossain",
      companyName: "Dhaka Fashion House",
      phone: "01712345603",
      email: "imran@dhakafashion.com",
      source: "referral" as const,
      status: "qualified" as const,
      priority: "high" as const,
      estimatedValue: 340000,
      nextFollowUp: daysFromNow(-2),
      notes: "Referred by an existing customer. Budget confirmed, needs samples.",
    },
    {
      name: "Nasrin Sultana",
      companyName: "Sultana Boutique",
      phone: "01712345604",
      email: "nasrin@sultanaboutique.com",
      source: "website" as const,
      status: "proposal" as const,
      priority: "medium" as const,
      estimatedValue: 128000,
      nextFollowUp: daysFromNow(2),
      notes: "Quotation sent, waiting on her partner's approval.",
    },
    {
      name: "Tanvir Ahmed",
      companyName: null,
      phone: "01712345605",
      email: "tanvir.ahmed@outlook.com",
      source: "phone" as const,
      status: "lost" as const,
      priority: "low" as const,
      estimatedValue: 12000,
      nextFollowUp: null,
      notes: "Went with a cheaper local supplier. Revisit next season.",
    },
  ].map((lead, index) => ({
    _id: `LED-${10001 + index}`,
    ...lead,
    assignedTo: salesId,
    customerId: null,
    convertedAt: null,
    isArchived: false,
  }));

  await upsertAll(Lead, "leads", leads as never[]);

  /* ------------------------------------ Calls ----------------------------- */

  const calls = [
    { customerIndex: 0, leadId: null, type: "outgoing", status: "completed", outcome: "connected", durationSeconds: 245, day: -1, notes: "Confirmed the delivery address for this week's order." },
    { customerIndex: 1, leadId: null, type: "incoming", status: "completed", outcome: "quotation_requested", durationSeconds: 512, day: -1, notes: "Asked for a revised quotation with the bulk discount applied." },
    { customerIndex: null, leadId: "LED-10001", type: "outgoing", status: "missed", outcome: "no_answer", durationSeconds: 0, day: 0, notes: "No answer. Try again after 6pm." },
    { customerIndex: null, leadId: "LED-10003", type: "outgoing", status: "completed", outcome: "interested", durationSeconds: 720, day: 0, notes: "Walked through the sample range. Wants three samples couriered." },
    { customerIndex: 2, leadId: null, type: "incoming", status: "completed", outcome: "connected", durationSeconds: 180, day: 0, notes: "Chased the tracking number for the last shipment." },
    { customerIndex: null, leadId: "LED-10002", type: "outgoing", status: "busy", outcome: "busy", durationSeconds: 0, day: 0, notes: "Line busy." },
  ].map((call, index) => ({
    _id: `CAL-${10001 + index}`,
    customerId: call.customerIndex === null ? null : customerAt(call.customerIndex)._id,
    leadId: call.leadId,
    handledBy: salesId,
    type: call.type,
    durationSeconds: call.durationSeconds,
    status: call.status,
    outcome: call.outcome,
    recordingUrl: "",
    notes: call.notes,
    calledAt: daysFromNow(call.day, 11 + (index % 6)),
    isArchived: false,
  }));

  await upsertAll(Call, "calls", calls as never[]);

  /* ----------------------------------- Messages --------------------------- */

  const messages = [
    { customerIndex: 0, leadId: null, channel: "whatsapp", direction: "outbound", body: "Good morning — your order has been packed and goes out with the courier today.", day: -1 },
    { customerIndex: 0, leadId: null, channel: "whatsapp", direction: "inbound", body: "Thank you. Please share the tracking number once you have it.", day: -1 },
    { customerIndex: null, leadId: "LED-10002", channel: "whatsapp", direction: "outbound", body: "Here is our latest catalogue with wholesale pricing. Let me know what interests you.", day: -2 },
    { customerIndex: 1, leadId: null, channel: "email", direction: "outbound", body: "Please find the revised quotation attached, valid for 14 days.", day: 0 },
    { customerIndex: 2, leadId: null, channel: "sms", direction: "outbound", body: "Your payment has been received. Thank you.", day: -3 },
  ].map((message, index) => ({
    _id: `MSG-${10001 + index}`,
    customerId: message.customerIndex === null ? null : customerAt(message.customerIndex)._id,
    leadId: message.leadId,
    userId: salesId,
    senderName: message.direction === "outbound" ? "Sales team" : "Customer",
    channel: message.channel,
    direction: message.direction,
    message: message.body,
    sentAt: daysFromNow(message.day, 9 + (index % 8)),
    isArchived: false,
  }));

  await upsertAll(Message, "messages", messages as never[]);

  /* ---------------------------------- Follow-ups -------------------------- */

  const followUps = [
    { title: "Call back about the bulk shirt pricing", customerIndex: null, leadId: "LED-10001", type: "call", priority: "high", status: "pending", day: -1 },
    { title: "Send three samples by courier", customerIndex: null, leadId: "LED-10003", type: "task", priority: "high", status: "pending", day: 1 },
    { title: "Chase the outstanding invoice", customerIndex: 0, leadId: null, type: "call", priority: "medium", status: "pending", day: 0 },
    { title: "Follow up on the revised quotation", customerIndex: null, leadId: "LED-10004", type: "whatsapp", priority: "medium", status: "pending", day: 2 },
    { title: "Confirm the delivery window", customerIndex: 1, leadId: null, type: "call", priority: "low", status: "completed", day: -4 },
    { title: "Quarterly account review meeting", customerIndex: 2, leadId: null, type: "meeting", priority: "medium", status: "pending", day: 6 },
  ].map((task, index) => ({
    _id: `FUP-${10001 + index}`,
    customerId: task.customerIndex === null ? null : customerAt(task.customerIndex)._id,
    leadId: task.leadId,
    assignedTo: salesId,
    title: task.title,
    type: task.type,
    priority: task.priority,
    status: task.status,
    dueAt: daysFromNow(task.day, 14),
    completedAt: task.status === "completed" ? daysFromNow(task.day, 15) : null,
    notes: "",
    isArchived: false,
  }));

  await upsertAll(FollowUp, "follow-ups", followUps as never[]);

  /* --------------------------------- Quotations --------------------------- */

  const quotations = [0, 1, 2, 3].map((index) => {
    const items = [
      {
        productId: productAt(index)._id,
        quantity: 10 + index * 5,
        unitPrice: productAt(index).sellingPrice,
        total: (10 + index * 5) * productAt(index).sellingPrice,
      },
      {
        productId: productAt(index + 1)._id,
        quantity: 5 + index,
        unitPrice: productAt(index + 1).sellingPrice,
        total: (5 + index) * productAt(index + 1).sellingPrice,
      },
    ];

    const subtotal = items.reduce((sum, item) => sum + item.total, 0);
    const discount = index * 500;
    const shippingCost = 600;

    return {
      _id: `QUO-${10001 + index}`,
      quotationNumber: `QUO-${10001 + index}`,
      customerId: customerAt(index)._id,
      createdBy: salesId,
      // One of each interesting state, so the list has something to filter.
      status: (["draft", "sent", "sent", "rejected"] as const)[index]!,
      validUntil: daysFromNow(14 - index * 3),
      items,
      subtotal,
      discount,
      shippingCost,
      total: subtotal - discount + shippingCost,
      notes: "Prices hold for the validity period. Delivery 5–7 working days.",
      rejectionReason: index === 3 ? "Customer's budget was reallocated this quarter." : "",
      approvedAt: null,
      orderId: null,
      isArchived: false,
    };
  });

  await upsertAll(Quotation, "quotations", quotations as never[]);

  /* --------------------------------- Suppliers ---------------------------- */

  const suppliers = [
    { name: "Guangzhou Textile Export Co.", contactPerson: "Li Wei", phone: "+862012345678", email: "liwei@gztextile.cn", country: "China", address: "Block 8, Baiyun Industrial Park, Guangzhou", totalPurchases: 1_250_000, notes: "30% deposit, balance before shipping. Lead time 18–25 days." },
    { name: "Yiwu Fashion Accessories", contactPerson: "Zhang Min", phone: "+865798812345", email: "zhang@yiwufashion.cn", country: "China", address: "District 4, Yiwu International Trade City", totalPurchases: 480_000, notes: "Good on small runs. Quality inconsistent on zips — inspect on arrival." },
    { name: "Dhaka Packaging Supplies", contactPerson: "Rafiqul Islam", phone: "01812345678", email: "sales@dhakapack.com", country: "Bangladesh", address: "Tejgaon Industrial Area, Dhaka", totalPurchases: 96_000, notes: "Local, next-day on cartons and polybags." },
  ].map((supplier, index) => ({
    _id: `SUP-${10001 + index}`,
    ...supplier,
    whatsapp: supplier.phone,
    status: "active" as const,
    isArchived: false,
  }));

  await upsertAll(Supplier, "suppliers", suppliers as never[]);

  /* -------------------------------- Warehouses ---------------------------- */

  const warehouses = [
    { name: "Dhaka Central Depot", code: "DHK-01", capacity: 12000, contactPhone: "01912345601", address: { street: "Plot 42, Block C", area: "Tejgaon", city: "Dhaka", postalCode: "1208", country: "Bangladesh" } },
    { name: "Chattogram Port Store", code: "CTG-01", capacity: 8000, contactPhone: "01912345602", address: { street: "Warehouse 7, Port Access Road", area: "Agrabad", city: "Chattogram", postalCode: "4100", country: "Bangladesh" } },
  ].map((warehouse, index) => ({
    _id: `WHS-${10001 + index}`,
    ...warehouse,
    managerId: warehouseId,
    status: "active" as const,
    isArchived: false,
  }));

  await upsertAll(Warehouse, "warehouses", warehouses as never[]);

  /* --------------------------------- Inventory ---------------------------- */

  // A spread of healthy, low and critical rows so the reorder banding and the
  // low-stock alert have something real to show on first load.
  const inventory = products.slice(0, 8).map((product, index) => {
    const quantity = [420, 180, 26, 8, 95, 310, 14, 240][index] ?? 100;
    const reserved = [40, 15, 6, 2, 10, 25, 4, 20][index] ?? 0;

    return {
      _id: `INV-${10001 + index}`,
      warehouseId: warehouses[index % warehouses.length]!._id,
      productId: product._id,
      quantity,
      reservedQuantity: reserved,
      reorderLevel: 30,
      isArchived: false,
    };
  });

  await upsertAll(Inventory, "inventory", inventory as never[]);

  const movements = inventory.map((row, index) => ({
    _id: `STM-${10001 + index}`,
    warehouseId: row.warehouseId,
    productId: row.productId,
    type: "in" as const,
    quantity: row.quantity,
    quantityAfter: row.quantity,
    referenceType: "adjustment" as const,
    referenceId: "",
    performedBy: warehouseId,
    performedByName: "Warehouse Officer",
    notes: "Opening balance",
  }));

  await upsertAll(StockMovement, "movements", movements as never[]);

  /* ------------------------------ Purchase orders ------------------------- */

  const purchaseOrders = [0, 1, 2].map((index) => {
    const items = [
      {
        productId: productAt(index)._id,
        quantity: 200 + index * 50,
        unitPrice: productAt(index).purchasePrice,
        total: (200 + index * 50) * productAt(index).purchasePrice,
        // The middle PO is part-received, so the partial state is visible.
        receivedQuantity: index === 1 ? 120 : 0,
      },
    ];

    return {
      _id: `PO-${10001 + index}`,
      poNumber: `PO-${10001 + index}`,
      supplierId: suppliers[index % suppliers.length]!._id,
      warehouseId: warehouses[index % warehouses.length]!._id,
      createdBy: warehouseId,
      status: (["draft", "partial", "issued"] as const)[index]!,
      items,
      totalAmount: items.reduce((sum, item) => sum + item.total, 0),
      expectedDate: daysFromNow(10 + index * 7),
      receivedDate: null,
      notes: "Sea freight. Inspect on arrival before booking into stock.",
      isArchived: false,
    };
  });

  await upsertAll(PurchaseOrder, "purchase orders", purchaseOrders as never[]);

  /* ---------------------------------- Couriers ---------------------------- */

  const couriers = [
    { name: "Pathao Courier", phone: "09678100800", email: "support@pathao.com", serviceType: "nationwide" as const, baseRate: 120 },
    { name: "Steadfast Courier", phone: "09614555555", email: "help@steadfast.com.bd", serviceType: "nationwide" as const, baseRate: 100 },
    { name: "RedX Express", phone: "09610970970", email: "care@redx.com.bd", serviceType: "express" as const, baseRate: 180 },
  ].map((courier, index) => ({
    _id: `COU-${10001 + index}`,
    ...courier,
    status: "active" as const,
    isArchived: false,
  }));

  await upsertAll(Courier, "couriers", couriers as never[]);

  /* --------------------------------- Shipments ---------------------------- */

  const shipments = orders.map((order, index) => ({
    _id: `SHP-${10001 + index}`,
    orderId: order._id,
    courierId: couriers[index % couriers.length]!._id,
    trackingNumber: `TJ${String(884210 + index)}BD`,
    status: order.status === "delivered" ? ("delivered" as const) : ("in_transit" as const),
    shippingCost: couriers[index % couriers.length]!.baseRate,
    dispatchedAt: daysFromNow(-3 - index),
    estimatedDelivery: daysFromNow(1 - index),
    deliveredAt: order.status === "delivered" ? daysFromNow(-1 - index) : null,
    notes: "",
    isArchived: false,
  }));

  await upsertAll(Shipment, "shipments", shipments as never[]);

  console.log("\nDone. Run `npm run seed:crm` first if any counts above look short.\n");

  await disconnectDatabase();
}

main().catch(async (error) => {
  console.error("\nSeeding failed:", error instanceof Error ? error.message : error, "\n");
  await disconnectDatabase().catch(() => undefined);
  process.exit(1);
});
