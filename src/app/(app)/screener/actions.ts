"use server";

import pLimit from "p-limit";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { ScreenId } from "@/lib/market-data/types";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { provider } from "@/lib/market-data/router";
import { findOrCreateStock } from "@/lib/stocks/lazy-create";

const VALID_SCREENS = new Set<ScreenId>([
  "most_actives",
  "day_gainers",
  "day_losers",
  "trending_now",
  "undervalued_large_caps",
  "growth_technology_stocks",
  "aggressive_small_caps",
]);

/**
 * Pull a Yahoo predefined screen and import the matching tickers into the
 * user's universe. Each match is funneled through `findOrCreateStock` so
 * fundamentals + Lynch fields land in one shot.
 *
 * Concurrency capped at 4 — Yahoo gets unhappy past ~5 RPS sustained.
 *
 * Returns the count actually imported (vs already-known) so the caller can
 * surface a toast like "Added 18 new stocks from Most Active".
 */
export async function importYahooScreen(formData: FormData) {
  const session = await auth();
  if (!session?.user?.id) redirect("/signin");

  const id = String(formData.get("scrId") ?? "") as ScreenId;
  if (!VALID_SCREENS.has(id)) {
    return { error: "Unknown screen" };
  }

  const matches = await provider.runScreen(id, { count: 25 }).catch(() => []);
  const supported = matches.filter((m) => m.isSupported);

  // Skip the lazy-create dance for symbols already in DB to keep this fast.
  const existingSymbols = new Set(
    (
      await prisma.stock.findMany({
        where: { symbol: { in: supported.map((m) => m.symbol) } },
        select: { symbol: true },
      })
    ).map((s) => s.symbol),
  );

  const toAdd = supported.filter((m) => !existingSymbols.has(m.symbol));
  const limit = pLimit(4);

  const results = await Promise.all(
    toAdd.map((m) =>
      limit(async () => {
        const stock = await findOrCreateStock(m.symbol).catch(() => null);
        return stock;
      }),
    ),
  );

  // For known symbols + newly-created ones alike: ensure they're in a
  // synthetic "Discoveries" watchlist so they show up in the screener.
  const discoveryListName = "Discoveries";
  let discoveryList = await prisma.watchlist.findFirst({
    where: { userId: session.user.id, name: discoveryListName },
    select: { id: true },
  });
  if (!discoveryList) {
    discoveryList = await prisma.watchlist.create({
      data: { userId: session.user.id, name: discoveryListName, sortOrder: 999 },
      select: { id: true },
    });
  }

  const allStockIds = [
    ...(
      await prisma.stock.findMany({
        where: { symbol: { in: supported.map((m) => m.symbol) } },
        select: { id: true },
      })
    ).map((s) => s.id),
    ...results.filter((s): s is NonNullable<typeof s> => !!s).map((s) => s.id),
  ];

  // Idempotent inserts thanks to the unique constraint on (watchlistId, stockId).
  await Promise.all(
    Array.from(new Set(allStockIds)).map((stockId) =>
      prisma.watchlistItem
        .create({ data: { watchlistId: discoveryList!.id, stockId } })
        .catch(() => {
          /* already there — ignore */
        }),
    ),
  );

  revalidatePath("/screener");
  revalidatePath("/dashboard");
  revalidatePath("/watchlists");

  const newCount = results.filter(Boolean).length;
  return {
    ok: true,
    imported: newCount,
    alreadyKnown: supported.length - newCount,
    skipped: matches.length - supported.length,
  };
}
