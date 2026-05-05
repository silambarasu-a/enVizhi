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
 * Run the screener scoped to a user's accumulated universe.
 *
 *   "Universe" = stocks the user has touched: in any of their watchlists,
 *   referenced by any of their portfolio transactions, or with an active
 *   alert. The fully-live rewrite removed the seeded global universe, so the
 *   screener works against this personal-but-growing set.
 *
 *   Discover-panel actions (e.g. clicking "Most Active") add stocks to this
 *   set by lazy-creating Stock rows + their fundamentals — at which point
 *   they show up here on the next refresh.
 */
export async function runScreener(
  filter: ScreenerFilter,
  userId: string,
): Promise<ScreenerResult> {
  const baseWhere = buildStockWhere(filter);
  const orderBy = buildOrderBy(filter.sort, filter.dir);

  const where = {
    AND: [
      baseWhere,
      {
        OR: [
          { watchlistItems: { some: { watchlist: { userId } } } },
          { transactions: { some: { portfolio: { userId } } } },
          { alerts: { some: { userId } } },
        ],
      },
    ],
  };

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

/** Sector list, scoped to the user's accumulated universe. */
export async function listSectors(userId: string): Promise<string[]> {
  const rows = await prisma.stock.findMany({
    where: {
      sector: { not: null },
      OR: [
        { watchlistItems: { some: { watchlist: { userId } } } },
        { transactions: { some: { portfolio: { userId } } } },
        { alerts: { some: { userId } } },
      ],
    },
    select: { sector: true },
    distinct: ["sector"],
    orderBy: { sector: "asc" },
  });
  return rows.map((r) => r.sector!).filter(Boolean);
}
