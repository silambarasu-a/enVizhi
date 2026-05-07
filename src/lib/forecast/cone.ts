/**
 * Probabilistic price forecast cone.
 *
 *   We model future log returns as a normal distribution fit to the stock's
 *   own historical daily log returns (geometric Brownian motion). For each
 *   horizon we report the *median* trajectory and the 68% (1σ) and 95% (2σ)
 *   confidence ranges around it — these widen with √T, which is the correct
 *   behavior (longer horizons are fundamentally more uncertain).
 *
 *   This is the right tool for honest UX: we surface ranges, not point
 *   predictions. Anyone claiming a single "predicted price" with confidence
 *   in liquid markets is wrong on net.
 *
 *   Math:
 *
 *     daily log returns   r_i = ln(P_i / P_{i-1})
 *     annualized drift    μ   = mean(r) × 252
 *     annualized vol      σ   = stdev(r) × √252
 *     (using sample stdev with Bessel's correction)
 *
 *     Under GBM, ln(P_T / P_0) ~ N((μ - σ²/2)T, σ² T).
 *
 *     Median price        P_T,med  = P_0 × exp((μ - σ²/2) × T)
 *     Mean price          P_T,mean = P_0 × exp(μ × T)
 *     68% range           P_0 × exp((μ - σ²/2)T ± σ√T)
 *     95% range           P_0 × exp((μ - σ²/2)T ± 2σ√T)
 *
 *   We report median (not mean) as the "center" since the price distribution
 *   is log-normal, not symmetric — half the realizations land above median,
 *   half below, which matches how readers interpret a center.
 *
 *   Caveats baked into the data we return:
 *     - `lowConfidence: true` when we have <60 bars (need ~3 months minimum
 *       to fit even the smallest horizons defensibly).
 *     - `tailWarning: true` when σ is very high (>60% annualized) or |μ| is
 *       very high (>30% annualized) — fits to recent regime are unreliable.
 *     - Long horizons (3y / 5y) are flagged as `assumptionStrained`.
 */

export type ForecastHorizon = "1d" | "1w" | "1m" | "3m" | "6m" | "1y" | "3y" | "5y";

const TRADING_DAYS_PER_YEAR = 252;

const HORIZONS: Array<{ id: ForecastHorizon; label: string; tradingDays: number }> = [
  { id: "1d", label: "1 day", tradingDays: 1 },
  { id: "1w", label: "1 week", tradingDays: 5 },
  { id: "1m", label: "1 month", tradingDays: 21 },
  { id: "3m", label: "3 months", tradingDays: 63 },
  { id: "6m", label: "6 months", tradingDays: 126 },
  { id: "1y", label: "1 year", tradingDays: 252 },
  { id: "3y", label: "3 years", tradingDays: 252 * 3 },
  { id: "5y", label: "5 years", tradingDays: 252 * 5 },
];

export interface ForecastBand {
  /** Horizon ID for keying. */
  id: ForecastHorizon;
  /** Human label, e.g. "1 month". */
  label: string;
  /** Median (50th percentile) price under GBM — symmetric center on log scale. */
  median: number;
  /** Mean (expected value) price — slightly above median due to log-normal skew. */
  mean: number;
  /** 68% range — 1σ. */
  low68: number;
  high68: number;
  /** 95% range — 2σ. */
  low95: number;
  high95: number;
  /** Annualized strain marker — true for ≥3y horizons. */
  assumptionStrained: boolean;
}

export interface ForecastCone {
  /** Most recent close used as the anchor price. */
  spot: number;
  /** Annualized drift (μ) from log returns, expressed as decimal (e.g. 0.14 = 14%). */
  drift: number;
  /** Annualized volatility (σ), decimal (e.g. 0.22 = 22%). */
  volatility: number;
  /** Number of daily returns used in the fit. */
  sampleSize: number;
  /** Bands keyed by horizon. */
  bands: ForecastBand[];
  /** Set when the fit relied on too little history. */
  lowConfidence: boolean;
  /** Set when σ or |μ| are extreme — recent regime probably won't persist. */
  tailWarning: boolean;
}

export interface ForecastBar {
  date: string;
  close: number;
}

/** Build the cone from a closes-only price series. */
export function buildForecastCone(bars: ForecastBar[]): ForecastCone | null {
  const closes = bars.map((b) => b.close).filter((v) => Number.isFinite(v) && v > 0);
  if (closes.length < 2) return null;

  // Daily log returns.
  const logReturns: number[] = [];
  for (let i = 1; i < closes.length; i++) {
    logReturns.push(Math.log(closes[i] / closes[i - 1]));
  }

  const n = logReturns.length;
  const mean = logReturns.reduce((a, b) => a + b, 0) / n;
  // Sample stdev (Bessel's correction) — the data is a sample, not a population.
  const variance = logReturns.reduce((acc, r) => acc + (r - mean) ** 2, 0) / Math.max(1, n - 1);
  const stdev = Math.sqrt(variance);

  const drift = mean * TRADING_DAYS_PER_YEAR;
  const volatility = stdev * Math.sqrt(TRADING_DAYS_PER_YEAR);

  const spot = closes[closes.length - 1];

  const bands: ForecastBand[] = HORIZONS.map(({ id, label, tradingDays }) => {
    const T = tradingDays / TRADING_DAYS_PER_YEAR;
    // log-space center of the distribution (drift minus Itô correction)
    const muLog = (drift - (volatility * volatility) / 2) * T;
    const sigmaLog = volatility * Math.sqrt(T);

    return {
      id,
      label,
      median: spot * Math.exp(muLog),
      mean: spot * Math.exp(drift * T),
      low68: spot * Math.exp(muLog - sigmaLog),
      high68: spot * Math.exp(muLog + sigmaLog),
      low95: spot * Math.exp(muLog - 2 * sigmaLog),
      high95: spot * Math.exp(muLog + 2 * sigmaLog),
      assumptionStrained: tradingDays >= TRADING_DAYS_PER_YEAR * 3,
    };
  });

  return {
    spot,
    drift,
    volatility,
    sampleSize: n,
    bands,
    lowConfidence: n < 60,
    tailWarning: volatility > 0.6 || Math.abs(drift) > 0.3,
  };
}
