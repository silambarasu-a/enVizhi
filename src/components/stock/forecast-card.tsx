import { TrendingUp, AlertTriangle } from "lucide-react";
import type { ForecastCone } from "@/lib/forecast/cone";

/**
 * Probabilistic price forecast cone card.
 *
 *   For each of 8 horizons (1d → 5y) we render the 68% and 95% confidence
 *   ranges for the price under geometric Brownian motion fit to the stock's
 *   own historical daily log returns.
 *
 *   Important: this is *not* a price prediction. It's a statistical projection
 *   of the spread of plausible outcomes given the stock's realized volatility.
 *   The band widens with √T — long horizons are inherently more uncertain.
 *
 *   The "Median" column is the center of the log-normal distribution: half of
 *   simulated paths end above it, half below. We deliberately avoid showing a
 *   bare "predicted price" — that would create false confidence.
 */
export function ForecastCard({
  cone,
  currency,
}: {
  cone: ForecastCone | null;
  currency: string;
}) {
  if (!cone) {
    return (
      <section className="rounded-2xl border border-border bg-card p-6 shadow-card">
        <h3 className="font-mono text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
          Forecast cone
        </h3>
        <p className="text-sm text-muted-foreground mt-2">
          Not enough history to fit the volatility model.
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

  const driftPct = (cone.drift * 100).toFixed(1);
  const volPct = (cone.volatility * 100).toFixed(1);

  return (
    <section className="rounded-2xl border border-border bg-card shadow-card overflow-hidden">
      <div className="px-6 pt-5 pb-4 border-b border-border">
        <div className="flex items-baseline justify-between gap-3 flex-wrap">
          <div>
            <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
              Forecast cone
            </div>
            <h3 className="font-display text-lg mt-1">Where price could land</h3>
          </div>
          <p className="text-[10px] text-muted-foreground/70 italic">
            Statistical projection · not a forecast
          </p>
        </div>
        <div className="mt-3 grid grid-cols-2 sm:grid-cols-4 gap-3 text-[11px]">
          <Stat label="Spot" value={fmt.format(cone.spot)} />
          <Stat
            label="Drift (μ)"
            value={`${cone.drift >= 0 ? "+" : ""}${driftPct}% / yr`}
            tone={cone.drift >= 0 ? "good" : "bad"}
          />
          <Stat label="Volatility (σ)" value={`${volPct}% / yr`} />
          <Stat label="Sample" value={`${cone.sampleSize} bars`} />
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-secondary/40 text-muted-foreground">
              <th className="text-left px-4 py-2.5 font-medium text-[11px] uppercase tracking-wider">
                Horizon
              </th>
              <th className="text-right px-4 py-2.5 font-medium text-[11px] uppercase tracking-wider">
                Median
              </th>
              <th className="text-right px-4 py-2.5 font-medium text-[11px] uppercase tracking-wider">
                68% range (1σ)
              </th>
              <th className="text-right px-4 py-2.5 font-medium text-[11px] uppercase tracking-wider">
                95% range (2σ)
              </th>
              <th className="text-right px-4 py-2.5 font-medium text-[11px] uppercase tracking-wider">
                Δ from spot
              </th>
            </tr>
          </thead>
          <tbody>
            {cone.bands.map((b) => {
              const delta = ((b.median - cone.spot) / cone.spot) * 100;
              const deltaCls =
                delta > 0
                  ? "text-emerald-700 dark:text-emerald-400"
                  : delta < 0
                    ? "text-rose-700 dark:text-rose-400"
                    : "text-muted-foreground";
              return (
                <tr
                  key={b.id}
                  className="border-b border-border/60 last:border-0 hover:bg-secondary/30 transition-colors"
                >
                  <td className="px-4 py-2.5">
                    <div className="flex items-center gap-1.5">
                      <span>{b.label}</span>
                      {b.assumptionStrained ? (
                        <span title="Long-horizon GBM is unreliable — treat as illustrative.">
                          <AlertTriangle className="size-3 text-amber-600 dark:text-amber-400" />
                        </span>
                      ) : null}
                    </div>
                  </td>
                  <td className="px-4 py-2.5 text-right font-mono tabular-nums">
                    {fmt.format(b.median)}
                  </td>
                  <td className="px-4 py-2.5 text-right font-mono tabular-nums text-muted-foreground">
                    {fmt.format(b.low68)} – {fmt.format(b.high68)}
                  </td>
                  <td className="px-4 py-2.5 text-right font-mono tabular-nums text-muted-foreground/70">
                    {fmt.format(b.low95)} – {fmt.format(b.high95)}
                  </td>
                  <td className={`px-4 py-2.5 text-right font-mono tabular-nums ${deltaCls}`}>
                    {delta >= 0 ? "+" : ""}
                    {delta.toFixed(1)}%
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="px-6 py-4 border-t border-border bg-secondary/20 space-y-2">
        <div className="flex items-start gap-2">
          <TrendingUp className="size-3.5 text-muted-foreground mt-0.5 shrink-0" />
          <p className="text-[11px] text-muted-foreground leading-relaxed">
            <span className="font-medium text-foreground/80">How this works:</span> we fit a
            geometric Brownian motion model to {cone.sampleSize} daily log returns. Median is the
            center of the distribution at each horizon; 68% (1σ) and 95% (2σ) ranges widen with
            √time because longer horizons are inherently more uncertain.
          </p>
        </div>
        {cone.lowConfidence ? (
          <div className="flex items-start gap-2">
            <AlertTriangle className="size-3.5 text-amber-600 dark:text-amber-400 mt-0.5 shrink-0" />
            <p className="text-[11px] text-amber-700 dark:text-amber-400 leading-relaxed">
              <span className="font-medium">Low confidence:</span> only {cone.sampleSize} bars
              available. Fit is unstable — at least 60 bars (~3 months) recommended.
            </p>
          </div>
        ) : null}
        {cone.tailWarning ? (
          <div className="flex items-start gap-2">
            <AlertTriangle className="size-3.5 text-amber-600 dark:text-amber-400 mt-0.5 shrink-0" />
            <p className="text-[11px] text-amber-700 dark:text-amber-400 leading-relaxed">
              <span className="font-medium">Extreme regime:</span> volatility or drift are unusually
              high. Recent behavior probably won't persist — the cone overstates the most likely
              path.
            </p>
          </div>
        ) : null}
        <p className="text-[10px] text-muted-foreground/60 italic leading-relaxed pl-5">
          GBM assumes constant μ and σ and log-normal price changes. Real markets have fat tails,
          regime shifts, and serial correlation that this model doesn't capture. Treat as a
          calibration, not a forecast.
        </p>
      </div>
    </section>
  );
}

function Stat({
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
    <div className="rounded-md border border-border/60 bg-background px-2.5 py-1.5">
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-mono">
        {label}
      </div>
      <div className={`font-mono tabular-nums text-[13px] ${valueCls}`}>{value}</div>
    </div>
  );
}
