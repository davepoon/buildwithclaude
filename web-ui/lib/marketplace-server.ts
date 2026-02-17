import { desc, asc, eq, sql, ilike, or, and } from 'drizzle-orm'
import type { MarketplaceRegistry } from './marketplace-types'
import { db } from './db/client'
import { marketplaces } from './db/schema'
import { safeDbQuery } from './db/safe-query'

export type SortOption = 'relevance' | 'stars' | 'newest' | 'oldest' | 'name' | 'name-desc'

export interface PaginatedMarketplaces {
  marketplaces: MarketplaceRegistry[]
  total: number
  hasMore: boolean
}

export interface MarketplaceQueryOptions {
  limit?: number
  offset?: number
  search?: string
  sort?: SortOption
}

/**
 * Transform database row to MarketplaceRegistry
 */
function transformRow(row: {
  id: string
  name: string
  displayName: string
  description: string | null
  url: string | null
  repository: string
  installCommand: string | null
  namespace: string
  pluginCount: number
  skillCount: number
  categories: string[] | null
  badges: string[] | null
  maintainerName: string | null
  maintainerGithub: string | null
  stars: number
  installs: number
  verified: boolean
  lastIndexedAt: Date | null
  updatedAt: Date
}): MarketplaceRegistry {
  return {
    id: row.id,
    name: row.name,
    displayName: row.displayName,
    description: row.description || '',
    url: row.url || row.repository,
    repository: row.repository,
    installCommand: row.installCommand || `/plugin marketplace add ${row.namespace}`,
    pluginCount: row.pluginCount,
    skillCount: row.skillCount,
    categories: row.categories || [],
    badges: row.badges || [],
    maintainer: {
      name: row.maintainerName || '',
      github: row.maintainerGithub || '',
    },
    stars: row.stars,
    installs: row.installs,
    verified: row.verified,
    lastIndexedAt: row.lastIndexedAt?.toISOString(),
    updatedAt: row.updatedAt?.toISOString(),
  }
}

/**
 * Get sort order for database query
 */
function getOrderBy(sort: SortOption) {
  switch (sort) {
    case 'relevance':
      // Primary: installs (actual usage), Secondary: stars (popularity proxy)
      return [desc(marketplaces.installs), desc(marketplaces.stars)]
    case 'stars':
      return [desc(marketplaces.stars)]
    case 'newest':
      return [desc(marketplaces.updatedAt)]
    case 'oldest':
      return [asc(marketplaces.updatedAt)]
    case 'name':
      return [asc(marketplaces.displayName)]
    case 'name-desc':
      return [desc(marketplaces.displayName)]
    default:
      return [desc(marketplaces.stars)]
  }
}

/**
 * Get marketplaces with pagination and search
 */
export async function getMarketplacesPaginated(
  options: MarketplaceQueryOptions = {}
): Promise<PaginatedMarketplaces> {
  const { limit = 20, offset = 0, search, sort = 'relevance' } = options

  // Build where clause
  let whereClause = eq(marketplaces.active, true)

  if (search && search.trim()) {
    const searchTerm = `%${search.trim()}%`
    whereClause = and(
      whereClause,
      or(
        ilike(marketplaces.name, searchTerm),
        ilike(marketplaces.displayName, searchTerm),
        ilike(marketplaces.description, searchTerm),
        ilike(marketplaces.maintainerName, searchTerm)
      )
    )!
  }

  // Get total count
  const { data: countResult } = await safeDbQuery(
    () => db
      .select({ count: sql<number>`count(*)` })
      .from(marketplaces)
      .where(whereClause),
    [{ count: 0 }],
    'getMarketplacesPaginated:count',
  )

  const total = Number(countResult[0]?.count || 0)

  // Get paginated results with sorting
  const orderByClause = getOrderBy(sort)
  const { data: results } = await safeDbQuery(
    () => db
      .select()
      .from(marketplaces)
      .where(whereClause)
      .orderBy(...orderByClause)
      .limit(limit)
      .offset(offset),
    [],
    'getMarketplacesPaginated:results',
  )

  return {
    marketplaces: results.map(transformRow),
    total,
    hasMore: offset + results.length < total,
  }
}

/**
 * Get all marketplaces (for backwards compatibility and totals calculation)
 */
export async function getMarketplaces(): Promise<MarketplaceRegistry[]> {
  const result = await getMarketplacesPaginated({ limit: 10000 })
  return result.marketplaces
}

/**
 * Get marketplace totals (plugin count, skill count, marketplace count)
 */
export async function getMarketplaceTotals(): Promise<{
  totalPlugins: number
  totalSkills: number
  totalMarketplaces: number
}> {
  const { data: result } = await safeDbQuery(
    () => db
      .select({
        totalPlugins: sql<number>`sum(plugin_count)`,
        totalSkills: sql<number>`sum(skill_count)`,
        totalMarketplaces: sql<number>`count(*)`,
      })
      .from(marketplaces)
      .where(eq(marketplaces.active, true)),
    [{ totalPlugins: 0, totalSkills: 0, totalMarketplaces: 0 }],
    'getMarketplaceTotals',
  )

  return {
    totalPlugins: Number(result[0]?.totalPlugins || 0),
    totalSkills: Number(result[0]?.totalSkills || 0),
    totalMarketplaces: Number(result[0]?.totalMarketplaces || 0),
  }
}

/**
 * Get a single marketplace by ID or name
 */
export async function getMarketplaceById(id: string): Promise<MarketplaceRegistry | null> {
  const { data: results } = await safeDbQuery(
    () => db
      .select()
      .from(marketplaces)
      .where(or(eq(marketplaces.id, id), eq(marketplaces.name, id), eq(marketplaces.namespace, id)))
      .limit(1),
    [],
    'getMarketplaceById',
  )

  if (results.length > 0) {
    return transformRow(results[0])
  }

  return null
}
