// Pure helpers for the homepage lists (no DB imports, so they run under node --test).

const DAY_MS = 86_400_000
const MONTH_DAY = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' })

export function relativeDay(date: Date, now = Date.now()): string {
  const days = Math.floor((now - date.getTime()) / DAY_MS)
  if (days <= 0) return 'today'
  if (days < 14) return `${days}d ago`
  return MONTH_DAY.format(date)
}

/** Keep the first row seen for each key, up to `limit` rows. */
export function firstPerKey<T>(rows: T[], key: (row: T) => string, limit: number): T[] {
  const seen = new Set<string>()
  const out: T[] = []
  for (const row of rows) {
    const k = key(row)
    if (seen.has(k)) continue
    seen.add(k)
    out.push(row)
    if (out.length === limit) break
  }
  return out
}

/**
 * A different, evenly spread handful each UTC day, for collections that have no
 * popularity signal. Deterministic, so the hourly-cached page and its hydration agree.
 */
export function dailyPicks<T>(items: T[], count: number, now = Date.now()): T[] {
  if (items.length <= count) return items
  const stride = Math.floor(items.length / count)
  const start = Math.floor(now / DAY_MS) % items.length
  return Array.from({ length: count }, (_, i) => items[(start + i * stride) % items.length])
}
