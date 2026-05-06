"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { TrendingUp, TrendingDown, Flame, Sparkles, Diamond, Rocket, Plus } from "lucide-react";
import type { ScreenId } from "@/lib/market-data/types";
import { importYahooScreen } from "@/app/(app)/screener/actions";
import { cn } from "@/lib/utils";

const STORAGE_KEY_SCREEN = "envizhi.discover.screen";
const STORAGE_KEY_REGION = "envizhi.discover.region";

type Region = "US" | "IN";

interface ScreenChip {
  id: ScreenId;
  label: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  /** Whether the chip resolves to anything sensible for India. The two
   *  fundamentals-based screens have no NIFTY-50 ranking strategy. */
  inSupported: boolean;
}

const CHIPS: ScreenChip[] = [
  { id: "most_actives", label: "Most Active", description: "Today's heaviest volume.", icon: Flame, inSupported: true },
  { id: "day_gainers", label: "Day Gainers", description: "Biggest movers up.", icon: TrendingUp, inSupported: true },
  { id: "day_losers", label: "Day Losers", description: "Biggest movers down.", icon: TrendingDown, inSupported: true },
  { id: "trending_now", label: "Trending Now", description: "Yahoo-watched names.", icon: Sparkles, inSupported: true },
  { id: "undervalued_large_caps", label: "Undervalued Large Caps", description: "Quality at a discount.", icon: Diamond, inSupported: false },
  { id: "growth_technology_stocks", label: "Tech Growth", description: "High-growth tech.", icon: Rocket, inSupported: false },
];

const REGIONS: Array<{ id: Region; flag: string; label: string }> = [
  { id: "US", flag: "🇺🇸", label: "US" },
  { id: "IN", flag: "🇮🇳", label: "India" },
];

const VALID_SCREEN_IDS = new Set<string>(CHIPS.map((c) => c.id));

function safeRead(key: string): string | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

export function DiscoverPanel({ defaultRegion = "US" }: { defaultRegion?: Region }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  // First-paint state must match the server (which can't see localStorage),
  // so `useState`'s initializer reads from URL only. On mount, a useEffect
  // promotes localStorage values when the URL doesn't already supply them.
  // After mount, state is the source of truth and changes write back to both
  // URL and localStorage.
  const [activeId, setActiveId] = useState<ScreenId | null>(() => {
    const fromUrl = searchParams.get("discoverScreen");
    return fromUrl && VALID_SCREEN_IDS.has(fromUrl) ? (fromUrl as ScreenId) : null;
  });
  const [region, setRegion] = useState<Region>(() => {
    const fromUrl = searchParams.get("discoverRegion");
    if (fromUrl === "IN" || fromUrl === "US") return fromUrl;
    return defaultRegion;
  });
  const [pendingId, setPendingId] = useState<ScreenId | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  // Hydrate-from-storage runs after first paint so server/client agree on
  // first render. If URL params already supplied values we leave them be.
  useEffect(() => {
    const sp = new URLSearchParams(window.location.search);
    if (!sp.get("discoverScreen")) {
      const stored = safeRead(STORAGE_KEY_SCREEN);
      if (stored && VALID_SCREEN_IDS.has(stored)) setActiveId(stored as ScreenId);
    }
    if (!sp.get("discoverRegion")) {
      const stored = safeRead(STORAGE_KEY_REGION);
      if (stored === "IN" || stored === "US") setRegion(stored);
    }
    // Run once on mount only — subsequent changes are state-driven.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Mirror state to localStorage so the next mount can recover it even if the
  // URL got rewritten (e.g. by sort/filter actions that drop the discover keys).
  useEffect(() => {
    try {
      if (activeId) localStorage.setItem(STORAGE_KEY_SCREEN, activeId);
      else localStorage.removeItem(STORAGE_KEY_SCREEN);
    } catch {
      /* localStorage may be unavailable in some embeds — silently skip. */
    }
  }, [activeId]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY_REGION, region);
    } catch {
      /* ignore */
    }
  }, [region]);

  function writeUrl(nextRegion: Region, nextScreen: ScreenId | null) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("discoverRegion", nextRegion);
    if (nextScreen) params.set("discoverScreen", nextScreen);
    else params.delete("discoverScreen");
    const qs = params.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  }

  function pickRegion(next: Region) {
    if (next === region || pendingId !== null) return;
    setRegion(next);
    setActiveId(null);
    setMessage(null);
    writeUrl(next, null);
  }

  function importScreen(id: ScreenId) {
    setPendingId(id);
    setActiveId(id);
    setMessage(null);
    writeUrl(region, id);
    startTransition(async () => {
      const fd = new FormData();
      fd.set("scrId", id);
      fd.set("region", region);
      const res = await importYahooScreen(fd);
      setPendingId(null);
      if (res?.error) {
        setMessage(`✗ ${res.error}`);
        setActiveId(null);
        writeUrl(region, null);
      } else if (res?.ok) {
        const parts: string[] = [];
        if (res.imported) parts.push(`${res.imported} new`);
        if (res.alreadyKnown) parts.push(`${res.alreadyKnown} already known`);
        if (res.skipped) parts.push(`${res.skipped} skipped (unsupported exchange)`);
        setMessage(`Imported — ${parts.join(", ") || "no matches"}`);
        router.refresh();
      }
    });
  }

  return (
    <div className="rounded-2xl border border-border bg-card p-5 shadow-card">
      <div className="flex items-start justify-between gap-4 mb-1">
        <div className="min-w-0">
          <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
            Discover
          </p>
          <h2 className="font-display text-base mt-0.5">Pull a Yahoo screen into your universe</h2>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          {message ? (
            <span className="hidden md:inline text-[11px] text-muted-foreground truncate max-w-[260px]">
              {message}
            </span>
          ) : null}
          <div
            className="inline-flex items-center gap-0.5 rounded-lg bg-secondary p-0.5"
            role="tablist"
            aria-label="Discover region"
          >
            {REGIONS.map((r) => {
              const active = r.id === region;
              return (
                <button
                  key={r.id}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  disabled={pendingId !== null}
                  onClick={() => pickRegion(r.id)}
                  className={cn(
                    "h-7 px-2.5 inline-flex items-center gap-1.5 rounded-md text-[11px] font-medium transition-colors disabled:opacity-60 cursor-pointer",
                    active
                      ? "bg-card text-foreground shadow-card"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  <span aria-hidden>{r.flag}</span>
                  {r.label}
                </button>
              );
            })}
          </div>
        </div>
      </div>
      <p className="text-xs text-muted-foreground mb-4">
        Click a screen below to import the top 25 tickers — fundamentals are fetched live, then
        they show up in the table below for filtering.
        {region === "IN" ? (
          <span className="block mt-1 text-muted-foreground/80">
            India ranks NIFTY 50 components by today's signal — Yahoo's predefined screens are US-only.
          </span>
        ) : null}
      </p>
      {message ? (
        <p className="md:hidden text-[11px] text-muted-foreground mb-3">{message}</p>
      ) : null}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
        {CHIPS.map((chip) => {
          const Icon = chip.icon;
          const isPending = pendingId === chip.id;
          const isActive = activeId === chip.id;
          const unsupportedForRegion = region === "IN" && !chip.inSupported;
          const disabled = pendingId !== null || unsupportedForRegion;
          return (
            <button
              key={chip.id}
              type="button"
              onClick={() => importScreen(chip.id)}
              disabled={disabled}
              aria-pressed={isActive}
              title={unsupportedForRegion ? "US only — needs fundamentals ranking" : undefined}
              className={cn(
                "group flex flex-col items-start gap-1.5 rounded-lg border p-3 text-left transition-colors disabled:cursor-not-allowed",
                unsupportedForRegion && "opacity-40",
                !unsupportedForRegion && pendingId !== null && !isPending && "opacity-50",
                isActive
                  ? "border-primary bg-primary/10 ring-1 ring-primary/30"
                  : "border-border bg-background hover:border-primary/40 hover:bg-secondary/40",
              )}
            >
              <div className="flex items-center gap-1.5 text-primary">
                <Icon className="size-3.5" />
                {isPending ? (
                  <Plus className="size-3 animate-spin opacity-50" />
                ) : isActive ? (
                  <Plus className="size-3 opacity-100 rotate-45" />
                ) : (
                  <Plus className="size-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                )}
              </div>
              <div className={cn("text-[12px] font-medium leading-tight", isActive && "text-primary")}>
                {chip.label}
              </div>
              <div className="text-[10px] text-muted-foreground leading-tight">
                {unsupportedForRegion ? "US only" : chip.description}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
