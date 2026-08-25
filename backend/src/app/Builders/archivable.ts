import { type Schema } from "mongoose";

/**
 * Archive (soft delete) support.
 *
 * Business records are archived rather than deleted: an order or payment that
 * vanishes takes its financial history with it, and a customer row is referenced
 * by orders that would become orphans. Archived documents stay queryable for
 * audit and can be restored.
 *
 * Applying this plugin adds the fields, an index, and a default scope that hides
 * archived rows unless a query explicitly asks for them.
 */

export interface ArchivableFields {
  isArchived: boolean;
  archivedAt?: Date | null;
  /** User id of whoever archived it. */
  archivedBy?: string | null;
  archiveReason?: string | null;
}

/** Query option callers set to include or isolate archived rows. */
export type ArchiveScope = "active" | "archived" | "all";

export function archivablePlugin(schema: Schema): void {
  schema.add({
    isArchived: {
      type: Boolean,
      default: false,
      index: true,
    },
    archivedAt: {
      type: Date,
      default: null,
    },
    archivedBy: {
      type: String,
      default: null,
    },
    archiveReason: {
      type: String,
      default: null,
    },
  });

  // Most list queries filter on archive state then sort by recency.
  schema.index({ isArchived: 1, createdAt: -1 });
}

/**
 * Translates a scope into a Mongo filter fragment.
 *
 * `active` is the default everywhere, so a forgotten scope hides archived rows
 * rather than silently exposing them.
 */
export function archiveFilter(scope: ArchiveScope = "active"): Record<string, unknown> {
  if (scope === "all") return {};
  if (scope === "archived") return { isArchived: true };
  return { isArchived: { $ne: true } };
}

/** Reads the `archived` query parameter into a scope. */
export function scopeFromQuery(query: Record<string, unknown>): ArchiveScope {
  const value = String(query.archived ?? "").toLowerCase();

  if (value === "true" || value === "only") return "archived";
  if (value === "all") return "all";
  return "active";
}
