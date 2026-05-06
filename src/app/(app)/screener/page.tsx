import Link from "next/link";
import { redirect } from "next/navigation";
import { Search } from "lucide-react";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { filterFromSearchParams } from "@/lib/screener/dsl";
import { listSectors, runScreener } from "@/lib/screener/query";
import { FilterControls } from "@/components/screener/filter-controls";
import { ResultsTable, type ScreenerTableRow } from "@/components/screener/results-table";
import { DiscoverPanel } from "@/components/screener/discover-panel";
import type { MarketsRegion } from "@/generated/prisma/enums";

export const dynamic = "force-dynamic";

export default async function ScreenerPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await auth();
  if (!session?.user?.id) redirect("/signin");
  const userId = session.user.id;

  const sp = await searchParams;
  const filter = filterFromSearchParams(sp);

  const [{ rows, total, page, pageSize }, sectors, userMeta] = await Promise.all([
    runScreener(filter, userId),
    listSectors(userId),
    prisma.user.findUnique({
      where: { id: userId },
      select: { marketsRegion: true },
    }),
  ]);
  const defaultRegion: MarketsRegion = userMeta?.marketsRegion ?? "US";

  // BigInt isn't serializable across the Server → Client boundary; convert
  // marketCap to string here so the table can render it.
  const tableRows: ScreenerTableRow[] = rows.map((r) => ({
    id: r.id,
    symbol: r.symbol,
    exchange: r.exchange,
    name: r.name,
    sector: r.sector,
    currency: r.currency,
    fundamentals: r.fundamentals
      ? {
          pe: r.fundamentals.pe,
          peg: r.fundamentals.peg,
          modifiedPeg: r.fundamentals.modifiedPeg,
          fairPe: r.fundamentals.fairPe,
          lynchCategory: r.fundamentals.lynchCategory,
          marketCap: r.fundamentals.marketCap != null ? r.fundamentals.marketCap.toString() : null,
          epsGrowth5y: r.fundamentals.epsGrowth5y,
          revenueGrowth5y: r.fundamentals.revenueGrowth5y,
          dividendYield: r.fundamentals.dividendYield,
          roe: r.fundamentals.roe,
          profitMargin: r.fundamentals.profitMargin,
          debtToEquity: r.fundamentals.debtToEquity,
          beta: r.fundamentals.beta,
          priceToBook: r.fundamentals.priceToBook,
        }
      : null,
  }));

  // Most recent fundamentals sync across the visible page — surfaced as a
  // "Data as of" indicator so users know how fresh the table is, especially
  // when the market is closed (Yahoo returns last-close data, which is what
  // gets persisted on sync).
  const latestSyncedAt = rows
    .map((r) => r.fundamentals?.syncedAt ?? null)
    .filter((d): d is Date => d != null)
    .reduce<Date | null>((max, d) => (max == null || d > max ? d : max), null);
  const latestSyncedAtIso = latestSyncedAt ? latestSyncedAt.toISOString() : null;

  // True when user has truly nothing — no stocks at all in their universe yet.
  // Distinct from "filtered to zero" (where total drops because of strict
  // filters). For empty-state we look at unfiltered totals via a count.
  const hasAnyStock = total > 0 || hasNonTrivialFilters(filter);

  return (
    <div className="mx-auto max-w-[1400px] px-6 py-10 space-y-6">
      <header className="space-y-1.5">
        <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
          Screener
        </p>
        <h1 className="font-display text-3xl md:text-4xl">Filter your universe</h1>
        <p className="text-sm text-muted-foreground max-w-2xl">
          Stocks here come from your watchlists, portfolio, and alerts. Use{" "}
          <kbd className="font-mono text-[11px] px-1.5 py-0.5 rounded border border-border bg-secondary">
            ⌘K
          </kbd>{" "}
          to find a ticker, or pull a Yahoo screen below to expand.
        </p>
      </header>

      <DiscoverPanel defaultRegion={defaultRegion} />

      {!hasAnyStock ? (
        <div className="rounded-2xl border border-dashed border-border bg-card/40 p-10 text-center">
          <Search className="size-10 text-muted-foreground/50 mx-auto mb-3" />
          <p className="text-sm font-medium">Your universe is empty</p>
          <p className="text-xs text-muted-foreground mt-1.5 max-w-md mx-auto leading-relaxed">
            Add stocks via{" "}
            <kbd className="font-mono text-[10px] px-1 py-0.5 rounded border border-border bg-secondary">
              ⌘K
            </kbd>{" "}
            search, or{" "}
            <Link href="/watchlists" className="text-primary hover:underline underline-offset-4">
              create a watchlist
            </Link>
            . Click a Discover button above to import the top names from a Yahoo screen.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-6 lg:gap-8">
          <div className="rounded-2xl border border-border bg-card p-5 shadow-card h-fit lg:sticky lg:top-20">
            <FilterControls sectors={sectors} />
          </div>
          <ResultsTable
            rows={tableRows}
            total={total}
            page={page}
            pageSize={pageSize}
            latestSyncedAt={latestSyncedAtIso}
          />
        </div>
      )}
    </div>
  );
}

function hasNonTrivialFilters(filter: ReturnType<typeof filterFromSearchParams>) {
  return (
    Object.keys(filter.ranges ?? {}).length > 0 ||
    filter.exchanges.length > 0 ||
    filter.sectors.length > 0 ||
    filter.lynchCategories.length > 0 ||
    !!filter.search
  );
}
