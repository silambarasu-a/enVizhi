"use client";

import Link from "next/link";
import { useTransition } from "react";
import { Trash2, X } from "lucide-react";
import { deleteWatchlist, removeFromWatchlist } from "@/app/(app)/watchlists/actions";
import { useRouter } from "next/navigation";

interface ItemRow {
  id: string;
  symbol: string;
  name: string;
  currency: string;
  exchange: string;
  price: number | null;
  changePct: number | null;
}

export function WatchlistDetail({
  watchlistId,
  rows,
}: {
  watchlistId: string;
  rows: ItemRow[];
}) {
  const router = useRouter();
  const [, startTransition] = useTransition();

  function onRemove(itemId: string) {
    startTransition(async () => {
      await removeFromWatchlist(itemId);
      router.refresh();
    });
  }

  function onDeleteWatchlist() {
    if (!confirm("Delete this watchlist? Stocks remain in the universe; alerts on them are kept.")) {
      return;
    }
    startTransition(async () => {
      await deleteWatchlist(watchlistId);
      router.push("/watchlists");
      router.refresh();
    });
  }

  return (
    <>
      <div className="flex justify-end">
        <button
          type="button"
          onClick={onDeleteWatchlist}
          className="inline-flex items-center gap-1.5 h-8 px-2.5 rounded-md text-[12px] text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
        >
          <Trash2 className="size-3.5" />
          Delete watchlist
        </button>
      </div>

      <div className="rounded-2xl border border-border bg-card overflow-hidden shadow-card">
        {rows.length === 0 ? (
          <div className="px-6 py-10 text-center">
            <p className="text-sm text-muted-foreground">
              This watchlist is empty.{" "}
              <Link href="/screener" className="text-primary hover:underline underline-offset-4">
                Open the screener
              </Link>{" "}
              and click the + on any stock to add it here.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-muted-foreground border-b border-border bg-secondary/40">
                <tr className="text-[11px] uppercase tracking-wider">
                  <th className="px-4 py-2.5 text-left font-medium">Symbol</th>
                  <th className="px-4 py-2.5 text-left font-medium">Name</th>
                  <th className="px-4 py-2.5 text-left font-medium hidden md:table-cell">Exchange</th>
                  <th className="px-4 py-2.5 text-right font-medium">Price</th>
                  <th className="px-4 py-2.5 text-right font-medium">Δ Day</th>
                  <th className="px-4 py-2.5" />
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => {
                  const up = (r.changePct ?? 0) >= 0;
                  return (
                    <tr key={r.id} className="border-b border-border/60 last:border-0 hover:bg-secondary/30 transition-colors">
                      <td className="px-4 py-3">
                        <Link href={`/stock/${encodeURIComponent(r.symbol)}`} className="font-mono hover:text-primary transition-colors">
                          {r.symbol}
                        </Link>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">{r.name}</td>
                      <td className="px-4 py-3 hidden md:table-cell font-mono text-[11px] text-muted-foreground">{r.exchange}</td>
                      <td className="px-4 py-3 text-right font-mono tabular-nums">
                        {r.price != null
                          ? new Intl.NumberFormat(r.currency === "INR" ? "en-IN" : "en-US", {
                              minimumFractionDigits: 2,
                              maximumFractionDigits: 2,
                            }).format(r.price)
                          : "—"}
                      </td>
                      <td className={`px-4 py-3 text-right font-mono tabular-nums ${
                        r.changePct == null
                          ? "text-muted-foreground/40"
                          : up
                          ? "text-emerald-600 dark:text-emerald-400"
                          : "text-rose-600 dark:text-rose-400"
                      }`}>
                        {r.changePct != null ? `${r.changePct >= 0 ? "+" : ""}${r.changePct.toFixed(2)}%` : "—"}
                      </td>
                      <td className="px-4 py-3 w-10">
                        <button
                          type="button"
                          onClick={() => onRemove(r.id)}
                          aria-label="Remove from watchlist"
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
        )}
      </div>
    </>
  );
}
