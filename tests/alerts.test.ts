import { describe, it, expect } from "vitest";
import { evaluateAlert, inRearmWindow } from "@/lib/alerts/evaluator";

describe("evaluateAlert", () => {
  const baseSnap = { price: 100, changePct: 1.2, pe: 22, peg: 1.5 };

  it("PRICE_ABOVE fires only when price > threshold", () => {
    expect(evaluateAlert("PRICE_ABOVE", 99, baseSnap).fired).toBe(true);
    expect(evaluateAlert("PRICE_ABOVE", 100, baseSnap).fired).toBe(false);
    expect(evaluateAlert("PRICE_ABOVE", 101, baseSnap).fired).toBe(false);
  });

  it("PRICE_BELOW fires only when price < threshold", () => {
    expect(evaluateAlert("PRICE_BELOW", 101, baseSnap).fired).toBe(true);
    expect(evaluateAlert("PRICE_BELOW", 100, baseSnap).fired).toBe(false);
    expect(evaluateAlert("PRICE_BELOW", 99, baseSnap).fired).toBe(false);
  });

  it("PE_BELOW fires when PE < threshold", () => {
    expect(evaluateAlert("PE_BELOW", 25, baseSnap).fired).toBe(true);
    expect(evaluateAlert("PE_BELOW", 22, baseSnap).fired).toBe(false);
    expect(evaluateAlert("PE_BELOW", 20, baseSnap).fired).toBe(false);
  });

  it("PEG_BELOW fires when PEG < threshold", () => {
    expect(evaluateAlert("PEG_BELOW", 2, baseSnap).fired).toBe(true);
    expect(evaluateAlert("PEG_BELOW", 1, baseSnap).fired).toBe(false);
  });

  it("MOVE_PCT fires on either direction when |change| ≥ threshold", () => {
    expect(evaluateAlert("MOVE_PCT", 1, baseSnap).fired).toBe(true); // +1.2 ≥ 1
    expect(evaluateAlert("MOVE_PCT", 1, { ...baseSnap, changePct: -3.5 }).fired).toBe(true);
    expect(evaluateAlert("MOVE_PCT", 5, baseSnap).fired).toBe(false);
  });

  it("returns missing-input skip when the relevant field is null", () => {
    expect(evaluateAlert("PE_BELOW", 25, { ...baseSnap, pe: null })).toEqual({
      fired: false,
      observedValue: null,
      skip: "missing-input",
    });
    expect(evaluateAlert("PRICE_ABOVE", 100, { ...baseSnap, price: null }).skip).toBe(
      "missing-input",
    );
  });
});

describe("inRearmWindow", () => {
  const now = new Date("2026-05-05T12:00:00Z");

  it("returns false when never triggered", () => {
    expect(inRearmWindow(null, 24, now)).toBe(false);
  });

  it("returns true (still cooling down) when within rearm window", () => {
    const triggeredAt = new Date("2026-05-05T06:00:00Z"); // 6h ago
    expect(inRearmWindow(triggeredAt, 24, now)).toBe(true);
  });

  it("returns false (can re-fire) once rearm window has passed", () => {
    const triggeredAt = new Date("2026-05-04T06:00:00Z"); // 30h ago
    expect(inRearmWindow(triggeredAt, 24, now)).toBe(false);
  });

  it("rearm=0 means one-shot — never re-fire", () => {
    const triggeredAt = new Date("2020-01-01T00:00:00Z"); // years ago
    // rearm 0 = "never re-fire" → caller should treat as still in window
    expect(inRearmWindow(triggeredAt, 0, now)).toBe(true);
  });
});
