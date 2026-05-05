/**
 * Single source of truth for app-level constants. Edit values here when
 * the product needs them tuned — no need to grep across files.
 *
 * Naming: keep keys short and lowercase. Group by feature.
 */

export const APP_CONFIG = {
  /** Display name across UI, emails, OG tags, manifest. */
  name: "EnVizhi",
  /** Short name for tight spaces (top nav at narrow widths, PWA short_name). */
  shortName: "EnVizhi",
  /** Tamil meaning surfaced in onboarding / about copy. */
  tamilMeaning: "En Vizhi (என் விழி) — my vision",
  /** Single-sentence tagline for marketing surfaces. */
  tagline: "The investing terminal, reimagined for the long term.",
  /** Brand primary color (mirror of `--primary` in globals.css). Used for
   *  generated icons + manifest theme color. Update both if you ever change. */
  brandColor: "#4F46E5", // indigo-600
  brandColorOnDark: "#818CF8", // indigo-400 (used inside the dark icon variant)

  /** Email-verification policy. */
  emailVerification: {
    /** How many days a new user has to verify before the warning hardens. */
    graceDays: 7,
    /** TTL for a single verification token. */
    tokenTtlHours: 24,
  },

  /** Password-reset policy. */
  passwordReset: {
    /** TTL for a reset link. */
    tokenTtlHours: 1,
  },

  /** Sign-in throttle. */
  signin: {
    /** Failed attempts allowed within `lockoutWindowMinutes` before a lockout fires. */
    maxFailures: 5,
    lockoutWindowMinutes: 15,
  },

  /** Public quote API rate limit. */
  rateLimit: {
    quoteRequestsPerMinute: 60,
  },

  /** Quote / fundamentals provenance — surfaced in legal copy. */
  data: {
    quoteDelayMinutes: 15,
    primaryProvider: "Yahoo Finance (via yahoo-finance2)",
  },
} as const;

/** Pretty deadline expressed in milliseconds — derived once for code that wants it. */
export const EMAIL_VERIFICATION_GRACE_MS =
  APP_CONFIG.emailVerification.graceDays * 24 * 60 * 60 * 1000;
