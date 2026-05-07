/**
 * Single source of truth for portfolio benchmarks.
 *
 *   Each entry is a Yahoo Finance index symbol (^XXX format) the user can
 *   compare a portfolio's TWR against. Order matters — used directly to render
 *   the Benchmark dropdown on the create-portfolio form, grouped by region.
 *
 *   Add new entries here only; the create-portfolio action validates against
 *   `BENCHMARK_SYMBOLS` so unknown values are rejected.
 */

export interface Benchmark {
  symbol: string;
  label: string;
  /** Region grouping for the picker UI. */
  region: "US" | "IN" | "Global";
}

export const BENCHMARKS: readonly Benchmark[] = [
  // ── United States ─────────────────────────────────────────────
  { symbol: "^GSPC", label: "S&P 500", region: "US" },
  { symbol: "^DJI", label: "Dow Jones Industrial Average", region: "US" },
  { symbol: "^IXIC", label: "NASDAQ Composite", region: "US" },
  { symbol: "^NDX", label: "NASDAQ 100", region: "US" },
  { symbol: "^RUT", label: "Russell 2000", region: "US" },
  // ── India ─────────────────────────────────────────────────────
  { symbol: "^NSEI", label: "NIFTY 50", region: "IN" },
  { symbol: "^BSESN", label: "BSE SENSEX", region: "IN" },
  { symbol: "^NSEBANK", label: "NIFTY Bank", region: "IN" },
  { symbol: "^CNXIT", label: "NIFTY IT", region: "IN" },
  { symbol: "NIFTY_MIDCAP_100.NS", label: "NIFTY Midcap 100", region: "IN" },
  // ── Global majors ─────────────────────────────────────────────
  { symbol: "^FTSE", label: "FTSE 100", region: "Global" },
  { symbol: "^N225", label: "Nikkei 225", region: "Global" },
  { symbol: "^HSI", label: "Hang Seng", region: "Global" },
  { symbol: "^GDAXI", label: "DAX (Germany)", region: "Global" },
  { symbol: "^STOXX50E", label: "Euro Stoxx 50", region: "Global" },
] as const;

export const BENCHMARK_SYMBOLS = new Set<string>(BENCHMARKS.map((b) => b.symbol));

const BY_SYMBOL = new Map<string, Benchmark>(BENCHMARKS.map((b) => [b.symbol, b]));

/** Look up a benchmark's pretty label, falling back to the raw symbol. */
export function benchmarkLabel(symbol: string): string {
  return BY_SYMBOL.get(symbol)?.label ?? symbol;
}

/** Group benchmarks by region for the picker UI. */
export function groupedBenchmarks(): Array<{ region: Benchmark["region"]; items: Benchmark[] }> {
  const order: Benchmark["region"][] = ["US", "IN", "Global"];
  return order.map((region) => ({
    region,
    items: BENCHMARKS.filter((b) => b.region === region),
  }));
}
