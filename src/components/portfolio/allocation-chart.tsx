"use client";

import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from "recharts";

interface Slice {
  symbol: string;
  value: number;
  pct: number;
}

const COLORS = [
  "var(--color-chart-1)",
  "var(--color-chart-2)",
  "var(--color-chart-3)",
  "var(--color-chart-4)",
  "var(--color-chart-5)",
  "#A855F7",
  "#14B8A6",
  "#F97316",
];

export function AllocationChart({
  slices,
  baseCurrency,
}: {
  slices: Slice[];
  baseCurrency: string;
}) {
  if (slices.length === 0) {
    return (
      <div className="h-full grid place-items-center text-sm text-muted-foreground">
        Allocation appears once you have open positions.
      </div>
    );
  }

  const fmt = new Intl.NumberFormat(baseCurrency === "INR" ? "en-IN" : "en-US", {
    style: "currency",
    currency: baseCurrency,
    maximumFractionDigits: 0,
  });

  return (
    <div className="grid grid-cols-[1fr_180px] gap-4 h-full items-center">
      <div className="h-44">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={slices}
              dataKey="value"
              nameKey="symbol"
              innerRadius="55%"
              outerRadius="100%"
              paddingAngle={1.5}
              stroke="var(--color-card)"
              strokeWidth={2}
            >
              {slices.map((_, i) => (
                <Cell key={i} fill={COLORS[i % COLORS.length]} />
              ))}
            </Pie>
            <Tooltip
              contentStyle={{
                background: "var(--color-popover)",
                border: "1px solid var(--color-border)",
                borderRadius: 8,
                fontSize: 12,
              }}
              formatter={(v) => [fmt.format(Number(v)), "Value"]}
            />
          </PieChart>
        </ResponsiveContainer>
      </div>

      <ul className="text-xs space-y-1.5">
        {slices.map((s, i) => (
          <li key={s.symbol} className="flex items-center gap-2">
            <span
              className="size-2.5 rounded-sm shrink-0"
              style={{ background: COLORS[i % COLORS.length] }}
            />
            <span className="font-mono flex-1 truncate">{s.symbol}</span>
            <span className="font-mono tabular-nums text-muted-foreground">
              {s.pct.toFixed(1)}%
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
