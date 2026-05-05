import { z } from "zod";
import type { Prisma } from "@/generated/prisma/client";
import {
  EXCHANGES,
  LYNCH_CATEGORIES,
  NUMERIC_FIELD_IDS,
  SORTABLE_FIELDS,
  type ExchangeId,
  type LynchCategoryId,
  type NumericFieldId,
  type SortableField,
} from "./fields";

// ─── Schema (validated at the API and URL boundary) ──────────────────────

const RangeSchema = z
  .object({
    min: z.number().finite().optional(),
    max: z.number().finite().optional(),
  })
  .refine((r) => r.min == null || r.max == null || r.min <= r.max, {
    message: "min must be ≤ max",
  });

// Use a string-keyed record + post-parse filter to known field IDs.
// (Zod's enum-keyed record types as a strict Record where every key is required,
// which doesn't match our actual semantics — keys are optional.)
const KNOWN_IDS = new Set<string>(NUMERIC_FIELD_IDS);

export const FilterSchema = z.object({
  ranges: z
    .record(z.string(), RangeSchema)
    .default({})
    .transform((r) => {
      const out: Partial<Record<NumericFieldId, { min?: number; max?: number }>> = {};
      for (const [k, v] of Object.entries(r)) {
        if (KNOWN_IDS.has(k)) out[k as NumericFieldId] = v;
      }
      return out;
    }),
  exchanges: z.array(z.enum(EXCHANGES)).default([]),
  sectors: z.array(z.string()).default([]),
  lynchCategories: z.array(z.enum(LYNCH_CATEGORIES)).default([]),
  search: z.string().trim().max(64).optional(),
  sort: z
    .enum([
      "symbol",
      "pe",
      "peg",
      "priceToBook",
      "marketCapBn",
      "epsGrowth5y",
      "revenueGrowth5y",
      "dividendYield",
      "roe",
      "profitMargin",
      "debtToEquity",
      "beta",
    ])
    .default("symbol"),
  dir: z.enum(["asc", "desc"]).default("asc"),
  page: z.number().int().positive().default(1),
  pageSize: z.number().int().min(10).max(200).default(50),
});

export type ScreenerFilter = z.infer<typeof FilterSchema>;

// ─── URL ↔ Filter ────────────────────────────────────────────────────────

/** Decode `URLSearchParams` (or a plain object from Next's `searchParams`) into a Filter. */
export function filterFromSearchParams(
  raw: Record<string, string | string[] | undefined> | URLSearchParams,
): ScreenerFilter {
  const get = (key: string): string | undefined => {
    if (raw instanceof URLSearchParams) return raw.get(key) ?? undefined;
    const v = raw[key];
    return Array.isArray(v) ? v[0] : v;
  };

  const ranges: Record<string, { min?: number; max?: number }> = {};
  for (const id of NUMERIC_FIELD_IDS) {
    const minStr = get(`${id}.min`);
    const maxStr = get(`${id}.max`);
    const range: { min?: number; max?: number } = {};
    if (minStr != null && minStr !== "") {
      const n = Number(minStr);
      if (Number.isFinite(n)) range.min = n;
    }
    if (maxStr != null && maxStr !== "") {
      const n = Number(maxStr);
      if (Number.isFinite(n)) range.max = n;
    }
    if (range.min != null || range.max != null) ranges[id] = range;
  }

  const exchanges = (get("exchange") ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  const sectors = (get("sector") ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  const lynchCategories = (get("lynch") ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  const sort = get("sort") ?? "symbol";
  const dir = get("dir") ?? "asc";
  const page = Number(get("page") ?? "1");
  const pageSize = Number(get("pageSize") ?? "50");
  const search = get("q");

  const parsed = FilterSchema.safeParse({
    ranges,
    exchanges,
    sectors,
    lynchCategories,
    search,
    sort,
    dir,
    page: Number.isFinite(page) ? page : 1,
    pageSize: Number.isFinite(pageSize) ? pageSize : 50,
  });

  if (!parsed.success) {
    return FilterSchema.parse({});
  }
  return parsed.data;
}

/** Encode a Filter into stable, sorted search params for shareable URLs. */
export function filterToSearchParams(filter: ScreenerFilter): URLSearchParams {
  const sp = new URLSearchParams();
  for (const [id, range] of Object.entries(filter.ranges ?? {})) {
    if (range?.min != null) sp.set(`${id}.min`, String(range.min));
    if (range?.max != null) sp.set(`${id}.max`, String(range.max));
  }
  if (filter.exchanges.length) sp.set("exchange", filter.exchanges.join(","));
  if (filter.sectors.length) sp.set("sector", filter.sectors.join(","));
  if (filter.lynchCategories.length) sp.set("lynch", filter.lynchCategories.join(","));
  if (filter.search) sp.set("q", filter.search);
  if (filter.sort !== "symbol") sp.set("sort", filter.sort);
  if (filter.dir !== "asc") sp.set("dir", filter.dir);
  if (filter.page !== 1) sp.set("page", String(filter.page));
  if (filter.pageSize !== 50) sp.set("pageSize", String(filter.pageSize));
  return sp;
}

// ─── Filter → Prisma where ───────────────────────────────────────────────

const FIELD_TO_COLUMN: Record<NumericFieldId, string> = {
  pe: "pe",
  peg: "peg",
  priceToBook: "priceToBook",
  marketCapBn: "marketCap", // user-facing in B; we scale at query time
  epsGrowth5y: "epsGrowth5y",
  revenueGrowth5y: "revenueGrowth5y",
  dividendYield: "dividendYield",
  roe: "roe",
  profitMargin: "profitMargin",
  debtToEquity: "debtToEquity",
  beta: "beta",
};

/**
 * Build the Stock + StockFundamentals filter clause.
 *
 * Numeric fields live on StockFundamentals; exchange/sector/search live on Stock.
 * We use a relation filter on Stock (`fundamentals: { ... }`) so a single query
 * pulls both. Stocks without fundamentals are excluded only if at least one
 * numeric range is set; otherwise they remain visible (with "—" cells).
 */
export function buildStockWhere(filter: ScreenerFilter): Prisma.StockWhereInput {
  const where: Prisma.StockWhereInput = { isActive: true };

  if (filter.exchanges.length) {
    where.exchange = { in: filter.exchanges as ExchangeId[] };
  }
  if (filter.sectors.length) {
    where.sector = { in: filter.sectors };
  }
  if (filter.search) {
    where.OR = [
      { symbol: { contains: filter.search, mode: "insensitive" } },
      { name: { contains: filter.search, mode: "insensitive" } },
    ];
  }

  const fundFilter: Prisma.StockFundamentalsWhereInput = {};
  let hasFundClause = false;

  if (filter.lynchCategories.length) {
    fundFilter.lynchCategory = { in: filter.lynchCategories as LynchCategoryId[] };
    hasFundClause = true;
  }

  for (const [id, range] of Object.entries(filter.ranges ?? {})) {
    const fid = id as NumericFieldId;
    const col = FIELD_TO_COLUMN[fid];
    if (!col || !range) continue;

    // marketCapBn is in billions; underlying column is in raw units.
    const scale = fid === "marketCapBn" ? 1_000_000_000 : 1;
    const clause: Record<string, number | bigint> = {};
    if (range.min != null) clause.gte = scaleForCol(col, range.min, scale);
    if (range.max != null) clause.lte = scaleForCol(col, range.max, scale);

    if (Object.keys(clause).length > 0) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (fundFilter as any)[col] = clause;
      hasFundClause = true;
    }
  }

  if (hasFundClause) {
    where.fundamentals = { ...fundFilter };
  }

  return where;
}

function scaleForCol(col: string, value: number, scale: number): number | bigint {
  if (col === "marketCap") {
    return BigInt(Math.trunc(value * scale));
  }
  return value * scale;
}

// ─── Sort → Prisma orderBy ───────────────────────────────────────────────

export function buildOrderBy(
  sort: SortableField,
  dir: "asc" | "desc",
): Prisma.StockOrderByWithRelationInput | Prisma.StockOrderByWithRelationInput[] {
  if (sort === "symbol") return { symbol: dir };
  // All other sortable fields are on the fundamentals relation.
  // Prisma orderBy on a relation needs the relation key.
  const col = FIELD_TO_COLUMN[sort as NumericFieldId];
  if (!col) return { symbol: dir };
  return { fundamentals: { [col]: dir } } as Prisma.StockOrderByWithRelationInput;
}
