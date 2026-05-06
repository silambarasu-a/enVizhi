import { redirect } from "next/navigation";
import { Mail, Lock, ShieldCheck, ShieldAlert, Clock } from "lucide-react";
import { auth } from "@/lib/auth";
import { LocalTime } from "@/components/util/local-time";
import { prisma } from "@/lib/prisma";
import { APP_CONFIG, EMAIL_VERIFICATION_GRACE_MS } from "@/lib/config";
import { PasswordForm } from "@/components/settings/password-form";
import { VerifyEmailBanner } from "@/components/auth/verify-email-banner";

export const dynamic = "force-dynamic";

export default async function ProfilePage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/signin");

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: {
      email: true,
      name: true,
      baseCurrency: true,
      passwordHash: true,
      emailVerified: true,
      createdAt: true,
    },
  });
  if (!user) redirect("/signin");

  const status = verificationStatus(user);

  return (
    <div className="mx-auto max-w-3xl px-6 py-10 space-y-8">
      <header className="space-y-1.5">
        <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
          Profile
        </p>
        <h1 className="font-display text-3xl">Account</h1>
      </header>

      {status.state !== "verified" ? (
        <VerifyEmailBanner email={user.email} />
      ) : null}

      {/* ── Identity ── */}
      <Section icon={Mail} title="Email" description="Used for sign-in and alert notifications.">
        <div className="space-y-3">
          <div className="rounded-lg border border-border bg-secondary/40 px-4 py-3 flex items-center justify-between gap-3">
            <span className="font-mono text-sm truncate">{user.email}</span>
            <VerificationBadge status={status} />
          </div>

          {status.state === "pending" ? (
            <div className="flex items-start gap-2.5 text-xs text-muted-foreground">
              <Clock className="size-3.5 mt-0.5 text-amber-700 dark:text-amber-400 shrink-0" />
              <p>
                Verify your email by{" "}
                <span className="font-mono text-foreground">
                  <LocalTime iso={status.deadline.toISOString()} mode="date-long" />
                </span>
                {" "}— that&apos;s{" "}
                <span className="font-medium text-foreground">
                  {status.daysRemaining} day{status.daysRemaining === 1 ? "" : "s"} left
                </span>
                . Check your inbox or use the resend button above.
              </p>
            </div>
          ) : status.state === "overdue" ? (
            <div className="rounded-lg border border-rose-300 dark:border-rose-800 bg-rose-50 dark:bg-rose-950/30 px-3.5 py-2.5 flex items-start gap-2.5 text-xs">
              <ShieldAlert className="size-4 mt-0.5 text-rose-700 dark:text-rose-400 shrink-0" />
              <p className="text-rose-900 dark:text-rose-200 leading-relaxed">
                <span className="font-medium">Verification overdue.</span> Your{" "}
                {APP_CONFIG.emailVerification.graceDays}-day grace period ended{" "}
                {status.daysOverdue} day{status.daysOverdue === 1 ? "" : "s"} ago. Please verify
                your email to keep using all features.
              </p>
            </div>
          ) : status.verifiedAt ? (
            <p className="text-[11px] text-muted-foreground">
              Verified <LocalTime iso={status.verifiedAt.toISOString()} mode="date-long" />
            </p>
          ) : null}

          <p className="text-[11px] text-muted-foreground">
            Need to change your email? Contact support — self-service email change isn&apos;t
            wired up yet.
          </p>
        </div>
      </Section>

      {/* ── Password ── */}
      <Section
        icon={Lock}
        title={user.passwordHash ? "Password" : "Set a password"}
        description={
          user.passwordHash
            ? "Sign in with your password as an alternative to magic links and Google."
            : "You sign in via magic link or Google. Set a password to skip your inbox next time."
        }
      >
        <PasswordForm hasPassword={Boolean(user.passwordHash)} />
      </Section>

      <p className="text-[11px] text-muted-foreground/70 text-center pt-4">
        Account created <LocalTime iso={user.createdAt.toISOString()} mode="date-long" />
      </p>
    </div>
  );
}

// ─── Helpers ────────────────────────────────────────────────────────────────

type VerificationState =
  | { state: "verified"; verifiedAt: Date }
  | { state: "pending"; deadline: Date; daysRemaining: number }
  | { state: "overdue"; deadline: Date; daysOverdue: number };

function verificationStatus(user: {
  emailVerified: Date | null;
  createdAt: Date;
}): VerificationState {
  if (user.emailVerified) {
    return { state: "verified", verifiedAt: user.emailVerified };
  }
  const deadline = new Date(user.createdAt.getTime() + EMAIL_VERIFICATION_GRACE_MS);
  const remainingMs = deadline.getTime() - Date.now();
  if (remainingMs <= 0) {
    return {
      state: "overdue",
      deadline,
      daysOverdue: Math.ceil(-remainingMs / 86_400_000),
    };
  }
  return {
    state: "pending",
    deadline,
    daysRemaining: Math.max(1, Math.ceil(remainingMs / 86_400_000)),
  };
}

function VerificationBadge({ status }: { status: VerificationState }) {
  if (status.state === "verified") {
    return (
      <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[11px] font-medium border border-emerald-300 dark:border-emerald-800 text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 shrink-0">
        <ShieldCheck className="size-3.5" />
        Verified
      </span>
    );
  }
  if (status.state === "overdue") {
    return (
      <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[11px] font-medium border border-rose-300 dark:border-rose-800 text-rose-700 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/40 shrink-0">
        <ShieldAlert className="size-3.5" />
        Overdue
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[11px] font-medium border border-amber-300 dark:border-amber-800 text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/40 shrink-0">
      <Clock className="size-3.5" />
      {status.daysRemaining}d left
    </span>
  );
}

function Section({
  icon: Icon,
  title,
  description,
  children,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-border bg-card shadow-card overflow-hidden">
      <div className="px-6 pt-5 pb-4 border-b border-border">
        <div className="flex items-center gap-2.5">
          <span className="size-8 rounded-lg bg-primary/10 text-primary inline-flex items-center justify-center">
            <Icon className="size-4" />
          </span>
          <h2 className="font-display text-lg">{title}</h2>
        </div>
        <p className="text-sm text-muted-foreground mt-2">{description}</p>
      </div>
      <div className="p-6">{children}</div>
    </section>
  );
}
