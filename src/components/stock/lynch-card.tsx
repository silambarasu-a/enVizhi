import type { LynchCategory } from "@/generated/prisma/enums";
import { categoryLabel, categoryDescription } from "@/lib/lynch/categories";
import { modifiedPegBracket, type ModifiedPegBracket } from "@/lib/lynch/score";

const CAT_STYLES: Record<LynchCategory, string> = {
  SLOW_GROWER:
    "border-zinc-300 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300 bg-zinc-100 dark:bg-zinc-900",
  STALWART:
    "border-emerald-300 dark:border-emerald-800 text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40",
  FAST_GROWER:
    "border-indigo-300 dark:border-indigo-800 text-indigo-700 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/40",
  CYCLICAL:
    "border-amber-300 dark:border-amber-800 text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/40",
  TURNAROUND:
    "border-rose-300 dark:border-rose-800 text-rose-700 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/40",
  ASSET_PLAY:
    "border-cyan-300 dark:border-cyan-800 text-cyan-700 dark:text-cyan-400 bg-cyan-50 dark:bg-cyan-950/40",
};

const PEG_STYLES: Record<ModifiedPegBracket, string> = {
  excellent: "text-emerald-700 dark:text-emerald-400",
  good: "text-emerald-600 dark:text-emerald-500",
  ok: "text-amber-700 dark:text-amber-400",
  poor: "text-rose-700 dark:text-rose-400",
};

const PEG_BRACKET_LABEL: Record<ModifiedPegBracket, string> = {
  excellent: "Excellent",
  good: "Good",
  ok: "Watchlist",
  poor: "Expensive",
};

export function LynchCard({
  category,
  modifiedPeg,
  fairPe,
  fairValue,
  price,
  currency,
}: {
  category: LynchCategory | null;
  modifiedPeg: number | null;
  fairPe: number | null;
  fairValue: number | null;
  price: number | null;
  currency: string;
}) {
  const bracket = modifiedPegBracket(modifiedPeg);
  const fmt = new Intl.NumberFormat(currency === "INR" ? "en-IN" : "en-US", {
    style: "currency",
    currency,
    maximumFractionDigits: 2,
  });

  const ratio =
    price != null && fairValue != null && fairValue > 0 ? price / fairValue : null;
  const upside = ratio != null ? (1 / ratio - 1) * 100 : null;
  const isDiscount = ratio != null && ratio < 1;

  return (
    <div className="rounded-2xl border border-border bg-card p-6 shadow-card space-y-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
            Lynch
          </div>
          <h3 className="mt-1.5 font-display text-xl">Peter Lynch view</h3>
        </div>
        {category ? (
          <span
            className={`inline-flex items-center px-2.5 py-1 rounded-md text-[11px] font-medium border ${CAT_STYLES[category]}`}
          >
            {categoryLabel(category)}
          </span>
        ) : (
          <span className="inline-flex items-center px-2.5 py-1 rounded-md text-[11px] font-medium border border-border text-muted-foreground bg-secondary">
            Unclassified
          </span>
        )}
      </div>

      {category ? (
        <p className="text-sm text-muted-foreground leading-relaxed">
          {categoryDescription(category)}
        </p>
      ) : (
        <p className="text-sm text-muted-foreground leading-relaxed">
          Not enough data to classify. Likely missing growth or sector from the upstream feed.
        </p>
      )}

      <div className="grid grid-cols-2 gap-3 pt-2">
        <Stat
          label="Modified PEG"
          value={modifiedPeg != null ? modifiedPeg.toFixed(2) : "—"}
          sub={bracket ? PEG_BRACKET_LABEL[bracket] : undefined}
          subClass={bracket ? PEG_STYLES[bracket] : undefined}
        />
        <Stat
          label="Lynch fair P/E"
          value={fairPe != null ? fairPe.toFixed(1) : "—"}
          sub="≈ growth rate"
        />
      </div>

      {fairValue != null && price != null ? (
        <div className="border-t border-border pt-4 space-y-2.5">
          <div className="flex items-baseline justify-between">
            <span className="text-xs text-muted-foreground">Lynch fair value</span>
            <span className="font-mono tabular-nums text-sm">{fmt.format(fairValue)}</span>
          </div>
          <div className="h-1.5 rounded-full bg-secondary overflow-hidden">
            <div
              className={isDiscount ? "h-full bg-emerald-500" : "h-full bg-amber-500"}
              style={{ width: `${Math.min(100, ratio! * 100)}%` }}
            />
          </div>
          <div className="flex items-baseline justify-between text-[11px]">
            <span className="text-muted-foreground">
              Trading at{" "}
              <span className="font-mono text-foreground">{(ratio! * 100).toFixed(0)}%</span> of fair
              value
            </span>
            {upside != null ? (
              <span
                className={`font-mono tabular-nums ${
                  isDiscount ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"
                }`}
              >
                {isDiscount ? "+" : ""}
                {upside.toFixed(1)}% upside
              </span>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function Stat({
  label,
  value,
  sub,
  subClass,
}: {
  label: string;
  value: string;
  sub?: string;
  subClass?: string;
}) {
  return (
    <div className="rounded-lg border border-border bg-secondary/40 p-3">
      <div className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
        {label}
      </div>
      <div className="mt-1 font-mono tabular-nums text-2xl">{value}</div>
      {sub ? (
        <div className={`mt-0.5 text-[11px] ${subClass ?? "text-muted-foreground"}`}>{sub}</div>
      ) : null}
    </div>
  );
}
