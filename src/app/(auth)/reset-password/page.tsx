import Link from "next/link";
import { LogoMark } from "@/components/brand/logo-mark";
import { APP_CONFIG } from "@/lib/config";
import { AlertTriangle } from "lucide-react";
import { ResetPasswordForm } from "@/components/auth/reset-password-form";

export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;

  return (
    <main className="min-h-svh grid place-items-center px-6 bg-background">
      <div className="w-full max-w-sm">
        <div className="rounded-2xl border border-border bg-card p-8 shadow-card-lg space-y-6">
          <div className="space-y-3 text-center">
            <Link href="/" className="inline-flex items-center gap-2.5 group">
              <LogoMark size={32} className="text-primary transition-transform group-hover:scale-105" />
              <span className="font-display text-[17px]">{APP_CONFIG.name}</span>
            </Link>
            <div className="space-y-1.5">
              <h1 className="font-display text-2xl">Set a new password</h1>
              <p className="text-sm text-muted-foreground">
                Pick something at least 8 characters long. You&apos;ll be signed in immediately.
              </p>
            </div>
          </div>

          {token ? (
            <ResetPasswordForm token={token} />
          ) : (
            <div className="rounded-lg border border-amber-300 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/30 p-4 flex items-start gap-3">
              <AlertTriangle className="size-4 text-amber-700 dark:text-amber-400 mt-0.5" />
              <div className="text-sm">
                <p className="font-medium text-amber-900 dark:text-amber-200">No reset token</p>
                <p className="mt-1 text-amber-800/80 dark:text-amber-300/80 text-xs">
                  This page needs a reset token in the URL. Use the link from your email, or{" "}
                  <Link href="/forgot-password" className="underline underline-offset-4">
                    request a new one
                  </Link>
                  .
                </p>
              </div>
            </div>
          )}

          <p className="text-center text-xs text-muted-foreground">
            <Link href="/signin" className="hover:text-foreground hover:underline underline-offset-4">
              Back to sign in
            </Link>
          </p>
        </div>
      </div>
    </main>
  );
}
