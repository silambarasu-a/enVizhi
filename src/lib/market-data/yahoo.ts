import YahooFinance from "yahoo-finance2";
import type {
  MarketDataProvider,
  NormalizedFundamentals,
  NormalizedQuote,
  OHLCBar,
  OHLCRange,
  ScreenId,
  SearchMatch,
} from "./types";

// yahoo-finance2 v3 requires explicit instantiation (was a singleton in v2).
const yahooFinance = new YahooFinance({ suppressNotices: ["yahooSurvey"] });

const RANGE_TO_PERIOD: Record<OHLCRange, { period1: Date; interval: "1d" | "1wk" }> = {
  "1mo": { period1: daysAgo(30), interval: "1d" },
  "3mo": { period1: daysAgo(91), interval: "1d" },
  "6mo": { period1: daysAgo(183), interval: "1d" },
  "1y": { period1: daysAgo(365), interval: "1d" },
  "5y": { period1: daysAgo(365 * 5), interval: "1wk" },
};

function daysAgo(n: number): Date {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d;
}

function flag(value: unknown): boolean {
  return value === null || value === undefined || (typeof value === "number" && !Number.isFinite(value));
}

export const yahooProvider: MarketDataProvider = {
  name: "yahoo",

  async getQuote(symbol) {
    const q = (await yahooFinance.quote(symbol)) as RawQuote | RawQuote[];
    const single = Array.isArray(q) ? q[0]! : q;
    return normalizeQuote(single);
  },

  async getQuotes(symbols) {
    if (symbols.length === 0) return [];
    const quotes = (await yahooFinance.quote(symbols)) as RawQuote | RawQuote[];
    const list = Array.isArray(quotes) ? quotes : [quotes];
    return list.map(normalizeQuote);
  },

  async getFundamentals(symbol) {
    // yahoo-finance2's typings narrow to `never` for arbitrary module tuples;
    // cast to a permissive shape since we treat every field as optional anyway.
    const summary = (await yahooFinance.quoteSummary(symbol, {
      modules: [
        "summaryDetail",
        "defaultKeyStatistics",
        "financialData",
        "assetProfile",
        "price",
      ],
    })) as Record<string, Record<string, unknown> | undefined>;

    const d = summary.summaryDetail ?? {};
    const k = summary.defaultKeyStatistics ?? {};
    const f = summary.financialData ?? {};
    const a = summary.assetProfile ?? {};
    const p = summary.price ?? {};

    const pe = numOrNull(d.trailingPE) ?? numOrNull(k.trailingEps && p.regularMarketPrice ? Number(p.regularMarketPrice) / Number(k.trailingEps) : null);
    const peg = numOrNull(k.pegRatio);
    const eps = numOrNull(k.trailingEps);
    const epsGrowth5y = numOrNull(f.earningsGrowth ? Number(f.earningsGrowth) * 100 : null);
    const revenueGrowth5y = numOrNull(f.revenueGrowth ? Number(f.revenueGrowth) * 100 : null);
    const dividendYield = numOrNull(d.dividendYield ? Number(d.dividendYield) * 100 : null);
    const debtToEquity = numOrNull(f.debtToEquity);
    const roe = numOrNull(f.returnOnEquity ? Number(f.returnOnEquity) * 100 : null);
    const profitMargin = numOrNull(f.profitMargins ? Number(f.profitMargins) * 100 : null);
    const beta = numOrNull(d.beta ?? k.beta);
    const priceToBook = numOrNull(k.priceToBook);
    const marketCap = bigIntOrNull(p.marketCap);
    const sector = strOrNull(a.sector);
    const industry = strOrNull(a.industry);
    const currency = strOrNull(p.currency);

    const dataQualityFlags: Record<string, boolean> = {};
    if (flag(pe)) dataQualityFlags.pe = true;
    if (flag(peg)) dataQualityFlags.peg = true;
    if (flag(eps)) dataQualityFlags.eps = true;
    if (flag(epsGrowth5y)) dataQualityFlags.epsGrowth5y = true;
    if (flag(revenueGrowth5y)) dataQualityFlags.revenueGrowth5y = true;
    if (flag(dividendYield)) dataQualityFlags.dividendYield = true;
    if (flag(debtToEquity)) dataQualityFlags.debtToEquity = true;
    if (flag(roe)) dataQualityFlags.roe = true;
    if (flag(profitMargin)) dataQualityFlags.profitMargin = true;
    if (flag(beta)) dataQualityFlags.beta = true;
    if (flag(priceToBook)) dataQualityFlags.priceToBook = true;
    if (flag(marketCap)) dataQualityFlags.marketCap = true;
    if (flag(sector)) dataQualityFlags.sector = true;
    if (flag(industry)) dataQualityFlags.industry = true;

    return {
      symbol,
      pe,
      peg,
      marketCap,
      eps,
      epsGrowth5y,
      revenueGrowth5y,
      dividendYield,
      debtToEquity,
      roe,
      profitMargin,
      beta,
      priceToBook,
      sector,
      industry,
      currency,
      syncedAt: new Date(),
      dataQualityFlags,
    } satisfies NormalizedFundamentals;
  },

  async getOHLC(symbol, range) {
    const cfg = RANGE_TO_PERIOD[range];
    const result = (await yahooFinance.chart(symbol, {
      period1: cfg.period1,
      interval: cfg.interval,
    })) as {
      quotes?: Array<{
        date: string | number | Date;
        open: number | null;
        high: number | null;
        low: number | null;
        close: number | null;
        volume: number | null;
      }>;
    };
    const quotes = result.quotes ?? [];
    return quotes
      .filter((q) => q.close != null && q.open != null && q.high != null && q.low != null)
      .map<OHLCBar>((q) => ({
        date: new Date(q.date),
        open: q.open!,
        high: q.high!,
        low: q.low!,
        close: q.close!,
        volume: q.volume != null ? BigInt(Math.trunc(q.volume)) : BigInt(0),
      }));
  },

  async getFXRate(base, quote) {
    const symbol = `${base}${quote}=X`;
    const q = (await yahooFinance.quote(symbol)) as
      | { regularMarketPrice?: number | null }
      | Array<{ regularMarketPrice?: number | null }>;
    const arr = Array.isArray(q) ? q[0] : q;
    if (!arr || arr.regularMarketPrice == null) {
      throw new Error(`FX rate ${base}/${quote} unavailable`);
    }
    return Number(arr.regularMarketPrice);
  },

  async search(query) {
    const trimmed = query.trim();
    if (!trimmed) return [];

    const result = (await yahooFinance.search(trimmed, {
      quotesCount: 20,
      newsCount: 0,
    })) as {
      quotes?: Array<{
        symbol?: string;
        shortname?: string;
        longname?: string;
        exchange?: string;
        exchangeDisplay?: string;
        currency?: string;
        quoteType?: string;
        isYahooFinance?: boolean;
      }>;
    };

    const quotes = result.quotes ?? [];
    return quotes
      .filter((q) => q.symbol && (q.quoteType === "EQUITY" || q.quoteType === "ETF"))
      .map<SearchMatch>((q) => {
        const ex = normalizeYahooExchange(q.exchange);
        return {
          symbol: q.symbol!,
          name: q.longname ?? q.shortname ?? q.symbol!,
          exchange: ex.label,
          currency: q.currency ?? null,
          isSupported: ex.supported,
        };
      });
  },

  async runScreen(id: ScreenId, opts) {
    const count = Math.min(Math.max(opts?.count ?? 25, 5), 50);
    // yahoo-finance2's `PredefinedScreenerModules` union is incomplete (missing
    // `trending_now` and a few others Yahoo actually accepts). Cast scrIds
    // through any to bypass the lib's typing while still validating at our
    // ScreenId boundary.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = (await yahooFinance.screener({
      scrIds: id as any,
      count,
      region: "US",
    })) as {
      quotes?: Array<{
        symbol?: string;
        shortName?: string;
        longName?: string;
        exchange?: string;
        currency?: string;
        quoteType?: string;
      }>;
    };
    const quotes = result.quotes ?? [];
    return quotes
      .filter((q) => q.symbol && (q.quoteType === "EQUITY" || q.quoteType === "ETF"))
      .map<SearchMatch>((q) => {
        const ex = normalizeYahooExchange(q.exchange);
        return {
          symbol: q.symbol!,
          name: q.longName ?? q.shortName ?? q.symbol!,
          exchange: ex.label,
          currency: q.currency ?? null,
          isSupported: ex.supported,
        };
      });
  },
};

/** Map Yahoo's cryptic exchange codes to a friendly label + whether it
 *  matches one of our supported `Exchange` enum values. */
function normalizeYahooExchange(code: string | undefined): { label: string; supported: boolean } {
  switch (code) {
    case "NMS":
    case "NCM":
    case "NGM":
      return { label: "NASDAQ", supported: true };
    case "NYQ":
      return { label: "NYSE", supported: true };
    case "ASE":
      return { label: "AMEX", supported: false };
    case "PCX":
      return { label: "NYSE Arca", supported: false };
    case "NSI":
      return { label: "NSE", supported: true };
    case "BSE":
    case "BOM":
      return { label: "BSE", supported: true };
    case "LSE":
      return { label: "LSE", supported: false };
    case "TOR":
      return { label: "TSX", supported: false };
    case "HKG":
      return { label: "HKEX", supported: false };
    case "FRA":
      return { label: "Frankfurt", supported: false };
    default:
      return { label: code ?? "—", supported: false };
  }
}

interface RawQuote {
  symbol: string;
  regularMarketPrice?: number | null;
  regularMarketChange?: number | null;
  regularMarketChangePercent?: number | null;
  regularMarketVolume?: number | null;
  marketState?: string | null;
  currency?: string | null;
}

function normalizeQuote(q: RawQuote): NormalizedQuote {
  return {
    symbol: q.symbol,
    price: Number(q.regularMarketPrice ?? 0),
    change: numOrNull(q.regularMarketChange),
    changePct: numOrNull(q.regularMarketChangePercent),
    volume: bigIntOrNull(q.regularMarketVolume),
    marketState: strOrNull(q.marketState),
    currency: strOrNull(q.currency) ?? "USD",
    fetchedAt: new Date(),
  };
}

function numOrNull(v: unknown): number | null {
  if (v == null) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function strOrNull(v: unknown): string | null {
  return typeof v === "string" && v.length > 0 ? v : null;
}

function bigIntOrNull(v: unknown): bigint | null {
  if (v == null) return null;
  const n = Number(v);
  if (!Number.isFinite(n)) return null;
  try {
    return BigInt(Math.trunc(n));
  } catch {
    return null;
  }
}
