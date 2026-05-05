"use client";

import { useState, useTransition } from "react";
import { Plus } from "lucide-react";
import { createPortfolio } from "@/app/(app)/portfolio/actions";

export function CreatePortfolioForm() {
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const fd = new FormData(e.currentTarget);
    startTransition(async () => {
      const res = await createPortfolio(fd);
      if (res?.error) setError(res.error);
    });
  }

  return (
    <form onSubmit={onSubmit} className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-[1fr_140px_180px_auto]">
        <label className="block">
          <span className="block text-[11px] font-medium text-muted-foreground mb-1">Name</span>
          <input
            type="text"
            name="name"
            required
            maxLength={64}
            placeholder="e.g. Long-term India bucket"
            className="w-full h-10 rounded-lg border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
        </label>

        <label className="block">
          <span className="block text-[11px] font-medium text-muted-foreground mb-1">
            Base currency
          </span>
          <select
            name="baseCurrency"
            defaultValue="USD"
            className="w-full h-10 rounded-lg border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <option value="USD">USD</option>
            <option value="INR">INR</option>
          </select>
        </label>

        <label className="block">
          <span className="block text-[11px] font-medium text-muted-foreground mb-1">
            Benchmark
          </span>
          <select
            name="benchmark"
            defaultValue="^GSPC"
            className="w-full h-10 rounded-lg border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <option value="^GSPC">S&P 500</option>
            <option value="^NSEI">NIFTY 50</option>
          </select>
        </label>

        <button
          type="submit"
          disabled={pending}
          className="h-10 px-4 inline-flex items-center justify-center gap-1.5 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 transition-opacity self-end disabled:opacity-60"
        >
          <Plus className="size-3.5" />
          {pending ? "Creating…" : "Create"}
        </button>
      </div>

      {error ? <p className="text-xs text-destructive">{error}</p> : null}
    </form>
  );
}
