import { db } from '@/lib/db/client'
import { mcpServers, mcpServerStats } from '@/lib/db/schema'
import type { MCPServerDB } from '@/lib/db/schema'
import { eq, ilike, or, sql, desc, asc, and } from 'drizzle-orm'
import { MCP_CATEGORIES } from './mcp-types'
import { safeDbQuery } from '@/lib/db/safe-query'

export type SortOption = 'relevance' | 'stars' | 'downloads' | 'name' | 'updated'

export interface MCPServerFilters {
  search?: string
  category?: string
  sourceRegistry?: string
  verification?: string
}

export interface PaginatedMCPServers {
  servers: MCPServerWithParsedJSON[]
  total: number
  limit: number
  offset: number
  hasMore: boolean
}

export interface CategoryWithCount {
  id: string
  displayName: string
  icon: string
  count: number
}

export interface MCPServerStatsResult {
  total: number
  bySource: Record<string, number>
  byCategory: Record<string, number>
  byVerification: Record<string, number>
}

// MCPServerDB with parsed JSON fields
export interface MCPServerWithParsedJSON extends Omit<MCPServerDB, 'packages' | 'remotes' | 'environmentVariables' | 'installationMethods'> {
  packages: unknown[] | null
  remotes: unknown[] | null
  environmentVariables: unknown[] | null
  installationMethods: unknown[] | null
}

function parseJSONField<T>(value: string | null): T[] | null {
  if (!value) return null
  try {
    return JSON.parse(value) as T[]
  } catch {
    return null
  }
}

function transformToMCPServerWithParsedJSON(server: MCPServerDB): MCPServerWithParsedJSON {
  return {
    ...server,
    packages: parseJSONField(server.packages),
    remotes: parseJSONField(server.remotes),
    environmentVariables: parseJSONField(server.environmentVariables),
    installationMethods: parseJSONField(server.installationMethods),
  }
}

/**
 * Get paginated MCP servers from the database with optional filters
 */
export async function getMCPServersPaginated(options: {
  limit?: number
  offset?: number
  search?: string
  sort?: SortOption
  category?: string
  sourceRegistry?: string
  verification?: string
}): Promise<PaginatedMCPServers> {
  const {
    limit = 50,
    offset = 0,
    search,
    sort = 'downloads',
    category,
    sourceRegistry,
    verification,
  } = options

  // Build where conditions
  const conditions = []

  // Active servers only
  conditions.push(eq(mcpServers.active, true))

  // Category filter
  if (category) {
    conditions.push(eq(mcpServers.category, category))
  }

  // Source registry filter
  if (sourceRegistry && sourceRegistry !== 'all') {
    conditions.push(eq(mcpServers.sourceRegistry, sourceRegistry))
  }

  // Verification filter
  if (verification && verification !== 'all') {
    conditions.push(eq(mcpServers.verificationStatus, verification))
  }

  // Search filter
  if (search) {
    const searchPattern = `%${search}%`
    conditions.push(
      or(
        ilike(mcpServers.name, searchPattern),
        ilike(mcpServers.displayName, searchPattern),
        ilike(mcpServers.description, searchPattern),
        sql`${search} = ANY(${mcpServers.tags})`
      )
    )
  }

  // Determine sort order
  let orderBy
  switch (sort) {
    case 'name':
      orderBy = asc(mcpServers.displayName)
      break
    case 'updated':
      orderBy = desc(mcpServers.updatedAt)
      break
    case 'stars':
      orderBy = sql`COALESCE(${mcpServers.githubStars}, 0) DESC`
      break
    case 'relevance':
      if (search) {
        orderBy = sql`
          CASE
            WHEN ${mcpServers.name} ILIKE ${search} THEN 0
            WHEN ${mcpServers.name} ILIKE ${`${search}%`} THEN 1
            WHEN ${mcpServers.displayName} ILIKE ${`%${search}%`} THEN 2
            WHEN ${mcpServers.description} ILIKE ${`%${search}%`} THEN 3
            ELSE 4
          END,
          COALESCE(${mcpServers.dockerPulls}, 0) DESC
        `
      } else {
        // When no search, sort by downloads
        orderBy = sql`COALESCE(${mcpServers.dockerPulls}, 0) DESC`
      }
      break
    case 'downloads':
    default:
      orderBy = sql`COALESCE(${mcpServers.dockerPulls}, 0) DESC`
      break
  }

  // Execute query
  const whereClause = conditions.length > 0 ? and(...conditions) : undefined

  const { data: [results, countResult] } = await safeDbQuery(
    () => Promise.all([
      db
        .select()
        .from(mcpServers)
        .where(whereClause)
        .orderBy(orderBy)
        .limit(limit)
        .offset(offset),

      db
        .select({ count: sql<number>`count(*)` })
        .from(mcpServers)
        .where(whereClause),
    ]),
    [[] as any[], [{ count: 0 }]],
    'getMCPServersPaginated',
  )

  const total = Number(countResult[0]?.count || 0)

  return {
    servers: results.map(transformToMCPServerWithParsedJSON),
    total,
    limit,
    offset,
    hasMore: offset + results.length < total,
  }
}

/**
 * Get MCP server by slug
 */
export async function getMCPServerBySlug(slug: string): Promise<MCPServerWithParsedJSON | null> {
  const { data: result } = await safeDbQuery(
    () => db
      .select()
      .from(mcpServers)
      .where(eq(mcpServers.slug, slug))
      .limit(1),
    [],
    'getMCPServerBySlug',
  )

  if (!result.length) return null
  return transformToMCPServerWithParsedJSON(result[0])
}

/**
 * Get category metadata with counts from database
 */
export async function getMCPCategoriesFromDB(): Promise<CategoryWithCount[]> {
  const { data: categoryCounts } = await safeDbQuery(
    () => db
      .select({
        category: mcpServers.category,
        count: sql<number>`count(*)`,
      })
      .from(mcpServers)
      .where(eq(mcpServers.active, true))
      .groupBy(mcpServers.category),
    [],
    'getMCPCategoriesFromDB',
  )

  const countMap = new Map<string, number>()
  for (const row of categoryCounts) {
    countMap.set(row.category, Number(row.count))
  }

  // Merge with MCP_CATEGORIES metadata
  const categories: CategoryWithCount[] = []
  for (const [id, catData] of Object.entries(MCP_CATEGORIES)) {
    const count = countMap.get(id) || 0
    if (count > 0) {
      categories.push({
        id,
        displayName: catData.name,
        icon: catData.icon,
        count,
      })
    }
  }
  return categories
}

/**
 * Get global MCP server stats
 */
export async function getMCPServerStatsFromDB(): Promise<MCPServerStatsResult> {
  // Count by source
  const { data: sourceStats } = await safeDbQuery(
    () => db
      .select({
        sourceRegistry: mcpServers.sourceRegistry,
        count: sql<number>`count(*)`,
      })
      .from(mcpServers)
      .where(eq(mcpServers.active, true))
      .groupBy(mcpServers.sourceRegistry),
    [],
    'getMCPServerStats:bySource',
  )

  // Count by category
  const { data: categoryStats } = await safeDbQuery(
    () => db
      .select({
        category: mcpServers.category,
        count: sql<number>`count(*)`,
      })
      .from(mcpServers)
      .where(eq(mcpServers.active, true))
      .groupBy(mcpServers.category),
    [],
    'getMCPServerStats:byCategory',
  )

  // Count by verification
  const { data: verificationStats } = await safeDbQuery(
    () => db
      .select({
        verificationStatus: mcpServers.verificationStatus,
        count: sql<number>`count(*)`,
      })
      .from(mcpServers)
      .where(eq(mcpServers.active, true))
      .groupBy(mcpServers.verificationStatus),
    [],
    'getMCPServerStats:byVerification',
  )

  const bySource: Record<string, number> = {}
  let total = 0
  for (const stat of sourceStats) {
    bySource[stat.sourceRegistry] = Number(stat.count)
    total += Number(stat.count)
  }

  const byCategory: Record<string, number> = {}
  for (const stat of categoryStats) {
    byCategory[stat.category] = Number(stat.count)
  }

  const byVerification: Record<string, number> = {}
  for (const stat of verificationStats) {
    if (stat.verificationStatus) {
      byVerification[stat.verificationStatus] = Number(stat.count)
    }
  }

  return { total, bySource, byCategory, byVerification }
}

/**
 * Get featured/popular MCP servers based on engagement score
 */
export async function getFeaturedMCPServersFromDB(limit: number = 10): Promise<MCPServerWithParsedJSON[]> {
  const { data: results } = await safeDbQuery(
    () => db
      .select()
      .from(mcpServers)
      .where(
        and(
          eq(mcpServers.active, true),
          eq(mcpServers.verificationStatus, 'verified')
        )
      )
      .orderBy(sql`COALESCE(${mcpServers.dockerPulls}, 0) + COALESCE(${mcpServers.githubStars}, 0) * 100 DESC`)
      .limit(limit),
    [],
    'getFeaturedMCPServersFromDB',
  )

  return results.map(transformToMCPServerWithParsedJSON)
}

/**
 * Get list of unique source registries for filter dropdown
 */
export async function getMCPSourceRegistries(): Promise<Array<{ id: string; name: string; count: number }>> {
  const { data: sources } = await safeDbQuery(
    () => db
      .select({
        sourceRegistry: mcpServers.sourceRegistry,
        count: sql<number>`count(*)`,
      })
      .from(mcpServers)
      .where(eq(mcpServers.active, true))
      .groupBy(mcpServers.sourceRegistry)
      .orderBy(sql`count(*) DESC`),
    [],
    'getMCPSourceRegistries',
  )

  const sourceNames: Record<string, string> = {
    'official-mcp': 'Official MCP',
    docker: 'Docker Hub',
    github: 'GitHub',
    community: 'Community',
  }

  return sources.map((s) => ({
    id: s.sourceRegistry,
    name: sourceNames[s.sourceRegistry] || s.sourceRegistry,
    count: Number(s.count),
  }))
}

/**
 * Record stats snapshot for an MCP server
 */
export async function recordMCPServerStats(
  serverId: string,
  stats: { githubStars?: number; dockerPulls?: number; npmDownloads?: number }
): Promise<void> {
  await safeDbQuery(
    () => db.insert(mcpServerStats).values({
      mcpServerId: serverId,
      githubStars: stats.githubStars ?? 0,
      dockerPulls: stats.dockerPulls ?? 0,
      npmDownloads: stats.npmDownloads ?? 0,
    }),
    undefined as any,
    'recordMCPServerStats',
  )
}
