import Link from "next/link";
import { redirect } from "next/navigation";
import { TrendingUp, TrendingDown, ArrowRight, Plus, Star, Bell } from "lucide-react";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { provider } from "@/lib/market-data/router";
import { ALERT_TYPE_LABEL } from "@/lib/alerts/evaluator";
import { VerifyEmailBanner } from "@/components/auth/verify-email-banner";
import { MarketsRegionToggle } from "@/components/dashboard/markets-region-toggle";
import type { MarketsRegion } from "@/generated/prisma/enums";

// Per-user content + live quotes — always render fresh on the server.
// `revalidate` deliberately omitted: combining it with `force-dynamic` is
// contradictory and was suspected of triggering odd cache behavior in dev.
export const dynamic = "force-dynamic";

const INDEX_SYMBOLS = ["^NSEI", "^GSPC", "USDINR=X"] as const;
const INDEX_LABEL: Record<(typeof INDEX_SYMBOLS)[number], string> = {
  "^NSEI": "NIFTY 50",
  "^GSPC": "S&P 500",
  "USDINR=X": "USD / INR",
};

export default async function DashboardPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/signin");
  const userId = session.user.id;

  const userMeta = await prisma.user.findUnique({
    where: { id: userId },
    select: { email: true, emailVerified: true, marketsRegion: true },
  });
  const region: MarketsRegion = userMeta?.marketsRegion ?? "US";

  // Pull what the user actually owns (universe scoped) + live indices and
  // Yahoo's market-wide gainers/losers in parallel. Movers no longer come
  // from a slice of the seeded universe — they're from Yahoo's day_gainers
  // and day_losers screens, so the dashboard reflects real market action.
  const [
    userStocks,
    fundamentalsAgg,
    indexQuotes,
    watchlists,
    alerts,
    yahooMovers,
  ] = await Promise.all([
    prisma.stock.findMany({
      where: {
        isActive: true,
        OR: [
          { watchlistItems: { some: { watchlist: { userId } } } },
          { transactions: { some: { portfolio: { userId } } } },
          { alerts: { some: { userId } } },
        ],
      },
      select: { id: true, symbol: true, exchange: true, name: true, currency: true },
    }),
    prisma.stockFundamentals.aggregate({
      _max: { syncedAt: true },
      _count: { stockId: true },
      where: {
        stock: {
          OR: [
            { watchlistItems: { some: { watchlist: { userId } } } },
            { transactions: { some: { portfolio: { userId } } } },
            { alerts: { some: { userId } } },
          ],
        },
      },
    }),
    fetchQuotesSafe([...INDEX_SYMBOLS]),
    prisma.watchlist.findMany({
      where: { userId },
      orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
      include: {
        _count: { select: { items: true } },
        items: {
          take: 6,
          orderBy: { addedAt: "desc" },
          include: {
            stock: { select: { id: true, symbol: true, name: true, currency: true } },
          },
        },
      },
    }),
    prisma.alert.findMany({
      where: { userId },
      orderBy: [{ triggeredAt: "desc" }, { createdAt: "desc" }],
      take: 6,
      select: {
        id: true,
        type: true,
        threshold: true,
        isActive: true,
        triggeredAt: true,
        stockId: true,
      },
    }),
    fetchMoversSafe(region, 5),
  ]);

  const latestSync = fundamentalsAgg._max.syncedAt;
  const fundamentalsCount = fundamentalsAgg._count.stockId;

  const topGainers = yahooMovers.gainers;
  const topLosers = yahooMovers.losers;
  const topGainer = topGainers[0];
  const topLoser = topLosers[0];

  // Hydrate alert stocks
  const alertStockIds = Array.from(new Set(alerts.map((a) => a.stockId)));
  const alertStocks = alertStockIds.length
    ? await prisma.stock.findMany({
        where: { id: { in: alertStockIds } },
        select: { id: true, symbol: true, name: true, currency: true },
      })
    : [];
  const alertStockMap = new Map(alertStocks.map((s) => [s.id, s]));

  return (
    <div className="mx-auto max-w-[1400px] px-6 py-10 space-y-8">
      {userMeta && !userMeta.emailVerified ? (
        <VerifyEmailBanner email={userMeta.email} />
      ) : null}

      {/* ── Greeting ── */}
      <header className="flex items-end justify-between gap-6 flex-wrap">
        <div className="space-y-1.5">
          <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
            Dashboard
          </p>
          <h1 className="font-display text-3xl md:text-4xl">
            {greeting()}
            {session?.user?.name ? `, ${session.user.name.split(" ")[0]}` : "."}
          </h1>
        </div>
        <UniverseChip
          total={userStocks.length}
          fundamentalsCount={fundamentalsCount}
          latestSync={latestSync}
        />
      </header>

      {/* ── Markets strip (compact horizontal) ── */}
      <section className="rounded-2xl border border-border bg-card shadow-card overflow-hidden">
        <div className="grid grid-cols-1 sm:grid-cols-3 divide-y sm:divide-y-0 sm:divide-x divide-border">
          {INDEX_SYMBOLS.map((sym, i) => {
            const q = indexQuotes.find((x) => x.symbol === sym);
            return (
              <IndexTile
                key={sym}
                label={INDEX_LABEL[sym]}
                ticker={sym}
                price={q?.price ?? null}
                changePct={q?.changePct ?? null}
                currency={i === 1 ? "USD" : "INR"}
              />
            );
          })}
        </div>
      </section>

      {/* ── Watchlists + Alerts ── */}
      <section className="grid gap-4 lg:grid-cols-3">
        <WatchlistsPreview watchlists={watchlists} className="lg:col-span-2" />
        <AlertsPreview alerts={alerts} stockMap={alertStockMap} />
      </section>

      {/* ── Movers (live, market-wide via Yahoo) ── */}
      <section className="space-y-3">
        <div className="flex items-end justify-between gap-3 flex-wrap">
          <div>
            <h2 className="font-mono text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
              Market movers
            </h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              Live from Yahoo · auto-saves to your profile
            </p>
          </div>
          <MarketsRegionToggle current={region} />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <MoverCard kind="up" rows={topGainers} highlight={topGainer} />
          <MoverCard kind="down" rows={topLosers} highlight={topLoser} />
        </div>
      </section>
    </div>
  );
}

// ─── Live data helpers ──────────────────────────────────────────────────────

async function fetchQuotesSafe(symbols: string[]) {
  if (symbols.length === 0) return [];
  try {
    return await provider.getQuotes(symbols);
  } catch {
    return [];
  }
}

async function fetchMoversSafe(region: MarketsRegion, count: number) {
  try {
    return await provider.getMarketMovers(region, count);
  } catch {
    return { gainers: [], losers: [] };
  }
}

function greeting() {
  const hour = new Date().getHours();
  if (hour < 5) return "Burning the midnight oil";
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

/** Currency-aware price formatter — `$234.12`, `₹2,432.30`, etc. Uses
 *  `narrowSymbol` so we get `$` instead of `US$` when locale-mixed (e.g. an
 *  INR-locale user viewing a USD stock). Centralized so every dashboard
 *  surface renders prices consistently. */
function formatCurrency(value: number, currency: string): string {
  const safeCurrency = currency || "USD";
  try {
    return new Intl.NumberFormat(safeCurrency === "INR" ? "en-IN" : "en-US", {
      style: "currency",
      currency: safeCurrency,
      currencyDisplay: "narrowSymbol",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(value);
  } catch {
    // Unknown ISO code (rare from Yahoo) — fall back to plain number + suffix.
    return `${value.toFixed(2)} ${safeCurrency}`;
  }
}

function relativeTime(d: Date | null) {
  if (!d) return "—";
  const diff = (Date.now() - d.getTime()) / 1000;
  if (diff < 60) return "just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

// ─── Components ─────────────────────────────────────────────────────────────

function UniverseChip({
  total,
  fundamentalsCount,
  latestSync,
}: {
  total: number;
  fundamentalsCount: number;
  latestSync: Date | null;
}) {
  const pct = total > 0 ? Math.round((fundamentalsCount / total) * 100) : 0;
  return (
    <div className="rounded-xl border border-border bg-card px-4 py-2.5 shadow-card flex items-center gap-4 text-xs">
      <div>
        <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
          Universe
        </div>
        <div className="font-mono tabular-nums">
          <span className="text-foreground">{total}</span>{" "}
          <span className="text-muted-foreground">tickers · {pct}%</span>
        </div>
      </div>
      <div className="border-l border-border h-9" />
      <div>
        <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
          Last sync
        </div>
        <div className="font-mono tabular-nums">{relativeTime(latestSync)}</div>
      </div>
    </div>
  );
}

function IndexTile({
  label,
  ticker,
  price,
  changePct,
  currency,
}: {
  label: string;
  ticker: string;
  price: number | null;
  changePct: number | null;
  currency: string;
}) {
  const isUp = (changePct ?? 0) >= 0;
  return (
    <div className="px-6 py-5 flex items-center justify-between gap-4">
      <div>
        <div className="text-sm font-medium">{label}</div>
        <div className="font-mono text-[11px] text-muted-foreground mt-0.5">{ticker}</div>
      </div>
      <div className="text-right">
        <div className="font-mono tabular-nums text-2xl">
          {price != null ? formatCurrency(price, currency) : "—"}
        </div>
        {changePct != null ? (
          <div
            className={`font-mono tabular-nums text-xs mt-0.5 ${
              isUp ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"
            }`}
          >
            {isUp ? "+" : ""}
            {changePct.toFixed(2)}% · {currency}
          </div>
        ) : (
          <div className="font-mono text-xs text-muted-foreground mt-0.5">—</div>
        )}
      </div>
    </div>
  );
}

interface WatchlistPreviewItem {
  id: string;
  name: string;
  _count: { items: number };
  items: Array<{
    stock: { id: string; symbol: string; name: string; currency: string };
  }>;
}

function WatchlistsPreview({
  watchlists,
  className,
}: {
  watchlists: WatchlistPreviewItem[];
  className?: string;
}) {
  return (
    <div className={`rounded-2xl border border-border bg-card shadow-card overflow-hidden ${className ?? ""}`}>
      <div className="px-5 py-4 flex items-center justify-between border-b border-border">
        <div className="flex items-center gap-2">
          <Star className="size-4 text-muted-foreground" />
          <span className="text-sm font-medium">Your watchlists</span>
        </div>
        <Link
          href="/watchlists"
          className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1"
        >
          View all
          <ArrowRight className="size-3" />
        </Link>
      </div>

      {watchlists.length === 0 ? (
        <div className="px-5 py-10 text-center">
          <p className="text-sm text-muted-foreground mb-4">
            You don&apos;t have any watchlists yet.
          </p>
          <Link
            href="/watchlists"
            className="inline-flex items-center gap-1.5 h-9 px-3.5 rounded-lg bg-primary text-primary-foreground text-[13px] font-medium hover:opacity-90 transition-opacity"
          >
            <Plus className="size-3.5" />
            Create your first watchlist
          </Link>
        </div>
      ) : (
        <ul className="divide-y divide-border">
          {watchlists.slice(0, 4).map((wl) => (
            <li key={wl.id}>
              <Link
                href={`/watchlists/${wl.id}`}
                className="flex items-center justify-between px-5 py-3.5 hover:bg-secondary/40 transition-colors"
              >
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-medium truncate">{wl.name}</div>
                  <div className="font-mono text-[11px] text-muted-foreground mt-0.5 truncate">
                    {wl._count.items} stock{wl._count.items === 1 ? "" : "s"}
                    {wl.items.length > 0 ? (
                      <span className="ml-2">
                        ·{" "}
                        {wl.items
                          .slice(0, 4)
                          .map((it) => it.stock.symbol)
                          .join(" · ")}
                        {wl._count.items > 4 ? ` · +${wl._count.items - 4}` : ""}
                      </span>
                    ) : null}
                  </div>
                </div>
                <ArrowRight className="size-4 text-muted-foreground shrink-0" />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

interface AlertPreviewItem {
  id: string;
  type: string;
  threshold: number;
  isActive: boolean;
  triggeredAt: Date | null;
  stockId: string;
}

function AlertsPreview({
  alerts,
  stockMap,
}: {
  alerts: AlertPreviewItem[];
  stockMap: Map<string, { id: string; symbol: string; name: string; currency: string }>;
}) {
  const triggered = alerts.filter((a) => a.triggeredAt);

  return (
    <div className="rounded-2xl border border-border bg-card shadow-card overflow-hidden">
      <div className="px-5 py-4 flex items-center justify-between border-b border-border">
        <div className="flex items-center gap-2">
          <Bell className="size-4 text-muted-foreground" />
          <span className="text-sm font-medium">Alerts</span>
        </div>
        <Link
          href="/alerts"
          className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1"
        >
          View all
          <ArrowRight className="size-3" />
        </Link>
      </div>

      {alerts.length === 0 ? (
        <div className="px-5 py-10 text-center text-sm text-muted-foreground">
          No alerts yet. Open any{" "}
          <Link href="/screener" className="text-primary hover:underline underline-offset-4">
            stock
          </Link>{" "}
          and add one.
        </div>
      ) : (
        <ul className="divide-y divide-border">
          {alerts.slice(0, 5).map((a) => {
            const stock = stockMap.get(a.stockId);
            if (!stock) return null;
            return (
              <li key={a.id}>
                <Link
                  href={`/stock/${encodeURIComponent(stock.symbol)}`}
                  className="flex items-center justify-between px-5 py-3 hover:bg-secondary/40 transition-colors"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span
                      className={`size-2 rounded-full shrink-0 ${
                        a.triggeredAt
                          ? "bg-emerald-500"
                          : a.isActive
                          ? "bg-primary"
                          : "bg-muted-foreground/40"
                      }`}
                    />
                    <span className="font-mono text-sm truncate">{stock.symbol}</span>
                  </div>
                  <span className="text-[11px] text-muted-foreground shrink-0">
                    {ALERT_TYPE_LABEL[a.type as keyof typeof ALERT_TYPE_LABEL]} {a.threshold}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
      {triggered.length > 0 ? (
        <div className="px-5 py-2.5 border-t border-border bg-emerald-500/5 text-xs text-emerald-700 dark:text-emerald-400">
          {triggered.length} alert{triggered.length === 1 ? "" : "s"} fired recently
        </div>
      ) : null}
    </div>
  );
}

function MoverCard({
  kind,
  rows,
  highlight,
}: {
  kind: "up" | "down";
  rows: Array<{ symbol: string; name: string; price: number; changePct: number; currency: string }>;
  highlight?: { symbol: string; changePct: number } | undefined;
}) {
  const accentClass =
    kind === "up"
      ? "text-emerald-700 dark:text-emerald-400"
      : "text-rose-700 dark:text-rose-400";
  const Icon = kind === "up" ? TrendingUp : TrendingDown;
  return (
    <div className="rounded-2xl border border-border bg-card shadow-card overflow-hidden">
      <div className="px-5 py-4 flex items-center justify-between border-b border-border">
        <div className="flex items-center gap-2">
          <Icon className={`size-4 ${accentClass}`} />
          <span className="text-sm font-medium">
            Top {kind === "up" ? "gainers" : "losers"}
          </span>
        </div>
        {highlight ? (
          <span className={`font-mono text-[11px] ${accentClass}`}>
            {highlight.symbol} {highlight.changePct >= 0 ? "+" : ""}
            {highlight.changePct.toFixed(2)}%
          </span>
        ) : null}
      </div>
      {rows.length === 0 ? (
        <div className="px-5 py-8 text-center text-xs text-muted-foreground">
          No live quotes — markets may be closed.
        </div>
      ) : (
        <ul className="divide-y divide-border">
          {rows.map((r) => (
            <li key={r.symbol}>
              <Link
                href={`/stock/${encodeURIComponent(r.symbol)}`}
                className="flex items-center justify-between px-5 py-3 hover:bg-secondary/40 transition-colors"
              >
                <div className="min-w-0">
                  <div className="font-mono text-[13px] truncate">{r.symbol}</div>
                  <div className="text-[11px] text-muted-foreground truncate">{r.name}</div>
                </div>
                <div className="text-right shrink-0">
                  <div className="font-mono tabular-nums text-[13px]">
                    {formatCurrency(r.price, r.currency)}
                  </div>
                  <div className={`font-mono tabular-nums text-[11px] ${accentClass}`}>
                    {r.changePct >= 0 ? "+" : ""}
                    {r.changePct.toFixed(2)}%
                  </div>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
