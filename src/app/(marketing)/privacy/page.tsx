import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Privacy Policy",
};

export default function PrivacyPage() {
  return (
    <article className="mx-auto max-w-3xl px-6 py-16">
      <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
        Legal
      </p>
      <h1 className="text-3xl md:text-4xl font-display tracking-tight mt-2 mb-4">
        Privacy Policy
      </h1>
      <p className="text-xs text-muted-foreground mb-10">
        Last updated · {new Date().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}
      </p>

      <Section title="1. What we collect">
        <p>The minimum required to run the product:</p>
        <ul className="list-disc pl-5 space-y-1 mt-2">
          <li>
            Your <strong>email address</strong> — used to send magic-link sign-ins and alert
            notifications.
          </li>
          <li>
            Watchlists, alerts, and portfolio transactions you create — stored against your account
            in our PostgreSQL database (Neon).
          </li>
          <li>
            Standard server logs (timestamp, IP, requested route) for short-term diagnostics. No
            third-party analytics or tracking pixels.
          </li>
        </ul>
      </Section>

      <Section title="2. What we don't collect">
        <ul className="list-disc pl-5 space-y-1">
          <li>
            <strong>No broker linkage.</strong> All portfolio data is entered manually by you.
          </li>
          <li>
            <strong>No passwords.</strong> Magic-link sign-in only — there&apos;s nothing to hash or
            leak.
          </li>
          <li>
            <strong>No third-party trackers.</strong> No Google Analytics, Segment, or ad pixels on
            authenticated pages.
          </li>
        </ul>
      </Section>

      <Section title="3. Where data lives">
        <ul className="list-disc pl-5 space-y-1">
          <li>
            <strong>Database</strong>: PostgreSQL on Neon (US East region in v1).
          </li>
          <li>
            <strong>Email delivery</strong>: SMTP via Gmail / your configured provider.
          </li>
          <li>
            <strong>Hosting</strong>: Vercel (planned) when we leave dev.
          </li>
        </ul>
      </Section>

      <Section title="4. Market data">
        <p>
          Quotes and fundamentals come from Yahoo Finance via the open-source <code>yahoo-finance2</code>{" "}
          client. EnVizhi doesn&apos;t pay Yahoo for this data, and Yahoo doesn&apos;t see your
          identity — your queries are made server-side from our infrastructure.
        </p>
      </Section>

      <Section title="5. Your rights">
        <p>
          You can delete your account at any time by reply to a EnVizhi email. On request we will
          purge all your data (account, watchlists, alerts, portfolios, transactions) within 7 days.
          We may retain server logs for up to 30 days for security and debugging.
        </p>
      </Section>

      <Section title="6. Changes">
        <p>
          We&apos;ll update this page when our practices change. Material changes will be sent to
          your email address.
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
