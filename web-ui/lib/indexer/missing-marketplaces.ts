/** How long a repo must go unconfirmed on GitHub before its marketplace is hidden. */
export const HIDE_AFTER_DAYS = 2

/**
 * Of the marketplaces GitHub could not resolve this run, the ones not confirmed
 * present for HIDE_AFTER_DAYS. last_indexed_at is only bumped when the repo
 * resolves, so with a daily run this means it was missing on consecutive runs,
 * and a repo that is briefly private or hit by a one-off GitHub error survives.
 *
 * ponytail: reuses last_indexed_at instead of a missing_since column (no
 * migration). Ceiling: a row that was already stale (deferred over the per-run
 * cap, or not checked since before daily runs) can be hidden on its first
 * miss. Add the column if that ever hides something it should not.
 */
export function staleMissing<T extends { lastIndexedAt: Date | null }>(rows: T[], now: Date): T[] {
  const cutoff = now.getTime() - HIDE_AFTER_DAYS * 24 * 60 * 60 * 1000
  return rows.filter((m) => !m.lastIndexedAt || m.lastIndexedAt.getTime() < cutoff)
}
