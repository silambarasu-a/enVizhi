"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight } from "lucide-react";
import { signUpWithPassword } from "@/app/(auth)/actions";

export function SignUpForm() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [redirectTo, setRedirectTo] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setRedirectTo(null);
    const fd = new FormData(e.currentTarget);
    startTransition(async () => {
      const res = await signUpWithPassword(fd);
      if (res?.error) {
        setError(res.error);
        if (res.redirectTo) setRedirectTo(res.redirectTo);
      }
    });
  }

  return (
    <form onSubmit={onSubmit} className="space-y-3">
      <Field label="Email">
        <input
          type="email"
          name="email"
          required
          autoComplete="email"
          autoFocus
          placeholder="you@example.com"
          className="w-full h-11 rounded-lg border border-input bg-background px-3.5 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:border-ring transition-colors"
        />
      </Field>
      <Field label="Password">
        <input
          type="password"
          name="password"
          required
          minLength={8}
          autoComplete="new-password"
          placeholder="At least 8 characters"
          className="w-full h-11 rounded-lg border border-input bg-background px-3.5 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:border-ring transition-colors"
        />
      </Field>
      <Field label="Confirm password">
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
        {pending ? "Creating…" : "Create account"}
        <ArrowRight className="size-4" />
      </button>
      {error ? (
        <div className="text-center space-y-2">
          <p className="text-sm text-destructive">{error}</p>
          {redirectTo ? (
            <button
              type="button"
              onClick={() => router.push(redirectTo)}
              className="text-xs text-primary hover:underline underline-offset-4"
            >
              Go to sign in →
            </button>
          ) : null}
        </div>
      ) : null}
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
