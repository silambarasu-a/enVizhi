"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { TrendingUp, TrendingDown, Flame, Sparkles, Diamond, Rocket, Plus } from "lucide-react";
import type { ScreenId } from "@/lib/market-data/types";
import { importYahooScreen } from "@/app/(app)/screener/actions";

interface ScreenChip {
  id: ScreenId;
  label: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
}

const CHIPS: ScreenChip[] = [
  { id: "most_actives", label: "Most Active", description: "Today's heaviest volume.", icon: Flame },
  { id: "day_gainers", label: "Day Gainers", description: "Biggest movers up.", icon: TrendingUp },
  { id: "day_losers", label: "Day Losers", description: "Biggest movers down.", icon: TrendingDown },
  { id: "trending_now", label: "Trending Now", description: "Yahoo-watched names.", icon: Sparkles },
  { id: "undervalued_large_caps", label: "Undervalued Large Caps", description: "Quality at a discount.", icon: Diamond },
  { id: "growth_technology_stocks", label: "Tech Growth", description: "High-growth tech.", icon: Rocket },
];

export function DiscoverPanel() {
  const router = useRouter();
  const [pendingId, setPendingId] = useState<ScreenId | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  function importScreen(id: ScreenId) {
    setPendingId(id);
    setMessage(null);
    startTransition(async () => {
      const fd = new FormData();
      fd.set("scrId", id);
      const res = await importYahooScreen(fd);
      setPendingId(null);
      if (res?.error) {
        setMessage(`✗ ${res.error}`);
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
      <div className="flex items-baseline justify-between mb-1">
        <div>
          <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
            Discover
          </p>
          <h2 className="font-display text-base mt-0.5">Pull a Yahoo screen into your universe</h2>
        </div>
        {message ? (
          <span className="text-[11px] text-muted-foreground truncate max-w-[60%]">{message}</span>
        ) : null}
      </div>
      <p className="text-xs text-muted-foreground mb-4">
        Click a screen below to import the top 25 tickers — fundamentals are fetched live, then
        they show up in the table below for filtering.
      </p>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
        {CHIPS.map((chip) => {
          const Icon = chip.icon;
          const isPending = pendingId === chip.id;
          return (
            <button
              key={chip.id}
              type="button"
              onClick={() => importScreen(chip.id)}
              disabled={pendingId !== null}
              className="group flex flex-col items-start gap-1.5 rounded-lg border border-border bg-background p-3 text-left hover:border-primary/40 hover:bg-secondary/40 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <div className="flex items-center gap-1.5 text-primary">
                <Icon className="size-3.5" />
                {isPending ? (
                  <Plus className="size-3 animate-spin opacity-50" />
                ) : (
                  <Plus className="size-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                )}
              </div>
              <div className="text-[12px] font-medium leading-tight">{chip.label}</div>
              <div className="text-[10px] text-muted-foreground leading-tight">{chip.description}</div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
