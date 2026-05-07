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
    // Yahoo's search() often returns no currency for indices; fall back to a
    // hardcoded map keyed off the symbol prefix. If that misses, fetch a live
    // quote (always returns currency) — and only then default to USD. Storing
    // the wrong currency makes every formatted price on the index detail page
    // (52w hi/lo, SMAs, fair value) display the wrong symbol forever.
    let currency = match.currency ?? currencyForIndexSymbol(symbol);
    if (!currency) {
      const liveQuote = await provider.getQuote(symbol).catch(() => null);
      currency = liveQuote?.currency ?? "USD";
    }
    return prisma.stock.create({
      data: {
        symbol,
        name: match.name,
        exchange, // "INDEX"
        currency,
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

/**
 * Re-fetch fundamentals from Yahoo and persist any improvement.
 *
 *   `findOrCreateStock` only fetches fundamentals once at row-create time —
 *   if Yahoo returned nulls then (common for Indian small caps and stocks
 *   right after IPO), the row is permanently sparse. This function refreshes
 *   the row when it's STALE (synced > maxAgeMs) or SPARSE (a critical field
 *   like epsGrowth5y or sector is null), and merges any newly-available
 *   values without overwriting existing data with nulls.
 *
 *   Returns the (possibly updated) fundamentals row, or null if the row
 *   doesn't exist or refresh failed.
 */
const STALE_AGE_MS = 7 * 24 * 60 * 60 * 1000; // 7 days
const CRITICAL_FIELDS = [
  "epsGrowth5y",
  "marketCap",
  "pe",
] as const;

export async function refreshFundamentalsIfStale(
  stockId: string,
  symbol: string,
): Promise<NonNullable<Awaited<ReturnType<typeof prisma.stockFundamentals.findUnique>>> | null> {
  const existing = await prisma.stockFundamentals.findUnique({ where: { stockId } });
  if (!existing) return null;

  const ageMs = Date.now() - new Date(existing.syncedAt).getTime();
  const isStale = ageMs > STALE_AGE_MS;
  const isSparse = CRITICAL_FIELDS.some((f) => existing[f] == null);
  if (!isStale && !isSparse) return existing;

  const stock = await prisma.stock.findUnique({ where: { id: stockId }, select: { currency: true } });
  if (!stock) return existing;

  const fresh = await provider.getFundamentals(symbol).catch(() => null);
  if (!fresh) return existing;

  const modPeg = modifiedPEG(fresh.pe ?? existing.pe, fresh.epsGrowth5y ?? existing.epsGrowth5y, fresh.dividendYield ?? existing.dividendYield);
  const fp = fairPE(fresh.epsGrowth5y ?? existing.epsGrowth5y);
  const lynchCat = classifyLynch({
    marketCap: fresh.marketCap ?? existing.marketCap,
    currency: fresh.currency ?? stock.currency,
    epsGrowth5yPct: fresh.epsGrowth5y ?? existing.epsGrowth5y,
    dividendYieldPct: fresh.dividendYield ?? existing.dividendYield,
    priceToBook: fresh.priceToBook ?? existing.priceToBook,
    sector: fresh.sector,
  });

  // Merge — never overwrite a non-null existing value with a fresh null.
  const merge = <K extends keyof typeof existing>(field: K, freshVal: (typeof existing)[K] | null) =>
    freshVal != null ? freshVal : existing[field];

  const updated = await prisma.stockFundamentals.update({
    where: { stockId },
    data: {
      pe: merge("pe", fresh.pe),
      peg: merge("peg", fresh.peg),
      modifiedPeg: modPeg ?? existing.modifiedPeg,
      fairPe: fp ?? existing.fairPe,
      lynchCategory: lynchCat ?? existing.lynchCategory,
      marketCap: merge("marketCap", fresh.marketCap),
      eps: merge("eps", fresh.eps),
      epsGrowth5y: merge("epsGrowth5y", fresh.epsGrowth5y),
      revenueGrowth5y: merge("revenueGrowth5y", fresh.revenueGrowth5y),
      dividendYield: merge("dividendYield", fresh.dividendYield),
      debtToEquity: merge("debtToEquity", fresh.debtToEquity),
      roe: merge("roe", fresh.roe),
      profitMargin: merge("profitMargin", fresh.profitMargin),
      beta: merge("beta", fresh.beta),
      priceToBook: merge("priceToBook", fresh.priceToBook),
      syncedAt: fresh.syncedAt,
      dataQualityFlags: fresh.dataQualityFlags,
    },
  });

  // Backfill sector / industry on the Stock row when Yahoo finally has them.
  if (fresh.sector || fresh.industry) {
    await prisma.stock
      .update({
        where: { id: stockId },
        data: {
          sector: fresh.sector ?? undefined,
          industry: fresh.industry ?? undefined,
        },
      })
      .catch(() => {});
  }

  return updated;
}

/**
 * Best-guess currency for known market-index symbols. Returns null when the
 * symbol isn't on the list — caller falls back to a live quote fetch.
 *
 * Source of truth: Yahoo Finance quote responses for each ticker. Keep in sync
 * with `lib/benchmarks.ts` whenever a new benchmark is added.
 */
function currencyForIndexSymbol(symbol: string): string | null {
  const s = symbol.toUpperCase();
  // India
  if (s === "^NSEI" || s === "^BSESN" || s === "^NSEBANK" || s === "^CNXIT") return "INR";
  if (s.startsWith("NIFTY") || s.endsWith(".NS") || s.endsWith(".BO")) return "INR";
  // United States
  if (s === "^GSPC" || s === "^DJI" || s === "^IXIC" || s === "^NDX" || s === "^RUT") return "USD";
  // Other globals
  if (s === "^FTSE") return "GBP";
  if (s === "^N225") return "JPY";
  if (s === "^HSI") return "HKD";
  if (s === "^GDAXI" || s === "^STOXX50E") return "EUR";
  return null;
}
