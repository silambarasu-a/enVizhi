import Link from "next/link";
import { ArrowRight, Check } from "lucide-react";
import { LogoMark } from "@/components/brand/logo-mark";
import { APP_CONFIG } from "@/lib/config";

export default function LandingPage() {
  return (
    <main className="min-h-svh flex flex-col bg-background">
      {/* ─── Top bar ──────────────────────────────────────────────────────── */}
      <header className="sticky top-0 z-40 border-b border-border bg-background/85 backdrop-blur-md">
        <div className="mx-auto max-w-6xl h-16 px-6 flex items-center">
          <Link href="/" className="flex items-center gap-2.5 group">
            <LogoMark size={28} className="text-primary transition-transform group-hover:scale-105" />
            <span className="font-display text-[16px]">{APP_CONFIG.name}</span>
          </Link>
          <nav className="ml-auto flex items-center gap-1 text-sm">
            <Link
              href="#features"
              className="hidden sm:inline-flex h-9 px-3 items-center text-muted-foreground hover:text-foreground transition-colors"
            >
              Features
            </Link>
            <Link
              href="/signin"
              className="inline-flex h-9 px-3 items-center text-muted-foreground hover:text-foreground transition-colors"
            >
              Sign in
            </Link>
            <Link
              href="/signin"
              className="ml-1 inline-flex h-9 px-4 items-center gap-1.5 rounded-lg bg-foreground text-background text-[13px] font-medium hover:opacity-90 transition-opacity"
            >
              Get started
              <ArrowRight className="size-3.5" />
            </Link>
          </nav>
        </div>
      </header>

      {/* ─── Hero ─────────────────────────────────────────────────────────── */}
      <section className="relative">
        <div className="mx-auto max-w-6xl px-6 pt-20 md:pt-32 pb-16 text-center">
          <div className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-3.5 h-7 text-xs text-muted-foreground mb-8 shadow-card">
            <span className="size-1.5 rounded-full bg-emerald-500" />
            Now tracking NSE, BSE, NASDAQ, NYSE
          </div>

          <h1 className="font-display text-[40px] md:text-[64px] leading-[1.05] max-w-4xl mx-auto">
            The investing terminal,{" "}
            <span className="text-primary">reimagined</span> for the long term.
          </h1>

          <p className="mt-6 text-base md:text-lg text-muted-foreground max-w-2xl mx-auto leading-relaxed">
            Screen 12,000+ stocks across India and the US. Apply Peter Lynch&apos;s rules in
            milliseconds. Build watchlists, get clean alerts, track your portfolio against the
            index. No clutter. No day-trading noise.
          </p>

          <div className="mt-9 flex flex-wrap items-center justify-center gap-3">
            <Link
              href="/signin"
              className="inline-flex h-11 px-6 items-center gap-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 transition-opacity shadow-card"
            >
              Start free
              <ArrowRight className="size-4" />
            </Link>
            <Link
              href="#features"
              className="inline-flex h-11 px-6 items-center rounded-lg border border-border bg-card text-sm font-medium hover:bg-secondary transition-colors"
            >
              Tour the product
            </Link>
          </div>

          <p className="mt-6 font-mono text-[11px] text-muted-foreground/80">
            Free during beta · Quotes delayed 15 min · No credit card
          </p>
        </div>

        {/* ─── Product mock ──────────────────────────────────────────────── */}
        <div className="mx-auto max-w-6xl px-6 pb-20">
          <div className="relative rounded-2xl border border-border bg-card shadow-card-lg overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-b from-primary/[0.02] to-transparent pointer-events-none" />
            <ScreenerMock />
          </div>
        </div>
      </section>

      <TickerTape />

      {/* ─── Features ─────────────────────────────────────────────────────── */}
      <section id="features" className="border-t border-border">
        <div className="mx-auto max-w-6xl px-6 py-20 md:py-28">
          <div className="text-center mb-14 max-w-2xl mx-auto">
            <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-primary mb-3">
              The product
            </p>
            <h2 className="font-display text-3xl md:text-5xl leading-[1.1]">
              Four tools, one workflow.
            </h2>
            <p className="mt-4 text-muted-foreground">
              Built for the investor who wants depth without complexity.
            </p>
          </div>

          <div className="grid gap-5 md:grid-cols-2">
            <FeatureCard
              kicker="Screener"
              title="Filter the universe"
              body="PE, PEG, market cap, growth, sector, dividend, Lynch category — across 12k+ tickers. Save your screens. Share via URL. Backed by a typed DSL."
              bullets={[
                "11 numeric filters across Valuation, Growth, Quality, Risk",
                "Multi-exchange + sector dropdown",
                "Sortable columns, paginated results",
              ]}
            />
            <FeatureCard
              kicker="Lynch analysis"
              title="The Lynch playbook on every stock"
              body="Modified PEG, fair P/E, six-category classifier. Every stock detail page shows whether you're looking at a Stalwart, a Fast Grower, or an Asset Play."
              bullets={[
                "Modified PEG = (EPS growth + dividend yield) / PE",
                "Lynch fair value benchmark",
                "Slow Grower → Asset Play classification",
              ]}
            />
            <FeatureCard
              kicker="Watchlists & alerts"
              title="Quiet alerts, not spam"
              body="Threshold alerts on price, PE, PEG, or % move. Re-arm logic so a single cross doesn't blow up your inbox. Email delivered fast."
              bullets={[
                "Multi-list tracking",
                "Smart re-arm windows",
                "Branded transactional email",
              ]}
            />
            <FeatureCard
              kicker="Portfolio"
              title="Real cost basis. Real benchmarks."
              body="Manual trade entry, FIFO cost basis, multi-currency P&L, time-weighted return vs NIFTY 50 / S&P 500. No broker linkage required."
              bullets={[
                "FIFO cost basis with corporate actions",
                "Multi-currency consolidated view",
                "TWR vs index, not just transaction-derived",
              ]}
            />
          </div>
        </div>
      </section>

      {/* ─── CTA strip ─────────────────────────────────────────────────────── */}
      <section className="border-t border-border">
        <div className="mx-auto max-w-6xl px-6 py-20 md:py-24 text-center">
          <h2 className="font-display text-3xl md:text-4xl leading-[1.1]">
            Ready to look at the market differently?
          </h2>
          <div className="mt-7 flex flex-wrap items-center justify-center gap-3">
            <Link
              href="/signin"
              className="inline-flex h-11 px-6 items-center gap-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 transition-opacity shadow-card"
            >
              Open the screener
              <ArrowRight className="size-4" />
            </Link>
          </div>
        </div>
      </section>

      <footer className="border-t border-border">
        <div className="mx-auto max-w-6xl px-6 h-14 flex items-center justify-between text-xs text-muted-foreground">
          <span>© {APP_CONFIG.name} · Quotes delayed 15 min · Not investment advice</span>
          <span className="font-mono">v0.1</span>
        </div>
      </footer>
    </main>
  );
}


function FeatureCard({
  kicker,
  title,
  body,
  bullets,
}: {
  kicker: string;
  title: string;
  body: string;
  bullets: string[];
}) {
  return (
    <div className="rounded-2xl border border-border bg-card p-7 md:p-8 shadow-card hover:shadow-card-lg transition-shadow">
      <div className="font-mono text-[11px] uppercase tracking-wider text-primary">{kicker}</div>
      <h3 className="mt-3 font-display text-xl md:text-2xl">{title}</h3>
      <p className="mt-3 text-sm text-muted-foreground leading-relaxed">{body}</p>
      <ul className="mt-5 space-y-2">
        {bullets.map((b) => (
          <li key={b} className="flex items-start gap-2.5 text-sm">
            <Check className="size-4 text-primary shrink-0 mt-0.5" />
            <span className="text-foreground/80">{b}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function TickerTape() {
  const ticks = [
    { sym: "RELIANCE.NS", price: "1,463.60", chg: "+0.03%" },
    { sym: "AAPL", price: "276.83", chg: "−1.22%" },
    { sym: "TCS.NS", price: "2,427.30", chg: "−0.16%" },
    { sym: "NVDA", price: "198.48", chg: "+0.02%" },
    { sym: "INFY.NS", price: "1,587.10", chg: "−0.18%" },
    { sym: "MSFT", price: "428.55", chg: "+0.55%" },
    { sym: "HDFCBANK.NS", price: "1,712.00", chg: "+0.04%" },
    { sym: "GOOGL", price: "172.10", chg: "−0.22%" },
    { sym: "META", price: "586.40", chg: "+0.81%" },
    { sym: "ITC.NS", price: "458.20", chg: "−0.30%" },
  ];
  const items = [...ticks, ...ticks];
  return (
    <div className="border-y border-border overflow-hidden bg-card">
      <div className="ticker-track flex gap-10 whitespace-nowrap py-2.5 text-xs">
        {items.map((t, i) => {
          const isUp = t.chg.startsWith("+");
          return (
            <span key={i} className="inline-flex items-center gap-2.5 font-mono">
              <span className="text-muted-foreground">{t.sym}</span>
              <span className="tabular-nums text-foreground">{t.price}</span>
              <span className={isUp ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"}>
                {t.chg}
              </span>
            </span>
          );
        })}
      </div>
    </div>
  );
}

function ScreenerMock() {
  const rows = [
    { sym: "ADBE", name: "Adobe Inc", pe: "14.79", peg: "0.71", mc: "$103B", chg: "+1.4%" },
    { sym: "QCOM", name: "QUALCOMM", pe: "12.93", peg: "0.76", mc: "$165B", chg: "+0.8%" },
    { sym: "META", name: "Meta Platforms", pe: "26.41", peg: "0.93", mc: "$1.49T", chg: "+0.81%" },
    { sym: "BAC", name: "Bank of America", pe: "14.36", peg: "0.95", mc: "$321B", chg: "+0.4%" },
    { sym: "UNH", name: "UnitedHealth", pe: "29.86", peg: "1.28", mc: "$556B", chg: "−0.3%" },
    { sym: "MSFT", name: "Microsoft", pe: "31.25", peg: "1.59", mc: "$3.18T", chg: "+0.55%" },
  ];
  return (
    <div>
      <div className="px-5 h-12 border-b border-border flex items-center gap-3 text-xs bg-secondary/30">
        <span className="font-mono text-muted-foreground">screener.results</span>
        <span className="ml-auto inline-flex gap-2">
          <span className="font-mono px-2 py-1 rounded-md border border-border bg-card text-muted-foreground">
            PE &lt; 30
          </span>
          <span className="font-mono px-2 py-1 rounded-md border border-border bg-card text-muted-foreground">
            PEG &lt; 2
          </span>
          <span className="hidden sm:inline-flex font-mono px-2 py-1 rounded-md border border-border bg-card text-muted-foreground">
            US markets
          </span>
        </span>
      </div>
      <table className="w-full text-sm">
        <thead className="text-muted-foreground border-b border-border">
          <tr className="text-[11px] uppercase tracking-wider">
            <th className="px-5 py-2.5 text-left font-medium">Symbol</th>
            <th className="px-5 py-2.5 text-left font-medium hidden md:table-cell">Name</th>
            <th className="px-5 py-2.5 text-right font-medium">P/E</th>
            <th className="px-5 py-2.5 text-right font-medium">PEG</th>
            <th className="px-5 py-2.5 text-right font-medium hidden sm:table-cell">Mkt Cap</th>
            <th className="px-5 py-2.5 text-right font-medium">Δ Day</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => {
            const up = r.chg.startsWith("+");
            return (
              <tr key={r.sym} className="border-b border-border/60 last:border-0">
                <td className="px-5 py-3 font-mono">{r.sym}</td>
                <td className="px-5 py-3 hidden md:table-cell text-muted-foreground">{r.name}</td>
                <td className="px-5 py-3 text-right font-mono tabular-nums">{r.pe}</td>
                <td className="px-5 py-3 text-right font-mono tabular-nums">{r.peg}</td>
                <td className="px-5 py-3 text-right font-mono tabular-nums hidden sm:table-cell text-muted-foreground">{r.mc}</td>
                <td className={`px-5 py-3 text-right font-mono tabular-nums ${up ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"}`}>
                  {r.chg}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
