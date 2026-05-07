import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft, TrendingUp, TrendingDown, Bell } from "lucide-react";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { provider } from "@/lib/market-data/router";
import { findOrCreateStock, refreshFundamentalsIfStale } from "@/lib/stocks/lazy-create";
import { modifiedPEG, fairPE, lynchFairValue } from "@/lib/lynch/score";
import { ALERT_TYPE_LABEL, ALERT_TYPE_UNIT } from "@/lib/alerts/evaluator";
import { LynchCard } from "@/components/stock/lynch-card";
import { FundamentalsGrid } from "@/components/stock/fundamentals-grid";
import { PriceChart } from "@/components/stock/price-chart";
import { Scoreboard, IndexScoreboard } from "@/components/stock/scoreboard";
import { ForecastCard } from "@/components/stock/forecast-card";
import { DirectionalCard } from "@/components/stock/directional-card";
import { buildForecastCone } from "@/lib/forecast/cone";
import { buildDirectionalRead } from "@/lib/forecast/directional";
import { AddToWatchlist } from "@/components/watchlists/add-to-watchlist";
import { CreateAlertForm } from "@/components/alerts/create-alert-form";
import { AlertRow } from "@/components/alerts/alert-row";
import { LocalTime } from "@/components/util/local-time";
import { scoreFundamentals } from "@/lib/scoring/fundamentals";
import { scoreTechnical } from "@/lib/scoring/technical";
import { scoreLynch } from "@/lib/scoring/lynch";
import { combineScores } from "@/lib/scoring/overall";

export const dynamic = "force-dynamic";

export default async function StockDetailPage({
  params,
}: {
  params: Promise<{ symbol: string }>;
}) {
  const session = await auth();
  if (!session?.user?.id) redirect("/signin");
  const userId = session.user.id;

  const { symbol: rawSymbol } = await params;
  const symbol = decodeURIComponent(rawSymbol).toUpperCase();

  // Look up the stock — if it's not in our DB yet, lazy-create it from Yahoo
  // (so subsequent watchlist / alert / portfolio operations work).
  const stock = await findOrCreateStock(symbol);
  if (!stock) notFound();

  const isIndex = stock.exchange === "INDEX";

  // Pull these out once so TypeScript can narrow stock.fundamentals later.
  const stockFundamentals = stock.fundamentals;

  const [quote, ohlc, ohlcDay, ohlcWeek, insights, earningsDate, refreshedFundamentals, watchlists, alerts] = await Promise.all([
    provider.getQuote(symbol).catch(() => null),
    provider.getOHLC(symbol, "5y").catch(() => []),
    // Intraday for the 1D / 1W chart ranges. Cheap (≈80 bars each) and lazy-
    // loading them client-side would mean an awkward loading state inside the
    // chart. Failures fall back to empty arrays.
    provider.getOHLC(symbol, "1d").catch(() => []),
    provider.getOHLC(symbol, "1w").catch(() => []),
    // Yahoo insights + earnings — best-effort, both can be null.
    provider.getInsights(symbol).catch(() => null),
    provider.getEarningsDate(symbol).catch(() => null),
    // Refresh fundamentals if the row is sparse (key fields null) or stale
    // (synced > 7 days). Yahoo's coverage improves over time for newly-IPO'd
    // and Indian small-cap stocks; this keeps the Lynch / scoreboard cards
    // useful as data gets filled in.
    isIndex ? Promise.resolve(null) : refreshFundamentalsIfStale(stock.id, symbol).catch(() => null),
    prisma.watchlist.findMany({
      where: { userId },
      orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
      include: {
        items: {
          where: { stockId: stock.id },
          select: { id: true },
        },
      },
    }),
    prisma.alert.findMany({
      where: { userId, stockId: stock.id },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        type: true,
        threshold: true,
        isActive: true,
        triggeredAt: true,
      },
    }),
  ]);

  const price = quote?.price ?? null;
  const change = quote?.change ?? null;
  const changePct = quote?.changePct ?? null;
  const isUp = (changePct ?? 0) >= 0;

  // For indices, prefer the live quote's currency over whatever's in the DB —
  // older index rows were saved with USD because Yahoo's search doesn't always
  // surface a currency for indices, leaving every formatted price ($, ₹, £)
  // displayed under the wrong symbol. Backfill the row so we only do this dance
  // once per stale entry.
  let currency = stock.currency;
  if (isIndex && quote?.currency && quote.currency !== stock.currency) {
    currency = quote.currency;
    await prisma.stock
      .update({
        where: { id: stock.id },
        data: { currency: quote.currency },
      })
      .catch(() => {
        /* race with another tab — harmless */
      });
  }

  // Prefer freshly-refreshed fundamentals when present — they have any new
  // fields Yahoo just made available since the row was first created.
  const f = refreshedFundamentals ?? stockFundamentals;

  const modPeg = f ? modifiedPEG(f.pe, f.epsGrowth5y, f.dividendYield) : null;
  const fp = f ? fairPE(f.epsGrowth5y) : null;
  const fairVal = f ? lynchFairValue(f.eps, f.epsGrowth5y) : null;

  const dataQualityFlags = (f?.dataQualityFlags ?? {}) as Record<string, boolean>;
  const gapCount = Object.keys(dataQualityFlags).length;

  const fmt = new Intl.NumberFormat(currency === "INR" ? "en-IN" : "en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

  const bars = (ohlc ?? []).map((b) => ({
    date: b.date.toISOString(),
    close: b.close,
  }));
  const intradayDay = (ohlcDay ?? []).map((b) => ({
    date: b.date.toISOString(),
    close: b.close,
  }));
  const intradayWeek = (ohlcWeek ?? []).map((b) => ({
    date: b.date.toISOString(),
    close: b.close,
  }));
  // Full OHLCV bars for the directional engine — needs high/low/volume for
  // ATR, ADX, OBV, Stochastic, CMF, candlestick patterns.
  const richBars = (ohlc ?? []).map((b) => ({
    date: b.date.toISOString(),
    open: b.open,
    high: b.high,
    low: b.low,
    close: b.close,
    volume: Number(b.volume),
  }));

  // ─── Score board ────────────────────────────────────────────────────
  // Pure computations: fundamentals from the StockFundamentals row,
  // technical from the 5y bars, Lynch from price + computed fair value.
  const fundamentalsScore = scoreFundamentals({
    pe: f?.pe ?? null,
    peg: f?.peg ?? null,
    priceToBook: f?.priceToBook ?? null,
    dividendYield: f?.dividendYield ?? null,
    epsGrowth5y: f?.epsGrowth5y ?? null,
    revenueGrowth5y: f?.revenueGrowth5y ?? null,
    roe: f?.roe ?? null,
    profitMargin: f?.profitMargin ?? null,
    debtToEquity: f?.debtToEquity ?? null,
    beta: f?.beta ?? null,
  });
  const technicalScore = scoreTechnical(bars);
  const lynchScoreResult = scoreLynch({ price, fairValue: fairVal });
  const overallScore = combineScores({
    fundamentals: fundamentalsScore,
    technical: technicalScore,
    lynch: lynchScoreResult,
  });
  // Probabilistic forecast cone — works for stocks and indices alike since
  // GBM only needs a closes series. Only requires non-empty bars.
  const forecastCone = buildForecastCone(bars);
  // Directional read — multi-signal vote on which way evidence currently
  // leans, plus typical magnitude IF the move happens. Uses full OHLCV bars +
  // Yahoo insights + earnings date for the richest possible read.
  const directionalRead = buildDirectionalRead({
    bars: richBars,
    insights,
    earningsDate,
  });

  const watchlistOpts = watchlists.map((w) => ({
    id: w.id,
    name: w.name,
    contains: w.items.length > 0,
  }));

  const alertRows = alerts.map((a) => ({
    id: a.id,
    type: a.type,
    threshold: a.threshold,
    isActive: a.isActive,
    triggeredAt: a.triggeredAt?.toISOString() ?? null,
    symbol,
    stockName: stock.name,
    currency,
  }));

  return (
    <div className="mx-auto max-w-[1400px] px-6 py-8 space-y-6">
      <Link
        href="/screener"
        className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
      >
        <ArrowLeft className="size-3.5" />
        Back to screener
      </Link>

      {/* ── Header ── */}
      <header className="rounded-2xl border border-border bg-card p-6 shadow-card flex flex-wrap items-start justify-between gap-6">
        <div className="space-y-1.5">
          <div className="flex items-baseline gap-3 flex-wrap">
            <h1 className="font-mono text-2xl">{stock.symbol}</h1>
            <span className="font-mono text-[11px] uppercase tracking-wider px-2 py-0.5 rounded-md border border-border bg-secondary text-muted-foreground">
              {stock.exchange}
            </span>
            {stock.sector ? (
              <span className="text-xs text-muted-foreground">{stock.sector}</span>
            ) : null}
          </div>
          <h2 className="font-display text-xl text-muted-foreground">{stock.name}</h2>
        </div>

        <div className="flex items-start gap-4 flex-wrap">
          {price != null ? (
            <div className="text-right">
              <div className="font-mono tabular-nums text-3xl md:text-4xl">{fmt.format(price)}</div>
              <div className="mt-1 flex items-center justify-end gap-2">
                <span
                  className={`font-mono tabular-nums text-sm inline-flex items-center gap-1 ${
                    isUp ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"
                  }`}
                >
                  {isUp ? <TrendingUp className="size-3.5" /> : <TrendingDown className="size-3.5" />}
                  {change != null ? `${change >= 0 ? "+" : ""}${fmt.format(change)}` : ""}
                  {changePct != null ? ` (${changePct >= 0 ? "+" : ""}${changePct.toFixed(2)}%)` : ""}
                </span>
                <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                  {currency}
                </span>
              </div>
            </div>
          ) : (
            <div className="text-sm text-muted-foreground">Live quote unavailable</div>
          )}
          <AddToWatchlist symbol={symbol} watchlists={watchlistOpts} />
        </div>
      </header>

      {/* ── Score board ── */}
      {isIndex ? (
        <IndexScoreboard technical={technicalScore} currency={currency} />
      ) : (
        <Scoreboard
          fundamentals={fundamentalsScore}
          technical={technicalScore}
          lynch={lynchScoreResult}
          overall={overallScore}
          currency={currency}
        />
      )}

      {/* ── Chart + Lynch ── */}
      {isIndex ? (
        <div>
          <PriceChart
            bars={bars}
            intradayDay={intradayDay}
            intradayWeek={intradayWeek}
            currency={currency}
          />
        </div>
      ) : (
        <div className="grid gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2">
            <PriceChart
              bars={bars}
              intradayDay={intradayDay}
              intradayWeek={intradayWeek}
              currency={currency}
            />
          </div>
          <LynchCard
            category={f?.lynchCategory ?? null}
            modifiedPeg={modPeg}
            fairPe={fp}
            fairValue={fairVal}
            price={price}
            currency={currency}
          />
        </div>
      )}

      {/* ── Directional read (best-guess direction + magnitude) ── */}
      <DirectionalCard read={directionalRead} currency={currency} />

      {/* ── Forecast cone (probability ranges) ── */}
      <ForecastCard cone={forecastCone} currency={currency} />

      {/* ── Fundamentals ── */}
      {!isIndex ? <FundamentalsGrid fundamentals={f} currency={currency} /> : null}

      {/* ── Alerts ── */}
      <section className="rounded-2xl border border-border bg-card shadow-card overflow-hidden">
        <div className="px-6 pt-5 pb-4 border-b border-border flex items-center justify-between">
          <div>
            <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
              Alerts
            </div>
            <h3 className="font-display text-lg mt-1">Get notified about {symbol}</h3>
          </div>
          {alertRows.length > 0 ? (
            <span className="font-mono text-[11px] text-muted-foreground">
              {alertRows.filter((a) => a.isActive).length} active · {alertRows.length} total
            </span>
          ) : null}
        </div>
        <div className="p-6">
          <CreateAlertForm symbol={symbol} currentPrice={price} currency={currency} />
        </div>
        {alertRows.length > 0 ? (
          <ul className="divide-y divide-border border-t border-border">
            {alertRows.map((a) => (
              <AlertRow key={a.id} a={a} />
            ))}
          </ul>
        ) : (
          <div className="px-6 pb-6 -mt-1 flex items-center gap-2 text-xs text-muted-foreground">
            <Bell className="size-3.5" />
            No alerts set on this {isIndex ? "index" : "stock"} yet.
          </div>
        )}
      </section>

      {/* ── Data quality (stocks only) ── */}
      {!isIndex && gapCount > 0 ? (
        <div className="rounded-xl border border-amber-300 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/30 p-4 text-sm">
          <div className="font-medium text-amber-900 dark:text-amber-200">
            Data quality: {gapCount} field{gapCount === 1 ? "" : "s"} missing from upstream
          </div>
          <p className="mt-1 text-amber-800/80 dark:text-amber-300/80 text-xs">
            Yahoo Finance returned null for: {Object.keys(dataQualityFlags).join(", ")}. This is
            common for Indian stocks and small caps; FMP / EODHD will fill the gaps in a future sync.
          </p>
        </div>
      ) : null}

      {!isIndex && f?.syncedAt ? (
        <p className="text-[11px] text-muted-foreground/70 text-center">
          Fundamentals synced{" "}
          <LocalTime iso={f.syncedAt.toISOString()} mode="datetime" /> · Quotes delayed 15 min
        </p>
      ) : null}
      {isIndex ? (
        <p className="text-[11px] text-muted-foreground/70 text-center">
          Quotes delayed 15 min · Index data from Yahoo Finance
        </p>
      ) : null}
    </div>
  );
}
