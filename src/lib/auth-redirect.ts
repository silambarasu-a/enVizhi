/**
 * Validate a `callbackUrl` query param before sending the user to it.
 *
 * Open-redirect protection: only same-origin paths are accepted. An attacker
 * who controls a query string mustn't be able to bounce users to
 * `https://evil.com/phish` after sign-in.
 *
 * Rules:
 *   - must start with `/`
 *   - must not start with `//` (protocol-relative URLs are external)
 *   - must not contain `\` (some browsers normalize `\\evil.com` to `//evil.com`)
 *   - falls back to `/dashboard` on anything else
 */
export function resolveSafeRedirect(
  raw: string | undefined | null,
  fallback: string = "/dashboard",
): string {
  if (!raw) return fallback;
  if (typeof raw !== "string") return fallback;
  if (!raw.startsWith("/")) return fallback;
  if (raw.startsWith("//")) return fallback;
  if (raw.includes("\\")) return fallback;
  return raw;
}
