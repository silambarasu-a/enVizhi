import Link from "next/link";
import { ArrowRight, Check, LayoutDashboard } from "lucide-react";
import { LogoMark } from "@/components/brand/logo-mark";
import { APP_CONFIG } from "@/lib/config";
import { auth } from "@/lib/auth";
import { UserMenu } from "@/components/auth/user-menu";

export default async function LandingPage() {
  const session = await auth();
  // Match the auth-check used by protected pages (id, not email) so the landing
  // never disagrees about whether someone is signed in.
  const isAuthed = Boolean(session?.user?.id && session?.user?.email);
  const firstName = session?.user?.name?.split(" ")[0];
  const userForMenu = isAuthed && session?.user?.email
    ? { email: session.user.email, name: session.user.name }
    : null;

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
            {isAuthed && userForMenu ? (
              <>
                <Link
                  href="/dashboard"
                  className="ml-1 inline-flex h-9 px-4 items-center gap-1.5 rounded-lg bg-foreground text-background text-[13px] font-medium hover:opacity-90 transition-opacity"
                >
                  <LayoutDashboard className="size-3.5" />
                  <span className="hidden sm:inline">Open dashboard</span>
                  <span className="sm:hidden">Dashboard</span>
                </Link>
                <div className="ml-1.5">
                  <UserMenu user={userForMenu} size={32} />
                </div>
              </>
            ) : (
              <>
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
              </>
            )}
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
            {isAuthed ? (
              <Link
                href="/dashboard"
                className="inline-flex h-11 px-6 items-center gap-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 transition-opacity shadow-card"
              >
                <LayoutDashboard className="size-4" />
                {firstName ? `Continue, ${firstName}` : "Open dashboard"}
              </Link>
            ) : (
              <Link
                href="/signin"
                className="inline-flex h-11 px-6 items-center gap-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 transition-opacity shadow-card"
              >
                Start free
                <ArrowRight className="size-4" />
              </Link>
            )}
            <Link
              href="#features"
              className="inline-flex h-11 px-6 items-center rounded-lg border border-border bg-card text-sm font-medium hover:bg-secondary transition-colors"
            >
              Tour the product
            </Link>
          </div>

          <p className="mt-6 font-mono text-[11px] text-muted-foreground/80">
            {isAuthed
              ? "Quotes delayed 15 min · You're signed in"
              : "Free during beta · Quotes delayed 15 min · No credit card"}
          </p>
        </div>

      </section>

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
              href={isAuthed ? "/screener" : "/signin"}
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

