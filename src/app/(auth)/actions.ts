"use server";

import { randomBytes } from "node:crypto";
import { hash } from "bcryptjs";
import { AuthError } from "next-auth";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { auth, signIn } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { sendPasswordResetEmail, sendVerificationEmail } from "@/lib/auth-email";
import { seedDefaultWatchlists } from "@/lib/onboarding";
import {
  checkSigninLockout,
  clearSigninFailures,
  formatLockoutMessage,
  recordSigninFailure,
} from "@/lib/auth-throttle";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MIN_PW = 8;
const RESET_TOKEN_TTL_MS = 60 * 60 * 1000; // 1 hour
const VERIFY_TOKEN_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

// ─── Password sign-in ───────────────────────────────────────────────────────

export async function signInWithPassword(formData: FormData) {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  const redirectTo = String(formData.get("redirectTo") ?? "/dashboard");

  if (!EMAIL_RE.test(email) || !password) {
    return { error: "Enter a valid email and password" };
  }

  // Lockout check before we even validate the password.
  const lockKey = `signin:${email}`;
  const lock = checkSigninLockout(lockKey);
  if (lock.locked) {
    return { error: formatLockoutMessage(lock.remainingMs) };
  }

  try {
    await signIn("credentials", { email, password, redirectTo });
    // signIn throws a redirect on success — anything past this is unreachable.
    clearSigninFailures(lockKey);
    return { ok: true };
  } catch (err) {
    // The redirect Auth.js throws on success isn't an AuthError — re-throw it
    // so Next.js can perform the navigation.
    if (err instanceof AuthError) {
      const f = recordSigninFailure(lockKey);
      if (f.locked) return { error: formatLockoutMessage(f.remainingMs) };

      // If the email exists but has no password (Google / magic-link only),
      // give a specific hint instead of the generic "incorrect" message.
      // This is mild enumeration but prevents users from getting stuck.
      const passwordless = await prisma.user.findUnique({
        where: { email },
        select: { passwordHash: true },
      });
      if (passwordless && !passwordless.passwordHash) {
        return {
          error:
            "This email signs in with Google or a magic link — try those above. To use a password, click 'Forgot?' to set one.",
        };
      }

      const tail = f.remainingAttempts <= 2 ? ` ${f.remainingAttempts} attempt${f.remainingAttempts === 1 ? "" : "s"} remaining.` : "";
      return { error: `Email or password is incorrect.${tail}` };
    }
    throw err;
  }
}

// ─── Magic link sign-in (used by the form on the magic-link tab) ───────────

export async function signInWithMagicLink(formData: FormData) {
  await signIn("nodemailer", formData);
  return { ok: true };
}

// ─── Sign up ────────────────────────────────────────────────────────────────

export async function signUpWithPassword(formData: FormData) {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  const confirm = String(formData.get("confirmPassword") ?? "");

  if (!EMAIL_RE.test(email)) return { error: "Enter a valid email address" };
  if (password.length < MIN_PW) {
    return { error: `Password must be at least ${MIN_PW} characters` };
  }
  if (password !== confirm) return { error: "Passwords don't match" };

  const existing = await prisma.user.findUnique({
    where: { email },
    select: { id: true, passwordHash: true },
  });
  if (existing) {
    if (existing.passwordHash) {
      // They already have a password — point them at the sign-in page.
      return {
        error:
          "An account with that email already exists. Sign in with your password — or click 'Forgot?' if you don't remember it.",
        redirectTo: `/signin?email=${encodeURIComponent(email)}`,
      };
    }
    // No password yet (Google / magic-link only). Convert the signup into a
    // claim flow: send them a link to set their password, then route to the
    // same "check your inbox" page we use for forgot-password.
    await issueResetToken(existing.id, email).catch((err) =>
      console.error("[signup-claim] failed to issue reset:", err),
    );
    redirect("/forgot-password/sent");
  }

  const passwordHash = await hash(password, 10);
  const user = await prisma.user.create({
    data: {
      email,
      passwordHash,
      // emailVerified stays null until they click the verify link.
    },
  });

  // Credentials provider doesn't trigger NextAuth's `events.createUser`, so seed manually.
  try {
    await seedDefaultWatchlists(user.id);
  } catch (err) {
    console.error("[onboarding] seed failed during signup:", err);
  }

  // Fire-and-log the verification email — never block signup on a mail failure.
  await issueVerificationEmail(user.id, email).catch((err) => {
    console.error("[verify] failed to send signup verification email:", err);
  });

  // Sign them in so they land on the dashboard. The dashboard will show a
  // "Verify your email" banner until they click the link.
  await signIn("credentials", { email, password, redirectTo: "/dashboard" });
  return { ok: true };
}

// ─── Email verification ─────────────────────────────────────────────────────

async function issueVerificationEmail(userId: string, email: string) {
  // Invalidate any prior outstanding tokens so only the latest one is valid.
  await prisma.emailVerificationToken.deleteMany({ where: { userId, usedAt: null } });

  const token = randomBytes(32).toString("hex");
  await prisma.emailVerificationToken.create({
    data: {
      token,
      userId,
      expires: new Date(Date.now() + VERIFY_TOKEN_TTL_MS),
    },
  });

  const baseUrl = process.env.AUTH_URL ?? "http://localhost:3005";
  const verifyUrl = `${baseUrl}/verify-email?token=${encodeURIComponent(token)}`;

  const smtp = buildSmtpFromEnv();
  if (smtp) {
    await sendVerificationEmail({ to: email, smtp, verifyUrl });
  } else {
    console.log("\n────────────────────────────────────────────────────────────");
    console.log(`✉ [vizhi dev] verification link for ${email}`);
    console.log(`   ${verifyUrl}`);
    console.log("────────────────────────────────────────────────────────────\n");
  }
}

/** Validate the verification token and mark the user's email verified. */
export async function verifyEmail(token: string) {
  if (!token) return { error: "Missing verification token" };

  const record = await prisma.emailVerificationToken.findUnique({
    where: { token },
  });
  if (!record || record.usedAt) {
    return { error: "This verification link has already been used." };
  }
  if (record.expires < new Date()) {
    return { error: "This verification link has expired. Request a new one from your dashboard." };
  }

  await prisma.$transaction([
    prisma.user.update({
      where: { id: record.userId },
      data: { emailVerified: new Date() },
    }),
    prisma.emailVerificationToken.update({
      where: { token },
      data: { usedAt: new Date() },
    }),
  ]);

  revalidatePath("/dashboard");
  return { ok: true };
}

/** Auth-gated: ask for a fresh verification email (used by the dashboard banner). */
export async function resendVerificationEmail() {
  const session = await auth();
  if (!session?.user?.id) return { error: "Not signed in" };

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { email: true, emailVerified: true },
  });
  if (!user) return { error: "Account not found" };
  if (user.emailVerified) return { ok: true, message: "Already verified" };

  try {
    await issueVerificationEmail(session.user.id, user.email);
    return { ok: true, message: "Verification email sent." };
  } catch (err) {
    console.error("[verify] resend failed:", err);
    return { error: "Couldn't send the email. Try again in a moment." };
  }
}

// ─── Forgot password ────────────────────────────────────────────────────────

/**
 * Triggered from /forgot-password. Always behaves the same (redirects to the
 * "check your inbox" page) regardless of whether the email exists, to prevent
 * account enumeration.
 */
export async function requestPasswordReset(formData: FormData) {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  if (!EMAIL_RE.test(email)) {
    // Still redirect on invalid email — no leakage either direction.
    redirect("/forgot-password/sent");
  }

  const user = await prisma.user.findUnique({ where: { email } });
  if (user) {
    await issueResetToken(user.id, email).catch((err) =>
      console.error("[reset] failed to issue:", err),
    );
  }

  redirect("/forgot-password/sent");
}

/**
 * Generate a fresh password-reset token, persist it, and send the reset email.
 * Shared by `requestPasswordReset` (forgot flow) and `signUpWithPassword`
 * (claim flow when the email is already registered without a password).
 */
async function issueResetToken(userId: string, email: string): Promise<void> {
  const token = randomBytes(32).toString("hex");
  const expires = new Date(Date.now() + RESET_TOKEN_TTL_MS);

  await prisma.passwordResetToken.create({
    data: { token, userId, expires },
  });

  const baseUrl = process.env.AUTH_URL ?? "http://localhost:3005";
  const resetUrl = `${baseUrl}/reset-password?token=${encodeURIComponent(token)}`;

  const smtp = buildSmtpFromEnv();
  if (smtp) {
    await sendPasswordResetEmail({ to: email, smtp, resetUrl });
  } else {
    console.log("\n────────────────────────────────────────────────────────────");
    console.log(`🔑 [vizhi dev] password reset link for ${email}`);
    console.log(`   ${resetUrl}`);
    console.log("────────────────────────────────────────────────────────────\n");
  }
}

/**
 * Validate the token and apply the new password. Token is invalidated on success
 * (single-use). On success the user is also signed in immediately so they don't
 * have to type their new password again.
 */
export async function resetPassword(formData: FormData) {
  const token = String(formData.get("token") ?? "");
  const password = String(formData.get("password") ?? "");
  const confirm = String(formData.get("confirmPassword") ?? "");

  if (!token) return { error: "Missing reset token" };
  if (password.length < MIN_PW) return { error: `Password must be at least ${MIN_PW} characters` };
  if (password !== confirm) return { error: "Passwords don't match" };

  const record = await prisma.passwordResetToken.findUnique({
    where: { token },
    include: { user: { select: { id: true, email: true } } },
  });

  if (!record || record.usedAt) {
    return { error: "This reset link has already been used. Request a new one." };
  }
  if (record.expires < new Date()) {
    return { error: "This reset link has expired. Request a new one." };
  }

  const passwordHash = await hash(password, 10);
  await prisma.$transaction([
    prisma.user.update({
      where: { id: record.userId },
      data: { passwordHash },
    }),
    prisma.passwordResetToken.update({
      where: { token },
      data: { usedAt: new Date() },
    }),
    // Invalidate any other outstanding reset tokens for this user.
    prisma.passwordResetToken.deleteMany({
      where: { userId: record.userId, NOT: { token } },
    }),
  ]);

  await signIn("credentials", {
    email: record.user.email,
    password,
    redirectTo: "/dashboard",
  });
  return { ok: true };
}

function buildSmtpFromEnv():
  | { server: { host: string; port: number; secure: boolean; auth: { user: string; pass: string } }; from: string }
  | null {
  const host = process.env.SMTP_HOST;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  if (!host || !user || !pass) return null;
  const port = process.env.SMTP_PORT ? Number(process.env.SMTP_PORT) : 587;
  return {
    server: { host, port, secure: port === 465, auth: { user, pass } },
    from: process.env.MAIL_FROM ?? `EnVizhi <${user}>`,
  };
}

// ─── Set / change password (auth-gated, used on /profile) ──────────────────

export async function setPassword(formData: FormData) {
  const session = await auth();
  if (!session?.user?.id) redirect("/signin");
  const userId = session.user.id;

  const current = String(formData.get("currentPassword") ?? "");
  const next = String(formData.get("newPassword") ?? "");
  const confirm = String(formData.get("confirmPassword") ?? "");

  if (next.length < MIN_PW) return { error: `New password must be at least ${MIN_PW} characters` };
  if (next !== confirm) return { error: "Passwords don't match" };

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { passwordHash: true },
  });
  if (!user) return { error: "Account not found" };

  // If a password is already set, require the current one to change it.
  // First-time setters (magic-link-only users) skip this check.
  if (user.passwordHash) {
    const { compare } = await import("bcryptjs");
    if (!current) return { error: "Enter your current password" };
    const ok = await compare(current, user.passwordHash);
    if (!ok) return { error: "Current password is incorrect" };
  }

  const passwordHash = await hash(next, 10);
  await prisma.user.update({ where: { id: userId }, data: { passwordHash } });
  revalidatePath("/profile");
  return { ok: true, message: user.passwordHash ? "Password updated." : "Password set." };
}
