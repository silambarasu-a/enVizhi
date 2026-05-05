import { describe, it, expect } from "vitest";
import { computePositions, unrealizedPnL, type PortfolioTxn } from "@/lib/portfolio/positions";

const t = (
  id: string,
  stockId: string,
  type: "BUY" | "SELL",
  quantity: number,
  price: number,
  date: string,
  fees = 0,
): PortfolioTxn => ({
  id,
  stockId,
  type,
  quantity,
  price,
  fees,
  executedAt: new Date(date),
});

describe("computePositions — single stock FIFO", () => {
  it("two BUYs build a weighted average cost", () => {
    const { positions } = computePositions([
      t("a", "AAPL", "BUY", 10, 100, "2024-01-01"),
      t("b", "AAPL", "BUY", 10, 150, "2024-02-01"),
    ]);
    const aapl = positions.get("AAPL")!;
    expect(aapl.quantity).toBe(20);
    expect(aapl.costBasis).toBe(2500);
    expect(aapl.avgCost).toBe(125);
    expect(aapl.realizedPnL).toBe(0);
    expect(aapl.lots).toHaveLength(2);
  });

  it("FIFO sell consumes oldest lot first", () => {
    // Buy 10 @ 100, Buy 10 @ 150, Sell 5 @ 200 — FIFO consumes from first lot.
    const { positions } = computePositions([
      t("a", "AAPL", "BUY", 10, 100, "2024-01-01"),
      t("b", "AAPL", "BUY", 10, 150, "2024-02-01"),
      t("c", "AAPL", "SELL", 5, 200, "2024-03-01"),
    ]);
    const aapl = positions.get("AAPL")!;
    expect(aapl.quantity).toBe(15);
    // Realized: 5 × 200 = 1000 proceeds, against 5 × 100 = 500 cost → +500.
    expect(aapl.realizedPnL).toBe(500);
    // Open lots: 5 @ 100, 10 @ 150 → cost basis 500 + 1500 = 2000, avg 133.33…
    expect(aapl.costBasis).toBe(2000);
    expect(aapl.avgCost).toBeCloseTo(2000 / 15, 5);
  });

  it("SELL spanning multiple lots aggregates realized correctly", () => {
    const { positions } = computePositions([
      t("a", "AAPL", "BUY", 10, 100, "2024-01-01"),
      t("b", "AAPL", "BUY", 10, 150, "2024-02-01"),
      t("c", "AAPL", "SELL", 15, 200, "2024-03-01"),
    ]);
    const aapl = positions.get("AAPL")!;
    expect(aapl.quantity).toBe(5);
    // Realized: 15 × 200 = 3000 proceeds.
    // Cost consumed: 10 × 100 + 5 × 150 = 1000 + 750 = 1750.
    // Realized = 3000 − 1750 = 1250.
    expect(aapl.realizedPnL).toBe(1250);
    // Remaining: 5 @ 150 → cost basis 750.
    expect(aapl.costBasis).toBe(750);
  });

  it("BUY fees raise per-share cost", () => {
    // Buy 10 @ 100 + $5 fees → effective cost 100.5 per share, total 1005.
    const { positions } = computePositions([t("a", "AAPL", "BUY", 10, 100, "2024-01-01", 5)]);
    const aapl = positions.get("AAPL")!;
    expect(aapl.avgCost).toBe(100.5);
    expect(aapl.costBasis).toBe(1005);
  });

  it("SELL fees reduce realized P&L", () => {
    // Buy 10 @ 100, Sell 10 @ 150 with $10 fees → realized = 1500 − 10 − 1000 = 490.
    const { positions } = computePositions([
      t("a", "AAPL", "BUY", 10, 100, "2024-01-01"),
      t("b", "AAPL", "SELL", 10, 150, "2024-02-01", 10),
    ]);
    // Position closed; map only keeps it because realizedPnL ≠ 0.
    expect(positions.get("AAPL")!.quantity).toBe(0);
    expect(positions.get("AAPL")!.realizedPnL).toBe(490);
  });

  it("transactions out of executedAt order are still FIFO by date", () => {
    // Insert in reverse chronological order; algorithm must sort first.
    const { positions } = computePositions([
      t("c", "AAPL", "SELL", 5, 200, "2024-03-01"),
      t("b", "AAPL", "BUY", 10, 150, "2024-02-01"),
      t("a", "AAPL", "BUY", 10, 100, "2024-01-01"),
    ]);
    const aapl = positions.get("AAPL")!;
    expect(aapl.realizedPnL).toBe(500); // same as in-order test above
    expect(aapl.costBasis).toBe(2000);
  });
});

describe("computePositions — multiple stocks", () => {
  it("each stock is independent (no cross-pollination)", () => {
    const { positions, totalRealizedPnL } = computePositions([
      t("a", "AAPL", "BUY", 10, 100, "2024-01-01"),
      t("b", "MSFT", "BUY", 5, 200, "2024-01-02"),
      t("c", "AAPL", "SELL", 5, 150, "2024-02-01"),
    ]);
    expect(positions.get("AAPL")!.quantity).toBe(5);
    expect(positions.get("AAPL")!.realizedPnL).toBe(250); // 5 × (150 − 100)
    expect(positions.get("MSFT")!.quantity).toBe(5);
    expect(positions.get("MSFT")!.realizedPnL).toBe(0);
    expect(totalRealizedPnL).toBe(250);
  });
});

describe("unrealizedPnL", () => {
  it("computes market value and unrealized vs cost basis", () => {
    const pos = { quantity: 15, costBasis: 2000 };
    const r = unrealizedPnL(pos, 180);
    expect(r.marketValue).toBe(2700);
    expect(r.unrealized).toBe(700);
    expect(r.unrealizedPct).toBeCloseTo(35, 5);
  });

  it("zero cost basis → 0% (no division by zero)", () => {
    const r = unrealizedPnL({ quantity: 0, costBasis: 0 }, 100);
    expect(r.unrealizedPct).toBe(0);
  });
});

describe("realistic 10-trade fixture", () => {
  // Hand-built portfolio used to validate cost basis + P&L end-to-end.
  // Three stocks, mix of BUYs and SELLs, fees throughout.
  const trades: PortfolioTxn[] = [
    t("01", "AAPL", "BUY", 10, 150, "2024-01-15", 5), // cost 1505 → 150.5/share
    t("02", "AAPL", "BUY", 5, 170, "2024-04-10", 5), // cost 855 → 171/share
    t("03", "MSFT", "BUY", 8, 380, "2024-02-01", 5), // cost 3045 → 380.625/share
    t("04", "NVDA", "BUY", 4, 700, "2024-03-22", 8), // cost 2808 → 702/share
    t("05", "NVDA", "BUY", 2, 900, "2024-06-12", 4), // cost 1804 → 902/share
    t("06", "AAPL", "SELL", 5, 220, "2024-07-01", 5), // proceeds 1095, cost 752.5, realized +342.5
    t("07", "NVDA", "SELL", 3, 1100, "2024-08-15", 6), // proceeds 3294, cost 3 × 702 = 2106, realized +1188
    t("08", "MSFT", "SELL", 3, 420, "2024-09-01", 5), // proceeds 1255, cost 3 × 380.625 = 1141.875, realized +113.125
    t("09", "AAPL", "BUY", 2, 230, "2024-10-05", 3), // cost 463 → 231.5/share
    t("10", "MSFT", "BUY", 1, 410, "2024-11-20", 2), // cost 412 → 412/share
  ];

  const result = computePositions(trades);

  it("AAPL: held 12 shares with realized +342.5 from the sell", () => {
    const aapl = result.positions.get("AAPL")!;
    // After SELL of 5 from first lot (cost 752.5 from 5 × 150.5),
    // open lots: 5 @ 150.5, 5 @ 171, 2 @ 231.5
    expect(aapl.quantity).toBe(12);
    expect(aapl.realizedPnL).toBeCloseTo(342.5, 5);
    // Open cost basis: 5*150.5 + 5*171 + 2*231.5 = 752.5 + 855 + 463 = 2070.5
    expect(aapl.costBasis).toBeCloseTo(2070.5, 5);
  });

  it("NVDA: held 3 shares (oldest lot fully consumed) with realized +1188", () => {
    const nvda = result.positions.get("NVDA")!;
    expect(nvda.quantity).toBe(3);
    expect(nvda.realizedPnL).toBeCloseTo(1188, 5);
    // After selling 3 of 4 in first lot (4 @ 702), 1 left in first lot, 2 in second.
    // Open: 1 @ 702, 2 @ 902 → cost 702 + 1804 = 2506.
    expect(nvda.costBasis).toBeCloseTo(2506, 5);
  });

  it("MSFT: held 6 shares (1 fresh BUY post-SELL) with realized +113.125", () => {
    const msft = result.positions.get("MSFT")!;
    expect(msft.quantity).toBe(6);
    expect(msft.realizedPnL).toBeCloseTo(113.125, 5);
    // After selling 3 of 8 (cost 3 × 380.625 = 1141.875), 5 left @ 380.625.
    // Plus 1 BUY @ 412 → 5 × 380.625 + 412 = 1903.125 + 412 = 2315.125.
    expect(msft.costBasis).toBeCloseTo(2315.125, 5);
  });

  it("total realized P&L across all three stocks: 1643.625", () => {
    expect(result.totalRealizedPnL).toBeCloseTo(342.5 + 1188 + 113.125, 5);
  });
});
