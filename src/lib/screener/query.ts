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

export async function runScreener(filter: ScreenerFilter): Promise<ScreenerResult> {
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

/** Distinct sector list — populated from Yahoo at sync time. Used to power the
 *  sector filter dropdown. */
export async function listSectors(): Promise<string[]> {
  const rows = await prisma.stock.findMany({
    where: { sector: { not: null } },
    select: { sector: true },
    distinct: ["sector"],
    orderBy: { sector: "asc" },
  });
  return rows.map((r) => r.sector!).filter(Boolean);
}
