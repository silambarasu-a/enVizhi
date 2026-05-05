import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft, Trash2 } from "lucide-react";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { provider } from "@/lib/market-data/router";
import { computePositions, unrealizedPnL } from "@/lib/portfolio/positions";
import { AddTransactionForm } from "@/components/portfolio/add-transaction-form";
import { TransactionsLog } from "@/components/portfolio/transactions-log";
import { HoldingsTable, type HoldingRow } from "@/components/portfolio/holdings-table";
import { AllocationChart } from "@/components/portfolio/allocation-chart";
import { DeletePortfolioButton } from "@/components/portfolio/delete-portfolio-button";

export const dynamic = "force-dynamic";

export default async function PortfolioDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await auth();
  if (!session?.user?.id) redirect("/signin");
  const userId = session.user.id;
  const { id } = await params;

  const portfolio = await prisma.portfolio.findFirst({
    where: { id, userId },
    include: {
      transactions: {
        orderBy: { executedAt: "desc" },
        include: {
          stock: { select: { id: true, symbol: true, name: true, currency: true } },
        },
      },
    },
  });
  if (!portfolio) notFound();

  // Reverse to chronological for FIFO computation; UI shows newest-first.
  const txnsForCompute = [...portfolio.transactions].reverse();
  const { positions, totalRealizedPnL } = computePositions(
    txnsForCompute.map((t) => ({
      id: t.id,
      stockId: t.stockId,
      type: t.type,
      quantity: t.quantity,
      price: t.price,
      fees: t.fees,
      executedAt: t.executedAt,
    })),
  );

  // Stock map for hydrating holdings rows.
  const stockMap = new Map(portfolio.transactions.map((t) => [t.stockId, t.stock]));

  // Live quotes for open positions only.
  const openSymbols = Array.from(positions.values())
    .filter((p) => p.quantity > 0)
    .map((p) => stockMap.get(p.stockId)?.symbol)
    .filter((s): s is string => !!s);

  const quotes = openSymbols.length
    ? await provider.getQuotes(openSymbols).catch(() => [])
    : [];
  const quoteBySym = new Map(quotes.map((q) => [q.symbol, q]));

  // Build holdings rows + roll up totals (each in its native currency).
  const holdings: HoldingRow[] = [];
  let totalCostNative = 0; // simplified — sum across native currencies (note caveat in UI)
  let totalValueNative = 0;
  let totalUnrealized = 0;

  for (const pos of positions.values()) {
    if (pos.quantity <= 0) continue;
    const stock = stockMap.get(pos.stockId);
    if (!stock) continue;
    const q = quoteBySym.get(stock.symbol);
    const currentPrice = q?.price ?? null;
    const v = currentPrice != null ? unrealizedPnL(pos, currentPrice) : null;
    holdings.push({
      symbol: stock.symbol,
      name: stock.name,
      currency: stock.currency,
      quantity: pos.quantity,
      avgCost: pos.avgCost,
      currentPrice,
      marketValue: v?.marketValue ?? null,
      unrealized: v?.unrealized ?? null,
      unrealizedPct: v?.unrealizedPct ?? null,
    });
    totalCostNative += pos.costBasis;
    totalValueNative += v?.marketValue ?? pos.costBasis;
    totalUnrealized += v?.unrealized ?? 0;
  }

  // Sort holdings by market value desc.
  holdings.sort((a, b) => (b.marketValue ?? 0) - (a.marketValue ?? 0));

  // Allocation slices (open holdings as % of total market value).
  const totalForSlices = holdings.reduce((s, h) => s + (h.marketValue ?? 0), 0);
  const slices = holdings
    .filter((h) => (h.marketValue ?? 0) > 0)
    .map((h) => ({
      symbol: h.symbol,
      value: h.marketValue!,
      pct: totalForSlices > 0 ? ((h.marketValue ?? 0) / totalForSlices) * 100 : 0,
    }));

  // For the create-transaction form: full active stock list for autocomplete.
  const allStocks = await prisma.stock.findMany({
    where: { isActive: true },
    select: { symbol: true, name: true },
    orderBy: { symbol: "asc" },
  });

  const txnRows = portfolio.transactions.map((t) => ({
    id: t.id,
    type: t.type,
    symbol: t.stock.symbol,
    stockName: t.stock.name,
    quantity: t.quantity,
    price: t.price,
    fees: t.fees,
    currency: t.currency,
    executedAt: t.executedAt.toISOString(),
    note: t.note,
  }));

  // Currencies present so we can show a multi-currency note when relevant.
  const currencies = Array.from(
    new Set(holdings.map((h) => h.currency).concat(portfolio.baseCurrency)),
  );

  return (
    <div className="mx-auto max-w-[1400px] px-6 py-8 space-y-8">
      <Link
        href="/portfolio"
        className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
      >
        <ArrowLeft className="size-3.5" />
        All portfolios
      </Link>

      {/* ── Header ── */}
      <header className="flex items-end justify-between gap-6 flex-wrap">
        <div className="space-y-1.5">
          <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
            Portfolio
          </p>
          <h1 className="font-display text-3xl md:text-4xl">{portfolio.name}</h1>
          <p className="text-sm text-muted-foreground">
            <span className="font-mono">{portfolio.baseCurrency}</span> · benchmark{" "}
            <span className="font-mono">{portfolio.benchmark}</span> · {portfolio.transactions.length}{" "}
            transactions
          </p>
        </div>
        <DeletePortfolioButton id={portfolio.id} name={portfolio.name} />
      </header>

      {/* ── Summary stats (per native currency, see note) ── */}
      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat
          label="Market value"
          value={totalValueNative}
          currency={primaryCurrency(currencies)}
        />
        <Stat
          label="Cost basis"
          value={totalCostNative}
          currency={primaryCurrency(currencies)}
        />
        <Stat
          label="Unrealized P&L"
          value={totalUnrealized}
          currency={primaryCurrency(currencies)}
          tone={totalUnrealized > 0 ? "up" : totalUnrealized < 0 ? "down" : "neutral"}
        />
        <Stat
          label="Realized P&L"
          value={totalRealizedPnL}
          currency={primaryCurrency(currencies)}
          tone={totalRealizedPnL > 0 ? "up" : totalRealizedPnL < 0 ? "down" : "neutral"}
        />
      </section>

      {currencies.length > 1 ? (
        <p className="text-[11px] text-amber-700 dark:text-amber-400 -mt-3">
          Mixed currencies in this portfolio ({currencies.join(", ")}). v1 sums values in their
          native currency without FX conversion. Multi-currency consolidation lands with portfolio
          snapshots in the next phase.
        </p>
      ) : null}

      {/* ── Allocation + Add transaction ── */}
      <section className="grid gap-4 lg:grid-cols-3">
        <div className="lg:col-span-1 rounded-2xl border border-border bg-card p-5 shadow-card">
          <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground mb-4">
            Allocation
          </div>
          <AllocationChart slices={slices.slice(0, 8)} baseCurrency={primaryCurrency(currencies)} />
        </div>
        <div className="lg:col-span-2 rounded-2xl border border-border bg-card p-5 shadow-card">
          <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground mb-4">
            Add transaction
          </div>
          <AddTransactionForm portfolioId={portfolio.id} stocks={allStocks} />
        </div>
      </section>

      {/* ── Holdings ── */}
      <HoldingsTable rows={holdings} />

      {/* ── Transactions log ── */}
      <TransactionsLog rows={txnRows} />
    </div>
  );
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function primaryCurrency(currencies: string[]): string {
  // Pick the currency that's most represented. Defaults to USD.
  return currencies[0] ?? "USD";
}

function Stat({
  label,
  value,
  currency,
  tone = "neutral",
}: {
  label: string;
  value: number;
  currency: string;
  tone?: "up" | "down" | "neutral";
}) {
  const fmt = new Intl.NumberFormat(currency === "INR" ? "en-IN" : "en-US", {
    style: "currency",
    currency,
    maximumFractionDigits: 2,
  });
  const colorClass =
    tone === "up"
      ? "text-emerald-700 dark:text-emerald-400"
      : tone === "down"
      ? "text-rose-700 dark:text-rose-400"
      : "";
  return (
    <div className="rounded-2xl border border-border bg-card p-5 shadow-card">
      <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
        {label}
      </div>
      <div className={`mt-2 font-mono tabular-nums text-2xl ${colorClass}`}>
        {tone !== "neutral" && value > 0 ? "+" : ""}
        {fmt.format(value)}
      </div>
    </div>
  );
}
