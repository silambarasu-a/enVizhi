import { bucket, isFiniteNum, type Score, type SubScore } from "./types";

/**
 * Lynch buy / hold / sell zones from his fair-value heuristic.
 *
 *   Zones use a ±30% margin of safety around fair value:
 *     buy:  price ≤ fair × 0.70   (deep discount; classic Lynch buy)
 *     hold: fair × 0.70 < price < fair × 1.30   (within reasonable range)
 *     sell: price ≥ fair × 1.30   (priced for perfection or beyond)
 *
 *   The score is derived from the same ratio (price / fair):
 *     ratio ≤ 0.5  → 100  (extreme discount; rare and worth investigating)
 *     ratio = 1.0  → 60   (fair)
 *     ratio = 1.3  → 35   (sell-zone threshold)
 *     ratio ≥ 2.0  → 5    (extreme premium)
 *
 *   This is *one* heuristic — it works best on Stalwarts (steady mid-teens
 *   growers). Fast Growers and Asset Plays can sustain >1.3 ratios for years
 *   without being mispriced. The UI surfaces the Lynch category alongside so
 *   users can sanity-check.
 */

export type LynchZone = "buy" | "hold" | "sell" | "n/a";

export const LYNCH_ZONE_LABEL: Record<LynchZone, string> = {
  buy: "Buy zone",
  hold: "Hold zone",
  sell: "Sell zone",
  "n/a": "Not applicable",
};

export interface LynchScore extends Score {
  zone: LynchZone;
  thresholds: {
    buyBelow: number | null;
    sellAbove: number | null;
  };
  /** price / fairValue. Above 1 = expensive, below 1 = cheap. */
  ratio: number | null;
  /** Implied % move from current price to fair value. Positive = upside. */
  impliedReturnPct: number | null;
}

export interface LynchInput {
  price: number | null;
  fairValue: number | null;
}

const BUY_MULT = 0.7;
const SELL_MULT = 1.3;

export function scoreLynch({ price, fairValue }: LynchInput): LynchScore {
  if (!isFiniteNum(price) || !isFiniteNum(fairValue) || fairValue <= 0) {
    return {
      value: null,
      coverage: 0,
      subscores: [],
      headline: "Lynch fair value not computable (need positive EPS and growth).",
      zone: "n/a",
      thresholds: { buyBelow: null, sellAbove: null },
      ratio: null,
      impliedReturnPct: null,
    };
  }

  const ratio = price / fairValue;
  const impliedReturnPct = (1 / ratio - 1) * 100;
  const buyBelow = fairValue * BUY_MULT;
  const sellAbove = fairValue * SELL_MULT;

  let zone: LynchZone;
  if (price <= buyBelow) zone = "buy";
  else if (price >= sellAbove) zone = "sell";
  else zone = "hold";

  // Symmetric scoring around fair value: deepest discounts get highest score,
  // extreme premiums lowest.
  const score = bucket(ratio, [
    { lt: 0.5, score: 100 },
    { lt: 0.7, score: 90 },
    { lt: 0.9, score: 75 },
    { lt: 1.1, score: 60 },
    { lt: 1.3, score: 45 },
    { lt: 1.6, score: 25 },
    { lt: 2.0, score: 10 },
    { lt: Infinity, score: 5 },
  ]);

  const sub: SubScore = {
    label: "Lynch fair-value spread",
    weight: 1,
    value: score,
    verdict: verdictFor(zone, impliedReturnPct),
    inputs: [
      {
        label: "Current price",
        value: price.toFixed(2),
        contribution: null,
        note: "Most recent quote (15-min delayed).",
      },
      {
        label: "Lynch fair value",
        value: fairValue.toFixed(2),
        contribution: null,
        note: "Fair P/E (≈ EPS growth %) × trailing EPS.",
      },
      {
        label: "Price / fair value",
        value: `${(ratio * 100).toFixed(0)}%`,
        contribution: score,
        note:
          ratio < 0.7
            ? "Below buy threshold (30% margin of safety)."
            : ratio < 1.3
              ? "Within reasonable range — neither cheap nor stretched."
              : "Above sell threshold — priced beyond Lynch's fair value.",
      },
      {
        label: "Buy below",
        value: buyBelow.toFixed(2),
        contribution: null,
        note: "Lynch fair value × 0.70 (30% margin of safety).",
      },
      {
        label: "Sell above",
        value: sellAbove.toFixed(2),
        contribution: null,
        note: "Lynch fair value × 1.30 (30% premium ceiling).",
      },
    ],
  };

  return {
    value: Math.round(score),
    coverage: 1,
    subscores: [sub],
    headline: headlineFor(zone, impliedReturnPct),
    zone,
    thresholds: { buyBelow, sellAbove },
    ratio,
    impliedReturnPct,
  };
}

function verdictFor(zone: LynchZone, impliedReturn: number): string {
  if (zone === "buy") return `In Lynch buy zone — ${impliedReturn.toFixed(0)}% upside to fair value.`;
  if (zone === "sell") return `In Lynch sell zone — ${Math.abs(impliedReturn).toFixed(0)}% implied downside.`;
  return `Within Lynch hold zone — fairly priced by this heuristic.`;
}

function headlineFor(zone: LynchZone, impliedReturn: number): string {
  if (zone === "buy") return `Below Lynch fair value — implied +${impliedReturn.toFixed(0)}% to fair`;
  if (zone === "sell") return `Above Lynch fair value — implied ${impliedReturn.toFixed(0)}% to fair`;
  return "Within Lynch hold zone";
}
