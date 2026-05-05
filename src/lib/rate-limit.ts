/**
 * In-memory token-bucket rate limit, keyed by IP.
 *
 * Good enough for v1 beta (single instance). When we run on multiple Vercel
 * regions or add more public endpoints, swap to `@upstash/ratelimit` — the
 * function signature stays identical so callers don't change.
 */

interface Bucket {
  count: number;
  resetAt: number;
}

const buckets = new Map<string, Bucket>();

// Periodic cleanup so memory doesn't grow with one-off scrapers.
setInterval(() => {
  const now = Date.now();
  for (const [k, b] of buckets) {
    if (b.resetAt < now) buckets.delete(k);
  }
}, 60_000).unref?.();

export interface RateLimitResult {
  ok: boolean;
  remaining: number;
  resetAt: number;
}

export function rateLimit(
  key: string,
  limit: number,
  windowMs: number,
): RateLimitResult {
  const now = Date.now();
  const bucket = buckets.get(key);
  if (!bucket || bucket.resetAt < now) {
    const resetAt = now + windowMs;
    buckets.set(key, { count: 1, resetAt });
    return { ok: true, remaining: limit - 1, resetAt };
  }
  if (bucket.count >= limit) {
    return { ok: false, remaining: 0, resetAt: bucket.resetAt };
  }
  bucket.count++;
  return { ok: true, remaining: limit - bucket.count, resetAt: bucket.resetAt };
}

/** Pull the best-guess client IP from the request headers Next/Vercel sets. */
export function clientIp(headers: Headers): string {
  return (
    headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    headers.get("x-real-ip") ??
    "anonymous"
  );
}
