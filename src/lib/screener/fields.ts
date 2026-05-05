/**
 * Single source of truth for every field the screener exposes.
 *
 * The UI builds filter controls from this list; the URL/DSL parser validates
 * against it; the Prisma query builder maps each id → a column. To add a new
 * field: add an entry here, ensure the Prisma column exists, done.
 */

export type FieldType = "number" | "percent" | "currency" | "ratio";

export interface NumericField {
  id: NumericFieldId;
  label: string;
  /** Pretty unit suffix shown in the UI (e.g. "%", "x"). */
  unit?: string;
  type: FieldType;
  /** Default min/max for the slider when nothing is set. */
  defaultMin?: number;
  defaultMax?: number;
  /** Step for slider/number input. */
  step?: number;
  /** Section grouping in the filter sidebar. */
  group: "Valuation" | "Growth" | "Quality" | "Risk";
  /** Short helper shown beneath the control. */
  hint?: string;
}

export const NUMERIC_FIELDS: readonly NumericField[] = [
  { id: "pe", label: "P/E Ratio", unit: "x", type: "ratio", group: "Valuation", defaultMin: 0, defaultMax: 60, step: 0.5, hint: "Trailing price-to-earnings." },
  { id: "peg", label: "PEG Ratio", unit: "x", type: "ratio", group: "Valuation", defaultMin: 0, defaultMax: 5, step: 0.1, hint: "PE divided by earnings growth. <1 = undervalued growth (Lynch)." },
  { id: "priceToBook", label: "P/B Ratio", unit: "x", type: "ratio", group: "Valuation", defaultMin: 0, defaultMax: 15, step: 0.1 },
  { id: "marketCapBn", label: "Market Cap", unit: "B", type: "number", group: "Valuation", defaultMin: 0, defaultMax: 4000, step: 1, hint: "In billions of native currency." },
  { id: "epsGrowth5y", label: "EPS Growth (5Y)", unit: "%", type: "percent", group: "Growth", defaultMin: -20, defaultMax: 60, step: 1 },
  { id: "revenueGrowth5y", label: "Revenue Growth (5Y)", unit: "%", type: "percent", group: "Growth", defaultMin: -20, defaultMax: 60, step: 1 },
  { id: "dividendYield", label: "Dividend Yield", unit: "%", type: "percent", group: "Quality", defaultMin: 0, defaultMax: 10, step: 0.1 },
  { id: "roe", label: "Return on Equity", unit: "%", type: "percent", group: "Quality", defaultMin: -20, defaultMax: 60, step: 1 },
  { id: "profitMargin", label: "Profit Margin", unit: "%", type: "percent", group: "Quality", defaultMin: -20, defaultMax: 60, step: 1 },
  { id: "debtToEquity", label: "Debt / Equity", unit: "x", type: "ratio", group: "Risk", defaultMin: 0, defaultMax: 5, step: 0.1 },
  { id: "beta", label: "Beta", unit: "", type: "ratio", group: "Risk", defaultMin: 0, defaultMax: 3, step: 0.1 },
];

export type NumericFieldId =
  | "pe"
  | "peg"
  | "priceToBook"
  | "marketCapBn"
  | "epsGrowth5y"
  | "revenueGrowth5y"
  | "dividendYield"
  | "roe"
  | "profitMargin"
  | "debtToEquity"
  | "beta";

export const NUMERIC_FIELD_IDS = NUMERIC_FIELDS.map((f) => f.id);

export const EXCHANGES = ["NASDAQ", "NYSE", "NSE", "BSE"] as const;
export type ExchangeId = (typeof EXCHANGES)[number];

export const LYNCH_CATEGORIES = [
  "SLOW_GROWER",
  "STALWART",
  "FAST_GROWER",
  "CYCLICAL",
  "TURNAROUND",
  "ASSET_PLAY",
] as const;
export type LynchCategoryId = (typeof LYNCH_CATEGORIES)[number];

export const LYNCH_LABEL: Record<LynchCategoryId, string> = {
  SLOW_GROWER: "Slow Grower",
  STALWART: "Stalwart",
  FAST_GROWER: "Fast Grower",
  CYCLICAL: "Cyclical",
  TURNAROUND: "Turnaround",
  ASSET_PLAY: "Asset Play",
};

export const SORTABLE_FIELDS = [
  ...NUMERIC_FIELD_IDS,
  "symbol",
] as const;
export type SortableField = (typeof SORTABLE_FIELDS)[number];
