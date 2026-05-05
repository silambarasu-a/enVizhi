import type { MarketDataProvider, Exchange } from "./types";
import { yahooProvider } from "./yahoo";

/**
 * Single point of dispatch for all market-data requests.
 *
 * Today: every exchange routes to Yahoo. When FMP / EODHD / Polygon are added
 * (likely for Indian fundamentals where Yahoo's coverage is patchy), this is
 * the only file that changes — the rest of the app uses `provider` opaquely.
 */
export function providerFor(_exchange?: Exchange): MarketDataProvider {
  return yahooProvider;
}

export const provider: MarketDataProvider = yahooProvider;
