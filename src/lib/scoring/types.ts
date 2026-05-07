/**
 * Shared types for the stock scoring engine.
 *
 * Every score module (fundamentals, technical, lynch, overall) returns a
 * `Score` shape:  the headline 0-100 number plus the inputs and reasons that
 * produced it. The scoreboard UI uses `inputs` to render the click-to-expand
 * "why" panel, so labels and values must be human-readable.
 */

export interface ScoreInput {
  /** Display label, e.g. "P/E ratio". */
  label: string;
  /** The raw value as it should appear, e.g. "23.4" or "INR 130.79". */
  value: string;
  /** Sub-score this input contributed to the parent (0-100), or null if the
   *  field was missing / unusable. */
  contribution: number | null;
  /** One-line interpretation of the value, e.g. "Below 20 is reasonable for a
   *  mid-growth company." */
  note: string;
}

export interface SubScore {
  /** Group label, e.g. "Valuation". */
  label: string;
  /** 0-100, or null if not enough data was available. */
  value: number | null;
  /** Weight of this subscore inside the parent (0-1). */
  weight: number;
  /** One-line summary of the verdict, e.g. "Cheap relative to growth". */
  verdict: string;
  /** Drill-down inputs that fed this subscore. */
  inputs: ScoreInput[];
}

export interface Score {
  /** Headline 0-100 score. May be null when insufficient data. */
  value: number | null;
  /** Coverage 0-1 — fraction of expected inputs that were available. Drives
   *  the "low confidence" badge in the UI. */
  coverage: number;
  /** Sub-scores that were averaged into `value`. */
  subscores: SubScore[];
  /** Headline summary, e.g. "Strong fundamentals" or "Insufficient data". */
  headline: string;
}

/** Bands the overall composite maps onto. Strictly research signals — never
 *  presented as investment advice. */
export type Signal = "buy" | "accumulate" | "hold" | "reduce" | "avoid";

/** Near-term technical bias derived from indicator voting. Not a forecast. */
export type Bias = "bullish" | "neutral" | "bearish";

export const SIGNAL_LABEL: Record<Signal, string> = {
  buy: "Buy signal",
  accumulate: "Accumulate signal",
  hold: "Hold",
  reduce: "Reduce signal",
  avoid: "Avoid",
};

export const SIGNAL_DESCRIPTION: Record<Signal, string> = {
  buy: "Multiple factors align positively. Worth deep diligence.",
  accumulate: "Skew is positive. Build position gradually if conviction firms.",
  hold: "Mixed signals — neither a clear buy nor a clear exit.",
  reduce: "Skew is negative. Trim or wait for a better setup.",
  avoid: "Multiple factors aligned negatively. Stay out unless thesis is contrarian.",
};

export const BIAS_LABEL: Record<Bias, string> = {
  bullish: "Bullish",
  neutral: "Neutral",
  bearish: "Bearish",
};

/** Map a 0-100 composite score into a research signal band. */
export function scoreToSignal(value: number | null): Signal | null {
  if (value == null) return null;
  if (value >= 80) return "buy";
  if (value >= 65) return "accumulate";
  if (value >= 45) return "hold";
  if (value >= 30) return "reduce";
  return "avoid";
}

// ─── Internal helpers ────────────────────────────────────────────────────

/** Linear ramp helper: returns 100 when value is at `best`, 0 at `worst`,
 *  with linear interpolation in between. Clamps outside the range. */
export function ramp(
  value: number,
  worst: number,
  best: number,
): number {
  if (worst === best) return value === best ? 100 : 0;
  const ascending = best > worst;
  const lo = ascending ? worst : best;
  const hi = ascending ? best : worst;
  const clamped = Math.max(lo, Math.min(hi, value));
  const t = (clamped - lo) / (hi - lo);
  return ascending ? t * 100 : (1 - t) * 100;
}

/** Bucket helper: maps a numeric value to a 0-100 score using the highest-
 *  matching bracket. Brackets must be sorted ascending by `lt` (strictly less
 *  than). The first bracket that the value satisfies wins. The final bracket
 *  acts as an "else" via `lt: Infinity`. */
export function bucket(
  value: number,
  brackets: Array<{ lt: number; score: number }>,
): number {
  for (const b of brackets) {
    if (value < b.lt) return b.score;
  }
  return brackets[brackets.length - 1]?.score ?? 0;
}

/** Average sub-scores using their stated weights. Missing sub-scores (null
 *  value) drop out entirely — their weight is redistributed across the
 *  available ones. Returns { value, coverage } where coverage is the fraction
 *  of total weight that had data. */
export function weightedAverage(
  subscores: SubScore[],
): { value: number | null; coverage: number } {
  const present = subscores.filter((s) => s.value != null);
  if (present.length === 0) return { value: null, coverage: 0 };

  const totalWeight = subscores.reduce((sum, s) => sum + s.weight, 0);
  const presentWeight = present.reduce((sum, s) => sum + s.weight, 0);
  if (presentWeight === 0) return { value: null, coverage: 0 };

  const weightedSum = present.reduce(
    (sum, s) => sum + (s.value as number) * s.weight,
    0,
  );
  return {
    value: weightedSum / presentWeight,
    coverage: totalWeight === 0 ? 0 : presentWeight / totalWeight,
  };
}

export function isFiniteNum(v: unknown): v is number {
  return typeof v === "number" && Number.isFinite(v);
}
