// Number formatters. Use these everywhere we render numbers — never raw `toFixed`.
// Designed to render consistently on server + client (no locale drift).

const COMPACT_USD = new Intl.NumberFormat("en-US", {
  notation: "compact",
  compactDisplay: "short",
  maximumFractionDigits: 2,
});

const COMPACT_INR = new Intl.NumberFormat("en-IN", {
  notation: "compact",
  compactDisplay: "short",
  maximumFractionDigits: 2,
});

export function formatCompact(value: number | null | undefined, currency: "USD" | "INR" = "USD"): string {
  if (value == null || !Number.isFinite(value)) return "—";
  return (currency === "INR" ? COMPACT_INR : COMPACT_USD).format(value);
}

export function formatCurrency(
  value: number | null | undefined,
  currency: string = "USD",
  fractionDigits = 2,
): string {
  if (value == null || !Number.isFinite(value)) return "—";
  return new Intl.NumberFormat(currency === "INR" ? "en-IN" : "en-US", {
    style: "currency",
    currency,
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  }).format(value);
}

export function formatPct(value: number | null | undefined, fractionDigits = 2): string {
  if (value == null || !Number.isFinite(value)) return "—";
  const sign = value > 0 ? "+" : "";
  return `${sign}${value.toFixed(fractionDigits)}%`;
}

export function formatNumber(value: number | null | undefined, fractionDigits = 2): string {
  if (value == null || !Number.isFinite(value)) return "—";
  return value.toLocaleString("en-US", {
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  });
}

/** Tailwind class for positive/negative values — emerald for gains, rose for losses. */
export function deltaClass(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return "text-muted-foreground";
  if (value > 0) return "text-emerald-500";
  if (value < 0) return "text-rose-500";
  return "text-muted-foreground";
}
