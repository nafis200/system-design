import type { Model } from "mongoose";

/**
 * Business-key generation.
 *
 * Records are keyed by a human-readable code (`CUS-10006`, `QUO-10012`) rather
 * than an ObjectId, because those codes are what appears on invoices and what
 * staff quote to each other. This mints the next one in a prefixed sequence.
 *
 * The max is taken with an aggregation over the numeric suffix, so `ORD-9`
 * cannot outrank `ORD-10` the way a lexical sort would, and the whole id set
 * never has to be pulled into memory.
 *
 * NOTE: this reads then writes, so two simultaneous creates can pick the same
 * code. A dedicated counters collection with findOneAndUpdate($inc) is the fix
 * if record creation ever becomes highly concurrent.
 */
export async function nextCode<T>(
  model: Model<T>,
  prefix: string,
  start = 10001,
): Promise<string> {
  const [result] = await model.aggregate<{ maxCode: number | null }>([
    { $match: { _id: { $regex: `^${prefix}-\\d+$` } } },
    {
      $project: {
        num: { $toInt: { $arrayElemAt: [{ $split: ["$_id", "-"] }, 1] } },
      },
    },
    { $group: { _id: null, maxCode: { $max: "$num" } } },
  ]);

  const highest = result?.maxCode ?? start - 1;

  return `${prefix}-${highest + 1}`;
}

/**
 * Time-ordered id for append-only rows (timeline entries, stock movements).
 *
 * These are written on every state change and never quoted to anyone, so a
 * collision-prone max() scan per insert would be both slower and less safe than
 * a timestamp with a random suffix.
 */
export function eventId(prefix: string, when: Date = new Date()): string {
  const stamp = when.getTime().toString(36);
  const suffix = Math.random().toString(36).slice(2, 8);
  return `${prefix}-${stamp}-${suffix}`;
}
