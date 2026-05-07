import type { Score, Signal } from "./types";
import { scoreToSignal, weightedAverage } from "./types";
import type { TechnicalScore } from "./technical";
import type { LynchScore } from "./lynch";

/**
 * Overall composite from the three pillars.
 *
 *   Default weights:
 *     - Fundamentals  50%   (the durable thesis driver)
 *     - Technical     30%   (timing / current regime)
 *     - Lynch valuation 20% (single-heuristic price discipline)
 *
 *   Weights redistribute when a pillar is null (insufficient data) — same
 *   pattern as the within-pillar averaging. Coverage drops, but the signal is
 *   still computable from whatever pillars survived.
 *
 *   Bias is whatever the technical engine says (we don't second-guess it
 *   from fundamentals — they operate on different time scales).
 */

export interface OverallScore {
  /** 0-100 composite, or null if no pillar had data. */
  value: number | null;
  signal: Signal | null;
  /** Fraction of total weight that contributed (0-1). */
  coverage: number;
  /** One-sentence summary of why we landed where we did. */
  rationale: string;
  /** Per-pillar contribution table for the UI. */
  contributions: Array<{
    label: string;
    value: number | null;
    weight: number;
    headline: string;
  }>;
}

export function combineScores(args: {
  fundamentals: Score;
  technical: TechnicalScore;
  lynch: LynchScore;
}): OverallScore {
  const pillars = [
    {
      label: "Fundamentals",
      score: args.fundamentals,
      weight: 0.5,
    },
    {
      label: "Technical",
      score: args.technical as Score,
      weight: 0.3,
    },
    {
      label: "Lynch valuation",
      score: args.lynch as Score,
      weight: 0.2,
    },
  ];

  // Reuse weightedAverage by treating each pillar as a SubScore.
  const { value, coverage } = weightedAverage(
    pillars.map((p) => ({
      label: p.label,
      weight: p.weight,
      value: p.score.value,
      verdict: p.score.headline,
      inputs: [],
    })),
  );

  const rounded = value != null ? Math.round(value) : null;
  const signal = scoreToSignal(rounded);

  return {
    value: rounded,
    signal,
    coverage,
    rationale: rationaleFor(rounded, pillars),
    contributions: pillars.map((p) => ({
      label: p.label,
      value: p.score.value,
      weight: p.weight,
      headline: p.score.headline,
    })),
  };
}

function rationaleFor(
  value: number | null,
  pillars: Array<{ label: string; score: Score; weight: number }>,
): string {
  if (value == null) return "No pillar had enough data to score.";
  const ranked = pillars
    .filter((p) => p.score.value != null)
    .sort((a, b) => (b.score.value as number) - (a.score.value as number));

  const strongest = ranked[0];
  const weakest = ranked[ranked.length - 1];
  if (!strongest) return "Insufficient data.";
  if (strongest === weakest) return `Driven entirely by ${strongest.label.toLowerCase()}.`;

  const strongVal = strongest.score.value as number;
  const weakVal = weakest.score.value as number;
  const gap = strongVal - weakVal;

  if (gap < 15) {
    return `Pillars are aligned (${pillars
      .map((p) => p.score.value)
      .filter((v) => v != null)
      .map((v) => Math.round(v as number))
      .join(" / ")}).`;
  }

  return `Strongest: ${strongest.label.toLowerCase()} (${Math.round(strongVal)}). Weakest: ${weakest.label.toLowerCase()} (${Math.round(weakVal)}).`;
}
