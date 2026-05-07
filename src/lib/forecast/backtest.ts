import { precomputeIndicators, snapshotAt, type RichBar } from "./indicators";
import { voteOnSnapshot, type VoteResult } from "./voting";

/**
 * Walk-forward backtest of the directional model on this stock's history.
 *
 *   For each historical bar i (from `warmup` onward, where indicators are
 *   warmed up), we:
 *     1. Generate a vote using only data available up to and including i
 *        (no look-ahead — that's the "walk-forward" constraint).
 *     2. Compare the predicted direction to the realised direction
 *        bars[i+1].close vs bars[i].close.
 *     3. Tally hits, misses, and average return per call.
 *
 *   We also track hit rate by confidence band — a vote-aggregation model
 *   should be more right when it's more confident, otherwise the
 *   confidence number is meaningless.
 *
 *   Honest caveat: this measures the model on THIS stock's PAST. It says
 *   nothing about the future. It also doesn't account for transaction
 *   costs, slippage, position sizing, or the tax-on-being-wrong. Treat
 *   the hit rate as a sanity check, not a Sharpe ratio.
 */

export interface BacktestResult {
  /** Total bars evaluated (excludes warmup + final bar). */
  trials: number;
  /** Hits: predicted direction matched realised direction. */
  hits: number;
  /** Misses: predicted direction was opposite. */
  misses: number;
  /** Trials where we voted neutral (excluded from hit-rate). */
  neutralCalls: number;
  /** hits / (hits + misses) — only counts directional calls. */
  hitRate: number;
  /** Average 1d return when model said up (positive ⇒ model adds value). */
  avgReturnOnUpCalls: number;
  /** Average 1d return when model said down (negative ⇒ model adds value). */
  avgReturnOnDownCalls: number;
  /** Hit-rate broken down by confidence band — should rise with confidence
   *  if the model's confidence is calibrated. */
  byConfidence: Array<{
    label: string;
    minConfidence: number;
    trials: number;
    hits: number;
    hitRate: number;
  }>;
  /** Most-recent N evaluations for the UI. */
  recent: Array<{
    date: string;
    direction: "up" | "down" | "neutral";
    confidence: number;
    realisedReturnPct: number;
    hit: boolean | null;
  }>;
}

const CONFIDENCE_BANDS: Array<{ label: string; min: number }> = [
  { label: "≥ 60%", min: 0.6 },
  { label: "40-60%", min: 0.4 },
  { label: "< 40%", min: 0 },
];

export function runBacktest(bars: RichBar[]): BacktestResult | null {
  if (bars.length < 220) return null; // need ~200 for SMA200 + a few evals

  const ind = precomputeIndicators(bars);

  // Warmup: index after which all indicators have valid values.
  const warmup = 200;

  const recentBuf: BacktestResult["recent"] = [];
  const bandStats = CONFIDENCE_BANDS.map((b) => ({
    label: b.label,
    minConfidence: b.min,
    trials: 0,
    hits: 0,
    hitRate: 0,
  }));

  let trials = 0;
  let hits = 0;
  let misses = 0;
  let neutralCalls = 0;
  let upCallReturnSum = 0;
  let upCallCount = 0;
  let downCallReturnSum = 0;
  let downCallCount = 0;

  for (let i = warmup; i < bars.length - 1; i++) {
    const snap = snapshotAt(ind, i);
    const vote: VoteResult = voteOnSnapshot(snap);
    const next = bars[i + 1];
    const realisedReturnPct = ((next.close - bars[i].close) / bars[i].close) * 100;

    let hit: boolean | null = null;
    if (vote.direction === "up") {
      upCallReturnSum += realisedReturnPct;
      upCallCount++;
      hit = realisedReturnPct > 0;
    } else if (vote.direction === "down") {
      downCallReturnSum += realisedReturnPct;
      downCallCount++;
      hit = realisedReturnPct < 0;
    }

    trials++;
    if (vote.direction === "neutral") {
      neutralCalls++;
    } else {
      if (hit) hits++;
      else misses++;

      // Band counters by confidence.
      for (const b of bandStats) {
        if (vote.confidence >= b.minConfidence) {
          b.trials++;
          if (hit) b.hits++;
          break; // only credit highest matching band
        }
      }
    }

    if (i >= bars.length - 31) {
      recentBuf.push({
        date: bars[i].date,
        direction: vote.direction,
        confidence: vote.confidence,
        realisedReturnPct,
        hit,
      });
    }
  }

  for (const b of bandStats) {
    b.hitRate = b.trials > 0 ? b.hits / b.trials : 0;
  }

  return {
    trials,
    hits,
    misses,
    neutralCalls,
    hitRate: hits + misses > 0 ? hits / (hits + misses) : 0,
    avgReturnOnUpCalls: upCallCount > 0 ? upCallReturnSum / upCallCount : 0,
    avgReturnOnDownCalls: downCallCount > 0 ? downCallReturnSum / downCallCount : 0,
    byConfidence: bandStats,
    recent: recentBuf,
  };
}
