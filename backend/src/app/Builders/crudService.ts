import httpStatus from "http-status-codes";
import type { Model, QueryFilter } from "mongoose";

import QueryBuilder from "./QueryBuilder";
import { archiveFilter, scopeFromQuery, type ArchivableFields } from "./archivable";
import ApiError from "../errors/ApiError";

/**
 * Shared read/archive behaviour for the business collections.
 *
 * Customers, products, orders and payments all need the same thing: a paginated,
 * searchable, filterable list that hides archived rows by default, plus fetch,
 * archive and restore. Writing that four times invites four slightly different
 * pagination bugs, so it lives here and each module supplies only its field
 * names.
 */

export interface CrudServiceOptions<T> {
  /** Human-readable name used in error messages, e.g. "Order". */
  label: string;
  model: Model<T>;
  /** Fields the `searchTerm` parameter matches against. */
  searchableFields: string[];
  /** Fields a client may filter and sort on. */
  allowedFilters: string[];
  /** Fields a client may request through `?fields=`. */
  selectableFields: string[];
  /** Allowed-filter fields whose `From`/`To` range is numeric, not a date. */
  numericRangeFields?: string[];
  /** Fields never returned, whatever is requested. */
  neverSelect?: string[];
  /** Extra filter always applied, e.g. scoping to one customer. */
  baseFilter?: QueryFilter<T>;
}

export interface ListResult<T> {
  meta: { page: number; limit: number; total: number; totalPage: number };
  data: T[];
}

export function createCrudService<T extends ArchivableFields>(
  options: CrudServiceOptions<T>,
) {
  const {
    label,
    model,
    searchableFields,
    allowedFilters,
    selectableFields,
    numericRangeFields = [],
    neverSelect = ["__v"],
    baseFilter = {},
  } = options;

  /**
   * Paginated list. `archived` selects the scope (`active` by default, plus
   * `true`/`all`), `searchTerm` searches, and any allow-listed field filters.
   */
  const list = async (
    query: Record<string, unknown>,
    extraFilter: QueryFilter<T> = {},
  ): Promise<ListResult<T>> => {
    const scope = scopeFromQuery(query);

    const builder = new QueryBuilder<T>(
      model.find({
        ...baseFilter,
        ...extraFilter,
        ...archiveFilter(scope),
      } as QueryFilter<T>),
      query,
      { allowedFilters, selectableFields, neverSelect, numericRangeFields },
    )
      .search(searchableFields)
      .filter()
      .sort()
      .paginate()
      .fields()
      .lean();

    const [data, meta] = await Promise.all([
      builder.modelQuery,
      builder.countTotal(),
    ]);

    return { meta, data: data as T[] };
  };

  const findById = async (id: string): Promise<T> => {
    const found = await model.findById(id).lean<T | null>();

    if (!found) {
      throw new ApiError(httpStatus.NOT_FOUND, `${label} not found`);
    }

    return found;
  };

  /**
   * Archives a record. Idempotent: archiving something already archived is a
   * no-op rather than an error, so a retried request does not fail.
   */
  const archive = async (
    id: string,
    actorId: string,
    reason?: string,
  ): Promise<T> => {
    const updated = await model
      .findByIdAndUpdate(
        id,
        {
          $set: {
            isArchived: true,
            archivedAt: new Date(),
            archivedBy: actorId,
            archiveReason: reason ?? null,
          },
        },
        { new: true },
      )
      .lean<T | null>();

    if (!updated) {
      throw new ApiError(httpStatus.NOT_FOUND, `${label} not found`);
    }

    return updated;
  };

  const restore = async (id: string): Promise<T> => {
    const updated = await model
      .findByIdAndUpdate(
        id,
        {
          $set: {
            isArchived: false,
            archivedAt: null,
            archivedBy: null,
            archiveReason: null,
          },
        },
        { new: true },
      )
      .lean<T | null>();

    if (!updated) {
      throw new ApiError(httpStatus.NOT_FOUND, `${label} not found`);
    }

    return updated;
  };

  return { list, findById, archive, restore, model, label };
}

export type CrudService<T extends ArchivableFields> = ReturnType<
  typeof createCrudService<T>
>;
