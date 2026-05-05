"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import type { MarketsRegion } from "@/generated/prisma/enums";
import { updateMarketsRegion } from "@/app/(app)/dashboard/actions";

const REGIONS: Array<{ id: MarketsRegion; flag: string; label: string }> = [
  { id: "US", flag: "🇺🇸", label: "US" },
  { id: "IN", flag: "🇮🇳", label: "India" },
];

export function MarketsRegionToggle({ current }: { current: MarketsRegion }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function pick(region: MarketsRegion) {
    if (region === current || pending) return;
    const fd = new FormData();
    fd.set("region", region);
    startTransition(async () => {
      await updateMarketsRegion(fd);
      router.refresh();
    });
  }

  return (
    <div
      className="inline-flex items-center gap-0.5 rounded-lg bg-secondary p-0.5"
      role="tablist"
      aria-label="Markets region"
    >
      {REGIONS.map((r) => {
        const active = r.id === current;
        return (
          <button
            key={r.id}
            type="button"
            role="tab"
            aria-selected={active}
            disabled={pending}
            onClick={() => pick(r.id)}
            className={`h-7 px-2.5 inline-flex items-center gap-1.5 rounded-md text-[11px] font-medium transition-colors disabled:opacity-60 ${
              active
                ? "bg-card text-foreground shadow-card"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <span aria-hidden>{r.flag}</span>
            {r.label}
          </button>
        );
      })}
    </div>
  );
}
