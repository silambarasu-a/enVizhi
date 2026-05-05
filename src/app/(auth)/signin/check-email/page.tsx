import Link from "next/link";
import { Mail } from "lucide-react";

export default function CheckEmailPage() {
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
              A sign-in link has been sent to your inbox. It expires in 24 hours and can only be
              used once.
            </p>
          </div>
          <p className="text-xs text-muted-foreground border-t border-border pt-4">
            Wrong email?{" "}
            <Link href="/signin" className="text-foreground hover:underline underline-offset-4">
              Try a different one
            </Link>
          </p>
        </div>
      </div>
    </main>
  );
}
