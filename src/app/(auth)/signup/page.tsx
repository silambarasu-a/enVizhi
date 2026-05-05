import Link from "next/link";
import { redirect } from "next/navigation";
import { LogoMark } from "@/components/brand/logo-mark";
import { APP_CONFIG } from "@/lib/config";
import { SignUpForm } from "@/components/auth/signup-form";
import { GoogleButton } from "@/components/auth/google-button";
import { auth, isGoogleEnabled } from "@/lib/auth";

export default async function SignUpPage() {
  const session = await auth();
  if (session?.user?.id) redirect("/dashboard");
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
              <h1 className="font-display text-2xl">Create your account</h1>
              <p className="text-sm text-muted-foreground">
                We&apos;ll seed a couple of starter watchlists so the dashboard isn&apos;t empty.
              </p>
            </div>
          </div>

          {isGoogleEnabled ? (
            <>
              <GoogleButton />
              <div className="relative flex items-center">
                <div className="flex-1 border-t border-border" />
                <span className="px-3 text-[11px] text-muted-foreground uppercase tracking-wider">
                  or
                </span>
                <div className="flex-1 border-t border-border" />
              </div>
            </>
          ) : null}

          <SignUpForm />

          <p className="text-center text-xs text-muted-foreground">
            Already have an account?{" "}
            <Link href="/signin" className="text-foreground hover:underline underline-offset-4">
              Sign in
            </Link>
          </p>
          <p className="text-center text-xs text-muted-foreground">
            By signing up you agree to our{" "}
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
