import type { Exchange } from "@/generated/prisma/enums";
import { prisma } from "@/lib/prisma";
import { provider } from "@/lib/market-data/router";
import { modifiedPEG, fairPE } from "@/lib/lynch/score";
import { classifyLynch } from "@/lib/lynch/categories";

/**
 * Look up a Stock by symbol, lazily creating it from upstream data if missing.
 *
 *   - Symbol already in DB → return as-is.
 *   - Symbol unknown to us but searchable on Yahoo → create a Stock row +
 *     fetch fundamentals (in parallel with the create) so the detail page,
 *     screener, and watchlist all see complete data on the very first view.
 *   - Symbol not on a supported exchange (LSE, TSX, etc.) → return null. The
 *     caller can decide how to handle (show read-only state or 404).
 *
 * This is what makes the ⌘K search "feel infinite": users can find any Yahoo
 * ticker, click into it, and the system materializes the row on first view —
 * after which watchlists, alerts, and portfolio operations all work normally.
 */
export async function findOrCreateStock(symbolRaw: string) {
  const symbol = symbolRaw.toUpperCase().trim();
  if (!symbol) return null;

  const existing = await prisma.stock.findUnique({
    where: { symbol },
    include: { fundamentals: true },
  });
  if (existing) return existing;

  // Use search() for metadata (exchange, currency, name) and reject unsupported
  // exchanges before we waste any DB write.
  const matches = await provider.search(symbol).catch(() => []);
  const match = matches.find((m) => m.symbol.toUpperCase() === symbol);
  if (!match || !match.isSupported) return null;

  const exchange = exchangeFromLabel(match.exchange);
  if (!exchange) return null;

  // Indices skip the fundamentals fetch entirely — Yahoo's quoteSummary returns
  // mostly nulls for ^NSEI / ^GSPC etc., and the metrics that exist (P/E of the
  // underlying basket) don't compose with our equity-oriented score model.
  if (match.isIndex) {
    return prisma.stock.create({
      data: {
        symbol,
        name: match.name,
        exchange, // "INDEX"
        currency: match.currency ?? "USD",
        sector: null,
      },
      include: { fundamentals: true },
    });
  }

  // Fetch fundamentals in parallel with the row create — since the row is the
  // FK target for fundamentals we need create first, but we kick off the
  // upstream fetch concurrently to mask Yahoo latency.
  const [created, fundamentals] = await Promise.all([
    prisma.stock.create({
      data: {
        symbol,
        name: match.name,
        exchange,
        currency: match.currency ?? defaultCurrencyForExchange(exchange),
        sector: null, // filled by fundamentals fetch below
      },
    }),
    provider.getFundamentals(symbol).catch(() => null),
  ]);

  if (fundamentals) {
    const modPeg = modifiedPEG(
      fundamentals.pe,
      fundamentals.epsGrowth5y,
      fundamentals.dividendYield,
    );
    const fp = fairPE(fundamentals.epsGrowth5y);
    const lynchCat = classifyLynch({
      marketCap: fundamentals.marketCap,
      currency: fundamentals.currency ?? created.currency,
      epsGrowth5yPct: fundamentals.epsGrowth5y,
      dividendYieldPct: fundamentals.dividendYield,
      priceToBook: fundamentals.priceToBook,
      sector: fundamentals.sector,
    });

    await Promise.all([
      prisma.stockFundamentals.create({
        data: {
          stockId: created.id,
          pe: fundamentals.pe,
          peg: fundamentals.peg,
          modifiedPeg: modPeg,
          fairPe: fp,
          lynchCategory: lynchCat,
          marketCap: fundamentals.marketCap,
          eps: fundamentals.eps,
          epsGrowth5y: fundamentals.epsGrowth5y,
          revenueGrowth5y: fundamentals.revenueGrowth5y,
          dividendYield: fundamentals.dividendYield,
          debtToEquity: fundamentals.debtToEquity,
          roe: fundamentals.roe,
          profitMargin: fundamentals.profitMargin,
          beta: fundamentals.beta,
          priceToBook: fundamentals.priceToBook,
          syncedAt: fundamentals.syncedAt,
          dataQualityFlags: fundamentals.dataQualityFlags,
        },
      }),
      // Backfill sector/industry on the Stock row when Yahoo had them.
      fundamentals.sector || fundamentals.industry
        ? prisma.stock.update({
            where: { id: created.id },
            data: {
              sector: fundamentals.sector ?? undefined,
              industry: fundamentals.industry ?? undefined,
            },
          })
        : Promise.resolve(),
    ]);
  }

  return prisma.stock.findUnique({
    where: { id: created.id },
    include: { fundamentals: true },
  });
}

function exchangeFromLabel(label: string): Exchange | null {
  switch (label) {
    case "NASDAQ":
      return "NASDAQ";
    case "NYSE":
      return "NYSE";
    case "NSE":
      return "NSE";
    case "BSE":
      return "BSE";
    case "INDEX":
      return "INDEX";
    default:
      return null;
  }
}

function defaultCurrencyForExchange(ex: Exchange): string {
  return ex === "NSE" || ex === "BSE" ? "INR" : "USD";
}
