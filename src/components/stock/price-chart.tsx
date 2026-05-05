"use client";

import { useMemo, useState } from "react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";

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

export function PriceChart({
  bars,
  currency,
}: {
  bars: Bar[];
  currency: string;
}) {
  const [range, setRange] = useState<Range>("1y");

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

  return (
    <div className="rounded-2xl border border-border bg-card shadow-card overflow-hidden">
      <div className="flex items-center justify-between px-5 pt-5">
        <div>
          <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
            Price
          </div>
          <div className="text-sm font-medium mt-1">
            {RANGE_LABEL[range]} chart
          </div>
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

      <div className="h-72 px-2 pb-3 pt-4">
        {filtered.length === 0 ? (
          <div className="h-full grid place-items-center text-sm text-muted-foreground">
            No price history available.
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={filtered} margin={{ top: 4, right: 12, left: 0, bottom: 0 }}>
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
                contentStyle={{
                  background: "var(--color-popover)",
                  border: "1px solid var(--color-border)",
                  borderRadius: 8,
                  fontSize: 12,
                }}
                labelFormatter={(v) => fmtDate.format(new Date(String(v)))}
                formatter={(v) => [fmtCcy.format(Number(v)), "Close"]}
              />
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
