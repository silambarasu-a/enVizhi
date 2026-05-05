import Link from "next/link";

export interface HoldingRow {
  symbol: string;
  name: string;
  currency: string;
  quantity: number;
  avgCost: number;
  currentPrice: number | null;
  marketValue: number | null;
  unrealized: number | null;
  unrealizedPct: number | null;
}

export function HoldingsTable({ rows }: { rows: HoldingRow[] }) {
  if (rows.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-border bg-card/40 p-10 text-center">
        <p className="text-sm text-muted-foreground">
          No open positions. Add a transaction to start tracking holdings.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-border bg-card overflow-hidden shadow-card">
      <div className="px-5 py-4 border-b border-border">
        <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
          Holdings
        </span>
        <span className="ml-2 text-xs text-muted-foreground">{rows.length} position{rows.length === 1 ? "" : "s"}</span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="text-muted-foreground border-b border-border bg-secondary/40">
            <tr className="text-[11px] uppercase tracking-wider">
              <th className="px-4 py-2.5 text-left font-medium">Symbol</th>
              <th className="px-4 py-2.5 text-left font-medium hidden md:table-cell">Name</th>
              <th className="px-4 py-2.5 text-right font-medium">Qty</th>
              <th className="px-4 py-2.5 text-right font-medium">Avg cost</th>
              <th className="px-4 py-2.5 text-right font-medium">Last</th>
              <th className="px-4 py-2.5 text-right font-medium">Market value</th>
              <th className="px-4 py-2.5 text-right font-medium">Unrealized</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const fmtCcy = new Intl.NumberFormat(r.currency === "INR" ? "en-IN" : "en-US", {
                style: "currency",
                currency: r.currency,
                maximumFractionDigits: 2,
              });
              const isUp = (r.unrealized ?? 0) >= 0;
              return (
                <tr key={r.symbol} className="border-b border-border/60 last:border-0 hover:bg-secondary/30 transition-colors">
                  <td className="px-4 py-3">
                    <Link
                      href={`/stock/${encodeURIComponent(r.symbol)}`}
                      className="font-mono hover:text-primary transition-colors"
                    >
                      {r.symbol}
                    </Link>
                  </td>
                  <td className="px-4 py-3 hidden md:table-cell text-muted-foreground">{r.name}</td>
                  <td className="px-4 py-3 text-right font-mono tabular-nums">
                    {formatQty(r.quantity)}
                  </td>
                  <td className="px-4 py-3 text-right font-mono tabular-nums">{fmtCcy.format(r.avgCost)}</td>
                  <td className="px-4 py-3 text-right font-mono tabular-nums">
                    {r.currentPrice != null ? fmtCcy.format(r.currentPrice) : "—"}
                  </td>
                  <td className="px-4 py-3 text-right font-mono tabular-nums">
                    {r.marketValue != null ? fmtCcy.format(r.marketValue) : "—"}
                  </td>
                  <td className={`px-4 py-3 text-right font-mono tabular-nums ${
                    r.unrealized == null
                      ? "text-muted-foreground/40"
                      : isUp
                      ? "text-emerald-600 dark:text-emerald-400"
                      : "text-rose-600 dark:text-rose-400"
                  }`}>
                    {r.unrealized == null ? (
                      "—"
                    ) : (
                      <span>
                        {r.unrealized >= 0 ? "+" : ""}
                        {fmtCcy.format(r.unrealized)}
                        <span className="ml-1.5 text-[11px]">
                          ({r.unrealizedPct != null
                            ? `${r.unrealizedPct >= 0 ? "+" : ""}${r.unrealizedPct.toFixed(2)}%`
                            : "—"})
                        </span>
                      </span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function formatQty(q: number) {
  return Number.isInteger(q) ? q.toString() : q.toFixed(4);
}
