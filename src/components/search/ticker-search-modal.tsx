"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { Search, ArrowRight, CornerDownLeft, ArrowUp, ArrowDown } from "lucide-react";

interface Stock {
  symbol: string;
  name: string;
  exchange: string;
  currency?: string | null;
  isSupported?: boolean;
}

export function TickerSearchModal({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [results, setResults] = useState<Stock[]>([]);
  const [loading, setLoading] = useState(false);
  const [activeIdx, setActiveIdx] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  // Fetch on open and on every query change. Cancellation flag avoids races
  // when the user is typing fast.
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setLoading(true);
    fetch(`/api/stocks/search?q=${encodeURIComponent(q)}`, { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : { stocks: [] }))
      .then((d) => {
        if (cancelled) return;
        setResults(d.stocks ?? []);
        setActiveIdx(0);
      })
      .catch(() => {
        if (!cancelled) setResults([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open, q]);

  // Reset state when closed; focus the input when freshly opened.
  useEffect(() => {
    if (open) {
      // Defer focus by a tick so the element exists in the DOM.
      const id = setTimeout(() => inputRef.current?.focus(), 30);
      // Lock body scroll while modal is open.
      const prev = document.body.style.overflow;
      document.body.style.overflow = "hidden";
      return () => {
        clearTimeout(id);
        document.body.style.overflow = prev;
      };
    }
    setQ("");
    setActiveIdx(0);
    setResults([]);
  }, [open]);

  // Keyboard handling: arrow keys, enter, esc.
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
        return;
      }
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setActiveIdx((i) => Math.min(i + 1, Math.max(0, results.length - 1)));
        return;
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setActiveIdx((i) => Math.max(i - 1, 0));
        return;
      }
      if (e.key === "Enter") {
        e.preventDefault();
        const selected = results[activeIdx];
        if (selected) {
          router.push(`/stock/${encodeURIComponent(selected.symbol)}`);
          onClose();
        }
      }
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, results, activeIdx, onClose, router]);

  // Keep the highlighted row in view as user arrows through results.
  useEffect(() => {
    if (!open) return;
    const list = listRef.current;
    if (!list) return;
    const item = list.children[activeIdx] as HTMLElement | undefined;
    item?.scrollIntoView({ block: "nearest" });
  }, [open, activeIdx]);

  if (!open) return null;
  // SSR guard — `createPortal` needs a real DOM target.
  if (typeof document === "undefined") return null;

  function navigateTo(symbol: string) {
    router.push(`/stock/${encodeURIComponent(symbol)}`);
    onClose();
  }

  // Render directly into <body> so the modal escapes the sticky header (which
  // uses `backdrop-filter` and would otherwise become the containing block for
  // our fixed-position overlay).
  return createPortal(
    <div
      className="fixed inset-0 z-[60] flex items-start justify-center pt-[10vh] sm:pt-[14vh] px-3 sm:px-4 bg-foreground/30 backdrop-blur-sm"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Ticker search"
    >
      <div
        className="w-full max-w-xl rounded-2xl border border-border bg-popover text-popover-foreground shadow-card-lg overflow-hidden flex flex-col max-h-[80vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Search input */}
        <div className="flex items-center gap-3 px-4 h-12 border-b border-border">
          <Search className="size-4 text-muted-foreground shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search by symbol or name…"
            className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
            spellCheck={false}
            autoComplete="off"
            autoCorrect="off"
          />
          <kbd className="hidden sm:inline-flex h-5 px-1.5 items-center rounded font-mono text-[10px] border border-border bg-background text-muted-foreground">
            esc
          </kbd>
        </div>

        {/* Results */}
        <div className="flex-1 overflow-y-auto min-h-0">
          {loading && results.length === 0 ? (
            <div className="px-4 py-8 text-center text-sm text-muted-foreground">
              Searching…
            </div>
          ) : results.length === 0 ? (
            <div className="px-4 py-8 text-center text-sm text-muted-foreground">
              {q ? "No matches." : "Type a symbol or company name to search anywhere on Yahoo Finance."}
            </div>
          ) : (
            <ul ref={listRef} className="py-1">
              {results.map((s, idx) => {
                const active = idx === activeIdx;
                return (
                  <li key={`${s.symbol}-${idx}`}>
                    <button
                      type="button"
                      onMouseEnter={() => setActiveIdx(idx)}
                      onClick={() => navigateTo(s.symbol)}
                      className={`w-full flex items-center gap-2 sm:gap-3 px-3 sm:px-4 py-2.5 text-left transition-colors min-w-0 ${
                        active ? "bg-secondary" : "hover:bg-secondary/60"
                      }`}
                    >
                      <span className="font-mono text-[13px] truncate min-w-0 max-w-[40%] sm:max-w-[28%]">
                        {s.symbol}
                      </span>
                      <span className="flex-1 text-sm text-foreground truncate min-w-0">
                        {s.name}
                      </span>
                      <span
                        className={`font-mono text-[10px] uppercase tracking-wider shrink-0 ${
                          s.isSupported === false
                            ? "text-amber-700 dark:text-amber-400"
                            : "text-muted-foreground/80"
                        }`}
                        title={
                          s.isSupported === false
                            ? "Listed outside our supported exchanges — view-only"
                            : undefined
                        }
                      >
                        {s.exchange}
                      </span>
                      <ArrowRight
                        className={`size-3.5 shrink-0 transition-opacity ${
                          active ? "opacity-100 text-foreground" : "opacity-0"
                        }`}
                      />
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        {/* Footer hints */}
        <div className="border-t border-border px-3 sm:px-4 h-9 flex items-center gap-3 sm:gap-4 text-[11px] text-muted-foreground bg-secondary/30 shrink-0">
          <span className="hidden sm:inline-flex items-center gap-1.5">
            <span className="inline-flex items-center gap-0.5">
              <ArrowUp className="size-3" />
              <ArrowDown className="size-3" />
            </span>
            navigate
          </span>
          <span className="hidden sm:inline-flex items-center gap-1.5">
            <CornerDownLeft className="size-3" />
            open
          </span>
          <span className="ml-auto font-mono tabular-nums">{results.length} results</span>
        </div>
      </div>
    </div>,
    document.body,
  );
}

