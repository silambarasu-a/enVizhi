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
 * shared Stock universe.
 *
 *   - Lazy-creates Stock + StockFundamentals rows for every supported match.
 *   - Does NOT auto-add anything to a user watchlist (importing is for
 *     discovery; watchlists are a user-driven organization layer that the
 *     user opts into explicitly).
 *
 * Returns counts so the caller can surface a toast like
 * "Imported 18 new, 7 already known" in the Discover panel.
 */
export async function importYahooScreen(formData: FormData) {
  const session = await auth();
  if (!session?.user?.id) redirect("/signin");

  const id = String(formData.get("scrId") ?? "") as ScreenId;
  if (!VALID_SCREENS.has(id)) {
    return { error: "Unknown screen" };
  }

  const regionRaw = String(formData.get("region") ?? "US");
  const region: "US" | "IN" = regionRaw === "IN" ? "IN" : "US";

  const matches = await provider.runScreen(id, { count: 25, region }).catch(() => []);
  const supported = matches.filter((m) => m.isSupported);

  // Skip stocks already in DB to keep this fast — we only need to lazy-create
  // the new ones.
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

  revalidatePath("/screener");
  revalidatePath("/dashboard");

  const newCount = results.filter(Boolean).length;
  return {
    ok: true,
    imported: newCount,
    alreadyKnown: supported.length - newCount,
    skipped: matches.length - supported.length,
  };
}
