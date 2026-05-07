import type { RichBar } from "./indicators";

/**
 * Candlestick pattern detection on the most recent bar.
 *
 *   We detect a small set of well-documented turning-point patterns:
 *     - Doji        — neutral indecision (small body, large range)
 *     - Hammer      — bullish reversal (small body up top, long lower wick)
 *     - Shooting    — bearish reversal (small body bottom, long upper wick)
 *     - Bull engulf — bullish reversal (today's body engulfs yesterday's red)
 *     - Bear engulf — bearish reversal (today's body engulfs yesterday's green)
 *     - Marubozu up — strong bull (full-body, no/minimal wicks)
 *     - Marubozu dn — strong bear
 *
 *   Returns the strongest pattern detected (highest priority by reliability)
 *   plus a small confidence based on the body/range ratio. We deliberately
 *   don't return more than one — multiple weak patterns simultaneously
 *   reduce signal, not increase it.
 */

export type PatternKind =
  | "doji"
  | "hammer"
  | "shooting_star"
  | "bullish_engulfing"
  | "bearish_engulfing"
  | "marubozu_up"
  | "marubozu_down"
  | "none";

export interface DetectedPattern {
  kind: PatternKind;
  /** Bullish (+1), bearish (-1), neutral (0). Doji is neutral. */
  bias: number;
  /** Plain-English description for the UI. */
  reason: string;
}

const NONE: DetectedPattern = { kind: "none", bias: 0, reason: "No standout candlestick pattern." };

export function detectPattern(bars: RichBar[]): DetectedPattern {
  if (bars.length < 2) return NONE;
  const cur = bars[bars.length - 1];
  const prev = bars[bars.length - 2];

  const range = cur.high - cur.low;
  if (range <= 0) return NONE;
  const body = Math.abs(cur.close - cur.open);
  const upperWick = cur.high - Math.max(cur.open, cur.close);
  const lowerWick = Math.min(cur.open, cur.close) - cur.low;
  const isUp = cur.close > cur.open;

  // ─── Engulfing (highest priority — strong reversal) ─────────────────
  const prevBody = Math.abs(prev.close - prev.open);
  const prevUp = prev.close > prev.open;
  if (
    !prevUp &&
    isUp &&
    cur.open < prev.close &&
    cur.close > prev.open &&
    body > prevBody * 1.05
  ) {
    return {
      kind: "bullish_engulfing",
      bias: 1,
      reason: "Bullish engulfing — today's green body fully engulfs yesterday's red. Reversal flag.",
    };
  }
  if (
    prevUp &&
    !isUp &&
    cur.open > prev.close &&
    cur.close < prev.open &&
    body > prevBody * 1.05
  ) {
    return {
      kind: "bearish_engulfing",
      bias: -1,
      reason: "Bearish engulfing — today's red body fully engulfs yesterday's green. Reversal flag.",
    };
  }

  // ─── Marubozu (strong continuation) ─────────────────────────────────
  if (body / range > 0.95) {
    return isUp
      ? {
          kind: "marubozu_up",
          bias: 1,
          reason: "Bullish Marubozu — full-body up candle, no wicks. Strong buying pressure.",
        }
      : {
          kind: "marubozu_down",
          bias: -1,
          reason: "Bearish Marubozu — full-body down candle, no wicks. Strong selling pressure.",
        };
  }

  // ─── Hammer / Shooting Star (small body + one long wick) ────────────
  const smallBody = body / range < 0.3;
  if (smallBody && lowerWick > body * 2 && upperWick < body * 0.5) {
    return {
      kind: "hammer",
      bias: 1,
      reason: "Hammer — small body with long lower wick. Buyers reclaimed the day. Reversal flag.",
    };
  }
  if (smallBody && upperWick > body * 2 && lowerWick < body * 0.5) {
    return {
      kind: "shooting_star",
      bias: -1,
      reason: "Shooting star — small body with long upper wick. Sellers reclaimed the day.",
    };
  }

  // ─── Doji (indecision) ──────────────────────────────────────────────
  if (body / range < 0.05) {
    return {
      kind: "doji",
      bias: 0,
      reason: "Doji — open ≈ close. Indecision; trend may be losing momentum.",
    };
  }

  return NONE;
}
