"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTheme } from "next-themes";
import { useState, useEffect } from "react";
import { Search, Sun, Moon } from "lucide-react";
import { cn } from "@/lib/utils";
import { LogoMark } from "@/components/brand/logo-mark";
import { APP_CONFIG } from "@/lib/config";
import { UserMenu } from "@/components/auth/user-menu";
import { TickerSearchModal } from "@/components/search/ticker-search-modal";

const NAV = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/screener", label: "Screener" },
  { href: "/watchlists", label: "Watchlists" },
  { href: "/portfolio", label: "Portfolio" },
  { href: "/alerts", label: "Alerts" },
] as const;

export function AppTopNav({ user }: { user: { email: string; name?: string | null } }) {
  const pathname = usePathname();
  const [searchOpen, setSearchOpen] = useState(false);

  // ⌘K (or Ctrl+K) opens the ticker search from anywhere in the app.
  // Skip when the user is typing in another input/textarea so we don't
  // hijack legitimate text-editing keystrokes.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const target = e.target as HTMLElement | null;
      const inField =
        !!target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.isContentEditable);
      if (e.key === "k" && (e.metaKey || e.ctrlKey) && !inField) {
        e.preventDefault();
        setSearchOpen(true);
      }
      if (e.key === "/" && !inField) {
        e.preventDefault();
        setSearchOpen(true);
      }
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  return (
    <header className="sticky top-0 z-40 w-full border-b border-border bg-background/85 backdrop-blur-md">
      <TickerSearchModal open={searchOpen} onClose={() => setSearchOpen(false)} />
      <div className="mx-auto max-w-[1400px] h-16 px-6 flex items-center gap-8">
        <Link href="/dashboard" className="flex items-center gap-2.5 shrink-0 group">
          <LogoMark size={28} className="text-primary transition-transform group-hover:scale-105" />
          <span className="font-display text-[16px] hidden sm:inline">{APP_CONFIG.name}</span>
        </Link>

        <nav className="hidden md:flex items-center gap-1">
          {NAV.map((item) => {
            const isActive =
              pathname === item.href || pathname.startsWith(item.href + "/");
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "h-9 px-3 inline-flex items-center rounded-lg text-[13.5px] transition-colors",
                  isActive
                    ? "bg-secondary text-foreground"
                    : "text-muted-foreground hover:text-foreground hover:bg-secondary/60",
                )}
              >
                <span>{item.label}</span>
                {"soon" in item && item.soon ? (
                  <span className="ml-1.5 font-mono text-[9px] uppercase tracking-wider opacity-50">
                    soon
                  </span>
                ) : null}
              </Link>
            );
          })}
        </nav>

        <div className="ml-auto flex items-center gap-2">
          <SearchTrigger onOpen={() => setSearchOpen(true)} />
          <ThemeToggle />
          <UserMenu user={user} />
        </div>
      </div>
    </header>
  );
}

function SearchTrigger({ onOpen }: { onOpen: () => void }) {
  return (
    <button
      type="button"
      onClick={onOpen}
      aria-label="Search ticker"
      className="hidden sm:inline-flex items-center gap-2 h-9 pl-3 pr-2 rounded-lg border border-border bg-card text-xs text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
    >
      <Search className="size-3.5" />
      <span className="hidden md:inline">Search ticker…</span>
      <kbd className="hidden md:inline-flex h-5 px-1.5 ml-1 items-center rounded font-mono text-[10px] border border-border bg-background">
        ⌘K
      </kbd>
    </button>
  );
}

function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  return (
    <button
      type="button"
      aria-label="Toggle theme"
      className="size-9 inline-flex items-center justify-center rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
      onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
    >
      {!mounted ? null : resolvedTheme === "dark" ? (
        <Sun className="size-4" />
      ) : (
        <Moon className="size-4" />
      )}
    </button>
  );
}

