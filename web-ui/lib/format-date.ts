const SHORT = new Intl.DateTimeFormat('en-US', { year: 'numeric', month: 'short', day: 'numeric', timeZone: 'UTC' })
const NUMERIC = new Intl.DateTimeFormat('en-US', { year: 'numeric', month: '2-digit', day: '2-digit', timeZone: 'UTC' })

/** UTC date ("Oct 28, 2026", or "10/28/2026" when numeric), so server and client render the same text. */
export function formatDate(iso: string, style: 'short' | 'numeric' = 'short'): string {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return iso
  return (style === 'numeric' ? NUMERIC : SHORT).format(date)
}
