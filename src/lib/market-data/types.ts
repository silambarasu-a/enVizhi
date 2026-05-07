// Provider-agnostic shapes. Every implementation (Yahoo today, FMP/EODHD later)
// must normalize into these types so screener / Lynch / portfolio code never
// has to branch on the upstream source.

export type Exchange = "NASDAQ" | "NYSE" | "NSE" | "BSE";

export interface NormalizedQuote {
  symbol: string;
  price: number;
  change: number | null;
  changePct: number | null;
  volume: bigint | null;
  marketState: string | null;
  currency: string;
  fetchedAt: Date;
}

export interface NormalizedFundamentals {
  symbol: string;
  pe: number | null;
  peg: number | null;
  marketCap: bigint | null;
  eps: number | null;
  /** Five-year compound EPS growth (percent, e.g. 12.5 = 12.5%/yr). */
  epsGrowth5y: number | null;
  /** Five-year compound revenue growth (percent). */
  revenueGrowth5y: number | null;
  /** Trailing dividend yield (percent, e.g. 1.8 = 1.8%/yr). */
  dividendYield: number | null;
  debtToEquity: number | null;
  roe: number | null;
  profitMargin: number | null;
  beta: number | null;
  priceToBook: number | null;
  sector: string | null;
  industry: string | null;
  currency: string | null;
  syncedAt: Date;
  /** Map of field name → true when the provider returned null/missing. Used by
   *  the screener to surface gaps instead of silently dropping rows. */
  dataQualityFlags: Record<string, boolean>;
}

export interface OHLCBar {
  date: Date;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: bigint;
}

/**
 * Chart range. `1d` and `1w` use intraday bars (5m / 30m); the rest use
 * daily bars. Yahoo gates intraday intervals behind short windows — keep
 * the period+interval pairs in `RANGE_TO_PERIOD` aligned with that limit.
 */
export type OHLCRange = "1d" | "1w" | "1mo" | "3mo" | "6mo" | "1y" | "5y";

/** Search match returned from the upstream universe (Yahoo today). Lighter
 *  than a full Stock row — used by the ⌘K modal so users discover any ticker. */
export interface SearchMatch {
  symbol: string;
  name: string;
  /** Pretty exchange label: NASDAQ, NYSE, NSE, BSE, INDEX, AMEX, LSE, TSX, etc. */
  exchange: string;
  /** ISO currency or null if Yahoo didn't tell us. */
  currency: string | null;
  /** True when this exchange maps to one of our supported `Exchange` enum
   *  values — lets the stock-detail page lazy-create a Stock row safely. */
  isSupported: boolean;
  /** True when this is a market index (^NSEI, ^GSPC, ^BSESN, etc.) rather
   *  than a tradeable equity. Index detail pages skip fundamentals + Lynch
   *  and only render price + technicals. */
  isIndex: boolean;
}

/** Yahoo `insights` payload normalised to what the directional engine
 *  actually consumes — analyst rating, multi-timeframe outlooks, sig
 *  developments (news headlines), key technicals. Optional everywhere
 *  because Yahoo's coverage is sparse outside US large-caps. */
export interface NormalizedInsights {
  recommendation: { rating: "BUY" | "HOLD" | "SELL"; targetPrice: number | null } | null;
  outlooks: {
    short: { direction: "Bullish" | "Bearish" | "Neutral"; score: number | null } | null;
    intermediate: { direction: "Bullish" | "Bearish" | "Neutral"; score: number | null } | null;
    long: { direction: "Bullish" | "Bearish" | "Neutral"; score: number | null } | null;
  };
  keyTechnicals: { support: number | null; resistance: number | null; stopLoss: number | null };
  /** Headlines as plain strings — used for sentiment scoring. */
  headlines: string[];
}

/** Hydrated mover entry — symbol, label, and live quote rolled into one shape
 *  so the dashboard can render it directly. */
export interface MoverEntry {
  symbol: string;
  name: string;
  exchange: string;
  currency: string;
  price: number;
  changePct: number;
}

export interface MarketMovers {
  gainers: MoverEntry[];
  losers: MoverEntry[];
}

/** A Yahoo predefined screen we surface in the Discover panel. */
export type ScreenId =
  | "most_actives"
  | "day_gainers"
  | "day_losers"
  | "trending_now"
  | "undervalued_large_caps"
  | "growth_technology_stocks"
  | "aggressive_small_caps";

export interface MarketDataProvider {
  name: string;
  getQuote(symbol: string): Promise<NormalizedQuote>;
  getQuotes(symbols: string[]): Promise<NormalizedQuote[]>;
  getFundamentals(symbol: string): Promise<NormalizedFundamentals>;
  getOHLC(symbol: string, range: OHLCRange): Promise<OHLCBar[]>;
  getFXRate(base: string, quote: string): Promise<number>;
  search(query: string): Promise<SearchMatch[]>;
  /** Yahoo predefined screen (most actives, day gainers, etc.) returning lighter
   *  matches so the screener Discover panel can offer instant breadth. */
  runScreen(
    id: ScreenId,
    opts?: { count?: number; region?: "US" | "IN" },
  ): Promise<SearchMatch[]>;
  /** Region-aware market movers. US uses Yahoo's predefined day_gainers /
   *  day_losers screens. IN ranks NIFTY 50 components by intraday % change
   *  (Yahoo's predefined screens are US-locked; the `region` param doesn't
   *  filter them server-side). Returns hydrated entries with price + name. */
  getMarketMovers(
    region: "US" | "IN",
    count?: number,
  ): Promise<MarketMovers>;
  /** Analyst recommendation, multi-timeframe technical outlook, recent
   *  significant developments, and key technicals from Yahoo's insights API.
   *  Best-effort — coverage is sparse on small caps and Indian stocks.
   *  Returns null if Yahoo had no insights for the symbol. */
  getInsights(symbol: string): Promise<NormalizedInsights | null>;
  /** Next / most recent earnings date for the ticker. Used to flag the
   *  directional engine when earnings are within ~5 trading days, since
   *  pre-/post-earnings vol is high and direction is largely unpredictable.
   *  Returns null if Yahoo doesn't have an earnings date on file. */
  getEarningsDate(symbol: string): Promise<Date | null>;
}
