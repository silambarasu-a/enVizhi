interface FundamentalsInput {
  pe: number | null;
  peg: number | null;
  marketCap: bigint | null;
  eps: number | null;
  epsGrowth5y: number | null;
  revenueGrowth5y: number | null;
  dividendYield: number | null;
  roe: number | null;
  profitMargin: number | null;
  debtToEquity: number | null;
  beta: number | null;
  priceToBook: number | null;
}

export function FundamentalsGrid({
  fundamentals,
  currency,
}: {
  fundamentals: FundamentalsInput | null;
  currency: string;
}) {
  if (!fundamentals) {
    return (
      <div className="rounded-2xl border border-border bg-card p-6 shadow-card">
        <p className="text-sm text-muted-foreground">
          No fundamentals on file yet. Run{" "}
          <code className="font-mono text-xs px-1.5 py-0.5 rounded bg-secondary border border-border">
            npm run sync:fundamentals -- {"<symbol>"}
          </code>{" "}
          to populate.
        </p>
      </div>
    );
  }

  const groups: Array<{
    title: string;
    items: Array<{ label: string; value: string; muted?: boolean }>;
  }> = [
    {
      title: "Valuation",
      items: [
        { label: "Market Cap", value: formatMarketCap(fundamentals.marketCap, currency) },
        { label: "P/E (TTM)", value: formatRatio(fundamentals.pe) },
        { label: "PEG", value: formatRatio(fundamentals.peg) },
        { label: "P/B", value: formatRatio(fundamentals.priceToBook) },
        { label: "EPS (TTM)", value: formatCurrency(fundamentals.eps, currency) },
      ],
    },
    {
      title: "Growth",
      items: [
        { label: "EPS growth (5Y)", value: formatPct(fundamentals.epsGrowth5y) },
        { label: "Revenue growth (5Y)", value: formatPct(fundamentals.revenueGrowth5y) },
      ],
    },
    {
      title: "Quality",
      items: [
        { label: "Dividend yield", value: formatPct(fundamentals.dividendYield) },
        { label: "Return on equity", value: formatPct(fundamentals.roe) },
        { label: "Profit margin", value: formatPct(fundamentals.profitMargin) },
      ],
    },
    {
      title: "Risk",
      items: [
        { label: "Debt / Equity", value: formatRatio(fundamentals.debtToEquity) },
        { label: "Beta", value: formatRatio(fundamentals.beta) },
      ],
    },
  ];

  return (
    <div className="rounded-2xl border border-border bg-card shadow-card overflow-hidden">
      <div className="px-6 pt-5">
        <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
          Fundamentals
        </div>
      </div>
      <div className="p-6 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
        {groups.map((g) => (
          <div key={g.title} className="space-y-2.5">
            <h4 className="text-[12px] font-medium text-foreground">{g.title}</h4>
            <ul className="space-y-1.5">
              {g.items.map((it) => (
                <li
                  key={it.label}
                  className="flex items-baseline justify-between text-[13px]"
                >
                  <span className="text-muted-foreground">{it.label}</span>
                  <span className="font-mono tabular-nums">{it.value}</span>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </div>
  );
}

function formatRatio(v: number | null) {
  if (v == null || !Number.isFinite(v)) return "—";
  return v.toFixed(2);
}

function formatPct(v: number | null) {
  if (v == null || !Number.isFinite(v)) return "—";
  return `${v >= 0 ? "+" : ""}${v.toFixed(1)}%`;
}

function formatCurrency(v: number | null, currency: string) {
  if (v == null || !Number.isFinite(v)) return "—";
  return new Intl.NumberFormat(currency === "INR" ? "en-IN" : "en-US", {
    style: "currency",
    currency,
    maximumFractionDigits: 2,
  }).format(v);
}

function formatMarketCap(cap: bigint | null, currency: string) {
  if (cap == null) return "—";
  const n = Number(cap);
  if (!Number.isFinite(n)) return "—";
  if (currency === "INR") {
    const lcr = n / 1e12;
    if (lcr >= 1) return `₹${lcr.toFixed(2)} L Cr`;
    return `₹${(n / 1e7).toFixed(0)} Cr`;
  }
  if (n >= 1e12) return `$${(n / 1e12).toFixed(2)}T`;
  if (n >= 1e9) return `$${(n / 1e9).toFixed(1)}B`;
  if (n >= 1e6) return `$${(n / 1e6).toFixed(0)}M`;
  return `$${n.toLocaleString()}`;
}
