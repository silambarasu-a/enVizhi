"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Bell } from "lucide-react";
import type { AlertType } from "@/generated/prisma/enums";
import { ALERT_TYPE_LABEL, ALERT_TYPE_UNIT } from "@/lib/alerts/evaluator";
import { createAlert } from "@/app/(app)/alerts/actions";

const TYPES: AlertType[] = ["PRICE_ABOVE", "PRICE_BELOW", "PE_BELOW", "PEG_BELOW", "MOVE_PCT"];

export function CreateAlertForm({
  symbol,
  currentPrice,
  currency,
}: {
  symbol: string;
  currentPrice: number | null;
  currency: string;
}) {
  const router = useRouter();
  const [type, setType] = useState<AlertType>("PRICE_ABOVE");
  const [threshold, setThreshold] = useState<string>("");
  const [rearm, setRearm] = useState<string>("0");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const t = Number(threshold);
    if (!Number.isFinite(t)) {
      setError("Threshold must be a number");
      return;
    }
    const fd = new FormData(e.currentTarget);
    startTransition(async () => {
      const res = await createAlert(fd);
      if (res?.error) {
        setError(res.error);
        return;
      }
      setThreshold("");
      router.refresh();
    });
  }

  const placeholder = (() => {
    if (type === "PRICE_ABOVE" || type === "PRICE_BELOW") {
      return currentPrice != null
        ? `e.g. ${(currentPrice * (type === "PRICE_ABOVE" ? 1.1 : 0.9)).toFixed(2)}`
        : "e.g. 250";
    }
    if (type === "MOVE_PCT") return "e.g. 5";
    if (type === "PE_BELOW") return "e.g. 20";
    return "e.g. 1";
  })();

  return (
    <form onSubmit={onSubmit} className="grid gap-3 sm:grid-cols-[1fr_1fr_120px_auto]">
      <input type="hidden" name="symbol" value={symbol} />
      <label className="block">
        <span className="block text-[11px] font-medium text-muted-foreground mb-1">Type</span>
        <select
          name="type"
          value={type}
          onChange={(e) => setType(e.target.value as AlertType)}
          className="w-full h-10 rounded-lg border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          {TYPES.map((t) => (
            <option key={t} value={t}>
              {ALERT_TYPE_LABEL[t]}
            </option>
          ))}
        </select>
      </label>

      <label className="block">
        <span className="block text-[11px] font-medium text-muted-foreground mb-1">
          Threshold {ALERT_TYPE_UNIT[type] ? `(${ALERT_TYPE_UNIT[type]})` : currency ? `(${currency})` : ""}
        </span>
        <input
          type="number"
          name="threshold"
          step="any"
          required
          value={threshold}
          onChange={(e) => setThreshold(e.target.value)}
          placeholder={placeholder}
          className="w-full h-10 rounded-lg border border-input bg-background px-3 text-sm font-mono tabular-nums placeholder:text-muted-foreground/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />
      </label>

      <label className="block">
        <span className="block text-[11px] font-medium text-muted-foreground mb-1">
          Re-arm (h)
        </span>
        <input
          type="number"
          name="rearmAfterHours"
          min={0}
          step={1}
          value={rearm}
          onChange={(e) => setRearm(e.target.value)}
          className="w-full h-10 rounded-lg border border-input bg-background px-3 text-sm font-mono tabular-nums focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          title="Hours before this alert can fire again. 0 = one-shot (auto-disable after firing)."
        />
      </label>

      <button
        type="submit"
        disabled={pending}
        className="h-10 px-4 inline-flex items-center justify-center gap-1.5 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 transition-opacity self-end disabled:opacity-60"
      >
        <Bell className="size-3.5" />
        {pending ? "Adding…" : "Add alert"}
      </button>

      {error ? (
        <p className="sm:col-span-4 text-xs text-destructive">{error}</p>
      ) : null}
    </form>
  );
}
