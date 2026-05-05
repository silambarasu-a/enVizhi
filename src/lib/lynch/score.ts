/**
 * Peter Lynch's quantitative tools, expressed as pure functions.
 *
 * All inputs may be null (provider gaps); functions return null when they
 * can't be computed safely. No throws.
 *
 *   - modifiedPEG = (EPS growth % + dividend yield %) / PE
 *     A standard PE/Growth ratio under-rewards dividend payers; Lynch's modified
 *     form adds the yield to the numerator. Brackets:
 *        ≥ 2     excellent / "buying earnings cheap"
 *        ≥ 1     good      / "fairly valued"
 *        ≥ 0.5   ok        / "watchlist territory"
 *        < 0.5   poor      / "expensive on his framework"
 *
 *   - Lynch fair P/E ≈ EPS growth rate (a 15%-grower deserves a P/E of 15)
 *
 *   - Lynch fair value = fairPE × trailing EPS
 */

export type ModifiedPegBracket = "excellent" | "good" | "ok" | "poor";

export function modifiedPEG(
  pe: number | null | undefined,
  epsGrowth5yPct: number | null | undefined,
  dividendYieldPct: number | null | undefined,
): number | null {
  if (!isFiniteNumber(pe) || pe! <= 0) return null;
  if (!isFiniteNumber(epsGrowth5yPct)) return null;
  const yld = isFiniteNumber(dividendYieldPct) ? dividendYieldPct! : 0;
  return (epsGrowth5yPct! + yld) / pe!;
}

export function modifiedPegBracket(value: number | null | undefined): ModifiedPegBracket | null {
  if (!isFiniteNumber(value)) return null;
  if (value! >= 2) return "excellent";
  if (value! >= 1) return "good";
  if (value! >= 0.5) return "ok";
  return "poor";
}

/** Lynch's "fair P/E" heuristic: a stock deserves a P/E close to its growth rate.
 *  Negative or zero growth → no fair P/E (a falling business has no growth-justified premium). */
export function fairPE(epsGrowth5yPct: number | null | undefined): number | null {
  if (!isFiniteNumber(epsGrowth5yPct)) return null;
  if (epsGrowth5yPct! <= 0) return null;
  return epsGrowth5yPct!;
}

/** Lynch fair value = fairPE × trailing EPS. */
export function lynchFairValue(
  eps: number | null | undefined,
  epsGrowth5yPct: number | null | undefined,
): number | null {
  const fp = fairPE(epsGrowth5yPct);
  if (fp == null || !isFiniteNumber(eps) || eps! <= 0) return null;
  return fp * eps!;
}

/** Premium (>1) or discount (<1) of price to fair value. */
export function priceToFairRatio(
  price: number | null | undefined,
  fairValue: number | null | undefined,
): number | null {
  if (!isFiniteNumber(price) || !isFiniteNumber(fairValue) || fairValue! <= 0) return null;
  return price! / fairValue!;
}

function isFiniteNumber(v: unknown): v is number {
  return typeof v === "number" && Number.isFinite(v);
}
