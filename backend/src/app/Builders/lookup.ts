import type { Model, QueryFilter } from "mongoose";

import { User } from "../modules/user.model";

/**
 * Batched name resolution.
 *
 * Every collection stores ids, and every screen shows names. Resolving them
 * here — one batched lookup per page, regardless of page size — keeps the
 * display correct for the whole database without denormalising names onto each
 * record and letting them drift.
 */

/** `_id -> doc` map for a set of ids, skipping the query when there are none. */
export async function lookupById<T extends { _id: string }>(
  model: Model<T>,
  ids: (string | null | undefined)[],
  fields: string,
): Promise<Map<string, T>> {
  const unique = [...new Set(ids.filter((id): id is string => Boolean(id)))];
  if (unique.length === 0) return new Map();

  const rows = await model
    .find({ _id: { $in: unique } } as QueryFilter<T>)
    .select(fields)
    .lean<T[]>();

  return new Map(rows.map((row) => [row._id, row]));
}

/** Staff ids are Mongo ObjectIds; anything else would throw on cast. */
const OBJECT_ID = /^[0-9a-f]{24}$/i;

/** `userId -> name` for a set of staff ids, ignoring anything not an ObjectId. */
export async function lookupStaffNames(
  ids: (string | null | undefined)[],
): Promise<Map<string, string>> {
  const unique = [...new Set(ids.filter((id): id is string => OBJECT_ID.test(id ?? "")))];
  if (unique.length === 0) return new Map();

  const rows = await User.find({ _id: { $in: unique } })
    .select("name")
    .lean<{ _id: unknown; name?: string }[]>();

  return new Map(rows.map((row) => [String(row._id), row.name ?? ""]));
}
