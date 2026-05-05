import Link from "next/link";
import { redirect } from "next/navigation";
import { Bell } from "lucide-react";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { AlertRow } from "@/components/alerts/alert-row";

export const dynamic = "force-dynamic";

export default async function AlertsPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/signin");

  const alerts = await prisma.alert.findMany({
    where: { userId: session.user.id },
    orderBy: [{ isActive: "desc" }, { createdAt: "desc" }],
    select: {
      id: true,
      type: true,
      threshold: true,
      isActive: true,
      triggeredAt: true,
      stockId: true,
    },
  });

  // Hydrate stock metadata in one query.
  const stockIds = Array.from(new Set(alerts.map((a) => a.stockId)));
  const stocks = stockIds.length
    ? await prisma.stock.findMany({
        where: { id: { in: stockIds } },
        select: { id: true, symbol: true, name: true, currency: true },
      })
    : [];
  const stockMap = new Map(stocks.map((s) => [s.id, s]));

  const rows = alerts
    .map((a) => {
      const stock = stockMap.get(a.stockId);
      if (!stock) return null;
      return {
        id: a.id,
        type: a.type,
        threshold: a.threshold,
        isActive: a.isActive,
        triggeredAt: a.triggeredAt?.toISOString() ?? null,
        symbol: stock.symbol,
        stockName: stock.name,
        currency: stock.currency,
      };
    })
    .filter((r): r is NonNullable<typeof r> => r !== null);

  const activeCount = rows.filter((r) => r.isActive).length;
  const triggeredCount = rows.filter((r) => r.triggeredAt).length;

  return (
    <div className="mx-auto max-w-[1400px] px-6 py-10 space-y-6">
      <header className="space-y-1.5">
        <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
          Alerts
        </p>
        <h1 className="font-display text-3xl md:text-4xl">All your alerts</h1>
        <p className="text-sm text-muted-foreground">
          Email is sent when an alert fires. Add new alerts on each{" "}
          <Link href="/screener" className="text-primary hover:underline underline-offset-4">
            stock detail page
          </Link>
          .
        </p>
      </header>

      <section className="grid gap-3 sm:grid-cols-3">
        <Stat label="Total" value={String(rows.length)} />
        <Stat label="Active" value={String(activeCount)} />
        <Stat label="Triggered (lifetime)" value={String(triggeredCount)} />
      </section>

      {rows.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-card/40 p-10 text-center">
          <Bell className="size-10 text-muted-foreground/50 mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">
            No alerts yet. Open any{" "}
            <Link href="/screener" className="text-primary hover:underline underline-offset-4">
              stock
            </Link>{" "}
            and add your first alert from the Alerts section.
          </p>
        </div>
      ) : (
        <ul className="rounded-2xl border border-border bg-card overflow-hidden shadow-card divide-y divide-border">
          {rows.map((a) => (
            <AlertRow key={a.id} a={a} />
          ))}
        </ul>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-border bg-card p-4 shadow-card">
      <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
        {label}
      </div>
      <div className="mt-1.5 font-display text-2xl tabular-nums">{value}</div>
    </div>
  );
}
