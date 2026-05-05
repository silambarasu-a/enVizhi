import Link from "next/link";
import { ArrowLeft } from "lucide-react";

export default function NotFound() {
  return (
    <main className="min-h-svh grid place-items-center px-6 bg-background">
      <div className="w-full max-w-md text-center space-y-6">
        <div className="space-y-3">
          <p className="font-mono text-[64px] leading-none text-muted-foreground/30">404</p>
          <h1 className="font-display text-2xl">Page not found</h1>
          <p className="text-sm text-muted-foreground leading-relaxed">
            The page you&apos;re looking for doesn&apos;t exist, or the symbol you typed isn&apos;t in
            the EnVizhi universe yet. We track ~50 of the most-watched stocks in v1.
          </p>
        </div>
        <div className="flex items-center justify-center gap-3">
          <Link
            href="/"
            className="inline-flex h-10 px-4 items-center gap-1.5 rounded-lg border border-border bg-card text-sm font-medium hover:bg-secondary transition-colors"
          >
            <ArrowLeft className="size-3.5" />
            Home
          </Link>
          <Link
            href="/screener"
            className="inline-flex h-10 px-4 items-center rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 transition-opacity"
          >
            Open the screener
          </Link>
        </div>
      </div>
    </main>
  );
}
