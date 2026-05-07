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

/**
 * Currency-aware compact market-cap formatter.
 *
 *   INR uses the Indian convention: `₹2.4 L Cr` (Lakh Crore = 10¹²) for large
 *   caps, falling back to `Cr` (10⁷) below 1 L Cr.
 *
 *   Everything else uses Intl's compact currency notation, which renders the
 *   right symbol for the locale (USD → `$2.4T`, EUR → `€2.4T`, JPY → `¥2.4T`).
 *   Uses `narrowSymbol` so we get `$` instead of `US$`.
 */
export function formatMarketCap(value: number | null | undefined, currency: string = "USD"): string {
  if (value == null || !Number.isFinite(value)) return "—";

  if (currency === "INR") {
    const lcr = value / 1e12;
    if (lcr >= 1) return `₹${lcr.toFixed(2)} L Cr`;
    return `₹${(value / 1e7).toFixed(0)} Cr`;
  }

  return new Intl.NumberFormat(localeForCurrency(currency), {
    notation: "compact",
    compactDisplay: "short",
    style: "currency",
    currency,
    currencyDisplay: "narrowSymbol",
    maximumFractionDigits: 2,
  }).format(value);
}

function localeForCurrency(currency: string): string {
  switch (currency) {
    case "INR":
      return "en-IN";
    case "GBP":
      return "en-GB";
    case "EUR":
      return "en-IE"; // English-language Eurozone
    case "JPY":
      return "ja-JP";
    case "CNY":
      return "zh-CN";
    case "HKD":
      return "en-HK";
    default:
      return "en-US";
  }
}

/** Tailwind class for positive/negative values — emerald for gains, rose for losses. */
export function deltaClass(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return "text-muted-foreground";
  if (value > 0) return "text-emerald-500";
  if (value < 0) return "text-rose-500";
  return "text-muted-foreground";
}
