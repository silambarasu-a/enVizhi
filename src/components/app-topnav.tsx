"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTheme } from "next-themes";
import { useState, useRef, useEffect } from "react";
import { Search, Sun, Moon, LogOut, User as UserIcon } from "lucide-react";
import { signOut } from "next-auth/react";
import { cn } from "@/lib/utils";
import { LogoMark } from "@/components/brand/logo-mark";
import { APP_CONFIG } from "@/lib/config";

const NAV = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/screener", label: "Screener" },
  { href: "/watchlists", label: "Watchlists" },
  { href: "/portfolio", label: "Portfolio" },
  { href: "/alerts", label: "Alerts" },
] as const;

export function AppTopNav({ user }: { user: { email: string; name?: string | null } }) {
  const pathname = usePathname();

  return (
    <header className="sticky top-0 z-40 w-full border-b border-border bg-background/85 backdrop-blur-md">
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
          <SearchTrigger />
          <ThemeToggle />
          <UserMenu user={user} />
        </div>
      </div>
    </header>
  );
}

function SearchTrigger() {
  return (
    <button
      type="button"
      className="hidden sm:inline-flex items-center gap-2 h-9 pl-3 pr-2 rounded-lg border border-border bg-card text-xs text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
      onClick={() => {
        // TODO: cmdk-style ticker search modal — Phase 3
      }}
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

function UserMenu({ user }: { user: { email: string; name?: string | null } }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [open]);

  const initials = (user.name ?? user.email)
    .split(/[ .@_-]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((s) => s[0]?.toUpperCase() ?? "")
    .join("");

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="size-9 inline-flex items-center justify-center rounded-full bg-secondary text-secondary-foreground text-xs font-medium hover:bg-accent transition-colors"
        aria-haspopup="menu"
        aria-expanded={open}
      >
        {initials || "?"}
      </button>

      {open ? (
        <div
          role="menu"
          className="absolute right-0 mt-2 w-60 rounded-xl border border-border bg-popover text-popover-foreground shadow-card-lg overflow-hidden"
        >
          <div className="px-3.5 py-3 border-b border-border">
            <div className="text-sm font-medium truncate">{user.name ?? user.email}</div>
            {user.name ? (
              <div className="text-xs text-muted-foreground truncate mt-0.5">{user.email}</div>
            ) : null}
          </div>
          <div className="p-1">
            <Link
              href="/profile"
              className="flex items-center gap-2.5 px-2.5 h-9 rounded-md text-sm hover:bg-secondary transition-colors"
              role="menuitem"
              onClick={() => setOpen(false)}
            >
              <UserIcon className="size-4 text-muted-foreground" />
              Profile
            </Link>
            <button
              type="button"
              className="w-full flex items-center gap-2.5 px-2.5 h-9 rounded-md text-sm hover:bg-secondary transition-colors text-left"
              role="menuitem"
              onClick={() => {
                setOpen(false);
                signOut({ callbackUrl: "/" });
              }}
            >
              <LogOut className="size-4 text-muted-foreground" />
              Sign out
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
