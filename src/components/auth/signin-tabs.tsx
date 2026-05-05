"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { ArrowRight, Mail } from "lucide-react";
import { signInWithPassword, signInWithMagicLink } from "@/app/(auth)/actions";
import { cn } from "@/lib/utils";

type Tab = "password" | "magic";

export function SignInTabs({
  callbackUrl,
  initialError,
  initialEmail,
}: {
  callbackUrl: string;
  initialError?: string;
  initialEmail?: string;
}) {
  const [tab, setTab] = useState<Tab>("password");
  const [error, setError] = useState<string | null>(initialError ?? null);
  const [magicSent, setMagicSent] = useState(false);
  const [pending, startTransition] = useTransition();

  function onPassword(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const fd = new FormData(e.currentTarget);
    startTransition(async () => {
      const res = await signInWithPassword(fd);
      if (res?.error) setError(res.error);
    });
  }

  function onMagic(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const fd = new FormData(e.currentTarget);
    startTransition(async () => {
      try {
        await signInWithMagicLink(fd);
        setMagicSent(true);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Could not send magic link");
      }
    });
  }

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 rounded-lg border border-border bg-secondary/40 p-0.5">
        <TabButton active={tab === "password"} onClick={() => setTab("password")}>
          Password
        </TabButton>
        <TabButton active={tab === "magic"} onClick={() => setTab("magic")}>
          Magic link
        </TabButton>
      </div>

      {tab === "password" ? (
        <form onSubmit={onPassword} className="space-y-3">
          <input type="hidden" name="redirectTo" value={callbackUrl} />
          <Field label="Email">
            <input
              type="email"
              name="email"
              required
              autoComplete="email"
              autoFocus
              defaultValue={initialEmail}
              placeholder="you@example.com"
              className="w-full h-11 rounded-lg border border-input bg-background px-3.5 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:border-ring transition-colors"
            />
          </Field>
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="block text-xs font-medium">Password</span>
              <Link
                href="/forgot-password"
                className="text-[11px] text-muted-foreground hover:text-foreground transition-colors"
              >
                Forgot?
              </Link>
            </div>
            <input
              type="password"
              name="password"
              required
              autoComplete="current-password"
              placeholder="••••••••"
              className="w-full h-11 rounded-lg border border-input bg-background px-3.5 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:border-ring transition-colors"
            />
          </div>
          <button
            type="submit"
            disabled={pending}
            className="w-full h-11 inline-flex items-center justify-center gap-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 transition-opacity shadow-card disabled:opacity-60"
          >
            {pending ? "Signing in…" : "Sign in"}
            <ArrowRight className="size-4" />
          </button>
        </form>
      ) : (
        <form onSubmit={onMagic} className="space-y-3">
          <input type="hidden" name="redirectTo" value={callbackUrl} />
          <Field label="Email">
            <input
              type="email"
              name="email"
              required
              autoComplete="email"
              autoFocus
              defaultValue={initialEmail}
              placeholder="you@example.com"
              className="w-full h-11 rounded-lg border border-input bg-background px-3.5 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:border-ring transition-colors"
            />
          </Field>
          <button
            type="submit"
            disabled={pending || magicSent}
            className="w-full h-11 inline-flex items-center justify-center gap-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 transition-opacity shadow-card disabled:opacity-60"
          >
            <Mail className="size-4" />
            {magicSent ? "Check your inbox" : pending ? "Sending…" : "Send magic link"}
          </button>
          <p className="text-xs text-muted-foreground text-center">
            We&apos;ll email you a one-time link — expires in 24 hours.
          </p>
        </form>
      )}

      {error ? (
        <p className="text-sm text-destructive text-center">{error}</p>
      ) : null}

      <p className="text-center text-xs text-muted-foreground">
        New here?{" "}
        <Link href="/signup" className="text-foreground hover:underline underline-offset-4">
          Create an account
        </Link>
      </p>
    </div>
  );
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "h-9 rounded-md text-[13px] font-medium transition-colors",
        active
          ? "bg-card shadow-card text-foreground"
          : "text-muted-foreground hover:text-foreground",
      )}
    >
      {children}
    </button>
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
