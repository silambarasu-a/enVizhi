"use client";

import { useState, useTransition } from "react";
import { Check } from "lucide-react";
import { setPassword } from "@/app/(auth)/actions";

export function PasswordForm({ hasPassword }: { hasPassword: boolean }) {
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    const fd = new FormData(e.currentTarget);
    startTransition(async () => {
      const res = await setPassword(fd);
      if (res?.error) {
        setError(res.error);
      } else if (res?.message) {
        setSuccess(res.message);
        e.currentTarget.reset();
      }
    });
  }

  return (
    <form onSubmit={onSubmit} className="space-y-3 max-w-md">
      {hasPassword ? (
        <Field label="Current password">
          <input
            type="password"
            name="currentPassword"
            required
            autoComplete="current-password"
            className="w-full h-10 rounded-lg border border-input bg-background px-3.5 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:border-ring transition-colors"
          />
        </Field>
      ) : null}
      <Field label="New password">
        <input
          type="password"
          name="newPassword"
          required
          minLength={8}
          autoComplete="new-password"
          placeholder="At least 8 characters"
          className="w-full h-10 rounded-lg border border-input bg-background px-3.5 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:border-ring transition-colors"
        />
      </Field>
      <Field label="Confirm new password">
        <input
          type="password"
          name="confirmPassword"
          required
          minLength={8}
          autoComplete="new-password"
          className="w-full h-10 rounded-lg border border-input bg-background px-3.5 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:border-ring transition-colors"
        />
      </Field>

      <button
        type="submit"
        disabled={pending}
        className="h-10 px-4 inline-flex items-center justify-center rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-60"
      >
        {pending ? "Saving…" : hasPassword ? "Update password" : "Set password"}
      </button>

      {success ? (
        <p className="text-sm text-emerald-700 dark:text-emerald-400 inline-flex items-center gap-1.5">
          <Check className="size-3.5" />
          {success}
        </p>
      ) : null}
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
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
