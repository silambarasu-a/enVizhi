import type { IndicatorSnapshot } from "./indicators";
import { classifyRegime, type RegimeRead } from "./regime";

/**
 * Pure vote function — given an indicator snapshot at a single point in
 * time, return a direction + confidence + signal breakdown.
 *
 *   This is the SAME logic the backtest uses on each historical bar. So if
 *   the live UI ever stops agreeing with the backtest, we have a bug. No
 *   network calls, no I/O, no time-of-day awareness — just the snapshot in,
 *   verdict out.
 *
 *   Signal categories (used to apply regime-aware weights):
 *     - trend          : price-vs-MA, MA-cross, ADX direction
 *     - momentum       : MACD, short return, OBV trend
 *     - meanReversion  : RSI extremes, Bollinger %B, Stochastic
 *     - volume         : CMF, OBV vs OBV-SMA
 *     - pattern        : (filled in by caller — not from snapshot)
 *
 *   Each signal contributes a vote in {-1, -0.5, 0, +0.5, +1} times its
 *   regime-adjusted weight. We sum, normalize by sum-of-absolute-weights,
 *   and apply a 0.15 deadband for neutrality.
 */

export type Direction = "up" | "down" | "neutral";

export type SignalCategory = "trend" | "momentum" | "meanReversion" | "volume" | "pattern";

export interface VoteSignal {
  name: string;
  category: SignalCategory;
  /** Raw vote in [-1, +1]. */
  vote: number;
  /** Weight after regime-aware adjustment. */
  weight: number;
  reason: string;
}

export interface VoteResult {
  direction: Direction;
  /** 0..1 — magnitude of normalized vote. */
  confidence: number;
  signals: VoteSignal[];
  regime: RegimeRead;
}

/** Run the full indicator-based vote on a single snapshot. Used identically
 *  by the live engine and by the walk-forward backtest. */
export function voteOnSnapshot(snap: IndicatorSnapshot): VoteResult {
  const regime = classifyRegime(snap);
  const w = regime.weights;
  const signals: VoteSignal[] = [];

  // ── Trend category ───────────────────────────────────────────────────
  if (snap.sma200 != null) {
    const pct = ((snap.close - snap.sma200) / snap.sma200) * 100;
    if (pct > 5) push(signals, "Price vs 200d MA", "trend", 1, w.trend, `${pct.toFixed(1)}% above 200d — strong uptrend.`);
    else if (pct > 1) push(signals, "Price vs 200d MA", "trend", 0.5, w.trend, `${pct.toFixed(1)}% above 200d — moderate uptrend.`);
    else if (pct < -5) push(signals, "Price vs 200d MA", "trend", -1, w.trend, `${Math.abs(pct).toFixed(1)}% below 200d — strong downtrend.`);
    else if (pct < -1) push(signals, "Price vs 200d MA", "trend", -0.5, w.trend, `${Math.abs(pct).toFixed(1)}% below 200d — moderate downtrend.`);
    else push(signals, "Price vs 200d MA", "trend", 0, w.trend, "At long-term average — neutral.");
  }
  if (snap.sma50 != null && snap.sma200 != null) {
    const diff = ((snap.sma50 - snap.sma200) / snap.sma200) * 100;
    if (diff > 5) push(signals, "Golden/death cross", "trend", 1, w.trend, `50d ${diff.toFixed(1)}% above 200d — golden cross deep.`);
    else if (diff > 1) push(signals, "Golden/death cross", "trend", 0.5, w.trend, `50d above 200d — early uptrend.`);
    else if (diff < -5) push(signals, "Golden/death cross", "trend", -1, w.trend, `50d ${Math.abs(diff).toFixed(1)}% below 200d — death cross deep.`);
    else if (diff < -1) push(signals, "Golden/death cross", "trend", -0.5, w.trend, `50d below 200d — early downtrend.`);
    else push(signals, "Golden/death cross", "trend", 0, w.trend, "MAs intersecting — trend ambiguous.");
  }
  if (snap.adx14 != null && snap.plusDi != null && snap.minusDi != null && snap.adx14 > 25) {
    if (snap.plusDi > snap.minusDi) push(signals, "ADX direction", "trend", 0.5, w.trend, `ADX ${snap.adx14.toFixed(0)} with +DI > -DI — bull trend confirmed.`);
    else push(signals, "ADX direction", "trend", -0.5, w.trend, `ADX ${snap.adx14.toFixed(0)} with -DI > +DI — bear trend confirmed.`);
  }

  // ── Momentum category ────────────────────────────────────────────────
  if (snap.macdHist != null && snap.macdLine != null && snap.macdSignal != null) {
    const above = snap.macdLine > snap.macdSignal;
    const histStrong = Math.abs(snap.macdHist) > 0.5;
    if (above && histStrong) push(signals, "MACD", "momentum", 1, w.momentum, "MACD above signal with strong histogram — momentum positive.");
    else if (above) push(signals, "MACD", "momentum", 0.5, w.momentum, "MACD above signal — momentum positive.");
    else if (histStrong) push(signals, "MACD", "momentum", -1, w.momentum, "MACD below signal with strong negative histogram — momentum negative.");
    else push(signals, "MACD", "momentum", -0.5, w.momentum, "MACD below signal — momentum weak.");
  }
  if (snap.return5d != null) {
    if (snap.return5d > 5) push(signals, "5-day return", "momentum", 1, w.momentum, `5-day +${snap.return5d.toFixed(1)}% — strong recent momentum.`);
    else if (snap.return5d > 1.5) push(signals, "5-day return", "momentum", 0.5, w.momentum, `5-day +${snap.return5d.toFixed(1)}% — positive momentum.`);
    else if (snap.return5d < -5) push(signals, "5-day return", "momentum", -1, w.momentum, `5-day ${snap.return5d.toFixed(1)}% — strong negative momentum.`);
    else if (snap.return5d < -1.5) push(signals, "5-day return", "momentum", -0.5, w.momentum, `5-day ${snap.return5d.toFixed(1)}% — negative momentum.`);
    else push(signals, "5-day return", "momentum", 0, w.momentum, `5-day ${snap.return5d >= 0 ? "+" : ""}${snap.return5d.toFixed(1)}% — flat.`);
  }

  // ── Mean reversion category (CONTRARIAN — extremes flag fades) ───────
  if (snap.rsi14 != null) {
    if (snap.rsi14 > 75) push(signals, "RSI fade", "meanReversion", -1, w.meanReversion, `RSI ${snap.rsi14.toFixed(0)} — overbought; reversion likely.`);
    else if (snap.rsi14 > 65) push(signals, "RSI fade", "meanReversion", -0.5, w.meanReversion, `RSI ${snap.rsi14.toFixed(0)} — getting stretched up.`);
    else if (snap.rsi14 < 25) push(signals, "RSI fade", "meanReversion", 1, w.meanReversion, `RSI ${snap.rsi14.toFixed(0)} — oversold; bounce likely.`);
    else if (snap.rsi14 < 35) push(signals, "RSI fade", "meanReversion", 0.5, w.meanReversion, `RSI ${snap.rsi14.toFixed(0)} — getting stretched down.`);
    else push(signals, "RSI fade", "meanReversion", 0, w.meanReversion, `RSI ${snap.rsi14.toFixed(0)} — healthy range.`);
  }
  if (snap.bbPctB != null) {
    if (snap.bbPctB > 95) push(signals, "Bollinger %B", "meanReversion", -1, w.meanReversion, `At/above upper band — overextended.`);
    else if (snap.bbPctB > 85) push(signals, "Bollinger %B", "meanReversion", -0.5, w.meanReversion, `Pushing on upper band.`);
    else if (snap.bbPctB < 5) push(signals, "Bollinger %B", "meanReversion", 1, w.meanReversion, `At/below lower band — oversold short-term.`);
    else if (snap.bbPctB < 15) push(signals, "Bollinger %B", "meanReversion", 0.5, w.meanReversion, `Pushing on lower band.`);
    else push(signals, "Bollinger %B", "meanReversion", 0, w.meanReversion, "Mid-band — no extreme.");
  }
  if (snap.stochK != null && snap.stochD != null) {
    if (snap.stochK > 80 && snap.stochK < snap.stochD) push(signals, "Stochastic", "meanReversion", -1, w.meanReversion, "Stoch in overbought zone with bearish cross — reversion flag.");
    else if (snap.stochK > 80) push(signals, "Stochastic", "meanReversion", -0.5, w.meanReversion, `Stoch %K ${snap.stochK.toFixed(0)} — overbought.`);
    else if (snap.stochK < 20 && snap.stochK > snap.stochD) push(signals, "Stochastic", "meanReversion", 1, w.meanReversion, "Stoch in oversold zone with bullish cross — bounce flag.");
    else if (snap.stochK < 20) push(signals, "Stochastic", "meanReversion", 0.5, w.meanReversion, `Stoch %K ${snap.stochK.toFixed(0)} — oversold.`);
    else push(signals, "Stochastic", "meanReversion", 0, w.meanReversion, "Stoch in normal range.");
  }

  // ── Volume category ──────────────────────────────────────────────────
  if (snap.cmf20 != null) {
    if (snap.cmf20 > 0.15) push(signals, "Money flow (CMF)", "volume", 1, w.volume, `CMF +${snap.cmf20.toFixed(2)} — accumulation.`);
    else if (snap.cmf20 > 0.05) push(signals, "Money flow (CMF)", "volume", 0.5, w.volume, `CMF +${snap.cmf20.toFixed(2)} — light accumulation.`);
    else if (snap.cmf20 < -0.15) push(signals, "Money flow (CMF)", "volume", -1, w.volume, `CMF ${snap.cmf20.toFixed(2)} — distribution.`);
    else if (snap.cmf20 < -0.05) push(signals, "Money flow (CMF)", "volume", -0.5, w.volume, `CMF ${snap.cmf20.toFixed(2)} — light distribution.`);
    else push(signals, "Money flow (CMF)", "volume", 0, w.volume, "CMF near zero — balanced flow.");
  }
  if (snap.obv != null && snap.obvSma20 != null) {
    if (snap.obv > snap.obvSma20 * 1.05) push(signals, "OBV trend", "volume", 0.5, w.volume, "OBV above 20d SMA — volume confirms uptrend.");
    else if (snap.obv < snap.obvSma20 * 0.95) push(signals, "OBV trend", "volume", -0.5, w.volume, "OBV below 20d SMA — volume diverges from price.");
    else push(signals, "OBV trend", "volume", 0, w.volume, "OBV near 20d SMA — neutral.");
  }

  // ── Aggregate ────────────────────────────────────────────────────────
  const totalWeighted = signals.reduce((sum, s) => sum + s.vote * s.weight, 0);
  const totalWeight = signals.reduce((sum, s) => sum + Math.abs(s.weight), 0);
  const normalized = totalWeight > 0 ? totalWeighted / totalWeight : 0;

  const direction: Direction = normalized > 0.15 ? "up" : normalized < -0.15 ? "down" : "neutral";
  const confidence = Math.min(1, Math.abs(normalized)) * regime.confidenceMultiplier;

  return { direction, confidence, signals, regime };
}

function push(
  out: VoteSignal[],
  name: string,
  category: SignalCategory,
  vote: number,
  weight: number,
  reason: string,
): void {
  out.push({ name, category, vote, weight, reason });
}
