import {
  bucket,
  isFiniteNum,
  ramp,
  weightedAverage,
  type Score,
  type ScoreInput,
  type SubScore,
} from "./types";
import { modifiedPEG } from "@/lib/lynch/score";

/**
 * Fundamentals score.
 *
 * Composite of four equal-weighted dimensions, each itself a weighted
 * average of objective brackets:
 *
 *   1. Valuation (PE, PEG, P/B, dividend yield)
 *   2. Growth   (5y EPS growth, 5y revenue growth)
 *   3. Profitability (ROE, profit margin)
 *   4. Financial health (debt/equity, beta as a stability proxy)
 *
 * The brackets are calibrated for a long-only, "value-with-quality" investor
 * (the spirit of Lynch's framework) — they reward reasonable PE multiples,
 * double-digit growth, mid-teens+ ROE, and conservative leverage.
 *
 * Missing inputs reduce coverage rather than crash the score: each subscore
 * uses `weightedAverage` to redistribute weight onto available metrics, and
 * a subscore returns null only if every input was missing.
 */

export interface FundamentalsInput {
  pe: number | null;
  peg: number | null;
  priceToBook: number | null;
  dividendYield: number | null; // percent (e.g. 1.8 for 1.8%)
  epsGrowth5y: number | null; // percent
  revenueGrowth5y: number | null; // percent
  roe: number | null; // percent
  profitMargin: number | null; // percent
  debtToEquity: number | null; // raw ratio (yahoo gives raw, not %)
  beta: number | null;
}

export function scoreFundamentals(input: FundamentalsInput): Score {
  const valuation = scoreValuation(input);
  const growth = scoreGrowth(input);
  const profitability = scoreProfitability(input);
  const health = scoreHealth(input);

  const subscores: SubScore[] = [valuation, growth, profitability, health];
  const { value, coverage } = weightedAverage(subscores);

  return {
    value: value != null ? Math.round(value) : null,
    coverage,
    subscores,
    headline: headlineFor(value, coverage),
  };
}

function headlineFor(value: number | null, coverage: number): string {
  if (value == null) return "Insufficient fundamentals data";
  if (coverage < 0.5) return `${describeBand(value)} (low confidence — many fields missing)`;
  return describeBand(value);
}

function describeBand(value: number): string {
  if (value >= 80) return "Strong fundamentals across the board";
  if (value >= 65) return "Solid fundamentals with a few weak spots";
  if (value >= 45) return "Mixed fundamentals — some flags";
  if (value >= 30) return "Weak fundamentals — multiple concerns";
  return "Poor fundamentals across most metrics";
}

// ─── Sub-scores ─────────────────────────────────────────────────────────

function scoreValuation(f: FundamentalsInput): SubScore {
  const inputs: ScoreInput[] = [];

  // PE — lower is cheaper. Negative PE (loss) returns null.
  const peScore = isFiniteNum(f.pe) && f.pe > 0
    ? bucket(f.pe, [
        { lt: 10, score: 100 },
        { lt: 15, score: 90 },
        { lt: 20, score: 75 },
        { lt: 25, score: 60 },
        { lt: 30, score: 45 },
        { lt: 40, score: 25 },
        { lt: Infinity, score: 10 },
      ])
    : null;
  inputs.push({
    label: "P/E ratio",
    value: f.pe != null && f.pe > 0 ? f.pe.toFixed(2) : "—",
    contribution: peScore,
    note:
      f.pe == null || f.pe <= 0
        ? "Negative or unavailable — earnings unprofitable or not reported."
        : f.pe < 15
          ? "Below 15 is cheap by any benchmark."
          : f.pe < 25
            ? "Reasonable for most quality businesses."
            : f.pe < 40
              ? "Elevated — must be paid for by growth."
              : "Very expensive — only justified for hyper-growth.",
  });

  // PEG — Lynch's preferred metric. <1 cheap, 1-2 fair, >2 rich.
  const pegScore = isFiniteNum(f.peg) && f.peg > 0
    ? bucket(f.peg, [
        { lt: 0.75, score: 100 },
        { lt: 1, score: 90 },
        { lt: 1.5, score: 70 },
        { lt: 2, score: 50 },
        { lt: 3, score: 25 },
        { lt: Infinity, score: 0 },
      ])
    : null;
  inputs.push({
    label: "PEG ratio",
    value: f.peg != null && f.peg > 0 ? f.peg.toFixed(2) : "—",
    contribution: pegScore,
    note:
      f.peg == null || f.peg <= 0
        ? "Unavailable — no growth estimate or negative earnings."
        : f.peg < 1
          ? "Below 1 — Lynch's classic 'cheap relative to growth' threshold."
          : f.peg < 2
            ? "Fairly priced for the growth on offer."
            : "Expensive — paying a steep premium for growth.",
  });

  // Modified PEG (Lynch's variant — adds dividend yield to numerator).
  const modPeg = modifiedPEG(f.pe, f.epsGrowth5y, f.dividendYield);
  const modPegScore = modPeg != null && modPeg > 0
    ? bucket(modPeg, [
        { lt: 0.5, score: 0 },
        { lt: 1, score: 50 },
        { lt: 1.5, score: 75 },
        { lt: 2, score: 90 },
        { lt: Infinity, score: 100 },
      ])
    : null;
  inputs.push({
    label: "Modified PEG",
    value: modPeg != null ? modPeg.toFixed(2) : "—",
    contribution: modPegScore,
    note:
      modPeg == null
        ? "Need PE and EPS growth to compute."
        : modPeg >= 2
          ? "Excellent — Lynch's 'buying earnings cheap' zone."
          : modPeg >= 1
            ? "Good — fairly valued by Lynch's framework."
            : modPeg >= 0.5
              ? "Watchlist territory — warrants closer look."
              : "Poor — expensive on Lynch's growth-adjusted measure.",
  });

  // P/B — book value cushion. Less meaningful for asset-light businesses.
  const pbScore = isFiniteNum(f.priceToBook) && f.priceToBook > 0
    ? bucket(f.priceToBook, [
        { lt: 1, score: 100 },
        { lt: 2, score: 85 },
        { lt: 3, score: 65 },
        { lt: 5, score: 45 },
        { lt: 8, score: 25 },
        { lt: Infinity, score: 10 },
      ])
    : null;
  inputs.push({
    label: "Price / Book",
    value: f.priceToBook != null && f.priceToBook > 0 ? f.priceToBook.toFixed(2) : "—",
    contribution: pbScore,
    note:
      f.priceToBook == null
        ? "Unavailable."
        : f.priceToBook < 1
          ? "Below book — deep value (or warning sign)."
          : f.priceToBook < 3
            ? "Reasonable for most quality businesses."
            : f.priceToBook < 5
              ? "Premium — common for capital-light franchises."
              : "Very high — relies heavily on intangibles or expectation.",
  });

  // Dividend yield — bonus, not a hard requirement.
  const dyScore = isFiniteNum(f.dividendYield) && f.dividendYield >= 0
    ? bucket(f.dividendYield, [
        { lt: 0.5, score: 50 },
        { lt: 1.5, score: 65 },
        { lt: 3, score: 80 },
        { lt: 5, score: 95 },
        { lt: 8, score: 80 }, // very high yields can signal distress
        { lt: Infinity, score: 50 },
      ])
    : null;
  inputs.push({
    label: "Dividend yield",
    value: f.dividendYield != null ? `${f.dividendYield.toFixed(2)}%` : "—",
    contribution: dyScore,
    note:
      f.dividendYield == null
        ? "Unavailable — non-payer or data gap."
        : f.dividendYield < 1
          ? "Negligible — growth-focused, retains earnings."
          : f.dividendYield < 5
            ? "Healthy payout — provides income cushion."
            : "Very high — verify it's not a payout-ratio warning.",
  });

  return {
    label: "Valuation",
    weight: 0.25,
    value: averageContributions(inputs),
    verdict: verdictForValuation(peScore, pegScore, pbScore),
    inputs,
  };
}

function scoreGrowth(f: FundamentalsInput): SubScore {
  const inputs: ScoreInput[] = [];

  const epsScore = isFiniteNum(f.epsGrowth5y)
    ? bucket(f.epsGrowth5y, [
        { lt: 0, score: 0 },
        { lt: 5, score: 25 },
        { lt: 10, score: 50 },
        { lt: 15, score: 70 },
        { lt: 20, score: 85 },
        { lt: 30, score: 95 },
        { lt: 50, score: 100 },
        { lt: Infinity, score: 90 }, // >50% growth often unsustainable
      ])
    : null;
  inputs.push({
    label: "EPS growth (5y avg)",
    value: f.epsGrowth5y != null ? `${f.epsGrowth5y.toFixed(1)}%` : "—",
    contribution: epsScore,
    note:
      f.epsGrowth5y == null
        ? "Unavailable — no historical EPS series."
        : f.epsGrowth5y < 0
          ? "Earnings shrinking — value trap risk."
          : f.epsGrowth5y < 10
            ? "Slow grower territory — needs dividend or value cushion."
            : f.epsGrowth5y < 20
              ? "Stalwart-grade compounding."
              : f.epsGrowth5y < 50
                ? "Fast grower — premium valuation often justified."
                : "Hyper-growth — verify sustainability before trusting.",
  });

  const revScore = isFiniteNum(f.revenueGrowth5y)
    ? bucket(f.revenueGrowth5y, [
        { lt: 0, score: 0 },
        { lt: 5, score: 30 },
        { lt: 10, score: 55 },
        { lt: 15, score: 75 },
        { lt: 25, score: 90 },
        { lt: Infinity, score: 100 },
      ])
    : null;
  inputs.push({
    label: "Revenue growth (5y avg)",
    value: f.revenueGrowth5y != null ? `${f.revenueGrowth5y.toFixed(1)}%` : "—",
    contribution: revScore,
    note:
      f.revenueGrowth5y == null
        ? "Unavailable."
        : f.revenueGrowth5y < 0
          ? "Sales declining — fundamental concern."
          : f.revenueGrowth5y < 10
            ? "Mature, low-growth business."
            : f.revenueGrowth5y < 20
              ? "Healthy top-line expansion."
              : "Strong revenue compounder.",
  });

  return {
    label: "Growth",
    weight: 0.25,
    value: averageContributions(inputs),
    verdict: verdictForGrowth(epsScore, revScore),
    inputs,
  };
}

function scoreProfitability(f: FundamentalsInput): SubScore {
  const inputs: ScoreInput[] = [];

  const roeScore = isFiniteNum(f.roe)
    ? bucket(f.roe, [
        { lt: 0, score: 0 },
        { lt: 5, score: 25 },
        { lt: 10, score: 50 },
        { lt: 15, score: 70 },
        { lt: 20, score: 85 },
        { lt: 30, score: 100 },
        { lt: Infinity, score: 90 }, // very high ROE often = leverage
      ])
    : null;
  inputs.push({
    label: "Return on equity",
    value: f.roe != null ? `${f.roe.toFixed(1)}%` : "—",
    contribution: roeScore,
    note:
      f.roe == null
        ? "Unavailable."
        : f.roe < 0
          ? "Negative — destroying shareholder capital."
          : f.roe < 10
            ? "Below cost of equity — capital-allocation concern."
            : f.roe < 20
              ? "Solid — Buffett's ~15% threshold."
              : f.roe < 30
                ? "Excellent capital efficiency."
                : "Exceptional — verify it's not over-levered.",
  });

  const marginScore = isFiniteNum(f.profitMargin)
    ? bucket(f.profitMargin, [
        { lt: 0, score: 0 },
        { lt: 3, score: 25 },
        { lt: 7, score: 50 },
        { lt: 12, score: 70 },
        { lt: 20, score: 85 },
        { lt: Infinity, score: 100 },
      ])
    : null;
  inputs.push({
    label: "Net profit margin",
    value: f.profitMargin != null ? `${f.profitMargin.toFixed(1)}%` : "—",
    contribution: marginScore,
    note:
      f.profitMargin == null
        ? "Unavailable."
        : f.profitMargin < 0
          ? "Loss-making."
          : f.profitMargin < 7
            ? "Thin — typical of commodity / low-moat businesses."
            : f.profitMargin < 15
              ? "Healthy operating margins."
              : "Fat margins — moat or pricing power.",
  });

  return {
    label: "Profitability",
    weight: 0.25,
    value: averageContributions(inputs),
    verdict: verdictForProfitability(roeScore, marginScore),
    inputs,
  };
}

function scoreHealth(f: FundamentalsInput): SubScore {
  const inputs: ScoreInput[] = [];

  // Yahoo's debtToEquity is reported in *percent* (e.g. 45 for 0.45×). Treat
  // ratios <5 as already a ratio for safety; otherwise divide by 100.
  const dEraw = f.debtToEquity;
  const dE = isFiniteNum(dEraw) ? (dEraw > 5 ? dEraw / 100 : dEraw) : null;
  const dEScore = dE != null
    ? bucket(dE, [
        { lt: 0.3, score: 100 },
        { lt: 0.6, score: 85 },
        { lt: 1, score: 65 },
        { lt: 1.5, score: 45 },
        { lt: 2.5, score: 25 },
        { lt: Infinity, score: 5 },
      ])
    : null;
  inputs.push({
    label: "Debt / Equity",
    value: dE != null ? dE.toFixed(2) : "—",
    contribution: dEScore,
    note:
      dE == null
        ? "Unavailable."
        : dE < 0.5
          ? "Conservative leverage — low solvency risk."
          : dE < 1
            ? "Moderate — typical for capital-intensive sectors."
            : dE < 2
              ? "Elevated — interest expense risk in downturns."
              : "Aggressive leverage — solvency risk if cash flow falters.",
  });

  // Beta — closer to 1 = market-like; high beta = volatile.
  const betaScore = isFiniteNum(f.beta)
    ? ramp(Math.abs(f.beta - 1), 2, 0) // perfect at 1, zero at 3 or -1
    : null;
  inputs.push({
    label: "Beta (vs market)",
    value: f.beta != null ? f.beta.toFixed(2) : "—",
    contribution: betaScore,
    note:
      f.beta == null
        ? "Unavailable."
        : f.beta < 0.7
          ? "Low-beta — defensive, less drawdown in selloffs."
          : f.beta < 1.3
            ? "Market-like volatility."
            : f.beta < 2
              ? "High-beta — magnifies market moves."
              : "Very volatile — sized small or hedged.",
  });

  return {
    label: "Financial health",
    weight: 0.25,
    value: averageContributions(inputs),
    verdict: verdictForHealth(dEScore, betaScore),
    inputs,
  };
}

// ─── Subscore aggregation ────────────────────────────────────────────────

function averageContributions(inputs: ScoreInput[]): number | null {
  const present = inputs.filter((i) => i.contribution != null);
  if (present.length === 0) return null;
  const sum = present.reduce((acc, i) => acc + (i.contribution as number), 0);
  return sum / present.length;
}

// ─── Verdict copy ────────────────────────────────────────────────────────

function verdictForValuation(pe: number | null, peg: number | null, pb: number | null): string {
  if (pe == null && peg == null && pb == null) return "No valuation data.";
  const avg = averageContributions([
    { label: "", value: "", contribution: pe, note: "" },
    { label: "", value: "", contribution: peg, note: "" },
    { label: "", value: "", contribution: pb, note: "" },
  ]) ?? 0;
  if (avg >= 75) return "Cheap — multiple valuation metrics agree.";
  if (avg >= 55) return "Fairly valued.";
  if (avg >= 35) return "Stretched — paying up for growth.";
  return "Expensive on most metrics.";
}

function verdictForGrowth(eps: number | null, rev: number | null): string {
  if (eps == null && rev == null) return "No growth data.";
  const avg = averageContributions([
    { label: "", value: "", contribution: eps, note: "" },
    { label: "", value: "", contribution: rev, note: "" },
  ]) ?? 0;
  if (avg >= 75) return "Strong compounder — both top and bottom line growing.";
  if (avg >= 50) return "Moderate growth — mature business.";
  if (avg >= 25) return "Slow grower — needs other rationale.";
  return "Shrinking or stagnant.";
}

function verdictForProfitability(roe: number | null, margin: number | null): string {
  if (roe == null && margin == null) return "No profitability data.";
  const avg = averageContributions([
    { label: "", value: "", contribution: roe, note: "" },
    { label: "", value: "", contribution: margin, note: "" },
  ]) ?? 0;
  if (avg >= 75) return "Highly profitable — efficient capital deployment.";
  if (avg >= 50) return "Reasonably profitable.";
  if (avg >= 25) return "Thin margins or modest returns on capital.";
  return "Unprofitable or capital-destructive.";
}

function verdictForHealth(de: number | null, beta: number | null): string {
  if (de == null && beta == null) return "No leverage / volatility data.";
  const avg = averageContributions([
    { label: "", value: "", contribution: de, note: "" },
    { label: "", value: "", contribution: beta, note: "" },
  ]) ?? 0;
  if (avg >= 75) return "Conservative balance sheet, market-like risk.";
  if (avg >= 50) return "Manageable leverage / volatility.";
  if (avg >= 25) return "Elevated leverage or volatility.";
  return "Stressed — high leverage and / or unstable price.";
}
