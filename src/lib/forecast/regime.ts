import type { IndicatorSnapshot } from "./indicators";

/**
 * Market regime classifier.
 *
 *   Regime drives signal weighting downstream — in a strong trend the
 *   trend-following signals (price vs SMA, MACD direction) dominate. In a
 *   ranging market the mean-reversion signals (Bollinger, RSI extremes,
 *   Stochastic) dominate. In a high-volatility regime everything gets
 *   damped because false signals are common.
 *
 *   Classification rules (simple, robust):
 *
 *     Trending up   : price > SMA200, SMA50 > SMA200, ADX > 25, +DI > -DI
 *     Trending down : price < SMA200, SMA50 < SMA200, ADX > 25, -DI > +DI
 *     High vol      : ATR / price > 4% (about 2σ for typical equities)
 *     Ranging       : ADX < 20 OR mixed trend signals
 *     Mixed         : everything else (transitional)
 *
 *   Volatility regime is orthogonal — a stock can be trending AND volatile,
 *   in which case we tag both. The directional engine reads `damping` to
 *   shrink confidence in high-vol regimes regardless of direction call.
 */

export type Regime =
  | "trending_up"
  | "trending_down"
  | "ranging"
  | "mixed";

export interface RegimeRead {
  regime: Regime;
  /** True when ATR / price > 4%. Direction signal less reliable. */
  highVolatility: boolean;
  /** Plain-English summary for the UI. */
  description: string;
  /** Multipliers applied to signal-category weights downstream. Sum needn't equal 1. */
  weights: {
    trend: number;
    momentum: number;
    meanReversion: number;
    volume: number;
    pattern: number;
  };
  /** Confidence damping (0-1). High vol → close to 0.7. */
  confidenceMultiplier: number;
}

export function classifyRegime(snap: IndicatorSnapshot): RegimeRead {
  const { close, sma50, sma200, adx14, plusDi, minusDi, atr14 } = snap;

  const adxStrong = adx14 != null && adx14 > 25;
  const adxWeak = adx14 != null && adx14 < 20;
  const aboveLong = sma200 != null && close > sma200;
  const belowLong = sma200 != null && close < sma200;
  const goldenCross = sma50 != null && sma200 != null && sma50 > sma200;
  const deathCross = sma50 != null && sma200 != null && sma50 < sma200;
  const plusOver = plusDi != null && minusDi != null && plusDi > minusDi;
  const minusOver = plusDi != null && minusDi != null && minusDi > plusDi;

  const atrPct = atr14 != null && close > 0 ? (atr14 / close) * 100 : null;
  const highVolatility = atrPct != null && atrPct > 4;

  let regime: Regime;
  let description: string;

  if (adxStrong && aboveLong && goldenCross && plusOver) {
    regime = "trending_up";
    description = `Strong uptrend (ADX ${adx14!.toFixed(0)}, price > 200d MA, +DI > -DI).`;
  } else if (adxStrong && belowLong && deathCross && minusOver) {
    regime = "trending_down";
    description = `Strong downtrend (ADX ${adx14!.toFixed(0)}, price < 200d MA, -DI > +DI).`;
  } else if (adxWeak) {
    regime = "ranging";
    description = `Range-bound (ADX ${adx14!.toFixed(0)} — no dominant trend).`;
  } else {
    regime = "mixed";
    description = "Mixed signals — trend forming or breaking down.";
  }

  if (highVolatility) {
    description += ` High vol (ATR ${atrPct!.toFixed(1)}% of price).`;
  }

  // Weights chosen so trend regimes punish mean-reversion fades and
  // ranging regimes punish trend-following.
  const weights = (() => {
    if (regime === "trending_up" || regime === "trending_down") {
      return { trend: 1.5, momentum: 1.2, meanReversion: 0.5, volume: 1, pattern: 1 };
    }
    if (regime === "ranging") {
      return { trend: 0.4, momentum: 0.7, meanReversion: 1.5, volume: 0.9, pattern: 1.1 };
    }
    return { trend: 1, momentum: 1, meanReversion: 1, volume: 1, pattern: 1 };
  })();

  // Damp confidence by 25% in high-vol regimes — false moves are common.
  const confidenceMultiplier = highVolatility ? 0.75 : 1;

  return { regime, highVolatility, description, weights, confidenceMultiplier };
}

export const REGIME_LABEL: Record<Regime, string> = {
  trending_up: "Trending up",
  trending_down: "Trending down",
  ranging: "Ranging",
  mixed: "Mixed",
};
