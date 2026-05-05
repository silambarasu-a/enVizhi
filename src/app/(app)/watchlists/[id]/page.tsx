import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { provider } from "@/lib/market-data/router";
import { WatchlistDetail } from "@/components/watchlists/watchlist-detail";

export const dynamic = "force-dynamic";

export default async function WatchlistDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await auth();
  if (!session?.user?.id) redirect("/signin");

  const { id } = await params;
  const watchlist = await prisma.watchlist.findFirst({
    where: { id, userId: session.user.id },
    include: {
      items: {
        orderBy: { addedAt: "desc" },
        include: {
          stock: {
            select: { id: true, symbol: true, name: true, currency: true, exchange: true },
          },
        },
      },
    },
  });

  if (!watchlist) notFound();

  // Live quotes for all items
  const symbols = watchlist.items.map((i) => i.stock.symbol);
  const quotes = symbols.length
    ? await provider.getQuotes(symbols).catch(() => [])
    : [];

  const rows = watchlist.items.map((it) => {
    const q = quotes.find((qq) => qq.symbol === it.stock.symbol);
    return {
      id: it.id,
      symbol: it.stock.symbol,
      name: it.stock.name,
      currency: it.stock.currency,
      exchange: it.stock.exchange,
      price: q?.price ?? null,
      changePct: q?.changePct ?? null,
    };
  });

  return (
    <div className="mx-auto max-w-[1400px] px-6 py-10 space-y-6">
      <Link
        href="/watchlists"
        className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
      >
        <ArrowLeft className="size-3.5" />
        All watchlists
      </Link>

      <header className="space-y-1.5">
        <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
          Watchlist
        </p>
        <h1 className="font-display text-3xl md:text-4xl">{watchlist.name}</h1>
        <p className="text-sm text-muted-foreground">
          {watchlist.items.length} stock{watchlist.items.length === 1 ? "" : "s"} · live quotes
          delayed 15 min
        </p>
      </header>

      <WatchlistDetail watchlistId={watchlist.id} rows={rows} />
    </div>
  );
}
