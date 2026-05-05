import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowRight, Briefcase } from "lucide-react";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { computePositions } from "@/lib/portfolio/positions";
import { CreatePortfolioForm } from "@/components/portfolio/create-portfolio-form";

export const dynamic = "force-dynamic";

export default async function PortfolioListPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/signin");

  const portfolios = await prisma.portfolio.findMany({
    where: { userId: session.user.id },
    orderBy: { createdAt: "asc" },
    include: {
      transactions: {
        orderBy: { executedAt: "asc" },
        select: {
          id: true,
          stockId: true,
          type: true,
          quantity: true,
          price: true,
          fees: true,
          executedAt: true,
        },
      },
    },
  });

  // Per-portfolio summary: open position count, realized P&L, total invested.
  const summaries = portfolios.map((p) => {
    const { positions, totalRealizedPnL } = computePositions(p.transactions);
    const openPositions = Array.from(positions.values()).filter((pos) => pos.quantity > 0);
    const totalCost = openPositions.reduce((s, pos) => s + pos.costBasis, 0);
    return {
      id: p.id,
      name: p.name,
      baseCurrency: p.baseCurrency,
      benchmark: p.benchmark,
      txnCount: p.transactions.length,
      positionCount: openPositions.length,
      totalCost,
      realized: totalRealizedPnL,
    };
  });

  return (
    <div className="mx-auto max-w-[1400px] px-6 py-10 space-y-8">
      <header className="space-y-1.5">
        <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
          Portfolio
        </p>
        <h1 className="font-display text-3xl md:text-4xl">Your portfolios</h1>
        <p className="text-sm text-muted-foreground max-w-2xl">
          Track holdings across portfolios with FIFO cost basis. Cost basis is in each
          trade&apos;s native currency; current values use today&apos;s FX rate.
        </p>
      </header>

      <section className="rounded-2xl border border-border bg-card p-5 shadow-card">
        <CreatePortfolioForm />
      </section>

      {summaries.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-card/40 p-10 text-center">
          <Briefcase className="size-10 text-muted-foreground/50 mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">
            Create your first portfolio above to start tracking.
          </p>
        </div>
      ) : (
        <section className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {summaries.map((s) => {
            const fmtCcy = new Intl.NumberFormat(s.baseCurrency === "INR" ? "en-IN" : "en-US", {
              style: "currency",
              currency: s.baseCurrency,
              maximumFractionDigits: 0,
            });
            const realizedClass =
              s.realized > 0
                ? "text-emerald-700 dark:text-emerald-400"
                : s.realized < 0
                ? "text-rose-700 dark:text-rose-400"
                : "text-muted-foreground";
            return (
              <Link
                key={s.id}
                href={`/portfolio/${s.id}`}
                className="group rounded-2xl border border-border bg-card p-5 shadow-card hover:shadow-card-lg hover:-translate-y-0.5 transition-all"
              >
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="font-display text-lg">{s.name}</h3>
                    <div className="font-mono text-[11px] text-muted-foreground mt-1 flex items-center gap-2">
                      <span>{s.baseCurrency}</span>
                      <span>·</span>
                      <span>vs {s.benchmark === "^GSPC" ? "S&P 500" : "NIFTY 50"}</span>
                    </div>
                  </div>
                  <ArrowRight className="size-4 text-muted-foreground group-hover:text-foreground transition-colors" />
                </div>
                <div className="mt-4 grid grid-cols-2 gap-3 text-xs">
                  <div>
                    <div className="text-muted-foreground">Positions</div>
                    <div className="font-mono tabular-nums text-base mt-0.5">{s.positionCount}</div>
                  </div>
                  <div>
                    <div className="text-muted-foreground">Cost basis</div>
                    <div className="font-mono tabular-nums text-base mt-0.5">
                      {fmtCcy.format(s.totalCost)}
                    </div>
                  </div>
                  <div>
                    <div className="text-muted-foreground">Realized P&amp;L</div>
                    <div className={`font-mono tabular-nums text-base mt-0.5 ${realizedClass}`}>
                      {s.realized >= 0 ? "+" : ""}
                      {fmtCcy.format(s.realized)}
                    </div>
                  </div>
                  <div>
                    <div className="text-muted-foreground">Trades</div>
                    <div className="font-mono tabular-nums text-base mt-0.5">{s.txnCount}</div>
                  </div>
                </div>
              </Link>
            );
          })}
        </section>
      )}
    </div>
  );
}
