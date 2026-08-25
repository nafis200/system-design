import express from "express";

import { AccountRoutes } from "../modules/accounts/accounts.route";
import { CrmRoutes } from "../modules/crm/crm.route";
import { SalesRoutes } from "../modules/sales/sales.route";
import { SearchRoutes } from "../modules/search/search.route";
import { SettingsRoutes } from "../modules/settings/settings.route";
import { SupplyRoutes } from "../modules/supply/supply.route";
import { UserRoutes } from "../modules/user_route";

const router = express.Router();

/**
 * All three business modules mount at `/api` directly rather than under a
 * per-module prefix, because the resources they own are peers as far as a
 * client is concerned: `/api/customers`, `/api/leads` and `/api/inventory` are
 * one API, not three. The split into modules is how the server is organised,
 * not something callers should have to know about.
 */
const moduleRoutes = [
  // Portal account management. Mounted before UserRoutes because it declares
  // `/auth/:id/reset-link`, which the bare `/auth/:id` handler there would
  // otherwise swallow as an account id.
  { path: "/", route: AccountRoutes },

  { path: "/auth", route: UserRoutes },

  // Branding, order pipeline, order statuses, payment methods.
  { path: "/", route: SettingsRoutes },
  // Customers, products, orders, payments, invoices, notes.
  { path: "/", route: CrmRoutes },
  // Leads, calls, messages, follow-ups, quotations.
  { path: "/", route: SalesRoutes },
  // Suppliers, warehouses, inventory, purchase orders, couriers, shipments.
  { path: "/", route: SupplyRoutes },
  // Cross-collection search, powering the console's command palette.
  { path: "/", route: SearchRoutes },
];

moduleRoutes.forEach((route) => router.use(route.path, route.route));

export default router;
