/**
 * Peter Lynch's six-category stock taxonomy, expressed as a deterministic
 * decision tree from snapshot fundamentals.
 *
 *   SLOW_GROWER   < 5% EPS growth, large cap, often pays dividend
 *   STALWART      5–12% EPS growth, large cap (>$10B equiv)
 *   FAST_GROWER   > 20% EPS growth, small/mid cap
 *   CYCLICAL      In a cyclical sector (auto, steel, airlines, energy, materials)
 *   TURNAROUND    Hard from a snapshot — needs earnings-trajectory time-series.
 *                 Skipped here; computed in a future "trends" sync.
 *   ASSET_PLAY    P/B < 1 + small-mid cap (book value > market value)
 *
 * Returns null when input is too sparse to classify confidently. The screener
 * surfaces this as "Unclassified" rather than guessing.
 */

import type { LynchCategory } from "@/generated/prisma/enums";

// Sectors Lynch (and modern equivalents) treat as cyclical. Yahoo uses this
// taxonomy; it differs from GICS for India where we'll need a re-mapping later.
const CYCLICAL_SECTORS = new Set<string>([
  "Energy",
  "Basic Materials",
  "Consumer Cyclical",
  // "Industrials" is broad but mostly cyclical (transports, machinery, defense).
  "Industrials",
]);

/** Approximate FX to convert market cap to USD-equivalent thresholds. */
const FX_TO_USD: Record<string, number> = {
  USD: 1,
  INR: 1 / 83, // rough; refresh from FXRate table when wiring portfolio
  EUR: 1.07,
  GBP: 1.27,
  JPY: 1 / 155,
};

export interface ClassifyInput {
  marketCap: bigint | number | null | undefined;
  currency: string | null | undefined;
  epsGrowth5yPct: number | null | undefined;
  dividendYieldPct: number | null | undefined;
  priceToBook: number | null | undefined;
  sector: string | null | undefined;
}

export function classifyLynch(input: ClassifyInput): LynchCategory | null {
  const usdMcapBn = marketCapInUsdBillions(input.marketCap, input.currency);

  // Asset Play: trades below book — small/mid caps where this is most actionable.
  if (
    isFinite(input.priceToBook) &&
    input.priceToBook! > 0 &&
    input.priceToBook! < 1 &&
    usdMcapBn != null &&
    usdMcapBn < 50
  ) {
    return "ASSET_PLAY";
  }

  // Cyclical: classify by sector first — earnings vary too much to use growth rate.
  if (input.sector && CYCLICAL_SECTORS.has(input.sector)) {
    return "CYCLICAL";
  }

  // Need growth rate to distinguish the remaining categories.
  if (!isFinite(input.epsGrowth5yPct)) return null;
  const growth = input.epsGrowth5yPct!;

  // Fast Grower: high growth, but small-to-mid cap (Lynch said "the perfect Fast
  // Grower" is small enough to multiply 10x). >$200B cap is a different beast.
  if (growth > 20 && (usdMcapBn == null || usdMcapBn < 200)) {
    return "FAST_GROWER";
  }

  // Slow Grower: low growth, large cap (his archetype: utility, large pharma).
  if (growth < 5) {
    return "SLOW_GROWER";
  }

  // Stalwart: 5–12% growth, large cap. Catch the broad middle here.
  // We extend up to ~20% for very-large caps (Apple-like) since they can't
  // grow like a small Fast Grower regardless of recent rate.
  return "STALWART";
}

export function categoryLabel(c: LynchCategory): string {
  switch (c) {
    case "SLOW_GROWER":
      return "Slow Grower";
    case "STALWART":
      return "Stalwart";
    case "FAST_GROWER":
      return "Fast Grower";
    case "CYCLICAL":
      return "Cyclical";
    case "TURNAROUND":
      return "Turnaround";
    case "ASSET_PLAY":
      return "Asset Play";
  }
}

export function categoryDescription(c: LynchCategory): string {
  switch (c) {
    case "SLOW_GROWER":
      return "Mature large cap with single-digit growth. Buy for the dividend, watch for shrinkage.";
    case "STALWART":
      return "Reliable large cap with 5–12% growth. Lynch's defensive bedrock; trim above fair P/E.";
    case "FAST_GROWER":
      return ">20% earnings growth in a small/mid cap. Lynch's favourite — verify the runway.";
    case "CYCLICAL":
      return "Earnings track the macro cycle. Buy near the trough, sell into the boom.";
    case "TURNAROUND":
      return "Distressed business pivoting back to profitability. High risk, high reward.";
    case "ASSET_PLAY":
      return "Trades below book / asset value. Catalyst typically required to unlock.";
  }
}

function isFinite(v: unknown): v is number {
  return typeof v === "number" && Number.isFinite(v);
}

function marketCapInUsdBillions(
  marketCap: bigint | number | null | undefined,
  currency: string | null | undefined,
): number | null {
  if (marketCap == null) return null;
  const raw = typeof marketCap === "bigint" ? Number(marketCap) : marketCap;
  if (!Number.isFinite(raw)) return null;
  const fx = FX_TO_USD[currency ?? "USD"] ?? 1;
  return (raw * fx) / 1_000_000_000;
}
