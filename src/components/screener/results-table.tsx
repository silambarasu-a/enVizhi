"use client";

import Link from "next/link";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { ArrowUp, ArrowDown, ArrowUpDown } from "lucide-react";
import { cn } from "@/lib/utils";

/** Wire-format row passed from server → client (BigInt → string). */
export interface ScreenerTableRow {
  id: string;
  symbol: string;
  exchange: string;
  name: string;
  sector: string | null;
  currency: string;
  fundamentals: {
    pe: number | null;
    peg: number | null;
    modifiedPeg: number | null;
    fairPe: number | null;
    lynchCategory: string | null;
    marketCap: string | null;
    epsGrowth5y: number | null;
    revenueGrowth5y: number | null;
    dividendYield: number | null;
    roe: number | null;
    profitMargin: number | null;
    debtToEquity: number | null;
    beta: number | null;
    priceToBook: number | null;
  } | null;
}
import {
  filterFromSearchParams,
  filterToSearchParams,
} from "@/lib/screener/dsl";
import { NUMERIC_FIELD_IDS, type SortableField } from "@/lib/screener/fields";
import { formatMarketCap as formatMarketCapShared } from "@/lib/format";

/**
 * URL keys that the filter system owns. When pagination / sort rewrites the
 * URL, we preserve unrelated keys (e.g. the Discover panel's region/chip) but
 * must NOT preserve stale filter keys that the new filter has dropped.
 */
const FILTER_OWNED_KEYS = new Set<string>([
  ...NUMERIC_FIELD_IDS.flatMap((id) => [`${id}.min`, `${id}.max`]),
  "exchange",
  "sector",
  "lynch",
  "q",
  "sort",
  "dir",
  "page",
  "pageSize",
]);

const COLUMNS: Array<{
  id: SortableField | "name";
  label: string;
  sortable: boolean;
  align?: "right" | "left";
  render: (r: ScreenerTableRow) => React.ReactNode;
  width?: string;
}> = [
  {
    id: "symbol",
    label: "Symbol",
    sortable: true,
    render: (r) => (
      <span className="font-mono text-[13px]">{r.symbol}</span>
    ),
  },
  {
    id: "name",
    label: "Name",
    sortable: false,
    render: (r) => (
      <span className="text-muted-foreground">{r.name}</span>
    ),
  },
  {
    id: "marketCapBn",
    label: "Mkt Cap",
    sortable: true,
    align: "right",
    render: (r) => formatMarketCap(r.fundamentals?.marketCap, r.currency),
  },
  { id: "pe", label: "P/E", sortable: true, align: "right", render: (r) => formatRatio(r.fundamentals?.pe) },
  { id: "peg", label: "PEG", sortable: true, align: "right", render: (r) => formatRatio(r.fundamentals?.peg) },
  {
    id: "lynchCategory" as never,
    label: "Lynch",
    sortable: false,
    render: (r) => formatLynch(r.fundamentals?.lynchCategory ?? null),
  },
  { id: "priceToBook", label: "P/B", sortable: true, align: "right", render: (r) => formatRatio(r.fundamentals?.priceToBook) },
  { id: "epsGrowth5y", label: "EPS Δ", sortable: true, align: "right", render: (r) => formatPct(r.fundamentals?.epsGrowth5y) },
  { id: "revenueGrowth5y", label: "Rev Δ", sortable: true, align: "right", render: (r) => formatPct(r.fundamentals?.revenueGrowth5y) },
  { id: "dividendYield", label: "Div Yld", sortable: true, align: "right", render: (r) => formatPct(r.fundamentals?.dividendYield) },
  { id: "roe", label: "ROE", sortable: true, align: "right", render: (r) => formatPct(r.fundamentals?.roe) },
  { id: "beta", label: "β", sortable: true, align: "right", render: (r) => formatRatio(r.fundamentals?.beta) },
];

export function ResultsTable({
  rows,
  total,
  page,
  pageSize,
  latestSyncedAt,
}: {
  rows: ScreenerTableRow[];
  total: number;
  page: number;
  pageSize: number;
  /** ISO string of the most recent fundamentals sync across the visible page. */
  latestSyncedAt: string | null;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();
  const filter = filterFromSearchParams(Object.fromEntries(sp.entries()));

  function pushFilter(next: typeof filter) {
    // Build the canonical filter URL, then layer back any *non-filter* params
    // (e.g. `discoverRegion`, `discoverScreen` from the Discover panel) so
    // sort / pagination doesn't wipe state owned by other components.
    const filterParams = filterToSearchParams(next);
    const filterKeys = new Set(filterParams.keys());
    sp.forEach((value, key) => {
      if (!filterKeys.has(key) && !FILTER_OWNED_KEYS.has(key) && !filterParams.has(key)) {
        filterParams.set(key, value);
      }
    });
    const qs = filterParams.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  }

  function setSort(col: SortableField) {
    let nextDir: "asc" | "desc";
    if (filter.sort === col) {
      nextDir = filter.dir === "asc" ? "desc" : "asc";
    } else {
      nextDir = "asc";
    }
    pushFilter({ ...filter, sort: col, dir: nextDir, page: 1 });
  }

  function setPage(p: number) {
    pushFilter({ ...filter, page: p });
  }

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  return (
    <div className="rounded-2xl border border-border bg-card overflow-hidden shadow-card">
      {/* Header bar */}
      <div className="px-5 py-4 border-b border-border flex items-center justify-between gap-4 text-sm">
        <div className="flex items-baseline gap-3 min-w-0">
          <div className="text-muted-foreground whitespace-nowrap">
            <span className="font-mono tabular-nums text-foreground">{total.toLocaleString()}</span>{" "}
            results
          </div>
          {latestSyncedAt ? (
            <div
              className="hidden sm:inline-flex items-center gap-1.5 text-[11px] text-muted-foreground"
              title={`Fundamentals last synced ${new Date(latestSyncedAt).toLocaleString()}`}
            >
              <span className="size-1.5 rounded-full bg-emerald-500" />
              <span>Data as of {formatAsOf(latestSyncedAt)}</span>
            </div>
          ) : null}
        </div>
        <Pager page={page} totalPages={totalPages} onChange={setPage} />
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-secondary/40 text-muted-foreground">
              {COLUMNS.map((c) => (
                <th
                  key={c.id}
                  className={cn(
                    "px-3 py-2.5 font-medium text-[11px] uppercase tracking-wider",
                    c.align === "right" ? "text-right" : "text-left",
                  )}
                >
                  {c.sortable ? (
                    <button
                      type="button"
                      onClick={() => setSort(c.id as SortableField)}
                      className={cn(
                        "inline-flex items-center gap-1 hover:text-foreground transition-colors",
                        c.align === "right" ? "flex-row-reverse" : "",
                        filter.sort === c.id ? "text-foreground" : "",
                      )}
                    >
                      {c.label}
                      {filter.sort === c.id ? (
                        filter.dir === "asc" ? (
                          <ArrowUp className="size-3" />
                        ) : (
                          <ArrowDown className="size-3" />
                        )
                      ) : (
                        <ArrowUpDown className="size-3 opacity-30" />
                      )}
                    </button>
                  ) : (
                    c.label
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={COLUMNS.length} className="px-4 py-12 text-center text-muted-foreground">
                  No matches. Try widening your filters.
                </td>
              </tr>
            ) : (
              rows.map((r) => (
                <tr
                  key={r.id}
                  className="border-b border-border/60 last:border-0 hover:bg-secondary/30 transition-colors"
                >
                  {COLUMNS.map((c) => (
                    <td
                      key={c.id}
                      className={cn(
                        "px-3 py-2.5",
                        c.align === "right" ? "text-right font-mono tabular-nums" : "",
                      )}
                    >
                      {c.id === "symbol" ? (
                        <Link
                          href={`/stock/${encodeURIComponent(r.symbol)}`}
                          className="hover:text-primary transition-colors"
                        >
                          {c.render(r)}
                        </Link>
                      ) : (
                        c.render(r)
                      )}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {totalPages > 1 ? (
        <div className="px-5 py-4 border-t border-border flex items-center justify-end text-sm">
          <Pager page={page} totalPages={totalPages} onChange={setPage} />
        </div>
      ) : null}
    </div>
  );
}

function Pager({
  page,
  totalPages,
  onChange,
}: {
  page: number;
  totalPages: number;
  onChange: (p: number) => void;
}) {
  return (
    <div className="inline-flex items-center gap-3 text-xs">
      <button
        type="button"
        disabled={page <= 1}
        onClick={() => onChange(page - 1)}
        className="size-8 inline-flex items-center justify-center rounded-lg border border-border bg-background hover:bg-secondary disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
      >
        ←
      </button>
      <span className="font-mono tabular-nums text-muted-foreground">
        {page} / {totalPages}
      </span>
      <button
        type="button"
        disabled={page >= totalPages}
        onClick={() => onChange(page + 1)}
        className="size-8 inline-flex items-center justify-center rounded-lg border border-border bg-background hover:bg-secondary disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
      >
        →
      </button>
    </div>
  );
}

// ─── Cell formatters ─────────────────────────────────────────────────────

function formatRatio(v: number | null | undefined) {
  if (v == null || !Number.isFinite(v)) return <span className="text-muted-foreground/40">—</span>;
  return v.toFixed(2);
}

function formatPct(v: number | null | undefined) {
  if (v == null || !Number.isFinite(v)) return <span className="text-muted-foreground/40">—</span>;
  const cls = v > 0 ? "text-emerald-700 dark:text-emerald-400" : v < 0 ? "text-rose-700 dark:text-rose-400" : "";
  return <span className={cls}>{v >= 0 ? "+" : ""}{v.toFixed(1)}%</span>;
}

function formatLynch(cat: string | null) {
  if (!cat) return <span className="text-muted-foreground/40">—</span>;
  const labels: Record<string, string> = {
    SLOW_GROWER: "Slow Grower",
    STALWART: "Stalwart",
    FAST_GROWER: "Fast Grower",
    CYCLICAL: "Cyclical",
    TURNAROUND: "Turnaround",
    ASSET_PLAY: "Asset Play",
  };
  const styles: Record<string, string> = {
    SLOW_GROWER: "border-zinc-300 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300 bg-zinc-100 dark:bg-zinc-900",
    STALWART: "border-emerald-300 dark:border-emerald-800 text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40",
    FAST_GROWER: "border-indigo-300 dark:border-indigo-800 text-indigo-700 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/40",
    CYCLICAL: "border-amber-300 dark:border-amber-800 text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/40",
    TURNAROUND: "border-rose-300 dark:border-rose-800 text-rose-700 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/40",
    ASSET_PLAY: "border-cyan-300 dark:border-cyan-800 text-cyan-700 dark:text-cyan-400 bg-cyan-50 dark:bg-cyan-950/40",
  };
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-medium border ${styles[cat] ?? styles.SLOW_GROWER}`}
    >
      {labels[cat] ?? cat}
    </span>
  );
}

function formatAsOf(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  const now = new Date();
  const startOfDay = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const dayDiff = Math.round((startOfDay(now) - startOfDay(d)) / 86_400_000);
  const time = d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
  if (dayDiff === 0) return `today, ${time}`;
  if (dayDiff === 1) return `yesterday, ${time}`;
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

function formatMarketCap(cap: string | null | undefined, currency: string) {
  if (cap == null) return <span className="text-muted-foreground/40">—</span>;
  const n = Number(cap);
  if (!Number.isFinite(n)) return <span className="text-muted-foreground/40">—</span>;
  return formatMarketCapShared(n, currency);
}
