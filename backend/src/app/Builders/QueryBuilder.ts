import { type Query, type QueryFilter } from 'mongoose';

/** Hard ceiling on `?limit=`, so one request cannot ask for the whole collection. */
const MAX_PAGE_SIZE = 100;
const DEFAULT_PAGE_SIZE = 10;

/** Reserved by the builder itself; never treated as a filter field. */
const CONTROL_PARAMS = ['searchTerm', 'sort', 'limit', 'page', 'fields'];

/** Regex metacharacters, escaped so a search term cannot become a pattern. */
const REGEX_SPECIALS = /[.*+?^${}()|[\]\\]/g;

interface QueryBuilderOptions {
  /**
   * Fields a client is allowed to filter and sort on. Anything else in the query
   * string is ignored.
   *
   * Without this, arbitrary query parameters reached `.find()` — so
   * `?passwordHash[$regex]=^a` became an oracle for brute-forcing hashes.
   */
  allowedFilters?: string[];
  /**
   * Fields a client may request via `?fields=`. Anything else is dropped.
   *
   * Without this, `?fields=passwordHash` overrode the schema's `select: false`
   * and returned every user's bcrypt hash.
   */
  selectableFields?: string[];
  /**
   * Fields whose `<field>From` / `<field>To` range is numeric rather than a
   * date, e.g. `sellingPrice`. Without listing a field here, its range is
   * parsed as a `Date` — which silently drops a plain number and matches
   * nothing, since `new Date("100")` is not a valid date.
   */
  numericRangeFields?: string[];
  /** Always removed from the projection, whatever the client asks for. */
  neverSelect?: string[];
  maxPageSize?: number;
}

class QueryBuilder<T> {
  public modelQuery: Query<T[], T>;
  public query: Record<string, unknown>;

  private readonly allowedFilters: string[] | undefined;
  private readonly selectableFields: string[] | undefined;
  private readonly numericRangeFields: string[];
  private readonly neverSelect: string[];
  private readonly maxPageSize: number;

  constructor(
    modelQuery: Query<T[], T>,
    query: Record<string, unknown>,
    options: QueryBuilderOptions = {},
  ) {
    this.modelQuery = modelQuery;
    this.query = query;
    this.allowedFilters = options.allowedFilters;
    this.selectableFields = options.selectableFields;
    this.numericRangeFields = options.numericRangeFields ?? [];
    this.neverSelect = options.neverSelect ?? ['passwordHash', '__v'];
    this.maxPageSize = options.maxPageSize ?? MAX_PAGE_SIZE;
  }

  search(searchableFields: string[]) {
    const searchTerm = this.query?.searchTerm;

    if (typeof searchTerm !== 'string' || !searchTerm.trim() || searchableFields.length === 0) {
      return this;
    }

    // Escaped, length-capped, and anchored to a substring match: an unescaped
    // term like `(a+)+$` is a catastrophic-backtracking denial of service.
    const safeTerm = searchTerm.trim().slice(0, 100).replace(REGEX_SPECIALS, '\\$&');

    this.modelQuery = this.modelQuery.find({
      $or: searchableFields.map((field) => ({
        [field]: { $regex: safeTerm, $options: 'i' },
      })),
    } as QueryFilter<T>);

    return this;
  }

  filter() {
    const queryObj: Record<string, unknown> = {};
    const ranges: Record<string, { $gte?: Date | number; $lte?: Date | number }> = {};

    for (const [key, value] of Object.entries(this.query ?? {})) {
      if (CONTROL_PARAMS.includes(key)) continue;

      // Only scalars. Objects and arrays are how operator injection arrives.
      if (value === null || typeof value === 'object') continue;

      // Ranges arrive as `<field>From` / `<field>To` rather than as Mongo
      // operators, because the request sanitiser strips `$`-prefixed keys before
      // they ever reach here. Most range fields are dates; `numericRangeFields`
      // lists the ones that are plain numbers instead (e.g. `sellingPrice`) —
      // `new Date("100")` is not a valid date, so treating a numeric field as a
      // date silently drops the bound and matches everything.
      const rangeMatch = /^(.*?)(From|To)$/.exec(key);

      if (rangeMatch) {
        const [, field, bound] = rangeMatch;

        if (field && this.allowedFilters?.includes(field)) {
          if (this.numericRangeFields.includes(field)) {
            const parsed = Number(value);

            if (Number.isFinite(parsed)) {
              ranges[field] ??= {};
              ranges[field]![bound === 'From' ? '$gte' : '$lte'] = parsed;
            }

            continue;
          }

          const parsed = new Date(String(value));

          if (!Number.isNaN(parsed.getTime())) {
            ranges[field] ??= {};

            if (bound === 'From') {
              ranges[field]!.$gte = parsed;
            } else {
              // A bare `YYYY-MM-DD` upper bound means "the whole of that day",
              // otherwise a same-day range would match nothing.
              const isDateOnly = /^\d{4}-\d{2}-\d{2}$/.test(String(value));
              ranges[field]!.$lte = isDateOnly
                ? new Date(parsed.getTime() + 24 * 60 * 60 * 1000 - 1)
                : parsed;
            }
          }

          continue;
        }
      }

      // Allow-list, not deny-list: an unknown field is dropped rather than
      // forwarded to Mongo.
      if (this.allowedFilters && !this.allowedFilters.includes(key)) continue;

      queryObj[key] = value;
    }

    this.modelQuery = this.modelQuery.find({
      ...queryObj,
      ...ranges,
    } as QueryFilter<T>);

    return this;
  }

  sort() {
    const requested = typeof this.query?.sort === 'string' ? this.query.sort : '';

    const fields = requested
      .split(',')
      .map((field) => field.trim())
      .filter(Boolean)
      .filter((field) => {
        const name = field.replace(/^-/, '');
        return this.allowedFilters ? this.allowedFilters.includes(name) : true;
      });

    // Ties in a non-unique sort key make pagination unstable — the same document
    // can appear on two pages. `_id` breaks those ties deterministically.
    const sortSpec = fields.length > 0 ? `${fields.join(' ')} -_id` : '-createdAt -_id';

    this.modelQuery = this.modelQuery.sort(sortSpec);

    return this;
  }

  paginate() {
    const { page, limit, skip } = this.pagination();

    this.modelQuery = this.modelQuery.skip(skip).limit(limit);

    void page;

    return this;
  }

  fields() {
    const requested = typeof this.query?.fields === 'string' ? this.query.fields : '';

    const selected = requested
      .split(',')
      .map((field) => field.trim().replace(/^[+-]/, ''))
      .filter(Boolean)
      .filter((field) => !this.neverSelect.includes(field))
      .filter((field) => (this.selectableFields ? this.selectableFields.includes(field) : true));

    if (selected.length > 0) {
      this.modelQuery = this.modelQuery.select(selected.join(' '));
    } else {
      // Default projection: everything except the fields that must never leave
      // the server.
      this.modelQuery = this.modelQuery.select(
        this.neverSelect.map((field) => `-${field}`).join(' '),
      );
    }

    return this;
  }

  /** Returns plain objects instead of hydrated documents — materially cheaper on list endpoints. */
  lean() {
    this.modelQuery = this.modelQuery.lean() as unknown as Query<T[], T>;
    return this;
  }

  private pagination() {
    const rawPage = Number(this.query?.page);
    const rawLimit = Number(this.query?.limit);

    const page = Number.isFinite(rawPage) && rawPage >= 1 ? Math.floor(rawPage) : 1;
    const limit =
      Number.isFinite(rawLimit) && rawLimit >= 1
        ? Math.min(Math.floor(rawLimit), this.maxPageSize)
        : DEFAULT_PAGE_SIZE;

    return { page, limit, skip: (page - 1) * limit };
  }

  async countTotal() {
    const { page, limit } = this.pagination();

    const total = await this.modelQuery.model.countDocuments(this.modelQuery.getFilter());

    return {
      page,
      limit,
      total,
      totalPage: Math.max(1, Math.ceil(total / limit)),
    };
  }
}

export default QueryBuilder;
