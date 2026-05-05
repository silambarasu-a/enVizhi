"use client";

import Link from "next/link";
import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Trash2, Power } from "lucide-react";
import type { AlertType } from "@/generated/prisma/enums";
import { ALERT_TYPE_LABEL, ALERT_TYPE_UNIT } from "@/lib/alerts/evaluator";
import { deleteAlert, toggleAlert } from "@/app/(app)/alerts/actions";

interface AlertRowData {
  id: string;
  type: AlertType;
  threshold: number;
  isActive: boolean;
  triggeredAt: string | null;
  symbol: string;
  stockName: string;
  currency: string;
}

export function AlertRow({ a }: { a: AlertRowData }) {
  const router = useRouter();
  const [, startTransition] = useTransition();

  function onDelete() {
    if (!confirm(`Delete alert: ${a.symbol} ${ALERT_TYPE_LABEL[a.type]} ${formatValue(a.threshold, a.type, a.currency)}?`)) return;
    startTransition(async () => {
      await deleteAlert(a.id);
      router.refresh();
    });
  }
  function onToggle() {
    startTransition(async () => {
      await toggleAlert(a.id);
      router.refresh();
    });
  }

  return (
    <li className="flex items-center justify-between gap-4 px-5 py-3 border-b border-border/60 last:border-0 hover:bg-secondary/30 transition-colors">
      <div className="flex items-center gap-4 min-w-0">
        <span
          className={`size-2 rounded-full shrink-0 ${
            a.isActive
              ? a.triggeredAt
                ? "bg-emerald-500"
                : "bg-primary"
              : "bg-muted-foreground/40"
          }`}
          aria-label={a.isActive ? "active" : "paused"}
        />
        <div className="min-w-0">
          <Link
            href={`/stock/${encodeURIComponent(a.symbol)}`}
            className="font-mono text-sm hover:text-primary transition-colors"
          >
            {a.symbol}
          </Link>
          <span className="text-xs text-muted-foreground ml-2">{a.stockName}</span>
        </div>
      </div>

      <div className="text-right shrink-0">
        <div className="text-[13px]">
          <span className="text-muted-foreground">{ALERT_TYPE_LABEL[a.type]}</span>{" "}
          <span className="font-mono tabular-nums">{formatValue(a.threshold, a.type, a.currency)}</span>
        </div>
        <div className="text-[11px] text-muted-foreground mt-0.5">
          {a.triggeredAt
            ? `Last fired ${new Date(a.triggeredAt).toLocaleString()}`
            : a.isActive
            ? "Watching"
            : "Paused"}
        </div>
      </div>

      <div className="flex items-center gap-1 shrink-0">
        <button
          type="button"
          onClick={onToggle}
          aria-label={a.isActive ? "Pause" : "Resume"}
          title={a.isActive ? "Pause alert" : "Resume alert"}
          className="size-8 inline-flex items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
        >
          <Power className="size-3.5" />
        </button>
        <button
          type="button"
          onClick={onDelete}
          aria-label="Delete alert"
          className="size-8 inline-flex items-center justify-center rounded-md text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
        >
          <Trash2 className="size-3.5" />
        </button>
      </div>
    </li>
  );
}

function formatValue(v: number, type: AlertType, currency: string): string {
  if (type === "PRICE_ABOVE" || type === "PRICE_BELOW") {
    return new Intl.NumberFormat(currency === "INR" ? "en-IN" : "en-US", {
      style: "currency",
      currency,
      maximumFractionDigits: 2,
    }).format(v);
  }
  if (type === "MOVE_PCT") return `${v >= 0 ? "+" : ""}${v.toFixed(2)}%`;
  return `${v.toFixed(2)}${ALERT_TYPE_UNIT[type]}`;
}
