/**
 * Directional engine v2 — multi-signal probabilistic direction read.
 *
 *   Takes 5y of OHLCV bars + (optional) Yahoo insights + (optional) earnings
 *   date, integrates everything through:
 *
 *     1. Indicator-based vote on the *current* snapshot (voting.ts)
 *     2. Candlestick pattern detection
 *     3. Yahoo's pre-computed multi-timeframe outlooks (short / intermediate / long)
 *     4. Analyst recommendation + target price gap
 *     5. News sentiment from sigDevs headlines
 *     6. Earnings proximity damping (within 5 trading days = high vol)
 *     7. Walk-forward backtest hit rate on this stock's own history
 *
 *   The output:
 *     - Per-horizon (today / 1 week / 1 month) direction + confidence + magnitude
 *     - Backtested accuracy on this stock specifically
 *     - Regime (trending up/down/ranging/mixed) for context
 *     - Categorized signal breakdown for the UI's "Why" panel
 *
 *   Magnitudes still come from realized σ × √T — that part's unchanged
 *   because no model can predict magnitude with high accuracy.
 */

import { precomputeIndicators, snapshotAt, type RichBar } from "./indicators";
import { voteOnSnapshot, type VoteResult, type VoteSignal } from "./voting";
import { detectPattern } from "./patterns";
import { scoreSentiment, type SentimentScore } from "./sentiment";
import { runBacktest, type BacktestResult } from "./backtest";
import type { NormalizedInsights } from "@/lib/market-data/types";
import type { Regime } from "./regime";

export type Direction = "up" | "down" | "neutral";

export interface DirectionalReadEntry {
  id: "1d" | "1w" | "1m";
  label: string;
  tradingDays: number;
  direction: Direction;
  confidence: number;
  expectedUpPct: number;
  expectedDownPct: number;
  upTargetPrice: number;
  downTargetPrice: number;
}

export interface DirectionalRead {
  spot: number;
  /** Annualized vol (σ_annual). */
  volatility: number;
  /** Daily vol (σ_d) — used to scale magnitudes. */
  dailyVolatility: number;
  horizons: DirectionalReadEntry[];
  signals: VoteSignal[];
  regime: { kind: Regime; description: string; highVolatility: boolean };
  /** Backtested accuracy on this stock — null if too little history. */
  backtest: BacktestResult | null;
  /** Yahoo analyst recommendation, if available. */
  analyst: NormalizedInsights["recommendation"];
  /** Pre-computed multi-timeframe outlooks from Yahoo. */
  outlooks: NormalizedInsights["outlooks"] | null;
  /** Key technical levels from Yahoo (support/resistance/stop). */
  keyTechnicals: NormalizedInsights["keyTechnicals"] | null;
  /** News sentiment from recent significant developments. */
  sentiment: SentimentScore | null;
  /** Days until next earnings (positive = future, negative = past). */
  daysToEarnings: number | null;
  /** Earnings within 5 trading days — damp confidence. */
  earningsProximityWarning: boolean;
  /** Detected candlestick pattern on the most recent bar. */
  pattern: { kind: string; bias: number; reason: string };
  /** True when bars are too sparse for a reliable read. */
  lowConfidence: boolean;
}

const HORIZONS: Array<{ id: DirectionalReadEntry["id"]; label: string; tradingDays: number }> = [
  { id: "1d", label: "Today", tradingDays: 1 },
  { id: "1w", label: "1 week", tradingDays: 5 },
  { id: "1m", label: "1 month", tradingDays: 21 },
];

const TRADING_DAYS_PER_YEAR = 252;

export function buildDirectionalRead(args: {
  bars: RichBar[];
  insights: NormalizedInsights | null;
  earningsDate: Date | null;
}): DirectionalRead | null {
  const { bars, insights, earningsDate } = args;
  if (bars.length < 30) return null;

  const ind = precomputeIndicators(bars);
  const i = bars.length - 1;
  const snap = snapshotAt(ind, i);
  const vote: VoteResult = voteOnSnapshot(snap);

  // ─── Layered enrichments ────────────────────────────────────────────
  const pattern = detectPattern(bars);

  // Add pattern as a signal.
  const allSignals: VoteSignal[] = [...vote.signals];
  if (pattern.kind !== "none") {
    allSignals.push({
      name: "Candlestick",
      category: "pattern",
      vote: pattern.bias,
      weight: vote.regime.weights.pattern,
      reason: pattern.reason,
    });
  }

  // Yahoo's pre-computed multi-timeframe outlooks.
  const outlooks = insights?.outlooks ?? null;
  if (outlooks?.short) {
    allSignals.push({
      name: "Yahoo short outlook",
      category: "trend",
      vote:
        outlooks.short.direction === "Bullish"
          ? 1
          : outlooks.short.direction === "Bearish"
            ? -1
            : 0,
      weight: 0.7,
      reason: `Yahoo short-term outlook: ${outlooks.short.direction}.`,
    });
  }
  if (outlooks?.intermediate) {
    allSignals.push({
      name: "Yahoo intermediate outlook",
      category: "trend",
      vote:
        outlooks.intermediate.direction === "Bullish"
          ? 1
          : outlooks.intermediate.direction === "Bearish"
            ? -1
            : 0,
      weight: 0.5,
      reason: `Yahoo intermediate outlook: ${outlooks.intermediate.direction}.`,
    });
  }

  // Analyst recommendation: BUY/HOLD/SELL → ±1/0, plus target price gap.
  const spot = bars[i].close;
  const analyst = insights?.recommendation ?? null;
  if (analyst) {
    const ratingVote = analyst.rating === "BUY" ? 1 : analyst.rating === "SELL" ? -1 : 0;
    if (ratingVote !== 0) {
      allSignals.push({
        name: "Analyst rating",
        category: "trend",
        vote: ratingVote,
        weight: 0.8,
        reason: `Analyst consensus: ${analyst.rating}${
          analyst.targetPrice ? ` (target ${analyst.targetPrice.toFixed(2)})` : ""
        }.`,
      });
    }
    if (analyst.targetPrice && analyst.targetPrice > 0) {
      const gap = ((analyst.targetPrice - spot) / spot) * 100;
      if (gap > 10) {
        allSignals.push({
          name: "Target price gap",
          category: "trend",
          vote: 1,
          weight: 0.6,
          reason: `Analyst target ${gap.toFixed(0)}% above spot.`,
        });
      } else if (gap < -10) {
        allSignals.push({
          name: "Target price gap",
          category: "trend",
          vote: -1,
          weight: 0.6,
          reason: `Analyst target ${Math.abs(gap).toFixed(0)}% below spot.`,
        });
      }
    }
  }

  // News sentiment from sigDevs.
  const sentiment = insights?.headlines ? scoreSentiment(insights.headlines) : null;
  if (sentiment && sentiment.headlineCount > 0 && Math.abs(sentiment.polarity) > 0.1) {
    const sVote = Math.max(-1, Math.min(1, sentiment.polarity * 2));
    allSignals.push({
      name: "News sentiment",
      category: "momentum",
      vote: sVote,
      weight: 0.5,
      reason: `${sentiment.headlineCount} headlines analysed. Net ${
        sentiment.polarity > 0 ? "positive" : "negative"
      } (${(sentiment.polarity * 100).toFixed(0)}%).`,
    });
  }

  // ─── Re-aggregate the full signal set ────────────────────────────────
  const totalWeighted = allSignals.reduce((sum, s) => sum + s.vote * s.weight, 0);
  const totalWeight = allSignals.reduce((sum, s) => sum + Math.abs(s.weight), 0);
  const normalized = totalWeight > 0 ? totalWeighted / totalWeight : 0;

  // Earnings proximity: damp confidence when within 5 trading days.
  const daysToEarnings = earningsDate
    ? Math.round((earningsDate.getTime() - Date.now()) / (24 * 3600 * 1000))
    : null;
  const earningsProximityWarning = daysToEarnings != null && daysToEarnings >= 0 && daysToEarnings <= 7;

  let direction: Direction = normalized > 0.15 ? "up" : normalized < -0.15 ? "down" : "neutral";
  let confidence = Math.min(1, Math.abs(normalized)) * vote.regime.confidenceMultiplier;
  if (earningsProximityWarning) {
    confidence *= 0.6;
    // If confidence drops too low due to earnings damping, fall back to neutral.
    if (confidence < 0.15) direction = "neutral";
  }

  // ─── Magnitude — realized vol scaled by √T ───────────────────────────
  const closes = bars.map((b) => b.close);
  const logReturns: number[] = [];
  for (let k = 1; k < closes.length; k++) {
    logReturns.push(Math.log(closes[k] / closes[k - 1]));
  }
  const meanRet = logReturns.reduce((a, b) => a + b, 0) / logReturns.length;
  const variance =
    logReturns.reduce((acc, r) => acc + (r - meanRet) ** 2, 0) / Math.max(1, logReturns.length - 1);
  const dailyVol = Math.sqrt(variance);
  const annualVol = dailyVol * Math.sqrt(TRADING_DAYS_PER_YEAR);

  const horizons: DirectionalReadEntry[] = HORIZONS.map(({ id, label, tradingDays }) => {
    const sigmaT = dailyVol * Math.sqrt(tradingDays);
    return {
      id,
      label,
      tradingDays,
      direction,
      confidence,
      expectedUpPct: (Math.exp(sigmaT) - 1) * 100,
      expectedDownPct: (1 - Math.exp(-sigmaT)) * 100,
      upTargetPrice: spot * Math.exp(sigmaT),
      downTargetPrice: spot * Math.exp(-sigmaT),
    };
  });

  // ─── Backtest on this stock's history ────────────────────────────────
  const backtest = runBacktest(bars);

  return {
    spot,
    volatility: annualVol,
    dailyVolatility: dailyVol,
    horizons,
    signals: allSignals,
    regime: {
      kind: vote.regime.regime,
      description: vote.regime.description,
      highVolatility: vote.regime.highVolatility,
    },
    backtest,
    analyst,
    outlooks,
    keyTechnicals: insights?.keyTechnicals ?? null,
    sentiment,
    daysToEarnings,
    earningsProximityWarning,
    pattern: { kind: pattern.kind, bias: pattern.bias, reason: pattern.reason },
    lowConfidence: bars.length < 60 || allSignals.length < 5,
  };
}
