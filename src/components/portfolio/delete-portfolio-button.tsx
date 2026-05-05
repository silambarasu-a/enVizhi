"use client";

import { useTransition } from "react";
import { Trash2 } from "lucide-react";
import { deletePortfolio } from "@/app/(app)/portfolio/actions";

export function DeletePortfolioButton({ id, name }: { id: string; name: string }) {
  const [pending, startTransition] = useTransition();
  function onClick() {
    if (
      !confirm(
        `Delete "${name}"? All transactions in this portfolio will be removed. This can't be undone.`,
      )
    ) {
      return;
    }
    startTransition(async () => {
      await deletePortfolio(id);
    });
  }
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={pending}
      className="inline-flex items-center gap-1.5 h-9 px-3 rounded-lg text-[12px] text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors disabled:opacity-60"
    >
      <Trash2 className="size-3.5" />
      {pending ? "Deleting…" : "Delete portfolio"}
    </button>
  );
}
