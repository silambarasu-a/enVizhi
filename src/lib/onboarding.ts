/**
 * Onboarding helpers for newly created users.
 *
 * As of the "fully live" rewrite: we no longer pre-seed default watchlists,
 * because there are no statically-loaded stocks to point them at. New users
 * land on an empty dashboard and discover stocks via ⌘K search or the
 * Discover panel on the screener.
 *
 * The export is preserved as a no-op so callers in `auth.ts` (the
 * `events.createUser` hook) keep working without a refactor — if onboarding
 * grows side-effects later (welcome email, default settings) they slot here.
 */

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export async function seedDefaultWatchlists(_userId: string): Promise<void> {
  // Intentionally empty. See module comment.
}
