import Link from "next/link";
import { CheckCircle2, AlertTriangle } from "lucide-react";
import { verifyEmail } from "@/app/(auth)/actions";

export default async function VerifyEmailPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;
  const result = token ? await verifyEmail(token) : { error: "No verification token in URL." };

  return (
    <main className="min-h-svh grid place-items-center px-6 bg-background">
      <div className="w-full max-w-sm">
        <div className="rounded-2xl border border-border bg-card p-8 shadow-card-lg space-y-5 text-center">
          {result.ok ? (
            <>
              <div className="size-14 rounded-2xl bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 inline-flex items-center justify-center mx-auto">
                <CheckCircle2 className="size-7" />
              </div>
              <div className="space-y-1.5">
                <h1 className="font-display text-2xl">Email verified</h1>
                <p className="text-sm text-muted-foreground">
                  Thanks — your account is fully activated. Head to the dashboard to start screening.
                </p>
              </div>
              <Link
                href="/dashboard"
                className="inline-flex h-10 px-5 items-center rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 transition-opacity shadow-card"
              >
                Open dashboard
              </Link>
            </>
          ) : (
            <>
              <div className="size-14 rounded-2xl bg-amber-500/10 text-amber-700 dark:text-amber-400 inline-flex items-center justify-center mx-auto">
                <AlertTriangle className="size-7" />
              </div>
              <div className="space-y-1.5">
                <h1 className="font-display text-2xl">Verification failed</h1>
                <p className="text-sm text-muted-foreground">{result.error}</p>
              </div>
              <Link
                href="/dashboard"
                className="inline-flex h-10 px-4 items-center rounded-lg border border-border bg-card text-sm font-medium hover:bg-secondary transition-colors"
              >
                Back to dashboard
              </Link>
            </>
          )}
        </div>
      </div>
    </main>
  );
}
