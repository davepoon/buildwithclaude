interface SearchIdentity {
  type: string
  slug: string
}

export function hydrateHitsByTypeAndSlug<T extends SearchIdentity>(
  hits: readonly SearchIdentity[],
  records: readonly T[],
): T[] {
  const byIdentity = new Map<string, T>()
  for (const record of records) {
    const key = `${record.type}:${record.slug}`
    if (!byIdentity.has(key)) byIdentity.set(key, record)
  }

  return hits
    .map((hit) => byIdentity.get(`${hit.type}:${hit.slug}`))
    .filter((record): record is T => Boolean(record))
}
