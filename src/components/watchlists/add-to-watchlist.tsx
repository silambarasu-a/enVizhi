"use client";

import { useState, useRef, useEffect, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Star, Plus, Check } from "lucide-react";
import { addStockToWatchlist, createWatchlist } from "@/app/(app)/watchlists/actions";

interface WatchlistOpt {
  id: string;
  name: string;
  contains: boolean;
}

export function AddToWatchlist({
  symbol,
  watchlists,
}: {
  symbol: string;
  watchlists: WatchlistOpt[];
}) {
  const [open, setOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const ref = useRef<HTMLDivElement>(null);
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    if (!open) return;
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [open]);

  function onAdd(watchlistId: string) {
    startTransition(async () => {
      await addStockToWatchlist({ watchlistId, symbol });
      router.refresh();
    });
  }

  async function onCreateAndAdd() {
    const name = newName.trim();
    if (!name) return;
    startTransition(async () => {
      const fd = new FormData();
      fd.set("name", name);
      await createWatchlist(fd);
      // Re-render — caller will get a fresh list. To keep UX snappy we close.
      setNewName("");
      setCreating(false);
      router.refresh();
    });
  }

  const inAny = watchlists.some((w) => w.contains);

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={`inline-flex items-center gap-1.5 h-9 px-3 rounded-lg border text-[13px] transition-colors ${
          inAny
            ? "border-primary bg-primary/10 text-primary"
            : "border-border bg-card text-foreground hover:bg-secondary"
        }`}
      >
        <Star className={`size-3.5 ${inAny ? "fill-current" : ""}`} />
        {inAny ? "In watchlist" : "Add to watchlist"}
      </button>

      {open ? (
        <div
          role="menu"
          className="absolute right-0 mt-2 w-72 rounded-xl border border-border bg-popover text-popover-foreground shadow-card-lg overflow-hidden z-20"
        >
          <div className="px-3.5 py-2.5 border-b border-border">
            <div className="text-xs font-medium">Add {symbol} to…</div>
          </div>
          {watchlists.length > 0 ? (
            <ul className="max-h-72 overflow-auto">
              {watchlists.map((w) => (
                <li key={w.id}>
                  <button
                    type="button"
                    onClick={() => onAdd(w.id)}
                    disabled={pending || w.contains}
                    className="w-full flex items-center justify-between px-3.5 h-9 text-[13px] hover:bg-secondary disabled:opacity-60 transition-colors text-left"
                  >
                    <span className="truncate">{w.name}</span>
                    {w.contains ? <Check className="size-3.5 text-primary" /> : null}
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="px-3.5 py-3 text-xs text-muted-foreground">No watchlists yet.</p>
          )}
          <div className="border-t border-border p-1">
            {!creating ? (
              <button
                type="button"
                onClick={() => setCreating(true)}
                className="w-full flex items-center gap-2 px-2.5 h-9 rounded-md text-[13px] hover:bg-secondary transition-colors"
              >
                <Plus className="size-3.5" />
                Create new watchlist
              </button>
            ) : (
              <div className="flex items-center gap-1 p-1">
                <input
                  autoFocus
                  type="text"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      onCreateAndAdd();
                    }
                    if (e.key === "Escape") setCreating(false);
                  }}
                  maxLength={64}
                  placeholder="Name…"
                  className="flex-1 h-8 rounded-md border border-input bg-background px-2.5 text-[13px] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                />
                <button
                  type="button"
                  onClick={onCreateAndAdd}
                  disabled={pending || !newName.trim()}
                  className="h-8 px-2.5 rounded-md bg-primary text-primary-foreground text-[12px] font-medium disabled:opacity-50"
                >
                  Create
                </button>
              </div>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
