import { ChevronDown, Activity, BarChart3, Target, Gauge } from "lucide-react";
import type { Score } from "@/lib/scoring/types";
import {
  BIAS_LABEL,
  SIGNAL_DESCRIPTION,
  SIGNAL_LABEL,
  type Bias,
  type Signal,
} from "@/lib/scoring/types";
import type { TechnicalScore } from "@/lib/scoring/technical";
import type { LynchScore } from "@/lib/scoring/lynch";
import type { OverallScore } from "@/lib/scoring/overall";

/**
 * Stock detail scoreboard.
 *
 *   Layout:
 *     [ Overall signal banner (full width) ]
 *     [ Fundamentals | Technical | Lynch ] (3-column grid)
 *
 *   Each card is a `<details>` element — click to expand the inputs that fed
 *   the score. Native HTML disclosure keeps it server-rendered, accessible,
 *   and zero-JS for the basic interaction.
 */
export function Scoreboard({
  fundamentals,
  technical,
  lynch,
  overall,
  currency,
}: {
  fundamentals: Score;
  technical: TechnicalScore;
  lynch: LynchScore;
  overall: OverallScore;
  currency: string;
}) {
  const fmt = new Intl.NumberFormat(currency === "INR" ? "en-IN" : "en-US", {
    style: "currency",
    currency,
    currencyDisplay: "narrowSymbol",
    maximumFractionDigits: 2,
  });

  return (
    <section className="space-y-4">
      <div className="flex items-baseline justify-between gap-3">
        <div>
          <h3 className="font-mono text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
            Score board
          </h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            Multi-factor research signals · click any card to see the inputs
          </p>
        </div>
        <p className="text-[10px] text-muted-foreground/70 italic">Not investment advice</p>
      </div>

      <OverallBanner overall={overall} bias={technical.bias} />

      <div className="grid gap-4 lg:grid-cols-3">
        <ScoreCard
          icon={BarChart3}
          title="Fundamentals"
          score={fundamentals}
          renderHeader={(s) => <ScoreHead value={s.value} headline={s.headline} />}
        />
        <ScoreCard
          icon={Activity}
          title="Technical"
          score={technical}
          renderHeader={() => (
            <div className="space-y-1">
              <ScoreHead value={technical.value} headline={technical.headline} />
              {technical.bias ? <BiasPill bias={technical.bias} /> : null}
            </div>
          )}
          extra={<TechnicalSnapshot snapshot={technical.snapshot} fmt={fmt} />}
        />
        <ScoreCard
          icon={Target}
          title="Lynch valuation"
          score={lynch}
          renderHeader={() => (
            <div className="space-y-1">
              <ScoreHead value={lynch.value} headline={lynch.headline} />
              {lynch.zone !== "n/a" ? <ZonePill zone={lynch.zone} /> : null}
            </div>
          )}
          extra={
            lynch.thresholds.buyBelow != null && lynch.thresholds.sellAbove != null ? (
              <div className="grid grid-cols-2 gap-2 text-[11px] mt-2">
                <div className="rounded-md border border-emerald-300 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/30 px-2.5 py-1.5">
                  <div className="text-[10px] uppercase tracking-wider text-emerald-700 dark:text-emerald-400 font-mono">
                    Buy below
                  </div>
                  <div className="font-mono tabular-nums text-emerald-900 dark:text-emerald-200">
                    {fmt.format(lynch.thresholds.buyBelow)}
                  </div>
                </div>
                <div className="rounded-md border border-rose-300 dark:border-rose-800 bg-rose-50 dark:bg-rose-950/30 px-2.5 py-1.5">
                  <div className="text-[10px] uppercase tracking-wider text-rose-700 dark:text-rose-400 font-mono">
                    Sell above
                  </div>
                  <div className="font-mono tabular-nums text-rose-900 dark:text-rose-200">
                    {fmt.format(lynch.thresholds.sellAbove)}
                  </div>
                </div>
              </div>
            ) : null
          }
        />
      </div>
    </section>
  );
}

// ─── Overall banner ─────────────────────────────────────────────────────

function OverallBanner({ overall, bias }: { overall: OverallScore; bias: Bias | null }) {
  const cls = signalStyle(overall.signal);
  return (
    <div
      className={`rounded-2xl border p-5 shadow-card flex flex-wrap items-start justify-between gap-4 ${cls.bg} ${cls.border}`}
    >
      <div className="space-y-1.5 min-w-0">
        <div className="flex items-center gap-2">
          <Gauge className={`size-4 ${cls.icon}`} />
          <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
            Overall signal
          </span>
        </div>
        <div className="flex items-baseline gap-3 flex-wrap">
          <div className={`font-display text-2xl ${cls.text}`}>
            {overall.signal != null ? SIGNAL_LABEL[overall.signal] : "Insufficient data"}
          </div>
          {overall.value != null ? (
            <div className="font-mono tabular-nums text-xl text-muted-foreground">
              {overall.value}
              <span className="text-xs">/100</span>
            </div>
          ) : null}
          {bias ? (
            <span className="text-xs text-muted-foreground">
              · near-term bias: <BiasInline bias={bias} />
            </span>
          ) : null}
        </div>
        <p className="text-sm text-muted-foreground leading-relaxed max-w-2xl">
          {overall.signal != null ? SIGNAL_DESCRIPTION[overall.signal] : ""}
          {overall.signal != null ? " " : ""}
          <span className="text-muted-foreground/80">{overall.rationale}</span>
        </p>
      </div>

      <div className="flex flex-col gap-1.5 text-[11px] shrink-0">
        {overall.contributions.map((c) => (
          <div key={c.label} className="flex items-center gap-2 font-mono">
            <span className="text-muted-foreground w-32 truncate">
              {c.label}
              <span className="text-muted-foreground/60 ml-1">×{(c.weight * 100).toFixed(0)}%</span>
            </span>
            <ScoreBar value={c.value} />
            <span className="tabular-nums w-8 text-right text-muted-foreground">
              {c.value != null ? Math.round(c.value) : "—"}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Generic score card ─────────────────────────────────────────────────

function ScoreCard<T extends Score>({
  icon: Icon,
  title,
  score,
  renderHeader,
  extra,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  score: T;
  renderHeader: (score: T) => React.ReactNode;
  extra?: React.ReactNode;
}) {
  return (
    <details className="group rounded-2xl border border-border bg-card p-5 shadow-card transition-shadow open:shadow-card-lg">
      <summary className="cursor-pointer list-none -m-1 p-1">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2 min-w-0">
            <Icon className="size-4 text-primary shrink-0" />
            <span className="font-mono text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
              {title}
            </span>
          </div>
          <ChevronDown className="size-4 text-muted-foreground transition-transform group-open:rotate-180 shrink-0" />
        </div>
        <div className="mt-3">{renderHeader(score)}</div>
      </summary>

      {extra}

      <div className="mt-4 pt-4 border-t border-border space-y-4">
        {score.subscores.length === 0 ? (
          <p className="text-xs text-muted-foreground">{score.headline}</p>
        ) : (
          score.subscores.map((sub) => (
            <div key={sub.label}>
              <div className="flex items-baseline justify-between gap-2 mb-1.5">
                <div className="text-[12px] font-medium">
                  {sub.label}
                  <span className="text-[10px] text-muted-foreground/60 ml-1.5 font-mono">
                    ×{(sub.weight * 100).toFixed(0)}%
                  </span>
                </div>
                <div className="font-mono tabular-nums text-[12px] text-muted-foreground">
                  {sub.value != null ? Math.round(sub.value) : "—"}
                  <span className="text-[10px]">/100</span>
                </div>
              </div>
              <ScoreBar value={sub.value} />
              <p className="text-[11px] text-muted-foreground mt-1.5 leading-relaxed">{sub.verdict}</p>

              <ul className="mt-2 space-y-1">
                {sub.inputs.map((inp, i) => (
                  <li
                    key={`${inp.label}-${i}`}
                    className="flex items-baseline justify-between gap-2 text-[11px]"
                  >
                    <span className="text-muted-foreground">
                      <span className="font-medium text-foreground/80">{inp.label}</span>
                      <span className="text-foreground/60 mx-1.5">·</span>
                      <span className="font-mono">{inp.value}</span>
                    </span>
                    <span className="text-muted-foreground/80 text-right max-w-[55%] leading-snug">
                      {inp.note}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ))
        )}

        {score.coverage < 0.6 ? (
          <p className="text-[10px] text-amber-700 dark:text-amber-400 italic">
            Low confidence — only {Math.round(score.coverage * 100)}% of expected inputs were available.
          </p>
        ) : null}
      </div>
    </details>
  );
}

function ScoreHead({ value, headline }: { value: number | null; headline: string }) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-baseline gap-2">
        <span className="font-display text-3xl font-medium tabular-nums">
          {value != null ? value : "—"}
        </span>
        {value != null ? (
          <span className="text-xs text-muted-foreground">/100</span>
        ) : null}
      </div>
      <ScoreBar value={value} />
      <p className="text-[11px] text-muted-foreground leading-relaxed">{headline}</p>
    </div>
  );
}

function ScoreBar({ value }: { value: number | null }) {
  if (value == null) {
    return <div className="h-1.5 rounded-full bg-secondary/60 w-full" />;
  }
  const pct = Math.max(0, Math.min(100, value));
  const cls =
    pct >= 70 ? "bg-emerald-500" : pct >= 50 ? "bg-amber-500" : pct >= 30 ? "bg-orange-500" : "bg-rose-500";
  return (
    <div className="h-1.5 rounded-full bg-secondary/60 w-full overflow-hidden">
      <div className={`h-full ${cls}`} style={{ width: `${pct}%` }} />
    </div>
  );
}

// ─── Pills ──────────────────────────────────────────────────────────────

function BiasPill({ bias }: { bias: Bias }) {
  const styles: Record<Bias, string> = {
    bullish: "border-emerald-300 dark:border-emerald-800 text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40",
    neutral: "border-zinc-300 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300 bg-zinc-100 dark:bg-zinc-900",
    bearish: "border-rose-300 dark:border-rose-800 text-rose-700 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/40",
  };
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-medium border ${styles[bias]}`}
    >
      {BIAS_LABEL[bias]} · current state, not a forecast
    </span>
  );
}

function BiasInline({ bias }: { bias: Bias }) {
  const cls: Record<Bias, string> = {
    bullish: "text-emerald-700 dark:text-emerald-400",
    neutral: "text-muted-foreground",
    bearish: "text-rose-700 dark:text-rose-400",
  };
  return <span className={`font-medium ${cls[bias]}`}>{BIAS_LABEL[bias]}</span>;
}

function ZonePill({ zone }: { zone: "buy" | "hold" | "sell" }) {
  const styles: Record<typeof zone, string> = {
    buy: "border-emerald-300 dark:border-emerald-800 text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40",
    hold: "border-amber-300 dark:border-amber-800 text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/40",
    sell: "border-rose-300 dark:border-rose-800 text-rose-700 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/40",
  };
  const label = zone === "buy" ? "Buy zone" : zone === "sell" ? "Sell zone" : "Hold zone";
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-medium border ${styles[zone]}`}
    >
      {label}
    </span>
  );
}

// ─── Technical snapshot ────────────────────────────────────────────────

function TechnicalSnapshot({
  snapshot,
  fmt,
}: {
  snapshot: TechnicalScore["snapshot"];
  fmt: Intl.NumberFormat;
}) {
  if (snapshot.price == null) return null;
  return (
    <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-[11px] mt-3 font-mono">
      <SnapRow label="50-day SMA" value={snapshot.sma50 != null ? fmt.format(snapshot.sma50) : "—"} />
      <SnapRow label="200-day SMA" value={snapshot.sma200 != null ? fmt.format(snapshot.sma200) : "—"} />
      <SnapRow label="RSI 14" value={snapshot.rsi14 != null ? snapshot.rsi14.toFixed(1) : "—"} />
      <SnapRow
        label="MACD hist"
        value={snapshot.macdHist != null ? snapshot.macdHist.toFixed(2) : "—"}
      />
      <SnapRow label="52w high" value={snapshot.high52w != null ? fmt.format(snapshot.high52w) : "—"} />
      <SnapRow label="52w low" value={snapshot.low52w != null ? fmt.format(snapshot.low52w) : "—"} />
      {snapshot.returns.map((r) => (
        <SnapRow
          key={r.period}
          label={`${r.period} return`}
          value={r.value != null ? `${r.value >= 0 ? "+" : ""}${r.value.toFixed(1)}%` : "—"}
          tone={r.value == null ? undefined : r.value >= 0 ? "good" : "bad"}
        />
      ))}
    </div>
  );
}

function SnapRow({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: "good" | "bad";
}) {
  const valueCls =
    tone === "good"
      ? "text-emerald-700 dark:text-emerald-400"
      : tone === "bad"
        ? "text-rose-700 dark:text-rose-400"
        : "text-foreground";
  return (
    <div className="flex items-baseline justify-between gap-2 border-b border-border/40 last:border-0 py-0.5">
      <span className="text-muted-foreground">{label}</span>
      <span className={`tabular-nums ${valueCls}`}>{value}</span>
    </div>
  );
}

// ─── Signal styling ────────────────────────────────────────────────────

function signalStyle(signal: Signal | null): {
  bg: string;
  border: string;
  text: string;
  icon: string;
} {
  switch (signal) {
    case "buy":
      return {
        bg: "bg-emerald-50/60 dark:bg-emerald-950/30",
        border: "border-emerald-300 dark:border-emerald-800",
        text: "text-emerald-800 dark:text-emerald-300",
        icon: "text-emerald-600 dark:text-emerald-400",
      };
    case "accumulate":
      return {
        bg: "bg-emerald-50/40 dark:bg-emerald-950/20",
        border: "border-emerald-200 dark:border-emerald-900",
        text: "text-emerald-800 dark:text-emerald-300",
        icon: "text-emerald-600 dark:text-emerald-400",
      };
    case "hold":
      return {
        bg: "bg-card",
        border: "border-border",
        text: "text-foreground",
        icon: "text-muted-foreground",
      };
    case "reduce":
      return {
        bg: "bg-amber-50/60 dark:bg-amber-950/30",
        border: "border-amber-300 dark:border-amber-800",
        text: "text-amber-800 dark:text-amber-300",
        icon: "text-amber-600 dark:text-amber-400",
      };
    case "avoid":
      return {
        bg: "bg-rose-50/60 dark:bg-rose-950/30",
        border: "border-rose-300 dark:border-rose-800",
        text: "text-rose-800 dark:text-rose-300",
        icon: "text-rose-600 dark:text-rose-400",
      };
    default:
      return {
        bg: "bg-card",
        border: "border-border",
        text: "text-foreground",
        icon: "text-muted-foreground",
      };
  }
}
