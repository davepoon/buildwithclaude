interface SearchIdentity {
  type: string
  slug: string
  marketplaceId?: string
}

/**
 * Turn ranked hits into full records. Several marketplaces can hold a plugin
 * with the same slug, so a hit is matched on its marketplace first and falls
 * back to type + slug (local items carry no marketplace id).
 */
export function hydrateHitsByTypeAndSlug<T extends SearchIdentity>(
  hits: readonly SearchIdentity[],
  records: readonly T[],
): T[] {
  const byIdentity = new Map<string, T>()
  for (const record of records) {
    const key = `${record.type}:${record.slug}`
    if (!byIdentity.has(key)) byIdentity.set(key, record)
    if (record.marketplaceId) byIdentity.set(`${key}:${record.marketplaceId}`, record)
  }

  return hits
    .map((hit) => {
      const key = `${hit.type}:${hit.slug}`
      return byIdentity.get(`${key}:${hit.marketplaceId}`) ?? byIdentity.get(key)
    })
    .filter((record): record is T => Boolean(record))
}
