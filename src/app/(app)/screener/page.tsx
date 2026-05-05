import { filterFromSearchParams } from "@/lib/screener/dsl";
import { listSectors, runScreener } from "@/lib/screener/query";
import { FilterControls } from "@/components/screener/filter-controls";
import { ResultsTable, type ScreenerTableRow } from "@/components/screener/results-table";

export const dynamic = "force-dynamic";

export default async function ScreenerPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const filter = filterFromSearchParams(sp);

  const [{ rows, total, page, pageSize }, sectors] = await Promise.all([
    runScreener(filter),
    listSectors(),
  ]);

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

  return (
    <div className="mx-auto max-w-[1400px] px-6 py-10">
      <header className="mb-8 space-y-1.5">
        <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
          Screener
        </p>
        <h1 className="font-display text-3xl md:text-4xl">Filter the universe</h1>
        <p className="text-sm text-muted-foreground max-w-2xl">
          Combine valuation, growth, quality, and risk filters. Your URL stays in sync — bookmark
          or share any screen.
        </p>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-8">
        <div className="rounded-2xl border border-border bg-card p-5 shadow-card h-fit lg:sticky lg:top-20">
          <FilterControls sectors={sectors} />
        </div>
        <ResultsTable rows={tableRows} total={total} page={page} pageSize={pageSize} />
      </div>
    </div>
  );
}
