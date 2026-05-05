/**
 * In-memory failed-signin counter — protects against credential stuffing
 * without needing Redis.
 *
 *   - 5 failures within a 15-minute rolling window → lockout
 *   - Window resets on first failure that lands outside the window
 *   - Successful signin clears the counter (call clearSigninFailures)
 *
 * Single-instance only (good enough for v1 beta on Vercel single region).
 * Swap to Upstash when we go multi-region.
 */

const MAX_FAILURES = 5;
const WINDOW_MS = 15 * 60 * 1000;

interface FailureBucket {
  count: number;
  resetAt: number;
}

const failures = new Map<string, FailureBucket>();

setInterval(() => {
  const now = Date.now();
  for (const [k, b] of failures) {
    if (b.resetAt < now) failures.delete(k);
  }
}, 60_000).unref?.();

export interface LockoutCheck {
  locked: boolean;
  remainingMs: number;
  remainingAttempts: number;
}

export function checkSigninLockout(key: string): LockoutCheck {
  const now = Date.now();
  const f = failures.get(key);
  if (!f || f.resetAt < now) {
    return { locked: false, remainingMs: 0, remainingAttempts: MAX_FAILURES };
  }
  if (f.count >= MAX_FAILURES) {
    return { locked: true, remainingMs: f.resetAt - now, remainingAttempts: 0 };
  }
  return { locked: false, remainingMs: 0, remainingAttempts: MAX_FAILURES - f.count };
}

export function recordSigninFailure(key: string): LockoutCheck {
  const now = Date.now();
  const f = failures.get(key);
  if (!f || f.resetAt < now) {
    failures.set(key, { count: 1, resetAt: now + WINDOW_MS });
    return { locked: false, remainingMs: WINDOW_MS, remainingAttempts: MAX_FAILURES - 1 };
  }
  f.count++;
  if (f.count >= MAX_FAILURES) {
    return { locked: true, remainingMs: f.resetAt - now, remainingAttempts: 0 };
  }
  return { locked: false, remainingMs: f.resetAt - now, remainingAttempts: MAX_FAILURES - f.count };
}

export function clearSigninFailures(key: string): void {
  failures.delete(key);
}

export function formatLockoutMessage(remainingMs: number): string {
  const minutes = Math.ceil(remainingMs / 60_000);
  return `Too many failed sign-in attempts. Try again in ${minutes} minute${minutes === 1 ? "" : "s"}.`;
}
