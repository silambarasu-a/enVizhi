import Link from "next/link";
import { redirect } from "next/navigation";
import { LogoMark } from "@/components/brand/logo-mark";
import { APP_CONFIG } from "@/lib/config";
import { SignInTabs } from "@/components/auth/signin-tabs";
import { GoogleButton } from "@/components/auth/google-button";
import { auth, isGoogleEnabled } from "@/lib/auth";
import { resolveSafeRedirect } from "@/lib/auth-redirect";

const ERROR_MESSAGES: Record<string, string> = {
  CredentialsSignin: "Email or password is incorrect.",
  AccessDenied: "Access denied — please contact support.",
  Verification: "That sign-in link expired or has already been used.",
};

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ callbackUrl?: string; error?: string; email?: string }>;
}) {
  const params = await searchParams;
  const callbackUrl = resolveSafeRedirect(params.callbackUrl);

  // Already signed in? Bounce to wherever they were headed.
  // Require `id` (not just email) to match the auth check on protected pages —
  // otherwise a half-hydrated session can ping-pong between /signin and /dashboard.
  const session = await auth();
  if (session?.user?.id) {
    redirect(callbackUrl);
  }

  const initialError = params.error ? ERROR_MESSAGES[params.error] ?? "Sign-in failed. Please try again." : undefined;
  const initialEmail = params.email?.trim().toLowerCase();

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
              <h1 className="font-display text-2xl">Welcome back</h1>
              <p className="text-sm text-muted-foreground">
                Sign in with a password or get a magic link in your inbox.
              </p>
            </div>
          </div>

          {isGoogleEnabled ? (
            <>
              <GoogleButton callbackUrl={callbackUrl} />
              <div className="relative flex items-center">
                <div className="flex-1 border-t border-border" />
                <span className="px-3 text-[11px] text-muted-foreground uppercase tracking-wider">
                  or
                </span>
                <div className="flex-1 border-t border-border" />
              </div>
            </>
          ) : null}

          <SignInTabs callbackUrl={callbackUrl} initialError={initialError} initialEmail={initialEmail} />

          <p className="text-center text-xs text-muted-foreground">
            By continuing you agree to our{" "}
            <Link href="/terms" className="underline underline-offset-4 hover:text-foreground">
              Terms
            </Link>{" "}
            and{" "}
            <Link href="/privacy" className="underline underline-offset-4 hover:text-foreground">
              Privacy
            </Link>
            .
          </p>
        </div>
      </div>
    </main>
  );
}
