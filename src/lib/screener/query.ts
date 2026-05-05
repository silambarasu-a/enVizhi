import { prisma } from "@/lib/prisma";
import {
  buildOrderBy,
  buildStockWhere,
  type ScreenerFilter,
} from "./dsl";

import type { LynchCategory } from "@/generated/prisma/enums";

export interface ScreenerRow {
  id: string;
  symbol: string;
  exchange: string;
  name: string;
  sector: string | null;
  currency: string;
  fundamentals: {
    pe: number | null;
    peg: number | null;
    modifiedPeg: number | null;
    fairPe: number | null;
    lynchCategory: LynchCategory | null;
    marketCap: bigint | null;
    epsGrowth5y: number | null;
    revenueGrowth5y: number | null;
    dividendYield: number | null;
    roe: number | null;
    profitMargin: number | null;
    debtToEquity: number | null;
    beta: number | null;
    priceToBook: number | null;
    syncedAt: Date | null;
  } | null;
}

export interface ScreenerResult {
  rows: ScreenerRow[];
  total: number;
  page: number;
  pageSize: number;
}

/**
 * Run the screener against the entire shared Stock pool.
 *
 *   The fully-live rewrite removed the seeded global universe, so the Stock
 *   table only ever contains tickers someone has actually interacted with —
 *   ⌘K-clicked, watchlist-added, portfolio-traded, alert-set, or imported via
 *   Discover. We treat that pool as the screener's universe rather than
 *   filtering down to per-user relations, because the alternative
 *   (auto-creating a "Discoveries" watchlist on import) leaks an organization
 *   construct the user never asked for.
 *
 *   `userId` is accepted for future per-tenant scoping (e.g. when this becomes
 *   multi-tenant SaaS) but currently unused.
 */
export async function runScreener(
  filter: ScreenerFilter,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _userId: string,
): Promise<ScreenerResult> {
  const where = buildStockWhere(filter);
  const orderBy = buildOrderBy(filter.sort, filter.dir);

  const [rows, total] = await Promise.all([
    prisma.stock.findMany({
      where,
      orderBy,
      skip: (filter.page - 1) * filter.pageSize,
      take: filter.pageSize,
      select: {
        id: true,
        symbol: true,
        exchange: true,
        name: true,
        sector: true,
        currency: true,
        fundamentals: {
          select: {
            pe: true,
            peg: true,
            modifiedPeg: true,
            fairPe: true,
            lynchCategory: true,
            marketCap: true,
            epsGrowth5y: true,
            revenueGrowth5y: true,
            dividendYield: true,
            roe: true,
            profitMargin: true,
            debtToEquity: true,
            beta: true,
            priceToBook: true,
            syncedAt: true,
          },
        },
      },
    }),
    prisma.stock.count({ where }),
  ]);

  return {
    rows: rows as ScreenerRow[],
    total,
    page: filter.page,
    pageSize: filter.pageSize,
  };
}

/** Sector list across the shared Stock pool. `userId` accepted for future
 *  per-tenant scoping; currently unused (matches `runScreener`). */
export async function listSectors(
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _userId: string,
): Promise<string[]> {
  const rows = await prisma.stock.findMany({
    where: { sector: { not: null } },
    select: { sector: true },
    distinct: ["sector"],
    orderBy: { sector: "asc" },
  });
  return rows.map((r) => r.sector!).filter(Boolean);
}
