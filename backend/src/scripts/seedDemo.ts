/**
 * Generates a realistic demo dataset for the CRM.
 *
 * `seed:crm` mirrors the five bundled fixture rows, which is enough to prove the
 * wiring and nothing else: no page two, no status mix, no month-over-month
 * trend, no order with a history worth reading. This builds a book of business
 * instead — customers with tenure, a product catalogue, orders spread across
 * eighteen months whose stage reflects their age, a payment ledger that adds up
 * to the settlement status shown on each order, and a dated timeline per order.
 *
 *   npm run seed:demo                      # 60 customers, 40 products, 400 orders
 *   npm run seed:demo -- --fresh           # wipe the CRM collections first
 *   npm run seed:demo -- --orders 1200     # a heavier book
 *   npm run seed:demo -- --anchor today    # end the date range at today
 *
 * Every value comes from a seeded generator, so re-running produces byte-identical
 * records and the upserts are genuinely idempotent — the same order keeps the
 * same total, the same timeline and the same dates.
 */

import { connectDatabase, disconnectDatabase } from "../app/config/db";
import {
  ActivityLog,
  Customer,
  Order,
  OrderEvent,
  Payment,
  Product,
} from "../app/modules/crm/crm.model";
import type {
  TCustomer,
  TOrder,
  TOrderEvent,
  TOrderStatus,
  TPayment,
  TProduct,
} from "../app/modules/crm/crm.interface";
import { User } from "../app/modules/user.model";
import { seedDemoUsers } from "./seedUsers";

/* -------------------------------------------------------------------------- */
/* Deterministic randomness                                                    */
/* -------------------------------------------------------------------------- */

/**
 * A 32-bit linear congruential generator.
 *
 * `Math.random()` would make every run produce different totals for the same
 * order id, so an upsert would rewrite history on each seed and no two
 * developers would be looking at the same numbers.
 */
function createRng(seed: number) {
  let state = seed >>> 0;

  const next = () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 0x100000000;
  };

  return {
    next,
    /** Integer in [min, max]. */
    int: (min: number, max: number) => min + Math.floor(next() * (max - min + 1)),
    pick: <T>(items: readonly T[]): T => items[Math.floor(next() * items.length)]!,
    /** True with the given probability. */
    chance: (probability: number) => next() < probability,
    /**
     * Picks by weight. Used for status and payment-method mixes, where a uniform
     * pick would give a book of business that looks nothing like a real one.
     */
    weighted: <T>(entries: readonly (readonly [T, number])[]): T => {
      const total = entries.reduce((sum, [, weight]) => sum + weight, 0);
      let roll = next() * total;

      for (const [value, weight] of entries) {
        roll -= weight;
        if (roll <= 0) return value;
      }

      return entries[entries.length - 1]![0];
    },
  };
}

type Rng = ReturnType<typeof createRng>;

/* -------------------------------------------------------------------------- */
/* Vocabulary                                                                  */
/* -------------------------------------------------------------------------- */

const FIRST_NAMES = [
  "Rahim", "Nusrat", "Karim", "Sadia", "Tanvir", "Farhana", "Imran", "Mehjabin",
  "Arif", "Sabrina", "Rakib", "Tasnim", "Shakil", "Nadia", "Fahim", "Rumana",
  "Jahangir", "Sumaiya", "Mizanur", "Afsana", "Tofael", "Ishrat", "Nasir", "Lubna",
  "Habib", "Sharmin", "Zahid", "Maliha", "Rashed", "Anika",
] as const;

const LAST_NAMES = [
  "Ahmed", "Jahan", "Hossain", "Rahman", "Islam", "Akter", "Chowdhury", "Khan",
  "Siddique", "Haque", "Karim", "Molla", "Sarker", "Bhuiyan", "Alam", "Mahmud",
] as const;

const COMPANY_HEADS = [
  "Trading", "Fashion House", "Garments", "Textiles", "Apparels", "Enterprise",
  "Traders", "Collection", "Fabrics", "Boutique", "Corner", "Mart",
] as const;

/** City with its real postal code and a couple of plausible areas. */
const LOCATIONS = [
  { city: "Dhaka", postalCode: "1000", areas: ["Motijheel", "Gulshan", "Dhanmondi", "Banani", "Mirpur", "Uttara"] },
  { city: "Chattogram", postalCode: "4000", areas: ["Agrabad", "Khulshi", "Nasirabad", "Halishahar"] },
  { city: "Sylhet", postalCode: "3100", areas: ["Zindabazar", "Ambarkhana", "Subid Bazar"] },
  { city: "Khulna", postalCode: "9100", areas: ["Sonadanga", "Khalishpur"] },
  { city: "Rajshahi", postalCode: "6000", areas: ["Boalia", "Shaheb Bazar"] },
  { city: "Narayanganj", postalCode: "1400", areas: ["Chashara", "Fatullah"] },
] as const;

const STREETS = [
  "House 24, Road 7", "12 Motijheel C/A", "Plot 45, Block C", "88 Elephant Road",
  "House 3, Road 12", "221 Jubilee Road", "17/A Green Road", "56 Station Road",
  "Level 4, Rupayan Tower", "9 New Market Lane",
] as const;

/** Product line: prefix × base garment, priced from the base. */
const PRODUCT_PREFIXES = [
  "Premium", "Classic", "Executive", "Heritage", "Urban", "Signature",
  "Essential", "Corporate", "Tailored", "Everyday",
] as const;

const PRODUCT_BASES = [
  { name: "Cotton Shirt", sku: "CS", category: "Apparel", cost: 950, price: 1450, unit: "piece" },
  { name: "Polo Shirt", sku: "PS", category: "Apparel", cost: 800, price: 1250, unit: "piece" },
  { name: "Denim Jacket", sku: "DJ", category: "Jacket", cost: 1900, price: 2850, unit: "piece" },
  { name: "Formal Trouser", sku: "FT", category: "Trousers", cost: 950, price: 1400, unit: "piece" },
  { name: "Office Blazer", sku: "OB", category: "Formal Wear", cost: 2200, price: 3250, unit: "piece" },
  { name: "Oxford Shirt", sku: "OX", category: "Apparel", cost: 1100, price: 1690, unit: "piece" },
  { name: "Chino Pants", sku: "CP", category: "Trousers", cost: 1050, price: 1590, unit: "piece" },
  { name: "Knit Sweater", sku: "KS", category: "Knitwear", cost: 1400, price: 2100, unit: "piece" },
  { name: "Windbreaker", sku: "WB", category: "Jacket", cost: 1750, price: 2600, unit: "piece" },
  { name: "Linen Shirt", sku: "LS", category: "Apparel", cost: 1200, price: 1850, unit: "piece" },
  { name: "Waistcoat", sku: "WC", category: "Formal Wear", cost: 1300, price: 1980, unit: "piece" },
  { name: "Cargo Pants", sku: "CG", category: "Trousers", cost: 1150, price: 1720, unit: "piece" },
] as const;

const BRANDS = ["Taojoo", "Taojoo Signature", "Nordwear", "Bengal Loom"] as const;

/**
 * Courier ids and names must match `db/taojooDB/couriers.json`, which is what the
 * console resolves names from — otherwise the summary rail names one carrier and
 * the timeline entry beneath it names another.
 */
const COURIERS = ["CUR-10001", "CUR-10002"] as const;
const COURIER_NAMES: Record<string, string> = {
  "CUR-10001": "Steadfast Courier",
  "CUR-10002": "RedX",
};

/**
 * Sales staff the orders are attributed to.
 *
 * Read from the accounts `seedDemoUsers()` just created rather than hard-coded:
 * user ids are Mongo ObjectIds, so a literal like `USR-10002` is a reference to
 * nothing and every order renders its rep as "Unknown User".
 */
interface SalesRep {
  id: string;
  name: string;
}

async function loadSalesReps(): Promise<SalesRep[]> {
  // Only admin and salesManager ever legitimately carry `salesUserId` — placing
  // an order or approving a quotation is gated to those two roles on the real
  // API (see sales.route.ts's ADMIN_OR_SALES). Including warehouseOfficer here
  // used to seed orders "handled by" the warehouse officer demo account, which
  // the portal's "message your sales rep" contact card would then surface as
  // the buyer's sales representative — data the live system could never
  // actually produce.
  const staff = await User.find({ role: { $in: ["salesManager", "admin"] } })
    .select("name")
    .sort({ createdAt: 1 })
    .lean<{ _id: unknown; name?: string }[]>();

  const reps = staff.map((row) => ({ id: String(row._id), name: row.name ?? "Staff" }));

  // Nothing to attribute to — the orders still seed, just without a named rep.
  return reps.length > 0 ? reps : [{ id: "", name: "Unassigned" }];
}

const ORDER_NOTES = [
  "Bulk corporate order — packaging instructions attached.",
  "Customer requested split delivery across two addresses.",
  "Repeat order from an existing wholesale account.",
  "Awaiting bank transfer confirmation from the customer.",
  "Priority dispatch — customer collecting from the office.",
  "Sample order ahead of a larger seasonal purchase.",
  "Sizes confirmed over WhatsApp before production.",
  "Customer asked for the invoice in the company name.",
] as const;

/* -------------------------------------------------------------------------- */
/* Arguments                                                                   */
/* -------------------------------------------------------------------------- */

interface Args {
  fresh: boolean;
  customers: number;
  products: number;
  orders: number;
  months: number;
  anchor: Date;
}

/**
 * The dataset ends here by default rather than at `new Date()`, so two runs a
 * week apart still produce the same records. `--anchor today` opts into a
 * moving window when you want the newest orders to look genuinely fresh.
 */
const DEFAULT_ANCHOR = "2026-08-13";

function parseArgs(argv: string[]): Args {
  const args: Args = {
    fresh: false,
    customers: 60,
    products: 40,
    orders: 400,
    months: 18,
    anchor: new Date(`${DEFAULT_ANCHOR}T18:00:00Z`),
  };

  const numeric: Record<string, keyof Pick<Args, "customers" | "products" | "orders" | "months">> = {
    "--customers": "customers",
    "--products": "products",
    "--orders": "orders",
    "--months": "months",
  };

  for (let i = 0; i < argv.length; i += 1) {
    const flag = argv[i]!;

    if (flag === "--fresh") {
      args.fresh = true;
      continue;
    }

    if (flag === "--anchor") {
      const raw = argv[i + 1];

      if (raw === "today") {
        args.anchor = new Date();
      } else if (raw && /^\d{4}-\d{2}-\d{2}$/.test(raw)) {
        args.anchor = new Date(`${raw}T18:00:00Z`);
      }

      continue;
    }

    const key = numeric[flag];

    if (key) {
      const value = Number(argv[i + 1]);
      if (Number.isFinite(value) && value > 0) args[key] = Math.floor(value);
    }
  }

  return args;
}

/* -------------------------------------------------------------------------- */
/* Time helpers                                                                */
/* -------------------------------------------------------------------------- */

const HOUR_MS = 3_600_000;
const DAY_MS = 86_400_000;

function addHours(date: Date, hours: number): Date {
  return new Date(date.getTime() + hours * HOUR_MS);
}

/** Business-hours timestamp — orders are not placed at 04:00. */
function atWorkingHour(date: Date, rng: Rng): Date {
  const stamped = new Date(date);
  stamped.setUTCHours(rng.int(4, 13), rng.int(0, 59), rng.int(0, 59), 0);
  return stamped;
}

function daysBetween(from: Date, to: Date): number {
  return Math.floor((to.getTime() - from.getTime()) / DAY_MS);
}

/* -------------------------------------------------------------------------- */
/* Generators                                                                  */
/* -------------------------------------------------------------------------- */

function buildProducts(count: number, rng: Rng): TProduct[] {
  const products: TProduct[] = [];
  const usedSkus = new Set<string>();

  for (let i = 0; i < count; i += 1) {
    const base = PRODUCT_BASES[i % PRODUCT_BASES.length]!;
    const prefix = PRODUCT_PREFIXES[Math.floor(i / PRODUCT_BASES.length) % PRODUCT_PREFIXES.length]!;

    // SKU carries the index, so it stays unique across every prefix/base pair.
    const sku = `${base.sku}-${String(i + 1).padStart(3, "0")}`;
    if (usedSkus.has(sku)) continue;
    usedSkus.add(sku);

    // ±12% around the line's reference price, rounded to a sane retail figure.
    const drift = 1 + (rng.int(-12, 12) / 100);
    const purchasePrice = Math.round((base.cost * drift) / 10) * 10;
    const sellingPrice = Math.round((base.price * drift) / 10) * 10;

    products.push({
      _id: `PRD-${10001 + i}`,
      name: `${prefix} ${base.name}`,
      sku,
      category: base.category,
      brand: rng.pick(BRANDS),
      description: `${prefix} ${base.name.toLowerCase()} for corporate and wholesale supply.`,
      unit: base.unit,
      purchasePrice,
      sellingPrice,
      taxRate: 5,
      // A catalogue with nothing discontinued is not a catalogue worth filtering.
      status: rng.chance(0.9) ? "active" : "inactive",
      image: "",
      isArchived: false,
      createdAt: new Date(Date.UTC(2025, 0, 1) + i * 3 * DAY_MS),
    } as TProduct);
  }

  return products;
}

function buildCustomers(count: number, anchor: Date, months: number, rng: Rng): TCustomer[] {
  const customers: TCustomer[] = [];

  for (let i = 0; i < count; i += 1) {
    const first = rng.pick(FIRST_NAMES);
    const last = rng.pick(LAST_NAMES);
    const location = rng.pick(LOCATIONS);
    const isBusiness = rng.chance(0.65);
    const registered = rng.chance(0.55);

    // Tenure anywhere between the start of the window and a month before the
    // anchor, so the customer list has both long-standing accounts and new ones.
    const joined = atWorkingHour(
      new Date(anchor.getTime() - rng.int(35, Math.max(60, months * 30)) * DAY_MS),
      rng,
    );

    const phone = `+8801${rng.int(3, 9)}${String(rng.int(10000000, 99999999))}`;

    customers.push({
      _id: `CUS-${10001 + i}`,
      userId: null,
      name: `${first} ${last}`,
      companyName: isBusiness ? `${first} ${rng.pick(COMPANY_HEADS)}` : null,
      phone,
      email: `${first.toLowerCase()}.${last.toLowerCase()}${i}@example.com`,
      whatsapp: phone,
      isRegistered: registered,
      status: rng.chance(0.88) ? "active" : "inactive",
      customerType: registered ? "registered" : "guest",
      address: {
        street: rng.pick(STREETS),
        city: location.city,
        area: rng.pick(location.areas),
        postalCode: location.postalCode,
        country: "Bangladesh",
      },
      // Rolled up from the generated orders once those exist.
      totalOrders: 0,
      totalSpent: 0,
      lastOrderId: null,
      lastOrderDate: null,
      isArchived: false,
      createdAt: joined,
    } as TCustomer);
  }

  return customers;
}

/**
 * Picks a status appropriate to the order's age.
 *
 * An order placed yesterday is rarely delivered, and one from nine months ago is
 * rarely still pending. Without this the Kanban board and every trend chart show
 * the same flat mix in every column and every month.
 */
function statusForAge(ageDays: number, rng: Rng): TOrderStatus {
  if (ageDays <= 3) {
    return rng.weighted([
      ["pending", 50],
      ["confirmed", 30],
      ["processing", 15],
      ["cancelled", 5],
    ] as const);
  }

  if (ageDays <= 10) {
    return rng.weighted([
      ["confirmed", 15],
      ["processing", 25],
      ["packed", 25],
      ["shipped", 25],
      ["cancelled", 6],
      ["pending", 4],
    ] as const);
  }

  if (ageDays <= 25) {
    return rng.weighted([
      ["shipped", 30],
      ["delivered", 50],
      ["packed", 8],
      ["returned", 6],
      ["cancelled", 6],
    ] as const);
  }

  return rng.weighted([
    ["delivered", 84],
    ["returned", 8],
    ["cancelled", 8],
  ] as const);
}

/** Settlement that makes sense for the stage the order reached. */
function paymentStatusFor(status: TOrderStatus, rng: Rng): TOrder["paymentStatus"] {
  switch (status) {
    case "pending":
      return rng.weighted([["unpaid", 70], ["partial", 30]] as const);
    case "confirmed":
      return rng.weighted([["unpaid", 40], ["partial", 40], ["paid", 20]] as const);
    case "processing":
    case "packed":
      return rng.weighted([["partial", 35], ["paid", 65]] as const);
    case "shipped":
      return rng.weighted([["partial", 20], ["paid", 80]] as const);
    case "delivered":
      return rng.weighted([["paid", 94], ["partial", 6]] as const);
    case "cancelled":
      return rng.weighted([["unpaid", 80], ["partial", 20]] as const);
    case "returned":
      return rng.weighted([["paid", 60], ["partial", 40]] as const);
    default:
      return "unpaid";
  }
}

interface GeneratedOrder {
  order: TOrder;
  payments: TPayment[];
  events: TOrderEvent[];
}

function buildOrder(
  index: number,
  customer: TCustomer,
  products: TProduct[],
  salesReps: SalesRep[],
  anchor: Date,
  rng: Rng,
): GeneratedOrder {
  const code = `ORD-${20001 + index}`;

  // Placed somewhere between the customer joining and the anchor date, biased
  // towards recent so the newest months are the densest.
  //
  // A third are forced into the last three weeks. Age decides status, so without
  // that deliberate slice almost everything is old enough to be delivered and the
  // fulfilment board opens with three empty columns and one overflowing one.
  const windowDays = Math.max(1, daysBetween(customer.createdAt ?? anchor, anchor));
  const ageDays = rng.chance(0.33)
    ? rng.int(0, Math.min(21, windowDays))
    : Math.min(windowDays, Math.floor(windowDays * rng.next() ** 1.6));
  const placedAt = atWorkingHour(new Date(anchor.getTime() - ageDays * DAY_MS), rng);

  // Line items — distinct products only, so a single order never bills the same
  // SKU on two rows.
  const sellable = products.filter((product) => product.status === "active");
  const itemCount = rng.weighted([[1, 30], [2, 32], [3, 22], [4, 11], [5, 5]] as const);
  const chosen = new Map<string, TProduct>();

  while (chosen.size < itemCount) {
    const product = rng.pick(sellable);
    if (!chosen.has(product._id)) chosen.set(product._id, product);
  }

  const items = [...chosen.values()].map((product) => {
    const quantity = rng.weighted([
      [rng.int(2, 10), 40],
      [rng.int(11, 40), 40],
      [rng.int(41, 120), 20],
    ] as const);

    return {
      productId: product._id,
      quantity,
      unitPrice: product.sellingPrice,
      unitCost: product.purchasePrice,
      total: quantity * product.sellingPrice,
    };
  });

  const subtotal = items.reduce((sum, item) => sum + item.total, 0);
  // Volume discount, rounded to the nearest 50 the way a rep would quote it.
  const discountRate = rng.weighted([[0, 45], [0.02, 25], [0.05, 20], [0.08, 10]] as const);
  const discount = Math.round((subtotal * discountRate) / 50) * 50;
  const shippingCost = rng.pick([0, 200, 350, 500, 800, 1200] as const);
  const totalAmount = subtotal - discount + shippingCost;

  const status = statusForAge(ageDays, rng);
  const paymentStatus = paymentStatusFor(status, rng);
  const rep = rng.pick(salesReps);
  const needsCourier = ["shipped", "delivered", "returned"].includes(status);
  const courierId = needsCourier ? rng.pick(COURIERS) : rng.chance(0.25) ? rng.pick(COURIERS) : null;

  const order: TOrder = {
    _id: code,
    orderNumber: code,
    customerId: customer._id,
    quotationId: rng.chance(0.28) ? `QUO-${10001 + rng.int(0, 40)}` : null,
    salesUserId: rep.id,
    status,
    items,
    subtotal,
    discount,
    shippingCost,
    totalAmount,
    paymentStatus,
    courierId,
    notes: rng.chance(0.7) ? rng.pick(ORDER_NOTES) : "",
    isArchived: rng.chance(0.04),
    archivedAt: null,
    archivedBy: null,
    archiveReason: null,
    createdAt: placedAt,
    updatedAt: placedAt,
  } as TOrder;

  if (order.isArchived) {
    order.archivedAt = addHours(placedAt, rng.int(48, 400));
    order.archivedBy = "USR-10001";
    order.archiveReason = "Superseded by a replacement order.";
  }

  const { payments, events } = buildLedgerAndTimeline(order, customer, rep, placedAt, rng);

  // A timeline advances hours per step, so an order placed near the anchor can
  // finish after it — and the UI then reports a delivery "in 17 hours". Slide
  // the whole order back by the overflow so its story stays in the past without
  // compressing the gaps between steps.
  const lastEventAt = events[events.length - 1]?.occurredAt;
  const overflowMs = lastEventAt ? lastEventAt.getTime() - anchor.getTime() : 0;

  if (overflowMs > 0) {
    shiftBack(order, payments, events, overflowMs);
  }

  return { order, payments, events };
}

/** Moves an order and everything attached to it back by a fixed interval. */
function shiftBack(
  order: TOrder,
  payments: TPayment[],
  events: TOrderEvent[],
  ms: number,
): void {
  const back = (date: Date) => new Date(date.getTime() - ms);

  if (order.createdAt) order.createdAt = back(order.createdAt);
  if (order.updatedAt) order.updatedAt = back(order.updatedAt);
  if (order.archivedAt) order.archivedAt = back(order.archivedAt);

  payments.forEach((payment) => {
    if (payment.paidAt) payment.paidAt = back(payment.paidAt);
    if (payment.createdAt) payment.createdAt = back(payment.createdAt);
    if (payment.updatedAt) payment.updatedAt = back(payment.updatedAt);
  });

  events.forEach((event) => {
    event.occurredAt = back(event.occurredAt);
    if (event.createdAt) event.createdAt = back(event.createdAt);
  });
}

/**
 * The order's money and its story, generated together.
 *
 * They have to agree: an order marked `paid` needs settled payment rows that sum
 * to its total, and the timeline entry announcing the payment has to sit between
 * the confirmation and the dispatch. Generating them in one pass is what keeps
 * the three consistent.
 */
function buildLedgerAndTimeline(
  order: TOrder,
  customer: TCustomer,
  rep: SalesRep,
  placedAt: Date,
  rng: Rng,
): { payments: TPayment[]; events: TOrderEvent[] } {
  const payments: TPayment[] = [];
  const events: TOrderEvent[] = [];

  let cursor = placedAt;
  let sequence = 0;

  const push = (
    type: TOrderEvent["type"],
    title: string,
    description: string,
    extra: Partial<TOrderEvent> = {},
  ) => {
    sequence += 1;
    events.push({
      // Deterministic id: same order, same step, same row on every run.
      _id: `EVT-${order._id}-${String(sequence).padStart(2, "0")}`,
      orderId: order._id,
      customerId: order.customerId,
      type,
      title,
      description,
      actorId: rep.id,
      actorName: rep.name,
      fromStatus: null,
      toStatus: null,
      amount: null,
      reference: null,
      occurredAt: cursor,
      createdAt: cursor,
      ...extra,
    } as TOrderEvent);
  };

  const advance = (minHours: number, maxHours: number) => {
    cursor = addHours(cursor, rng.int(minHours, maxHours));
  };

  push(
    "created",
    "Order placed",
    `${order.items.length} line item(s) totalling ${order.totalAmount} BDT for ${customer.name}.`,
    { toStatus: "pending", amount: order.totalAmount },
  );

  if (order.quotationId) {
    push("invoice", "Converted from quotation", `Raised against quotation ${order.quotationId}.`, {
      reference: order.quotationId,
    });
  }

  if (rng.chance(0.45)) {
    advance(1, 6);
    push("contact", "Customer contacted", "Sizes and delivery window confirmed over WhatsApp.");
  }

  const reachedConfirmed = order.status !== "pending";

  if (reachedConfirmed) {
    advance(2, 30);
    push("status_change", "Order confirmed", "Stock checked and the order accepted for fulfilment.", {
      fromStatus: "pending",
      toStatus: "confirmed",
    });
  }

  /* ------------------------------- Settlement ----------------------------- */

  const method = rng.weighted([
    ["bank_transfer", 40],
    ["mobile_banking", 30],
    ["cash", 20],
    ["card", 10],
  ] as const);

  const settledTotal =
    order.paymentStatus === "paid"
      ? order.totalAmount
      : order.paymentStatus === "partial"
        ? Math.round((order.totalAmount * rng.int(30, 70)) / 100 / 10) * 10
        : 0;

  if (settledTotal > 0) {
    advance(3, 40);

    // Larger settlements often arrive as an advance plus a balance.
    const instalments = order.paymentStatus === "paid" && rng.chance(0.35) ? 2 : 1;
    const firstAmount =
      instalments === 2 ? Math.round(settledTotal * 0.4 / 10) * 10 : settledTotal;

    const amounts = instalments === 2 ? [firstAmount, settledTotal - firstAmount] : [settledTotal];

    amounts.forEach((amount, i) => {
      if (i > 0) advance(24, 200);

      const paymentId = `PAY-${order._id.replace("ORD-", "")}${i + 1}`;

      payments.push({
        _id: paymentId,
        orderId: order._id,
        customerId: order.customerId,
        amount,
        method,
        transactionId: `TXN-${order._id.replace("ORD-", "")}${i + 1}`,
        status: "paid",
        paidAt: cursor,
        isArchived: false,
        archivedAt: null,
        archivedBy: null,
        archiveReason: null,
        createdAt: cursor,
        updatedAt: cursor,
      } as TPayment);

      push(
        "payment",
        amounts.length > 1 && i === 0 ? "Advance received" : "Payment received",
        `${amount} BDT via ${method.replace("_", " ")}.`,
        { amount, reference: `TXN-${order._id.replace("ORD-", "")}${i + 1}` },
      );
    });
  } else if (order.status !== "cancelled" && rng.chance(0.3)) {
    // An unpaid order that at least has an attempt on the ledger.
    advance(4, 30);

    payments.push({
      _id: `PAY-${order._id.replace("ORD-", "")}1`,
      orderId: order._id,
      customerId: order.customerId,
      amount: order.totalAmount,
      method,
      transactionId: `TXN-${order._id.replace("ORD-", "")}1`,
      status: rng.chance(0.6) ? "pending" : "failed",
      paidAt: null,
      isArchived: false,
      archivedAt: null,
      archivedBy: null,
      archiveReason: null,
      createdAt: cursor,
      updatedAt: cursor,
    } as TPayment);

    push("payment", "Payment awaited", `Invoice issued for ${order.totalAmount} BDT; not yet settled.`, {
      amount: order.totalAmount,
    });
  }

  /* ------------------------------ Fulfilment ------------------------------ */

  const pipeline: TOrderStatus[] = ["processing", "packed", "shipped", "delivered"];
  const reachedIndex = pipeline.indexOf(order.status);
  const terminal = order.status === "cancelled" || order.status === "returned";

  // A returned order went the whole way out before it came back.
  const walkTo = order.status === "returned" ? pipeline.length - 1 : reachedIndex;

  const labels: Record<string, { title: string; description: string }> = {
    processing: { title: "Moved to processing", description: "Picking started in the warehouse." },
    packed: { title: "Packed", description: "Items packed and labelled for dispatch." },
    shipped: {
      title: "Dispatched",
      description: order.courierId
        ? `Handed to ${COURIER_NAMES[order.courierId] ?? order.courierId}.`
        : "Handed to the courier.",
    },
    delivered: { title: "Delivered", description: "Delivery confirmed and the order closed." },
  };

  for (let i = 0; i <= walkTo; i += 1) {
    const stage = pipeline[i]!;
    advance(6, 60);

    push(
      stage === "shipped" ? "shipment" : "status_change",
      labels[stage]!.title,
      labels[stage]!.description,
      {
        fromStatus: i === 0 ? "confirmed" : pipeline[i - 1]!,
        toStatus: stage,
        ...(stage === "shipped" && order.courierId
          ? { reference: `TRK${order._id.replace(/\D/g, "")}${rng.int(100, 999)}` }
          : {}),
      },
    );
  }

  if (terminal) {
    advance(4, 72);

    if (order.status === "cancelled") {
      push("status_change", "Order cancelled", rng.pick([
        "Customer cancelled before dispatch.",
        "Stock unavailable in the requested sizes.",
        "Duplicate of an order already in progress.",
      ] as const), { fromStatus: "confirmed", toStatus: "cancelled" });
    } else {
      push("status_change", "Order returned", rng.pick([
        "Customer returned the consignment — sizing mismatch.",
        "Damaged in transit; return accepted.",
        "Returned unopened at the customer's request.",
      ] as const), { fromStatus: "delivered", toStatus: "returned" });
    }
  }

  if (order.isArchived && order.archivedAt) {
    cursor = order.archivedAt;
    push("archive", "Order archived", order.archiveReason ?? "Hidden from the active list.", {
      actorId: "USR-10001",
      actorName: "Taojoo Admin",
    });
  }

  return { payments, events };
}

/* -------------------------------------------------------------------------- */
/* Persistence                                                                 */
/* -------------------------------------------------------------------------- */

/**
 * Upserts in batches, keyed on the business id.
 *
 * `timestamps: false` matters: with Mongoose's automatic timestamps on, the
 * seeded `createdAt` is overwritten with the current time, every record lands on
 * today, and every date filter and trend chart collapses to a single day.
 */
async function upsertAll<T extends { _id: string }>(
  label: string,
  // The four models have unrelated document types; the write path is identical.
  model: { bulkWrite: (ops: never, options: { timestamps: boolean }) => Promise<unknown> },
  rows: T[],
  batchSize = 500,
): Promise<void> {
  if (rows.length === 0) {
    console.log(`  ${label.padEnd(14)} 0`);
    return;
  }

  for (let start = 0; start < rows.length; start += batchSize) {
    const batch = rows.slice(start, start + batchSize).map((row) => {
      const { _id, ...rest } = row;
      return {
        updateOne: {
          filter: { _id },
          update: { $set: rest, $setOnInsert: { _id } },
          upsert: true,
        },
      };
    });

    await model.bulkWrite(batch as never, { timestamps: false });
  }

  console.log(`  ${label.padEnd(14)} ${rows.length}`);
}

/* -------------------------------------------------------------------------- */
/* Entry point                                                                 */
/* -------------------------------------------------------------------------- */

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  const rng = createRng(20260813);

  await connectDatabase();

  if (args.fresh) {
    console.log("\nClearing CRM collections…");
    await Promise.all([
      Customer.deleteMany({}),
      Product.deleteMany({}),
      Order.deleteMany({}),
      Payment.deleteMany({}),
      OrderEvent.deleteMany({}),
      ActivityLog.deleteMany({}),
    ]);
  }

  console.log("\nSeeding demo accounts (one per role):");
  await seedDemoUsers();

  console.log("\nGenerating…");

  const salesReps = await loadSalesReps();
  console.log(`  attributing orders to ${salesReps.length} staff account(s)`);

  const products = buildProducts(args.products, rng);
  const customers = buildCustomers(args.customers, args.anchor, args.months, rng);

  const orders: TOrder[] = [];
  const payments: TPayment[] = [];
  const events: TOrderEvent[] = [];

  for (let i = 0; i < args.orders; i += 1) {
    // Weighted towards the front of the list, so a handful of accounts read as
    // key wholesale customers rather than everyone ordering exactly alike.
    const pool = rng.chance(0.45) ? Math.min(10, customers.length) : customers.length;
    const customer = customers[rng.int(0, pool - 1)]!;

    const generated = buildOrder(i, customer, products, salesReps, args.anchor, rng);

    orders.push(generated.order);
    payments.push(...generated.payments);
    events.push(...generated.events);
  }

  // Roll the customer counters up from the orders actually generated, so the
  // customer list and the order list cannot disagree.
  const rollups = new Map<string, { count: number; spent: number; lastId: string; lastAt: Date }>();

  for (const order of orders) {
    if (order.status === "cancelled") continue;

    const current = rollups.get(order.customerId);
    const placedAt = order.createdAt ?? args.anchor;

    if (!current || placedAt > current.lastAt) {
      rollups.set(order.customerId, {
        count: (current?.count ?? 0) + 1,
        spent: (current?.spent ?? 0) + order.totalAmount,
        lastId: order._id,
        lastAt: placedAt,
      });
    } else {
      current.count += 1;
      current.spent += order.totalAmount;
    }
  }

  for (const customer of customers) {
    const rollup = rollups.get(customer._id);
    customer.totalOrders = rollup?.count ?? 0;
    customer.totalSpent = rollup?.spent ?? 0;
    customer.lastOrderId = rollup?.lastId ?? null;
    customer.lastOrderDate = rollup?.lastAt ?? null;
  }

  // A system-wide audit trail alongside the per-order timelines.
  const activity = orders.slice(0, 250).map((order, i) => ({
    _id: `ACT-D${String(i + 1).padStart(4, "0")}`,
    actorId: order.salesUserId,
    action: rng.pick([
      "Updated order status",
      "Created invoice",
      "Verified payment",
      "Edited customer profile",
      "Exported order report",
    ] as const),
    entityType: "order" as const,
    entityId: order._id,
    customerId: order.customerId,
    ipAddress: `103.11.${rng.int(20, 60)}.${rng.int(10, 240)}`,
    createdAt: order.createdAt ?? args.anchor,
  }));

  console.log("\nWriting:");
  await upsertAll("products", Product, products);
  await upsertAll("customers", Customer, customers);
  await upsertAll("orders", Order, orders);
  await upsertAll("payments", Payment, payments);
  await upsertAll("timeline", OrderEvent, events);
  await upsertAll("activity", ActivityLog, activity);

  await report(args);

  await disconnectDatabase();
  process.exit(0);
}

/** Prints what is now in the database, so the seed doubles as a sanity check. */
async function report(args: Args): Promise<void> {
  const [customerCount, productCount, orderCount, paymentCount, eventCount] = await Promise.all([
    Customer.countDocuments(),
    Product.countDocuments(),
    Order.countDocuments(),
    Payment.countDocuments(),
    OrderEvent.countDocuments(),
  ]);

  console.log(
    `\nTotals — customers ${customerCount}, products ${productCount}, orders ${orderCount}, ` +
      `payments ${paymentCount}, timeline ${eventCount}`,
  );

  const byStatus = await Order.aggregate<{ _id: string; n: number; value: number }>([
    { $group: { _id: "$status", n: { $sum: 1 }, value: { $sum: "$totalAmount" } } },
    { $sort: { n: -1 } },
  ]);

  console.log("\nOrders by status:");
  byStatus.forEach((row) =>
    console.log(`  ${String(row._id).padEnd(12)} ${String(row.n).padStart(5)}   ${row.value.toLocaleString("en-US")} BDT`),
  );

  const bySettlement = await Order.aggregate<{ _id: string; n: number }>([
    { $group: { _id: "$paymentStatus", n: { $sum: 1 } } },
    { $sort: { n: -1 } },
  ]);

  console.log("\nOrders by settlement:");
  bySettlement.forEach((row) => console.log(`  ${String(row._id).padEnd(12)} ${String(row.n).padStart(5)}`));

  const months = await Order.aggregate<{ _id: string; n: number }>([
    { $group: { _id: { $dateToString: { format: "%Y-%m", date: "$createdAt" } }, n: { $sum: 1 } } },
    { $sort: { _id: 1 } },
  ]);

  console.log(`\nOrders per month (${months.length} months to ${args.anchor.toISOString().slice(0, 10)}):`);
  months.forEach((row) => console.log(`  ${row._id}  ${"█".repeat(Math.ceil(row.n / 3))} ${row.n}`));

  console.log("");
}

main().catch(async (error) => {
  console.error("\nSeeding failed:", error instanceof Error ? error.message : error, "\n");
  await disconnectDatabase().catch(() => undefined);
  process.exit(1);
});
