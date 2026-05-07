"use client";

import { useEffect, useRef, useState } from "react";
import { Search } from "lucide-react";

interface Match {
  symbol: string;
  name: string;
  exchange: string;
  currency?: string | null;
  isSupported?: boolean;
  isIndex?: boolean;
}

/**
 * Inline live-search ticker picker.
 *
 *   Hits /api/stocks/search on every keystroke, debounced ~150ms, and shows
 *   a dropdown below the input. On select, calls `onChange(symbol, currency)`
 *   so the parent form can both store the symbol AND enforce currency-aware
 *   rules (e.g. India = whole shares only).
 *
 *   Indices are excluded from results — you can't transact an index in a
 *   portfolio. Unsupported exchanges (LSE, TSX, etc.) are also hidden.
 *
 *   Free-typed symbols still work: the user can type any ticker and submit;
 *   the server action will lazy-create it through findOrCreateStock if Yahoo
 *   recognises it.
 */
export function TickerSelect({
  value,
  onChange,
  placeholder = "Search ticker (AAPL, RELIANCE…)",
  className,
}: {
  value: string;
  onChange: (symbol: string, currency: string | null) => void;
  placeholder?: string;
  className?: string;
}) {
  const [query, setQuery] = useState(value);
  const [results, setResults] = useState<Match[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [activeIdx, setActiveIdx] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);

  // Keep the visible input in sync if the parent resets `value` (e.g. after
  // submit clears the form).
  useEffect(() => {
    setQuery(value);
  }, [value]);

  // Live-search with cancellation + light debounce.
  useEffect(() => {
    if (!open) return;
    const trimmed = query.trim();
    if (trimmed.length < 1) {
      setResults([]);
      return;
    }
    let cancelled = false;
    setLoading(true);
    const id = setTimeout(() => {
      fetch(`/api/stocks/search?q=${encodeURIComponent(trimmed)}`, { cache: "no-store" })
        .then((r) => (r.ok ? r.json() : { stocks: [] }))
        .then((d) => {
          if (cancelled) return;
          const filtered = (d.stocks as Match[] | undefined ?? [])
            .filter((s) => s.isSupported !== false && !s.isIndex);
          setResults(filtered);
          setActiveIdx(0);
        })
        .catch(() => {
          if (!cancelled) setResults([]);
        })
        .finally(() => {
          if (!cancelled) setLoading(false);
        });
    }, 150);
    return () => {
      cancelled = true;
      clearTimeout(id);
    };
  }, [query, open]);

  // Click-outside closes the dropdown.
  useEffect(() => {
    if (!open) return;
    function onMouseDown(e: MouseEvent) {
      if (!containerRef.current?.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onMouseDown);
    return () => document.removeEventListener("mousedown", onMouseDown);
  }, [open]);

  function pick(m: Match) {
    setQuery(m.symbol);
    onChange(m.symbol, m.currency ?? null);
    setOpen(false);
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (!open) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIdx((i) => Math.min(results.length - 1, i + 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIdx((i) => Math.max(0, i - 1));
    } else if (e.key === "Enter") {
      const m = results[activeIdx];
      if (m) {
        e.preventDefault();
        pick(m);
      }
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  }

  return (
    <div ref={containerRef} className={`relative ${className ?? ""}`}>
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground pointer-events-none" />
        <input
          type="text"
          value={query}
          onChange={(e) => {
            const next = e.target.value.toUpperCase();
            setQuery(next);
            // Keep `value` in sync so a free-typed symbol still gets saved
            // even if the user doesn't pick from the list. Currency is null
            // until they pick — server action will resolve via findOrCreateStock.
            onChange(next, null);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={onKeyDown}
          placeholder={placeholder}
          autoComplete="off"
          spellCheck={false}
          className="w-full h-10 rounded-lg border border-input bg-background pl-9 pr-3 text-sm font-mono uppercase placeholder:text-muted-foreground/60 placeholder:normal-case focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />
      </div>

      {open && (loading || results.length > 0 || query.trim().length > 0) ? (
        <div className="absolute z-30 left-0 right-0 mt-1 rounded-lg border border-border bg-popover shadow-card-lg overflow-hidden">
          {loading ? (
            <div className="px-3 py-2 text-xs text-muted-foreground">Searching…</div>
          ) : results.length === 0 ? (
            <div className="px-3 py-2 text-xs text-muted-foreground">
              No matches. You can still type a ticker — we'll resolve it on submit.
            </div>
          ) : (
            <ul className="max-h-72 overflow-y-auto">
              {results.map((m, i) => (
                <li key={`${m.symbol}-${i}`}>
                  <button
                    type="button"
                    onMouseEnter={() => setActiveIdx(i)}
                    onClick={() => pick(m)}
                    className={`w-full text-left px-3 py-2 flex items-center gap-3 ${
                      i === activeIdx ? "bg-secondary" : ""
                    }`}
                  >
                    <span className="font-mono text-[12px] w-24 truncate">{m.symbol}</span>
                    <span className="text-xs text-muted-foreground flex-1 truncate">{m.name}</span>
                    <span className="font-mono text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded border border-border text-muted-foreground">
                      {m.exchange}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : null}
    </div>
  );
}
