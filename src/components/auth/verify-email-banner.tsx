"use client";

import { useState, useTransition } from "react";
import { Mail, RefreshCw, X } from "lucide-react";
import { resendVerificationEmail } from "@/app/(auth)/actions";

export function VerifyEmailBanner({ email }: { email: string }) {
  const [dismissed, setDismissed] = useState(false);
  const [status, setStatus] = useState<"idle" | "sent" | "error">("idle");
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  if (dismissed) return null;

  function onResend() {
    startTransition(async () => {
      const res = await resendVerificationEmail();
      if (res?.error) {
        setStatus("error");
        setMessage(res.error);
      } else {
        setStatus("sent");
        setMessage(res?.message ?? "Verification email sent.");
      }
    });
  }

  return (
    <div className="rounded-xl border border-amber-300 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/30 px-4 py-3 flex items-start gap-3">
      <Mail className="size-4 text-amber-700 dark:text-amber-400 mt-0.5 shrink-0" />
      <div className="flex-1 min-w-0 text-sm">
        <div className="font-medium text-amber-900 dark:text-amber-200">
          Verify your email
        </div>
        <p className="text-amber-800/80 dark:text-amber-300/80 text-xs mt-0.5">
          We sent a confirmation link to{" "}
          <span className="font-mono">{email}</span>. Click it to fully activate your account.
        </p>
        {message ? (
          <p
            className={`text-xs mt-1.5 ${
              status === "sent"
                ? "text-emerald-700 dark:text-emerald-400"
                : "text-rose-700 dark:text-rose-400"
            }`}
          >
            {message}
          </p>
        ) : null}
      </div>
      <button
        type="button"
        onClick={onResend}
        disabled={pending || status === "sent"}
        className="text-xs h-7 px-2.5 inline-flex items-center gap-1.5 rounded-md bg-amber-100 dark:bg-amber-900/40 text-amber-900 dark:text-amber-200 hover:bg-amber-200 dark:hover:bg-amber-900/60 transition-colors disabled:opacity-60 shrink-0"
      >
        <RefreshCw className={`size-3 ${pending ? "animate-spin" : ""}`} />
        {pending ? "Sending…" : status === "sent" ? "Sent" : "Resend"}
      </button>
      <button
        type="button"
        onClick={() => setDismissed(true)}
        aria-label="Dismiss"
        className="size-7 inline-flex items-center justify-center rounded-md text-amber-700 dark:text-amber-400 hover:bg-amber-100 dark:hover:bg-amber-900/40 transition-colors shrink-0"
      >
        <X className="size-3.5" />
      </button>
    </div>
  );
}
