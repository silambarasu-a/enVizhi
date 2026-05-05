import Link from "next/link";
import { ArrowRight, Plus } from "lucide-react";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { createWatchlist } from "./actions";

export const dynamic = "force-dynamic";

export default async function WatchlistsPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/signin");

  const watchlists = await prisma.watchlist.findMany({
    where: { userId: session.user.id },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
    include: {
      _count: { select: { items: true } },
      items: {
        take: 4,
        orderBy: { addedAt: "desc" },
        select: {
          stock: { select: { symbol: true, name: true } },
        },
      },
    },
  });

  return (
    <div className="mx-auto max-w-[1400px] px-6 py-10 space-y-8">
      <header className="flex items-end justify-between gap-6 flex-wrap">
        <div className="space-y-1.5">
          <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
            Watchlists
          </p>
          <h1 className="font-display text-3xl md:text-4xl">Your watchlists</h1>
          <p className="text-sm text-muted-foreground">
            Group stocks you&apos;re tracking. Add alerts on individual stocks from their detail page.
          </p>
        </div>
      </header>

      <section className="rounded-2xl border border-border bg-card p-5 shadow-card">
        <form action={createWatchlist} className="flex gap-3">
          <input
            type="text"
            name="name"
            required
            maxLength={64}
            placeholder="New watchlist name…"
            className="flex-1 h-10 rounded-lg border border-input bg-background px-3.5 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:border-ring"
          />
          <button
            type="submit"
            className="inline-flex h-10 px-4 items-center gap-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 transition-opacity"
          >
            <Plus className="size-4" />
            Create
          </button>
        </form>
      </section>

      {watchlists.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-card/40 p-10 text-center">
          <p className="text-sm text-muted-foreground">
            No watchlists yet. Create one above, or{" "}
            <Link href="/screener" className="text-primary hover:underline underline-offset-4">
              open the screener
            </Link>{" "}
            to find stocks worth watching.
          </p>
        </div>
      ) : (
        <section className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {watchlists.map((wl) => (
            <Link
              key={wl.id}
              href={`/watchlists/${wl.id}`}
              className="group rounded-2xl border border-border bg-card p-5 shadow-card hover:shadow-card-lg hover:-translate-y-0.5 transition-all"
            >
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="font-display text-lg">{wl.name}</h3>
                  <p className="font-mono text-[11px] text-muted-foreground mt-1">
                    {wl._count.items} stock{wl._count.items === 1 ? "" : "s"}
                  </p>
                </div>
                <ArrowRight className="size-4 text-muted-foreground group-hover:text-foreground transition-colors" />
              </div>
              {wl.items.length > 0 ? (
                <div className="mt-4 flex flex-wrap gap-1.5">
                  {wl.items.map((it) => (
                    <span
                      key={it.stock.symbol}
                      className="font-mono text-[11px] px-2 py-0.5 rounded border border-border bg-secondary"
                    >
                      {it.stock.symbol}
                    </span>
                  ))}
                  {wl._count.items > wl.items.length ? (
                    <span className="font-mono text-[11px] text-muted-foreground self-center">
                      +{wl._count.items - wl.items.length} more
                    </span>
                  ) : null}
                </div>
              ) : (
                <p className="mt-4 text-xs text-muted-foreground">No stocks added yet.</p>
              )}
            </Link>
          ))}
        </section>
      )}
    </div>
  );
}
