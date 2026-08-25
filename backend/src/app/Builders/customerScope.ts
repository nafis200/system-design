import httpStatus from "http-status-codes";
import type { Request } from "express";

import ApiError from "../errors/ApiError";
import { Customer } from "../modules/crm/crm.model";
import type { TCustomer } from "../modules/crm/crm.interface";

/**
 * Portal scoping.
 *
 * The quotation, order and payment list endpoints are shared between staff and
 * the customer portal. Staff may filter by any `customerId`; a buyer must not
 * be able to, or the portal becomes a way to read every other customer's
 * pricing by editing a query parameter.
 *
 * So for the `customer` role the filter is not validated — it is *replaced*
 * with the caller's own customer id, whatever they asked for. Anything a client
 * sends is therefore irrelevant rather than merely checked, which is the only
 * version of this that stays correct when a new filter is added later.
 */

/** Resolves the customer record attached to a signed-in portal account. */
export async function customerForUser(userId: string): Promise<TCustomer | null> {
  return Customer.findOne({ userId }).lean<TCustomer | null>();
}

/**
 * Extra filter to apply to a list endpoint for the current caller.
 *
 * Staff get an empty filter — they see everything the endpoint exposes. A
 * customer gets pinned to their own record.
 *
 * A portal account with no customer record is an error rather than an empty
 * list: it means registration half-completed, and silently showing "no orders"
 * would hide a real problem from both the buyer and support.
 */
export async function portalScope(req: Request): Promise<Record<string, unknown>> {
  if (req.user?.role !== "customer") return {};

  const userId = req.user?.userId;

  if (!userId) {
    throw new ApiError(httpStatus.UNAUTHORIZED, "Sign in to view this.");
  }

  const customer = await customerForUser(userId);

  if (!customer) {
    throw new ApiError(
      httpStatus.FORBIDDEN,
      "This account is not linked to a customer record yet. Contact your sales representative.",
    );
  }

  return { customerId: customer._id };
}
