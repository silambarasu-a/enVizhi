import {
  ArrowUp,
  ArrowDown,
  Minus,
  AlertTriangle,
  Compass,
  CalendarClock,
  Target,
  TrendingUp,
  TrendingDown,
  CheckCircle2,
  XCircle,
  Newspaper,
  Activity,
  Layers,
  Crosshair,
} from "lucide-react";
import type { Direction, DirectionalRead } from "@/lib/forecast/directional";
import type { SignalCategory, VoteSignal } from "@/lib/forecast/voting";
import { REGIME_LABEL } from "@/lib/forecast/regime";

const CATEGORY_LABEL: Record<SignalCategory, string> = {
  trend: "Trend",
  momentum: "Momentum",
  meanReversion: "Mean reversion",
  volume: "Volume",
  pattern: "Pattern",
};

const CATEGORY_ORDER: SignalCategory[] = ["trend", "momentum", "meanReversion", "volume", "pattern"];

/**
 * Directional read card v2 — multi-signal price direction with measured
 * accuracy on this stock's historical bars.
 *
 *   Sections (top to bottom):
 *     1. Header strip with regime + earnings warning + analyst pill
 *     2. Per-horizon direction (Today / 1 week / 1 month) with target prices
 *     3. Backtest accuracy panel — measured on THIS stock
 *     4. Yahoo multi-timeframe outlooks (short / intermediate / long)
 *     5. Key technical levels (support / resistance / stop loss)
 *     6. News sentiment from sigDevs (top headlines)
 *     7. Signal breakdown — categorized, expandable
 *     8. Honest caveats footer
 */
export function DirectionalCard({
  read,
  currency,
}: {
  read: DirectionalRead | null;
  currency: string;
}) {
  if (!read) {
    return (
      <section className="rounded-2xl border border-border bg-card p-6 shadow-card">
        <h3 className="font-mono text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
          Directional read
        </h3>
        <p className="text-sm text-muted-foreground mt-2">
          Need at least 30 trading days of price history.
        </p>
      </section>
    );
  }

  const fmt = new Intl.NumberFormat(currency === "INR" ? "en-IN" : "en-US", {
    style: "currency",
    currency,
    currencyDisplay: "narrowSymbol",
    maximumFractionDigits: 2,
  });

  return (
    <section className="rounded-2xl border border-border bg-card shadow-card overflow-hidden">
      {/* ── Header ── */}
      <div className="px-6 pt-5 pb-4 border-b border-border space-y-3">
        <div className="flex items-baseline justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-2">
            <Compass className="size-4 text-primary" />
            <div>
              <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
                Directional read
              </div>
              <h3 className="font-display text-lg mt-1">Where the evidence leans</h3>
            </div>
          </div>
          <p className="text-[10px] text-muted-foreground/70 italic">
            Probabilistic · backtested · not advice
          </p>
        </div>
        <div className="flex items-center flex-wrap gap-2 text-[11px]">
          <RegimePill kind={read.regime.kind} />
          {read.regime.highVolatility ? (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-medium border border-amber-300 dark:border-amber-800 text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/40">
              <AlertTriangle className="size-3" />
              High volatility
            </span>
          ) : null}
          {read.earningsProximityWarning ? (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-medium border border-amber-300 dark:border-amber-800 text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/40">
              <CalendarClock className="size-3" />
              Earnings in {read.daysToEarnings}d
            </span>
          ) : null}
          {read.analyst ? (
            <span
              className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-medium border ${
                read.analyst.rating === "BUY"
                  ? "border-emerald-300 dark:border-emerald-800 text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40"
                  : read.analyst.rating === "SELL"
                    ? "border-rose-300 dark:border-rose-800 text-rose-700 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/40"
                    : "border-border text-muted-foreground bg-secondary"
              }`}
            >
              <Target className="size-3" />
              Analyst: {read.analyst.rating}
              {read.analyst.targetPrice ? ` · target ${fmt.format(read.analyst.targetPrice)}` : ""}
            </span>
          ) : null}
        </div>
      </div>

      {/* ── Per-horizon direction ── */}
      <div className="grid sm:grid-cols-3 divide-y sm:divide-y-0 sm:divide-x divide-border">
        {read.horizons.map((h) => (
          <div key={h.id} className="p-5 space-y-3">
            <div className="flex items-baseline justify-between gap-2">
              <span className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground">
                {h.label}
              </span>
              <ConfidencePill confidence={h.confidence} direction={h.direction} />
            </div>
            <DirectionBig direction={h.direction} confidence={h.confidence} />
            <div className="grid grid-cols-2 gap-2 pt-1">
              <TargetPill
                label="If up"
                target={fmt.format(h.upTargetPrice)}
                pct={`+${h.expectedUpPct.toFixed(2)}%`}
                tone="up"
              />
              <TargetPill
                label="If down"
                target={fmt.format(h.downTargetPrice)}
                pct={`-${h.expectedDownPct.toFixed(2)}%`}
                tone="down"
              />
            </div>
          </div>
        ))}
      </div>

      {/* ── Measured accuracy on THIS stock ── */}
      {read.backtest ? <BacktestPanel backtest={read.backtest} /> : null}

      {/* ── Yahoo multi-timeframe outlooks + key technicals ── */}
      {read.outlooks &&
      (read.outlooks.short || read.outlooks.intermediate || read.outlooks.long) ? (
        <div className="border-t border-border px-6 py-4 space-y-3">
          <div className="flex items-center gap-2">
            <Layers className="size-3.5 text-muted-foreground" />
            <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
              Yahoo multi-timeframe outlook
            </span>
          </div>
          <div className="grid grid-cols-3 gap-2">
            <OutlookTile label="Short term" outlook={read.outlooks.short} />
            <OutlookTile label="Intermediate" outlook={read.outlooks.intermediate} />
            <OutlookTile label="Long term" outlook={read.outlooks.long} />
          </div>
        </div>
      ) : null}

      {read.keyTechnicals &&
      (read.keyTechnicals.support != null ||
        read.keyTechnicals.resistance != null ||
        read.keyTechnicals.stopLoss != null) ? (
        <div className="border-t border-border px-6 py-4 space-y-3">
          <div className="flex items-center gap-2">
            <Crosshair className="size-3.5 text-muted-foreground" />
            <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
              Key technical levels (Yahoo)
            </span>
          </div>
          <div className="grid grid-cols-3 gap-2">
            <LevelTile
              label="Support"
              value={read.keyTechnicals.support != null ? fmt.format(read.keyTechnicals.support) : "—"}
              tone="up"
            />
            <LevelTile
              label="Resistance"
              value={
                read.keyTechnicals.resistance != null ? fmt.format(read.keyTechnicals.resistance) : "—"
              }
              tone="down"
            />
            <LevelTile
              label="Stop loss"
              value={read.keyTechnicals.stopLoss != null ? fmt.format(read.keyTechnicals.stopLoss) : "—"}
              tone="neutral"
            />
          </div>
        </div>
      ) : null}

      {/* ── News sentiment ── */}
      {read.sentiment && read.sentiment.headlineCount > 0 ? (
        <details className="border-t border-border group">
          <summary className="px-6 py-3 cursor-pointer flex items-center justify-between list-none hover:bg-secondary/30 transition-colors">
            <div className="flex items-center gap-2">
              <Newspaper className="size-3.5 text-muted-foreground" />
              <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
                News sentiment
              </span>
              <SentimentBadge polarity={read.sentiment.polarity} />
            </div>
            <span className="text-[11px] text-muted-foreground group-open:rotate-180 transition-transform">
              ▾
            </span>
          </summary>
          <div className="px-6 pb-4 space-y-2">
            <p className="text-[11px] text-muted-foreground">
              {read.sentiment.headlineCount} headlines analysed · {read.sentiment.positiveHits}{" "}
              positive / {read.sentiment.negativeHits} negative word matches.
            </p>
            {read.sentiment.topHeadlines.length > 0 ? (
              <ul className="space-y-1">
                {read.sentiment.topHeadlines.map((h, idx) => (
                  <li
                    key={idx}
                    className="text-[11px] text-foreground/80 leading-snug flex items-start gap-2"
                  >
                    <SentimentDot polarity={h.polarity} />
                    <span>{h.headline}</span>
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        </details>
      ) : null}

      {/* ── Signal breakdown — categorized ── */}
      <details className="border-t border-border group">
        <summary className="px-6 py-3 cursor-pointer flex items-center justify-between list-none hover:bg-secondary/30 transition-colors">
          <div className="flex items-center gap-2">
            <Activity className="size-3.5 text-muted-foreground" />
            <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
              Why · {read.signals.length} signals voted
            </span>
          </div>
          <span className="text-[11px] text-muted-foreground group-open:rotate-180 transition-transform">
            ▾
          </span>
        </summary>
        <div className="px-6 pb-4 space-y-4">
          {CATEGORY_ORDER.map((cat) => {
            const inCat = read.signals.filter((s) => s.category === cat);
            if (inCat.length === 0) return null;
            return (
              <div key={cat}>
                <div className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground mb-1.5">
                  {CATEGORY_LABEL[cat]}
                </div>
                <ul className="space-y-1">
                  {inCat.map((s, i) => (
                    <SignalRow key={`${s.name}-${i}`} signal={s} />
                  ))}
                </ul>
              </div>
            );
          })}
        </div>
      </details>

      {/* ── Methodology + caveats ── */}
      <div className="px-6 py-4 border-t border-border bg-secondary/20 space-y-2">
        <p className="text-[11px] text-muted-foreground leading-relaxed">
          <span className="font-medium text-foreground/80">How this works:</span> we combine{" "}
          {read.signals.length} signals (price-vs-MA, MACD, RSI, Bollinger, Stochastic, ADX, OBV,
          CMF, candlestick patterns, Yahoo outlooks, analyst rating, news sentiment) into a
          regime-weighted vote. Magnitudes scale with realized volatility (σ_d ={" "}
          <span className="font-mono">{(read.dailyVolatility * 100).toFixed(2)}%</span>; σ_annual ={" "}
          <span className="font-mono">{(read.volatility * 100).toFixed(1)}%</span>). Confidence is{" "}
          damped {read.regime.highVolatility ? "25%" : "0%"} for vol regime and{" "}
          {read.earningsProximityWarning ? "40%" : "0%"} for earnings proximity.
        </p>
        {read.lowConfidence ? (
          <div className="flex items-start gap-2">
            <AlertTriangle className="size-3.5 text-amber-600 dark:text-amber-400 mt-0.5 shrink-0" />
            <p className="text-[11px] text-amber-700 dark:text-amber-400 leading-relaxed">
              <span className="font-medium">Low confidence:</span> short price history or weak
              signal aggregation.
            </p>
          </div>
        ) : null}
        <p className="text-[10px] text-muted-foreground/60 italic leading-relaxed">
          Not investment advice. Even top-tier quant funds report 52-55% hit rates on 1-day equity
          direction. Use this as one input alongside fundamentals, your thesis, and risk management.
        </p>
      </div>
    </section>
  );
}

// ─── Backtest panel ───────────────────────────────────────────────────

function BacktestPanel({ backtest }: { backtest: NonNullable<DirectionalRead["backtest"]> }) {
  const hitPct = (backtest.hitRate * 100).toFixed(1);
  const tone =
    backtest.hitRate >= 0.55
      ? "good"
      : backtest.hitRate >= 0.5
        ? "ok"
        : "bad";
  const toneCls =
    tone === "good"
      ? "text-emerald-700 dark:text-emerald-400"
      : tone === "bad"
        ? "text-rose-700 dark:text-rose-400"
        : "text-foreground";

  return (
    <div className="border-t border-border px-6 py-4 space-y-3">
      <div className="flex items-center gap-2">
        <CheckCircle2 className="size-3.5 text-muted-foreground" />
        <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
          Backtest on this stock — measured accuracy
        </span>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <BTStat
          label="Hit rate (1d)"
          value={`${hitPct}%`}
          tone={toneCls}
          sub={`${backtest.hits} of ${backtest.hits + backtest.misses} calls`}
        />
        <BTStat
          label="Avg return on UP calls"
          value={`${backtest.avgReturnOnUpCalls >= 0 ? "+" : ""}${backtest.avgReturnOnUpCalls.toFixed(2)}%`}
          tone={
            backtest.avgReturnOnUpCalls > 0
              ? "text-emerald-700 dark:text-emerald-400"
              : "text-rose-700 dark:text-rose-400"
          }
          sub="next-day return on bullish calls"
        />
        <BTStat
          label="Avg return on DOWN calls"
          value={`${backtest.avgReturnOnDownCalls >= 0 ? "+" : ""}${backtest.avgReturnOnDownCalls.toFixed(2)}%`}
          tone={
            backtest.avgReturnOnDownCalls < 0
              ? "text-emerald-700 dark:text-emerald-400"
              : "text-rose-700 dark:text-rose-400"
          }
          sub="next-day return on bearish calls (lower = model right)"
        />
        <BTStat
          label="Neutral"
          value={`${backtest.neutralCalls}`}
          tone="text-muted-foreground"
          sub="no-call days (excluded from hit rate)"
        />
      </div>

      <div className="space-y-1">
        <div className="text-[11px] text-muted-foreground font-mono">By confidence band:</div>
        <div className="grid grid-cols-3 gap-2">
          {backtest.byConfidence.map((b) => {
            const pct = b.trials > 0 ? (b.hitRate * 100).toFixed(1) : "—";
            const tone =
              b.trials > 5 && b.hitRate >= 0.55
                ? "text-emerald-700 dark:text-emerald-400"
                : b.trials > 5 && b.hitRate < 0.5
                  ? "text-rose-700 dark:text-rose-400"
                  : "text-muted-foreground";
            return (
              <div
                key={b.label}
                className="rounded-md border border-border/60 bg-background px-2.5 py-1.5"
              >
                <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-mono">
                  {b.label}
                </div>
                <div className={`font-mono tabular-nums text-[12px] ${tone}`}>{pct}%</div>
                <div className="text-[10px] text-muted-foreground font-mono">
                  {b.hits} / {b.trials}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <p className="text-[10px] text-muted-foreground/60 italic leading-snug">
        Walk-forward backtest over the last {backtest.trials + backtest.neutralCalls} trading days.
        Each day's vote uses only data available up to that day (no look-ahead). A well-calibrated
        model's hit rate should rise with confidence band.
      </p>
    </div>
  );
}

function BTStat({
  label,
  value,
  tone,
  sub,
}: {
  label: string;
  value: string;
  tone: string;
  sub?: string;
}) {
  return (
    <div className="rounded-md border border-border/60 bg-background px-3 py-2">
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-mono">
        {label}
      </div>
      <div className={`font-mono tabular-nums text-[15px] font-medium ${tone}`}>{value}</div>
      {sub ? <div className="text-[10px] text-muted-foreground/80 leading-tight mt-0.5">{sub}</div> : null}
    </div>
  );
}

// ─── Helpers ──────────────────────────────────────────────────────────

function DirectionBig({ direction, confidence }: { direction: Direction; confidence: number }) {
  const pct = Math.round(confidence * 100);
  if (direction === "up") {
    return (
      <div className="flex items-center gap-3">
        <ArrowUp className="size-7 text-emerald-600 dark:text-emerald-400" strokeWidth={2.5} />
        <div>
          <div className="font-display text-2xl font-medium text-emerald-700 dark:text-emerald-300">
            Bullish
          </div>
          <div className="text-[11px] text-muted-foreground font-mono">{pct}% confidence</div>
        </div>
      </div>
    );
  }
  if (direction === "down") {
    return (
      <div className="flex items-center gap-3">
        <ArrowDown className="size-7 text-rose-600 dark:text-rose-400" strokeWidth={2.5} />
        <div>
          <div className="font-display text-2xl font-medium text-rose-700 dark:text-rose-300">
            Bearish
          </div>
          <div className="text-[11px] text-muted-foreground font-mono">{pct}% confidence</div>
        </div>
      </div>
    );
  }
  return (
    <div className="flex items-center gap-3">
      <Minus className="size-7 text-muted-foreground" strokeWidth={2.5} />
      <div>
        <div className="font-display text-2xl font-medium text-muted-foreground">Neutral</div>
        <div className="text-[11px] text-muted-foreground font-mono">no clear edge</div>
      </div>
    </div>
  );
}

function ConfidencePill({ confidence, direction }: { confidence: number; direction: Direction }) {
  const pct = Math.round(confidence * 100);
  if (direction === "neutral") {
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-mono border border-border bg-secondary text-muted-foreground">
        {pct}%
      </span>
    );
  }
  const cls =
    direction === "up"
      ? "border-emerald-300 dark:border-emerald-800 text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40"
      : "border-rose-300 dark:border-rose-800 text-rose-700 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/40";
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-mono border ${cls}`}>
      {pct}%
    </span>
  );
}

function TargetPill({
  label,
  target,
  pct,
  tone,
}: {
  label: string;
  target: string;
  pct: string;
  tone: "up" | "down";
}) {
  const cls =
    tone === "up"
      ? "border-emerald-300/60 dark:border-emerald-900 bg-emerald-50/60 dark:bg-emerald-950/20"
      : "border-rose-300/60 dark:border-rose-900 bg-rose-50/60 dark:bg-rose-950/20";
  const valueCls =
    tone === "up"
      ? "text-emerald-800 dark:text-emerald-300"
      : "text-rose-800 dark:text-rose-300";
  return (
    <div className={`rounded-md border ${cls} px-2.5 py-1.5`}>
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-mono">{label}</div>
      <div className={`font-mono tabular-nums text-[12px] font-medium ${valueCls}`}>{target}</div>
      <div className={`font-mono tabular-nums text-[11px] ${valueCls}/80`}>{pct}</div>
    </div>
  );
}

function RegimePill({ kind }: { kind: DirectionalRead["regime"]["kind"] }) {
  const cls =
    kind === "trending_up"
      ? "border-emerald-300 dark:border-emerald-800 text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40"
      : kind === "trending_down"
        ? "border-rose-300 dark:border-rose-800 text-rose-700 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/40"
        : kind === "ranging"
          ? "border-zinc-300 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300 bg-zinc-100 dark:bg-zinc-900"
          : "border-amber-300 dark:border-amber-800 text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/40";
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-medium border ${cls}`}>
      {kind === "trending_up" ? <TrendingUp className="size-3" /> : null}
      {kind === "trending_down" ? <TrendingDown className="size-3" /> : null}
      Regime: {REGIME_LABEL[kind]}
    </span>
  );
}

function OutlookTile({
  label,
  outlook,
}: {
  label: string;
  outlook: { direction: "Bullish" | "Bearish" | "Neutral"; score: number | null } | null;
}) {
  if (!outlook) {
    return (
      <div className="rounded-md border border-border/60 bg-background px-2.5 py-1.5">
        <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-mono">
          {label}
        </div>
        <div className="text-[12px] text-muted-foreground/40">—</div>
      </div>
    );
  }
  const cls =
    outlook.direction === "Bullish"
      ? "text-emerald-700 dark:text-emerald-400"
      : outlook.direction === "Bearish"
        ? "text-rose-700 dark:text-rose-400"
        : "text-muted-foreground";
  return (
    <div className="rounded-md border border-border/60 bg-background px-2.5 py-1.5">
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-mono">
        {label}
      </div>
      <div className={`text-[12px] font-medium ${cls}`}>{outlook.direction}</div>
      {outlook.score != null ? (
        <div className="text-[10px] text-muted-foreground font-mono">score {outlook.score}</div>
      ) : null}
    </div>
  );
}

function LevelTile({ label, value, tone }: { label: string; value: string; tone: "up" | "down" | "neutral" }) {
  const cls =
    tone === "up"
      ? "text-emerald-700 dark:text-emerald-400"
      : tone === "down"
        ? "text-rose-700 dark:text-rose-400"
        : "text-foreground";
  return (
    <div className="rounded-md border border-border/60 bg-background px-2.5 py-1.5">
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-mono">
        {label}
      </div>
      <div className={`text-[13px] font-mono tabular-nums ${cls}`}>{value}</div>
    </div>
  );
}

function SentimentBadge({ polarity }: { polarity: number }) {
  if (polarity > 0.15) {
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium border border-emerald-300 dark:border-emerald-800 text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40">
        Positive
      </span>
    );
  }
  if (polarity < -0.15) {
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium border border-rose-300 dark:border-rose-800 text-rose-700 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/40">
        Negative
      </span>
    );
  }
  return (
    <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium border border-border bg-secondary text-muted-foreground">
      Neutral
    </span>
  );
}

function SentimentDot({ polarity }: { polarity: number }) {
  const cls =
    polarity > 0
      ? "bg-emerald-500"
      : polarity < 0
        ? "bg-rose-500"
        : "bg-zinc-400";
  return <span className={`shrink-0 size-1.5 rounded-full mt-1 ${cls}`} />;
}

function SignalRow({ signal }: { signal: VoteSignal }) {
  const Icon =
    signal.vote > 0.3
      ? () => <ArrowUp className="size-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
      : signal.vote > 0
        ? () => <ArrowUp className="size-3.5 text-emerald-500/60 shrink-0" />
        : signal.vote < -0.3
          ? () => <ArrowDown className="size-3.5 text-rose-600 dark:text-rose-400 shrink-0" />
          : signal.vote < 0
            ? () => <ArrowDown className="size-3.5 text-rose-500/60 shrink-0" />
            : () => <Minus className="size-3.5 text-muted-foreground shrink-0" />;
  return (
    <li className="flex items-baseline gap-3 text-[11px] py-1.5 border-b border-border/40 last:border-0">
      <Icon />
      <span className="font-mono text-foreground/80 w-32 shrink-0 truncate">{signal.name}</span>
      <span className="text-muted-foreground flex-1">{signal.reason}</span>
      <span className="font-mono text-[10px] text-muted-foreground/60 shrink-0">
        ×{signal.weight.toFixed(1)}
      </span>
    </li>
  );
}

// Suppress unused-import lint (these are used in rendering above).
void XCircle;
