"use client";

import { useState, useTransition } from "react";
import { ArrowRight } from "lucide-react";
import { resetPassword } from "@/app/(auth)/actions";

export function ResetPasswordForm({ token }: { token: string }) {
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const fd = new FormData(e.currentTarget);
    startTransition(async () => {
      const res = await resetPassword(fd);
      if (res?.error) setError(res.error);
    });
  }

  return (
    <form onSubmit={onSubmit} className="space-y-3">
      <input type="hidden" name="token" value={token} />
      <Field label="New password">
        <input
          type="password"
          name="password"
          required
          minLength={8}
          autoComplete="new-password"
          autoFocus
          placeholder="At least 8 characters"
          className="w-full h-11 rounded-lg border border-input bg-background px-3.5 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:border-ring transition-colors"
        />
      </Field>
      <Field label="Confirm new password">
        <input
          type="password"
          name="confirmPassword"
          required
          minLength={8}
          autoComplete="new-password"
          placeholder="Repeat password"
          className="w-full h-11 rounded-lg border border-input bg-background px-3.5 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:border-ring transition-colors"
        />
      </Field>
      <button
        type="submit"
        disabled={pending}
        className="w-full h-11 inline-flex items-center justify-center gap-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 transition-opacity shadow-card disabled:opacity-60"
      >
        {pending ? "Updating…" : "Set new password"}
        <ArrowRight className="size-4" />
      </button>
      {error ? <p className="text-sm text-destructive text-center">{error}</p> : null}
    </form>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="block text-xs font-medium mb-1.5">{label}</span>
      {children}
    </label>
  );
}
