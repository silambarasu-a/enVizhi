import Link from "next/link";
import { LogoMark } from "@/components/brand/logo-mark";
import { APP_CONFIG } from "@/lib/config";

/**
 * Shared chrome for static / marketing pages (Terms, Privacy). Distinct from
 * the (app) layout — these pages don't auth and don't need the top nav.
 */
export default function MarketingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-svh flex flex-col bg-background">
      <header className="border-b border-border">
        <div className="mx-auto max-w-3xl h-14 px-6 flex items-center">
          <Link href="/" className="flex items-center gap-2.5 group">
            <LogoMark size={28} className="text-primary transition-transform group-hover:scale-105" />
            <span className="font-display text-[16px]">{APP_CONFIG.name}</span>
          </Link>
          <nav className="ml-auto flex items-center gap-1 text-sm">
            <Link href="/terms" className="h-9 px-3 inline-flex items-center text-muted-foreground hover:text-foreground transition-colors">
              Terms
            </Link>
            <Link href="/privacy" className="h-9 px-3 inline-flex items-center text-muted-foreground hover:text-foreground transition-colors">
              Privacy
            </Link>
            <Link
              href="/signin"
              className="ml-1 inline-flex h-9 px-4 items-center rounded-lg bg-foreground text-background text-[13px] font-medium hover:opacity-90 transition-opacity"
            >
              Sign in
            </Link>
          </nav>
        </div>
      </header>
      <main className="flex-1">{children}</main>
      <footer className="border-t border-border">
        <div className="mx-auto max-w-3xl px-6 h-14 flex items-center justify-between text-xs text-muted-foreground">
          <span>© {APP_CONFIG.name} · Quotes delayed 15 min · Not investment advice</span>
          <span className="font-mono">v0.1</span>
        </div>
      </footer>
    </div>
  );
}
