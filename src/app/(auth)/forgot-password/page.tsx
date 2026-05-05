import Link from "next/link";
import { LogoMark } from "@/components/brand/logo-mark";
import { APP_CONFIG } from "@/lib/config";
import { ArrowRight } from "lucide-react";
import { requestPasswordReset } from "@/app/(auth)/actions";

export default function ForgotPasswordPage() {
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
              <h1 className="font-display text-2xl">Reset your password</h1>
              <p className="text-sm text-muted-foreground">
                Enter your email and we&apos;ll send you a link to set a new password.
              </p>
            </div>
          </div>

          <form action={requestPasswordReset} className="space-y-3">
            <label className="block">
              <span className="block text-xs font-medium mb-1.5">Email</span>
              <input
                type="email"
                name="email"
                required
                autoComplete="email"
                autoFocus
                placeholder="you@example.com"
                className="w-full h-11 rounded-lg border border-input bg-background px-3.5 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:border-ring transition-colors"
              />
            </label>
            <button
              type="submit"
              className="w-full h-11 inline-flex items-center justify-center gap-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 transition-opacity shadow-card"
            >
              Send reset link
              <ArrowRight className="size-4" />
            </button>
          </form>

          <p className="text-center text-xs text-muted-foreground">
            Remember your password?{" "}
            <Link href="/signin" className="text-foreground hover:underline underline-offset-4">
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </main>
  );
}
