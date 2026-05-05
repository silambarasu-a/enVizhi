import Link from "next/link";
import { Mail } from "lucide-react";

export default function ResetSentPage() {
  return (
    <main className="min-h-svh grid place-items-center px-6 bg-background">
      <div className="w-full max-w-sm">
        <div className="rounded-2xl border border-border bg-card p-8 shadow-card-lg text-center space-y-5">
          <div className="size-14 rounded-2xl bg-primary/10 text-primary inline-flex items-center justify-center mx-auto">
            <Mail className="size-7" />
          </div>
          <div className="space-y-1.5">
            <h1 className="font-display text-2xl">Check your email</h1>
            <p className="text-sm text-muted-foreground leading-relaxed">
              If an account exists for that email, we&apos;ve sent a link to set or reset your
              password. The link expires in 1 hour and can only be used once.
            </p>
          </div>
          <p className="text-xs text-muted-foreground border-t border-border pt-4">
            Wrong email or didn&apos;t receive it?{" "}
            <Link href="/forgot-password" className="text-foreground hover:underline underline-offset-4">
              Try again
            </Link>
          </p>
        </div>
      </div>
    </main>
  );
}
