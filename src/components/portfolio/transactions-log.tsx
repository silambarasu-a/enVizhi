"use client";

import Link from "next/link";
import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { X } from "lucide-react";
import { deleteTransaction } from "@/app/(app)/portfolio/actions";

interface TxnRow {
  id: string;
  type: "BUY" | "SELL";
  symbol: string;
  stockName: string;
  quantity: number;
  price: number;
  fees: number;
  currency: string;
  executedAt: string;
  note: string | null;
}

export function TransactionsLog({ rows }: { rows: TxnRow[] }) {
  const router = useRouter();
  const [, startTransition] = useTransition();

  function onDelete(id: string) {
    if (!confirm("Delete this transaction? Cost basis and P&L will be recomputed.")) return;
    startTransition(async () => {
      await deleteTransaction(id);
      router.refresh();
    });
  }

  if (rows.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-border bg-card/40 p-10 text-center">
        <p className="text-sm text-muted-foreground">
          No transactions yet. Add your first BUY above to start tracking this portfolio.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-border bg-card overflow-hidden shadow-card">
      <div className="px-5 py-4 border-b border-border">
        <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
          Transactions
        </span>
        <span className="ml-2 text-xs text-muted-foreground">{rows.length} total</span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="text-muted-foreground border-b border-border bg-secondary/40">
            <tr className="text-[11px] uppercase tracking-wider">
              <th className="px-4 py-2.5 text-left font-medium">Date</th>
              <th className="px-4 py-2.5 text-left font-medium">Type</th>
              <th className="px-4 py-2.5 text-left font-medium">Symbol</th>
              <th className="px-4 py-2.5 text-right font-medium">Qty</th>
              <th className="px-4 py-2.5 text-right font-medium">Price</th>
              <th className="px-4 py-2.5 text-right font-medium hidden md:table-cell">Fees</th>
              <th className="px-4 py-2.5 text-right font-medium">Total</th>
              <th className="px-4 py-2.5" />
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const total = r.quantity * r.price + (r.type === "BUY" ? r.fees : -r.fees);
              const isBuy = r.type === "BUY";
              return (
                <tr key={r.id} className="border-b border-border/60 last:border-0 hover:bg-secondary/30 transition-colors">
                  <td className="px-4 py-3 font-mono text-[12px] text-muted-foreground whitespace-nowrap">
                    {new Date(r.executedAt).toLocaleDateString()}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-medium border ${
                        isBuy
                          ? "border-emerald-300 dark:border-emerald-800 text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40"
                          : "border-rose-300 dark:border-rose-800 text-rose-700 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/40"
                      }`}
                    >
                      {r.type}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <Link
                      href={`/stock/${encodeURIComponent(r.symbol)}`}
                      className="font-mono hover:text-primary transition-colors"
                    >
                      {r.symbol}
                    </Link>
                    {r.note ? (
                      <div className="text-[11px] text-muted-foreground/80 mt-0.5 truncate max-w-[20ch]">
                        {r.note}
                      </div>
                    ) : null}
                  </td>
                  <td className="px-4 py-3 text-right font-mono tabular-nums">
                    {formatQty(r.quantity)}
                  </td>
                  <td className="px-4 py-3 text-right font-mono tabular-nums">
                    {formatCurrency(r.price, r.currency)}
                  </td>
                  <td className="px-4 py-3 text-right font-mono tabular-nums hidden md:table-cell text-muted-foreground">
                    {r.fees > 0 ? formatCurrency(r.fees, r.currency) : "—"}
                  </td>
                  <td className="px-4 py-3 text-right font-mono tabular-nums">
                    {formatCurrency(total, r.currency)}
                  </td>
                  <td className="px-4 py-3 w-10">
                    <button
                      type="button"
                      onClick={() => onDelete(r.id)}
                      aria-label="Delete transaction"
                      className="size-7 inline-flex items-center justify-center rounded-md text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                    >
                      <X className="size-3.5" />
                    </button>
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

function formatCurrency(v: number, currency: string) {
  return new Intl.NumberFormat(currency === "INR" ? "en-IN" : "en-US", {
    style: "currency",
    currency,
    maximumFractionDigits: 2,
  }).format(v);
}
