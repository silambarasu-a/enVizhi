import { prisma } from "@/lib/prisma";

const DEFAULTS: Array<{ name: string; symbols: string[] }> = [
  {
    name: "Indian Bluechips",
    symbols: ["RELIANCE.NS", "TCS.NS", "HDFCBANK.NS", "INFY.NS", "ICICIBANK.NS"],
  },
  {
    name: "US Megacaps",
    symbols: ["AAPL", "MSFT", "GOOGL", "AMZN", "NVDA"],
  },
];

/**
 * Create starter watchlists for a brand-new user. Symbols not in the universe
 * are silently skipped, so this never blocks signup if the seed CSVs change.
 *
 * Used by both:
 *   - NextAuth's `events.createUser` (fires for magic-link users)
 *   - The password sign-up server action (Credentials doesn't trigger the event)
 */
export async function seedDefaultWatchlists(userId: string): Promise<void> {
  const allSymbols = DEFAULTS.flatMap((d) => d.symbols);
  const stocks = await prisma.stock.findMany({
    where: { symbol: { in: allSymbols } },
    select: { id: true, symbol: true },
  });
  const idBySymbol = new Map(stocks.map((s) => [s.symbol, s.id]));

  await Promise.all(
    DEFAULTS.map((wl, sortOrder) =>
      prisma.watchlist.create({
        data: {
          userId,
          name: wl.name,
          sortOrder,
          items: {
            create: wl.symbols
              .map((sym) => idBySymbol.get(sym))
              .filter((id): id is string => !!id)
              .map((stockId) => ({ stockId })),
          },
        },
      }),
    ),
  );
}
