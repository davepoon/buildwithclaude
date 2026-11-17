import type { UnifiedPlugin } from './plugin-types'

export type SortOption = 'relevance' | 'stars' | 'installs' | 'newest' | 'oldest' | 'name' | 'name-desc' | 'updated'

function pluginUpdatedAtMs(p: UnifiedPlugin): number | null {
  if (!p.updatedAt) return null
  const t = new Date(p.updatedAt).getTime()
  return Number.isNaN(t) ? null : t
}

/**
 * Sort plugins by the given sort option
 */
export function sortPlugins(plugins: UnifiedPlugin[], sort: SortOption, search?: string): UnifiedPlugin[] {
  const sorted = [...plugins]

  switch (sort) {
    case 'name':
      return sorted.sort((a, b) => a.name.localeCompare(b.name))
    case 'name-desc':
      return sorted.sort((a, b) => b.name.localeCompare(a.name))
    case 'stars':
      return sorted.sort((a, b) => (b.stars || 0) - (a.stars || 0))
    case 'installs':
      // Mirror the DB ORDER BY (installs DESC, stars DESC); name keeps ties stable
      return sorted.sort((a, b) =>
        (b.installs || 0) - (a.installs || 0) ||
        (b.stars || 0) - (a.stars || 0) ||
        a.name.localeCompare(b.name)
      )
    case 'newest':
    case 'updated':
      return sorted.sort((a, b) => {
        const ta = pluginUpdatedAtMs(a)
        const tb = pluginUpdatedAtMs(b)
        if (ta === null && tb === null) return a.name.localeCompare(b.name)
        if (ta === null) return 1
        if (tb === null) return -1
        if (tb !== ta) return tb - ta
        return a.name.localeCompare(b.name)
      })
    case 'oldest':
      return sorted.sort((a, b) => {
        const ta = pluginUpdatedAtMs(a)
        const tb = pluginUpdatedAtMs(b)
        if (ta === null && tb === null) return a.name.localeCompare(b.name)
        if (ta === null) return -1
        if (tb === null) return 1
        if (ta !== tb) return ta - tb
        return a.name.localeCompare(b.name)
      })
    case 'relevance':
    default:
      if (search) {
        const searchLower = search.toLowerCase()
        return sorted.sort((a, b) => {
          // Exact name match first
          const aExact = a.name.toLowerCase() === searchLower ? 0 : 1
          const bExact = b.name.toLowerCase() === searchLower ? 0 : 1
          if (aExact !== bExact) return aExact - bExact

          // Name starts with search
          const aStarts = a.name.toLowerCase().startsWith(searchLower) ? 0 : 1
          const bStarts = b.name.toLowerCase().startsWith(searchLower) ? 0 : 1
          if (aStarts !== bStarts) return aStarts - bStarts

          // Name contains search
          const aContains = a.name.toLowerCase().includes(searchLower) ? 0 : 1
          const bContains = b.name.toLowerCase().includes(searchLower) ? 0 : 1
          if (aContains !== bContains) return aContains - bContains

          // Fall back to alphabetical
          return a.name.localeCompare(b.name)
        })
      }
      return sorted.sort((a, b) => a.name.localeCompare(b.name))
  }
}
