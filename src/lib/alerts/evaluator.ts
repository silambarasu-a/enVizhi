/**
 * Alert evaluator — pure decision logic.
 *
 * Given an alert's threshold and the current values it depends on, returns
 * whether the alert should fire *right now*. The caller is responsible for
 * loading prior `triggeredAt` and applying re-arm windows.
 *
 * Five alert types:
 *   PRICE_ABOVE   — fires when current price > threshold
 *   PRICE_BELOW   — fires when current price < threshold
 *   PE_BELOW      — fires when current PE  < threshold (cheaper than X)
 *   PEG_BELOW     — fires when current PEG < threshold (cheaper than X)
 *   MOVE_PCT      — fires when |day's % change| ≥ threshold (volatility alert)
 */

import type { AlertType } from "@/generated/prisma/enums";

export interface AlertSnapshot {
  /** Current quote price. */
  price: number | null;
  /** Today's % change. */
  changePct: number | null;
  /** Latest PE from fundamentals snapshot. */
  pe: number | null;
  /** Latest PEG from fundamentals snapshot. */
  peg: number | null;
}

export interface EvaluatedAlert {
  fired: boolean;
  /** What value triggered (or didn't trigger) the alert. */
  observedValue: number | null;
  /** Optional skip reason for diagnostics. */
  skip?: "missing-input" | "rearm-window" | "inactive";
}

export function evaluateAlert(
  type: AlertType,
  threshold: number,
  snapshot: AlertSnapshot,
): EvaluatedAlert {
  const observed = pickValue(type, snapshot);
  if (observed == null) {
    return { fired: false, observedValue: null, skip: "missing-input" };
  }

  switch (type) {
    case "PRICE_ABOVE":
      return { fired: observed > threshold, observedValue: observed };
    case "PRICE_BELOW":
      return { fired: observed < threshold, observedValue: observed };
    case "PE_BELOW":
      return { fired: observed < threshold, observedValue: observed };
    case "PEG_BELOW":
      return { fired: observed < threshold, observedValue: observed };
    case "MOVE_PCT":
      // Threshold is a magnitude — fire on either direction.
      return { fired: Math.abs(observed) >= Math.abs(threshold), observedValue: observed };
  }
}

/** Whether enough time has elapsed since `triggeredAt` for the alert to re-fire. */
export function inRearmWindow(
  triggeredAt: Date | null,
  rearmAfterHours: number,
  now: Date = new Date(),
): boolean {
  if (triggeredAt == null) return false;
  if (rearmAfterHours <= 0) return true; // one-shot — never re-fire
  const elapsedMs = now.getTime() - triggeredAt.getTime();
  return elapsedMs < rearmAfterHours * 3600 * 1000;
}

function pickValue(type: AlertType, s: AlertSnapshot): number | null {
  switch (type) {
    case "PRICE_ABOVE":
    case "PRICE_BELOW":
      return s.price;
    case "PE_BELOW":
      return s.pe;
    case "PEG_BELOW":
      return s.peg;
    case "MOVE_PCT":
      return s.changePct;
  }
}

export const ALERT_TYPE_LABEL: Record<AlertType, string> = {
  PRICE_ABOVE: "Price above",
  PRICE_BELOW: "Price below",
  PE_BELOW: "PE below",
  PEG_BELOW: "PEG below",
  MOVE_PCT: "Daily move ≥",
};

export const ALERT_TYPE_UNIT: Record<AlertType, string> = {
  PRICE_ABOVE: "",
  PRICE_BELOW: "",
  PE_BELOW: "x",
  PEG_BELOW: "x",
  MOVE_PCT: "%",
};
