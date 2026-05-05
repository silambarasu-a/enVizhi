"use client";

import { useMemo, useState, useRef } from "react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  ReferenceArea,
} from "recharts";
import { X } from "lucide-react";

interface Bar {
  date: string;
  close: number;
}

const RANGES = ["1mo", "3mo", "6mo", "1y", "5y"] as const;
type Range = (typeof RANGES)[number];

const RANGE_LABEL: Record<Range, string> = {
  "1mo": "1M",
  "3mo": "3M",
  "6mo": "6M",
  "1y": "1Y",
  "5y": "5Y",
};

// Recharts' callback shape — we only care about the active tooltip index, which
// it exposes either as `activeTooltipIndex` or sometimes as a string label.
interface ChartMouseEvent {
  activeTooltipIndex?: number | string | null;
  activeLabel?: string | null;
}

export function PriceChart({
  bars,
  currency,
}: {
  bars: Bar[];
  currency: string;
}) {
  const [range, setRange] = useState<Range>("1y");
  // Click-drag range-selection state. Indices into `filtered`.
  const [selStart, setSelStart] = useState<number | null>(null);
  const [selEnd, setSelEnd] = useState<number | null>(null);
  const isDraggingRef = useRef(false);

  const filtered = useMemo(() => {
    if (bars.length === 0) return [];
    const now = Date.now();
    const cutoff = (() => {
      switch (range) {
        case "1mo":
          return now - 30 * 24 * 3600 * 1000;
        case "3mo":
          return now - 91 * 24 * 3600 * 1000;
        case "6mo":
          return now - 183 * 24 * 3600 * 1000;
        case "1y":
          return now - 365 * 24 * 3600 * 1000;
        case "5y":
          return now - 365 * 5 * 24 * 3600 * 1000;
      }
    })();
    return bars.filter((b) => new Date(b.date).getTime() >= cutoff);
  }, [bars, range]);

  // Reset any active selection when the range changes (indices would be stale).
  useMemo(() => {
    setSelStart(null);
    setSelEnd(null);
    isDraggingRef.current = false;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [range]);

  const fmtCcy = useMemo(
    () =>
      new Intl.NumberFormat(currency === "INR" ? "en-IN" : "en-US", {
        style: "currency",
        currency,
        maximumFractionDigits: 2,
      }),
    [currency],
  );

  const fmtDate = useMemo(
    () =>
      new Intl.DateTimeFormat("en-US", {
        month: "short",
        day: "numeric",
        year: range === "5y" ? "numeric" : undefined,
      }),
    [range],
  );

  const isUp =
    filtered.length >= 2 &&
    filtered[filtered.length - 1]!.close >= filtered[0]!.close;
  const stroke = isUp ? "var(--color-chart-2)" : "var(--color-chart-4)";

  // Compute the selection overlay state (dates + return %) only when a real
  // drag has produced a non-trivial range.
  const selection = useMemo(() => {
    if (selStart == null || selEnd == null) return null;
    const lo = Math.min(selStart, selEnd);
    const hi = Math.max(selStart, selEnd);
    if (lo === hi) return null;
    const startBar = filtered[lo];
    const endBar = filtered[hi];
    if (!startBar || !endBar || startBar.close <= 0) return null;
    const absChange = endBar.close - startBar.close;
    const pctChange = (absChange / startBar.close) * 100;
    return {
      startDate: startBar.date,
      endDate: endBar.date,
      startPrice: startBar.close,
      endPrice: endBar.close,
      absChange,
      pctChange,
      isUp: absChange >= 0,
    };
  }, [selStart, selEnd, filtered]);

  function indexFromEvent(e: ChartMouseEvent | null): number | null {
    if (!e) return null;
    const raw = e.activeTooltipIndex;
    if (raw == null) return null;
    const n = typeof raw === "number" ? raw : Number(raw);
    return Number.isFinite(n) ? n : null;
  }

  function handleMouseDown(e: unknown) {
    const idx = indexFromEvent(e as ChartMouseEvent | null);
    if (idx == null) return;
    isDraggingRef.current = true;
    setSelStart(idx);
    setSelEnd(idx);
  }

  function handleMouseMove(e: unknown) {
    if (!isDraggingRef.current) return;
    const idx = indexFromEvent(e as ChartMouseEvent | null);
    if (idx == null) return;
    setSelEnd(idx);
  }

  function handleMouseUp() {
    isDraggingRef.current = false;
    // If start and end converged (a plain click, not a drag), clear selection.
    if (selStart != null && selEnd != null && selStart === selEnd) {
      setSelStart(null);
      setSelEnd(null);
    }
  }

  function handleMouseLeave() {
    // End the drag so it doesn't continue if the user re-enters the chart.
    isDraggingRef.current = false;
  }

  function clearSelection() {
    setSelStart(null);
    setSelEnd(null);
    isDraggingRef.current = false;
  }

  const selStartDate = selection?.startDate ?? null;
  const selEndDate = selection?.endDate ?? null;

  return (
    <div className="rounded-2xl border border-border bg-card shadow-card overflow-hidden">
      <div className="flex items-center justify-between px-5 pt-5">
        <div>
          <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
            Price
          </div>
          <div className="text-sm font-medium mt-1">{RANGE_LABEL[range]} chart</div>
        </div>
        <div className="inline-flex items-center gap-0.5 rounded-lg bg-secondary p-0.5">
          {RANGES.map((r) => (
            <button
              key={r}
              type="button"
              onClick={() => setRange(r)}
              className={`h-7 px-2.5 rounded-md text-[11px] font-mono transition-colors ${
                range === r
                  ? "bg-card text-foreground shadow-card"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {RANGE_LABEL[r]}
            </button>
          ))}
        </div>
      </div>

      {/* Selection summary — appears above the chart when a range is selected. */}
      {selection ? (
        <div className="mx-5 mt-4 rounded-lg border border-primary/30 bg-primary/5 px-4 py-2.5 flex items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-3 min-w-0 flex-wrap">
            <span className="font-mono text-muted-foreground">
              {fmtDate.format(new Date(selection.startDate))} →{" "}
              {fmtDate.format(new Date(selection.endDate))}
            </span>
            <span className="text-muted-foreground hidden sm:inline">·</span>
            <span className="font-mono tabular-nums">
              {fmtCcy.format(selection.startPrice)} →{" "}
              {fmtCcy.format(selection.endPrice)}
            </span>
          </div>
          <div className="flex items-center gap-3 shrink-0">
            <span
              className={`font-mono tabular-nums font-medium ${
                selection.isUp
                  ? "text-emerald-600 dark:text-emerald-400"
                  : "text-rose-600 dark:text-rose-400"
              }`}
            >
              {selection.isUp ? "+" : ""}
              {selection.pctChange.toFixed(2)}%
            </span>
            <span
              className={`font-mono tabular-nums text-[11px] hidden md:inline ${
                selection.isUp
                  ? "text-emerald-600 dark:text-emerald-400"
                  : "text-rose-600 dark:text-rose-400"
              }`}
            >
              ({selection.isUp ? "+" : ""}
              {fmtCcy.format(selection.absChange)})
            </span>
            <button
              type="button"
              onClick={clearSelection}
              aria-label="Clear selection"
              className="size-6 inline-flex items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
            >
              <X className="size-3.5" />
            </button>
          </div>
        </div>
      ) : filtered.length > 1 ? (
        <p className="mx-5 mt-3 text-[11px] text-muted-foreground">
          Tip: click and drag across the chart to measure return between two dates.
        </p>
      ) : null}

      <div className="h-72 px-2 pb-3 pt-4 select-none" style={{ cursor: filtered.length > 1 ? "crosshair" : "default" }}>
        {filtered.length === 0 ? (
          <div className="h-full grid place-items-center text-sm text-muted-foreground">
            No price history available.
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart
              data={filtered}
              margin={{ top: 4, right: 12, left: 0, bottom: 0 }}
              onMouseDown={handleMouseDown}
              onMouseMove={handleMouseMove}
              onMouseUp={handleMouseUp}
              onMouseLeave={handleMouseLeave}
            >
              <defs>
                <linearGradient id="priceFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={stroke} stopOpacity={0.18} />
                  <stop offset="100%" stopColor={stroke} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} />
              <XAxis
                dataKey="date"
                tickFormatter={(v: string) => fmtDate.format(new Date(v))}
                stroke="var(--color-muted-foreground)"
                tick={{ fontSize: 10 }}
                axisLine={false}
                tickLine={false}
                minTickGap={40}
              />
              <YAxis
                domain={["auto", "auto"]}
                stroke="var(--color-muted-foreground)"
                tick={{ fontSize: 10 }}
                axisLine={false}
                tickLine={false}
                width={64}
                tickFormatter={(v: number) => fmtCcy.format(v)}
              />
              <Tooltip
                // Suppress the regular hover tooltip while a drag is in flight —
                // the selection summary above already shows the relevant data.
                wrapperStyle={isDraggingRef.current ? { display: "none" } : undefined}
                contentStyle={{
                  background: "var(--color-popover)",
                  border: "1px solid var(--color-border)",
                  borderRadius: 8,
                  fontSize: 12,
                }}
                labelFormatter={(v) => fmtDate.format(new Date(String(v)))}
                formatter={(v) => [fmtCcy.format(Number(v)), "Close"]}
              />
              {selStartDate && selEndDate ? (
                <ReferenceArea
                  x1={selStartDate}
                  x2={selEndDate}
                  fill="var(--color-primary)"
                  fillOpacity={0.12}
                  stroke="var(--color-primary)"
                  strokeOpacity={0.4}
                />
              ) : null}
              <Area
                type="monotone"
                dataKey="close"
                stroke={stroke}
                strokeWidth={1.75}
                fill="url(#priceFill)"
              />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}
