"use client";

import { useEffect } from "react";
import Link from "next/link";
import { RefreshCw } from "lucide-react";

export default function ErrorBoundary({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Log to whatever error reporter is wired up. (Sentry would replace this.)
    console.error("[app] route error:", error);
  }, [error]);

  return (
    <main className="min-h-svh grid place-items-center px-6 bg-background">
      <div className="w-full max-w-md text-center space-y-6">
        <div className="space-y-3">
          <p className="font-mono text-[64px] leading-none text-destructive/40">err</p>
          <h1 className="font-display text-2xl">Something went sideways</h1>
          <p className="text-sm text-muted-foreground leading-relaxed">
            We hit an unexpected error rendering this page. Try again, or head back home and we&apos;ll
            look into it.
          </p>
          {error.digest ? (
            <p className="font-mono text-[10px] text-muted-foreground/70">
              ref: {error.digest}
            </p>
          ) : null}
        </div>
        <div className="flex items-center justify-center gap-3">
          <button
            type="button"
            onClick={reset}
            className="inline-flex h-10 px-4 items-center gap-1.5 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 transition-opacity"
          >
            <RefreshCw className="size-3.5" />
            Try again
          </button>
          <Link
            href="/"
            className="inline-flex h-10 px-4 items-center rounded-lg border border-border bg-card text-sm font-medium hover:bg-secondary transition-colors"
          >
            Home
          </Link>
        </div>
      </div>
    </main>
  );
}
