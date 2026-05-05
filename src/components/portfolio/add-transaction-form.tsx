"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import type { TransactionType } from "@/generated/prisma/enums";
import { addTransaction } from "@/app/(app)/portfolio/actions";

interface StockOption {
  symbol: string;
  name: string;
}

export function AddTransactionForm({
  portfolioId,
  stocks,
}: {
  portfolioId: string;
  stocks: StockOption[];
}) {
  const router = useRouter();
  const [type, setType] = useState<TransactionType>("BUY");
  const [symbol, setSymbol] = useState("");
  const [quantity, setQuantity] = useState("");
  const [price, setPrice] = useState("");
  const [fees, setFees] = useState("0");
  const [executedAt, setExecutedAt] = useState(() => new Date().toISOString().slice(0, 10));
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const fd = new FormData(e.currentTarget);
    startTransition(async () => {
      const res = await addTransaction(fd);
      if (res?.error) {
        setError(res.error);
        return;
      }
      // Reset and refresh.
      setSymbol("");
      setQuantity("");
      setPrice("");
      setFees("0");
      setNote("");
      router.refresh();
    });
  }

  return (
    <form onSubmit={onSubmit} className="space-y-3">
      <input type="hidden" name="portfolioId" value={portfolioId} />

      <div className="grid grid-cols-2 sm:grid-cols-6 gap-3">
        <Field label="Type">
          <select
            name="type"
            value={type}
            onChange={(e) => setType(e.target.value as TransactionType)}
            className="w-full h-10 rounded-lg border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <option value="BUY">Buy</option>
            <option value="SELL">Sell</option>
          </select>
        </Field>

        <Field label="Symbol" className="col-span-2 sm:col-span-1">
          <input
            type="text"
            name="symbol"
            list="symbol-list"
            required
            value={symbol}
            onChange={(e) => setSymbol(e.target.value.toUpperCase())}
            placeholder="AAPL"
            className="w-full h-10 rounded-lg border border-input bg-background px-3 text-sm font-mono uppercase placeholder:text-muted-foreground/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
          <datalist id="symbol-list">
            {stocks.map((s) => (
              <option key={s.symbol} value={s.symbol}>
                {s.name}
              </option>
            ))}
          </datalist>
        </Field>

        <Field label="Quantity">
          <input
            type="number"
            name="quantity"
            step="any"
            min={0}
            required
            value={quantity}
            onChange={(e) => setQuantity(e.target.value)}
            className="w-full h-10 rounded-lg border border-input bg-background px-3 text-sm font-mono tabular-nums focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
        </Field>

        <Field label="Price">
          <input
            type="number"
            name="price"
            step="any"
            min={0}
            required
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            className="w-full h-10 rounded-lg border border-input bg-background px-3 text-sm font-mono tabular-nums focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
        </Field>

        <Field label="Fees">
          <input
            type="number"
            name="fees"
            step="any"
            min={0}
            value={fees}
            onChange={(e) => setFees(e.target.value)}
            className="w-full h-10 rounded-lg border border-input bg-background px-3 text-sm font-mono tabular-nums focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
        </Field>

        <Field label="Date">
          <input
            type="date"
            name="executedAt"
            value={executedAt}
            onChange={(e) => setExecutedAt(e.target.value)}
            className="w-full h-10 rounded-lg border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
        </Field>
      </div>

      <div className="flex gap-3 items-end">
        <Field label="Note (optional)" className="flex-1">
          <input
            type="text"
            name="note"
            maxLength={140}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Why this trade?"
            className="w-full h-10 rounded-lg border border-input bg-background px-3 text-sm placeholder:text-muted-foreground/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
        </Field>
        <button
          type="submit"
          disabled={pending}
          className="h-10 px-4 inline-flex items-center justify-center gap-1.5 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-60"
        >
          <Plus className="size-3.5" />
          {pending ? "Adding…" : "Add transaction"}
        </button>
      </div>

      {error ? <p className="text-xs text-destructive">{error}</p> : null}
    </form>
  );
}

function Field({
  label,
  className,
  children,
}: {
  label: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <label className={`block ${className ?? ""}`}>
      <span className="block text-[11px] font-medium text-muted-foreground mb-1">{label}</span>
      {children}
    </label>
  );
}
