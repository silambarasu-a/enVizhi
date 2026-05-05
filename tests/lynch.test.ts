import { describe, it, expect } from "vitest";
import {
  modifiedPEG,
  modifiedPegBracket,
  fairPE,
  lynchFairValue,
  priceToFairRatio,
} from "@/lib/lynch/score";
import { classifyLynch } from "@/lib/lynch/categories";

describe("modifiedPEG", () => {
  it("computes (epsGrowth + dividend) / pe", () => {
    expect(modifiedPEG(20, 15, 2)).toBeCloseTo(0.85, 5);
  });

  it("treats null dividend as zero", () => {
    expect(modifiedPEG(20, 15, null)).toBeCloseTo(0.75, 5);
  });

  it("returns null when PE is missing or non-positive", () => {
    expect(modifiedPEG(null, 15, 2)).toBeNull();
    expect(modifiedPEG(0, 15, 2)).toBeNull();
    expect(modifiedPEG(-5, 15, 2)).toBeNull();
  });

  it("returns null when growth is missing", () => {
    expect(modifiedPEG(20, null, 2)).toBeNull();
  });
});

describe("modifiedPegBracket", () => {
  it("brackets values into excellent / good / ok / poor", () => {
    expect(modifiedPegBracket(2.5)).toBe("excellent");
    expect(modifiedPegBracket(1.4)).toBe("good");
    expect(modifiedPegBracket(0.7)).toBe("ok");
    expect(modifiedPegBracket(0.3)).toBe("poor");
    expect(modifiedPegBracket(null)).toBeNull();
  });
});

describe("fairPE / lynchFairValue / priceToFairRatio", () => {
  it("a 15% grower deserves a P/E of 15", () => {
    expect(fairPE(15)).toBe(15);
  });

  it("returns null for non-positive growth (no growth-justified premium)", () => {
    expect(fairPE(0)).toBeNull();
    expect(fairPE(-5)).toBeNull();
  });

  it("computes fair value as fairPE × EPS", () => {
    // 12% grower with $5 EPS → fair value $60
    expect(lynchFairValue(5, 12)).toBe(60);
  });

  it("returns null fair value when EPS is missing or non-positive", () => {
    expect(lynchFairValue(null, 12)).toBeNull();
    expect(lynchFairValue(-1, 12)).toBeNull();
  });

  it("price-to-fair > 1 means premium, < 1 means discount", () => {
    expect(priceToFairRatio(120, 100)).toBe(1.2); // 20% premium
    expect(priceToFairRatio(80, 100)).toBe(0.8); // 20% discount
    expect(priceToFairRatio(100, 0)).toBeNull();
  });
});

describe("classifyLynch — known cases", () => {
  it("classifies a slow large-cap growth name as SLOW_GROWER", () => {
    // Hypothetical large utility — 3% growth, 4% yield, $150B cap
    expect(
      classifyLynch({
        marketCap: BigInt(150_000_000_000),
        currency: "USD",
        epsGrowth5yPct: 3,
        dividendYieldPct: 4,
        priceToBook: 2.1,
        sector: "Utilities",
      }),
    ).toBe("SLOW_GROWER");
  });

  it("classifies an Apple-like name as STALWART (large cap, mid growth)", () => {
    expect(
      classifyLynch({
        marketCap: BigInt(3_180_000_000_000),
        currency: "USD",
        epsGrowth5yPct: 8,
        dividendYieldPct: 0.5,
        priceToBook: 50,
        sector: "Technology",
      }),
    ).toBe("STALWART");
  });

  it("classifies a small-mid cap with >20% growth as FAST_GROWER", () => {
    expect(
      classifyLynch({
        marketCap: BigInt(15_000_000_000), // $15B
        currency: "USD",
        epsGrowth5yPct: 28,
        dividendYieldPct: null,
        priceToBook: 6,
        sector: "Technology",
      }),
    ).toBe("FAST_GROWER");
  });

  it("does NOT classify a $3T mega-cap as Fast Grower even with 25% growth", () => {
    expect(
      classifyLynch({
        marketCap: BigInt(3_000_000_000_000),
        currency: "USD",
        epsGrowth5yPct: 25,
        dividendYieldPct: null,
        priceToBook: 12,
        sector: "Technology",
      }),
    ).toBe("STALWART");
  });

  it("classifies steel/auto/energy as CYCLICAL regardless of recent growth", () => {
    expect(
      classifyLynch({
        marketCap: BigInt(20_000_000_000),
        currency: "USD",
        epsGrowth5yPct: 8,
        dividendYieldPct: 1,
        priceToBook: 1.5,
        sector: "Basic Materials",
      }),
    ).toBe("CYCLICAL");
  });

  it("classifies P/B < 1 small-mid cap as ASSET_PLAY (book > market)", () => {
    expect(
      classifyLynch({
        marketCap: BigInt(2_000_000_000),
        currency: "USD",
        epsGrowth5yPct: 4,
        dividendYieldPct: 3,
        priceToBook: 0.8,
        sector: "Real Estate",
      }),
    ).toBe("ASSET_PLAY");
  });

  it("Indian market caps are FX-converted to USD before threshold checks", () => {
    // ₹19.8 lakh crore Reliance ≈ $238B → too big to be FAST_GROWER
    expect(
      classifyLynch({
        marketCap: BigInt(19_800_000_000_000), // ₹19.8 L Cr
        currency: "INR",
        epsGrowth5yPct: 25,
        dividendYieldPct: 0.4,
        priceToBook: 2.5,
        sector: "Energy",
      }),
    ).toBe("CYCLICAL"); // Energy → Cyclical wins regardless of growth
  });

  it("returns null when growth is missing and no other signal fires", () => {
    expect(
      classifyLynch({
        marketCap: BigInt(50_000_000_000),
        currency: "USD",
        epsGrowth5yPct: null,
        dividendYieldPct: 1,
        priceToBook: 3,
        sector: "Technology",
      }),
    ).toBeNull();
  });
});
