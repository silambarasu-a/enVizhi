"use client";

import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { useState, useTransition } from "react";
import { ChevronDown, X } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  NUMERIC_FIELDS,
  EXCHANGES,
  LYNCH_CATEGORIES,
  LYNCH_LABEL,
  type NumericFieldId,
  type ExchangeId,
  type LynchCategoryId,
} from "@/lib/screener/fields";
import { filterFromSearchParams, filterToSearchParams } from "@/lib/screener/dsl";

const GROUPS = ["Valuation", "Growth", "Quality", "Risk"] as const;

export function FilterControls({ sectors }: { sectors: string[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [, startTransition] = useTransition();
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({
    Markets: true,
    Lynch: true,
    Valuation: true,
    Growth: false,
    Quality: false,
    Risk: false,
  });

  const filter = filterFromSearchParams(Object.fromEntries(searchParams.entries()));

  function commit(next: typeof filter) {
    const sp = filterToSearchParams(next);
    startTransition(() => {
      router.replace(`${pathname}?${sp.toString()}`, { scroll: false });
    });
  }

  function setRange(id: NumericFieldId, key: "min" | "max", value: string) {
    const v = value.trim();
    const next = { ...filter, ranges: { ...filter.ranges }, page: 1 };
    const cur = { ...(next.ranges[id] ?? {}) };
    if (v === "") {
      delete cur[key];
    } else {
      const n = Number(v);
      if (Number.isFinite(n)) cur[key] = n;
    }
    if (cur.min == null && cur.max == null) {
      delete next.ranges[id];
    } else {
      next.ranges[id] = cur;
    }
    commit(next);
  }

  function toggleExchange(ex: ExchangeId) {
    const set = new Set(filter.exchanges);
    if (set.has(ex)) set.delete(ex);
    else set.add(ex);
    commit({ ...filter, exchanges: [...set] as ExchangeId[], page: 1 });
  }

  function toggleLynch(cat: LynchCategoryId) {
    const set = new Set(filter.lynchCategories);
    if (set.has(cat)) set.delete(cat);
    else set.add(cat);
    commit({ ...filter, lynchCategories: [...set] as LynchCategoryId[], page: 1 });
  }

  function setSector(s: string | null) {
    const sectors = s ? [s] : [];
    commit({ ...filter, sectors, page: 1 });
  }

  function clearAll() {
    commit({
      ranges: {},
      exchanges: [],
      sectors: [],
      lynchCategories: [],
      sort: "symbol",
      dir: "asc",
      page: 1,
      pageSize: 50,
    });
  }

  const activeRangeCount = Object.keys(filter.ranges ?? {}).length;
  const activeFilterCount =
    activeRangeCount +
    (filter.exchanges.length ? 1 : 0) +
    (filter.sectors.length ? 1 : 0) +
    (filter.lynchCategories.length ? 1 : 0);

  return (
    <aside className="space-y-1">
      <div className="px-1 mb-3 flex items-center justify-between">
        <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
          Filters
          {activeFilterCount > 0 ? (
            <span className="ml-2 text-primary">· {activeFilterCount}</span>
          ) : null}
        </span>
        {activeFilterCount > 0 ? (
          <button
            type="button"
            onClick={clearAll}
            className="text-[11px] text-muted-foreground hover:text-foreground transition-colors inline-flex items-center gap-1"
          >
            <X className="size-3" />
            Clear all
          </button>
        ) : null}
      </div>

      {/* Markets */}
      <FilterGroup
        label="Markets"
        open={openGroups.Markets ?? true}
        onToggle={() =>
          setOpenGroups({ ...openGroups, Markets: !(openGroups.Markets ?? true) })
        }
      >
        <div className="grid grid-cols-2 gap-1.5">
          {EXCHANGES.map((ex) => {
            const on = filter.exchanges.includes(ex);
            return (
              <button
                key={ex}
                type="button"
                onClick={() => toggleExchange(ex)}
                className={cn(
                  "h-8 px-2 rounded-md text-xs font-mono border transition-colors",
                  on
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-border bg-card text-muted-foreground hover:text-foreground hover:bg-secondary",
                )}
              >
                {ex}
              </button>
            );
          })}
        </div>

        {sectors.length > 0 ? (
          <label className="block mt-3" key="sector-block">
            <span className="block text-[11px] text-muted-foreground mb-1.5">Sector</span>
            <select
              className="w-full h-8 rounded-md border border-border bg-card text-xs px-2 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              value={filter.sectors[0] ?? ""}
              onChange={(e) => setSector(e.target.value || null)}
            >
              <option value="">All sectors</option>
              {sectors.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </label>
        ) : null}
      </FilterGroup>

      {/* Lynch */}
      <FilterGroup
        label="Lynch category"
        open={openGroups.Lynch ?? true}
        onToggle={() => setOpenGroups({ ...openGroups, Lynch: !(openGroups.Lynch ?? true) })}
      >
        <div className="grid grid-cols-2 gap-1.5">
          {LYNCH_CATEGORIES.map((cat) => {
            const on = filter.lynchCategories.includes(cat);
            return (
              <button
                key={cat}
                type="button"
                onClick={() => toggleLynch(cat)}
                className={cn(
                  "h-8 px-2 rounded-md text-[11px] border transition-colors text-left",
                  on
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-border bg-card text-muted-foreground hover:text-foreground hover:bg-secondary",
                )}
              >
                {LYNCH_LABEL[cat]}
              </button>
            );
          })}
        </div>
      </FilterGroup>

      {GROUPS.map((g) => (
        <FilterGroup
          key={g}
          label={g}
          open={openGroups[g] ?? false}
          onToggle={() => setOpenGroups({ ...openGroups, [g]: !(openGroups[g] ?? false) })}
        >
          <div className="space-y-3">
            {NUMERIC_FIELDS.filter((f) => f.group === g).map((f) => {
              const range = filter.ranges[f.id] ?? {};
              return (
                <div key={f.id}>
                  <div className="flex items-baseline justify-between">
                    <label className="text-[12px] font-medium">{f.label}</label>
                    {f.unit ? (
                      <span className="text-[10px] text-muted-foreground font-mono">{f.unit}</span>
                    ) : null}
                  </div>
                  <div className="mt-1.5 grid grid-cols-2 gap-1.5">
                    <RangeInput
                      placeholder="Min"
                      value={range.min ?? ""}
                      onChange={(v) => setRange(f.id, "min", v)}
                      step={f.step}
                    />
                    <RangeInput
                      placeholder="Max"
                      value={range.max ?? ""}
                      onChange={(v) => setRange(f.id, "max", v)}
                      step={f.step}
                    />
                  </div>
                  {f.hint ? (
                    <p className="mt-1 text-[10px] text-muted-foreground/80 leading-snug">
                      {f.hint}
                    </p>
                  ) : null}
                </div>
              );
            })}
          </div>
        </FilterGroup>
      ))}
    </aside>
  );
}

function FilterGroup({
  label,
  open,
  onToggle,
  children,
}: {
  label: string;
  open: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="border-t border-border first:border-t-0">
      <button
        type="button"
        onClick={onToggle}
        className="w-full px-1 h-9 flex items-center justify-between text-[11px] font-medium uppercase tracking-wider hover:text-primary transition-colors"
        aria-expanded={open}
      >
        {label}
        <ChevronDown
          className={cn("size-3.5 transition-transform", open ? "rotate-180" : "")}
        />
      </button>
      {open ? <div className="pb-4 pt-1">{children}</div> : null}
    </div>
  );
}

function RangeInput({
  placeholder,
  value,
  onChange,
  step,
}: {
  placeholder: string;
  value: number | string;
  onChange: (v: string) => void;
  step?: number;
}) {
  return (
    <input
      type="number"
      step={step ?? "any"}
      placeholder={placeholder}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="h-8 px-2 rounded-md border border-border bg-card text-xs font-mono tabular-nums placeholder:text-muted-foreground/60 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
    />
  );
}
