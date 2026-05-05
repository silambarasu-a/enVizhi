import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Terms of Service",
};

export default function TermsPage() {
  return (
    <article className="mx-auto max-w-3xl px-6 py-16 prose prose-zinc dark:prose-invert prose-headings:font-display prose-headings:tracking-tight">
      <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
        Legal
      </p>
      <h1 className="text-3xl md:text-4xl font-display tracking-tight mt-2 mb-4">
        Terms of Service
      </h1>
      <p className="text-xs text-muted-foreground mb-10">
        Last updated · {new Date().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}
      </p>

      <Section title="1. What EnVizhi is">
        <p>
          EnVizhi is a beta-stage research tool that surfaces market data, fundamentals, and Peter
          Lynch–style analysis on Indian (NSE/BSE) and US (NASDAQ/NYSE) listed stocks. By signing up
          you agree to these Terms.
        </p>
      </Section>

      <Section title="2. Not investment advice">
        <p>
          Nothing on EnVizhi is investment, tax, legal, or accounting advice. Screener filters,
          watchlists, alerts, Lynch classifications, and portfolio analytics are provided for
          informational purposes only. You are solely responsible for any decisions you make on the
          basis of information shown here.
        </p>
      </Section>

      <Section title="3. Quote latency and data quality">
        <p>
          Quotes are <strong>delayed by at least 15 minutes</strong> and are sourced via Yahoo
          Finance. We don&apos;t represent the data as suitable for active trading. Fundamentals
          can be incomplete — particularly for Indian small/mid caps — and we surface the gaps
          rather than hide them, but we cannot guarantee accuracy.
        </p>
      </Section>

      <Section title="4. Your account">
        <p>
          You must use a real email address. Magic-link sign-in is the only authentication method
          right now. You agree not to share your sign-in link, scrape the product, or attempt to
          access data outside your own account.
        </p>
      </Section>

      <Section title="5. Beta status & changes">
        <p>
          EnVizhi is in active development. Features may change, break, or disappear with little
          notice. We&apos;ll do our best to give a heads-up before destructive changes, but we make
          no guarantees while in beta.
        </p>
      </Section>

      <Section title="6. Liability">
        <p>
          EnVizhi is provided &quot;as is&quot; with no warranties. We are not liable for any loss —
          financial or otherwise — arising from use of the product, market data outages, classifier
          errors, or alert delivery delays.
        </p>
      </Section>

      <Section title="7. Contact">
        <p>
          Questions about these Terms? Reply to any EnVizhi email and we&apos;ll get back to you.
        </p>
      </Section>
    </article>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-8">
      <h2 className="text-lg font-semibold tracking-tight mb-2">{title}</h2>
      <div className="text-sm text-foreground/80 leading-relaxed space-y-2">{children}</div>
    </section>
  );
}
