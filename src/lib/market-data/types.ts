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

export type OHLCRange = "1mo" | "3mo" | "6mo" | "1y" | "5y";

/** Search match returned from the upstream universe (Yahoo today). Lighter
 *  than a full Stock row — used by the ⌘K modal so users discover any ticker. */
export interface SearchMatch {
  symbol: string;
  name: string;
  /** Pretty exchange label: NASDAQ, NYSE, NSE, BSE, AMEX, LSE, TSX, etc. */
  exchange: string;
  /** ISO currency or null if Yahoo didn't tell us. */
  currency: string | null;
  /** True when this exchange maps to one of our supported `Exchange` enum
   *  values — lets the stock-detail page lazy-create a Stock row safely. */
  isSupported: boolean;
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
  runScreen(id: ScreenId, opts?: { count?: number }): Promise<SearchMatch[]>;
}
