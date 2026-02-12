import { db } from '@/lib/db/client'
import { plugins, skills, marketplaces } from '@/lib/db/schema'
import { eq, ilike, or, sql, desc, asc, and, inArray } from 'drizzle-orm'
import type { UnifiedPlugin, PluginType } from './plugin-types'

// Import local plugin loaders for Build with Claude plugins
import { getAllSubagents } from './subagents-server'
import { getAllCommands } from './commands-server'
import { getAllHooks } from './hooks-server'
import { getAllSkills } from './skills-server'
import { getAllPlugins as getLocalPlugins } from './plugins-server'

export type SortOption = 'relevance' | 'stars' | 'newest' | 'oldest' | 'name' | 'name-desc' | 'updated'

export interface PluginFilters {
  search?: string
  type?: PluginType | 'all'
  marketplaceId?: string
  category?: string
}

export interface PaginatedPlugins {
  plugins: UnifiedPlugin[]
  total: number
  limit: number
  offset: number
  hasMore: boolean
}

export interface MarketplaceOption {
  id: string
  name: string
  displayName: string
  pluginCount: number
}

const BUILD_WITH_CLAUDE_MARKETPLACE = 'Build with Claude'
const BUILD_WITH_CLAUDE_ID = 'build-with-claude'

/**
 * Load all local Build with Claude plugins and convert to UnifiedPlugin format
 */
function getLocalBuildWithClaudePlugins(): UnifiedPlugin[] {
  const results: UnifiedPlugin[] = []

  // Load subagents
  try {
    const subagents = getAllSubagents()
    for (const s of subagents) {
      results.push({
        type: 'subagent',
        name: s.name,
        description: s.description,
        category: s.category,
        tags: [],
        marketplaceId: BUILD_WITH_CLAUDE_ID,
        marketplaceName: BUILD_WITH_CLAUDE_MARKETPLACE,
      })
    }
  } catch (e) {
    console.warn('Error loading local subagents:', e)
  }

  // Load commands
  try {
    const commands = getAllCommands()
    for (const c of commands) {
      results.push({
        type: 'command',
        name: c.slug,
        description: c.description,
        category: c.category,
        tags: [],
        marketplaceId: BUILD_WITH_CLAUDE_ID,
        marketplaceName: BUILD_WITH_CLAUDE_MARKETPLACE,
      })
    }
  } catch (e) {
    console.warn('Error loading local commands:', e)
  }

  // Load hooks
  try {
    const hooks = getAllHooks()
    for (const h of hooks) {
      results.push({
        type: 'hook',
        name: h.name,
        description: h.description,
        category: h.category,
        tags: [],
        marketplaceId: BUILD_WITH_CLAUDE_ID,
        marketplaceName: BUILD_WITH_CLAUDE_MARKETPLACE,
      })
    }
  } catch (e) {
    console.warn('Error loading local hooks:', e)
  }

  // Load skills
  try {
    const skills = getAllSkills()
    for (const s of skills) {
      results.push({
        type: 'skill',
        name: s.name,
        description: s.description,
        category: s.category,
        tags: [],
        marketplaceId: BUILD_WITH_CLAUDE_ID,
        marketplaceName: BUILD_WITH_CLAUDE_MARKETPLACE,
      })
    }
  } catch (e) {
    console.warn('Error loading local skills:', e)
  }

  // Load plugins from marketplace.json
  try {
    const localPlugins = getLocalPlugins()
    for (const p of localPlugins) {
      results.push({
        type: 'plugin',
        name: p.name,
        description: p.description,
        category: p.category,
        tags: p.keywords || [],
        marketplaceId: BUILD_WITH_CLAUDE_ID,
        marketplaceName: BUILD_WITH_CLAUDE_MARKETPLACE,
        repository: p.repository,
        author: p.author?.name,
        version: p.version,
      })
    }
  } catch (e) {
    console.warn('Error loading local plugins:', e)
  }

  return results
}

/**
 * Filter local plugins based on search/type/marketplace criteria
 */
function filterLocalPlugins(
  plugins: UnifiedPlugin[],
  options: {
    search?: string
    type?: PluginType | 'all'
    marketplaceId?: string
    category?: string
  }
): UnifiedPlugin[] {
  let filtered = plugins

  // Type filter
  if (options.type && options.type !== 'all') {
    filtered = filtered.filter(p => p.type === options.type)
  }

  // Marketplace filter - only include if 'all' or matching Build with Claude
  if (options.marketplaceId && options.marketplaceId !== 'all') {
    if (options.marketplaceId !== BUILD_WITH_CLAUDE_ID &&
        options.marketplaceId !== BUILD_WITH_CLAUDE_MARKETPLACE) {
      return [] // Not Build with Claude marketplace, return empty
    }
  }

  // Category filter (supports comma-separated categories with OR logic)
  if (options.category) {
    const categories = options.category.split(',').map(c => c.trim()).filter(Boolean)
    if (categories.length > 0) {
      filtered = filtered.filter(p => categories.includes(p.category || ''))
    }
  }

  // Search filter
  if (options.search) {
    const searchLower = options.search.toLowerCase()
    filtered = filtered.filter(p =>
      p.name.toLowerCase().includes(searchLower) ||
      p.description.toLowerCase().includes(searchLower) ||
      p.tags?.some(t => t.toLowerCase().includes(searchLower))
    )
  }

  return filtered
}

/**
 * Sort plugins by the given sort option
 */
function sortPlugins(plugins: UnifiedPlugin[], sort: SortOption, search?: string): UnifiedPlugin[] {
  const sorted = [...plugins]

  switch (sort) {
    case 'name':
      return sorted.sort((a, b) => a.name.localeCompare(b.name))
    case 'name-desc':
      return sorted.sort((a, b) => b.name.localeCompare(a.name))
    case 'stars':
      return sorted.sort((a, b) => (b.stars || 0) - (a.stars || 0))
    case 'newest':
    case 'oldest':
    case 'updated':
      // Local plugins don't have dates, keep current order
      return sorted
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

/**
 * Get paginated plugins from local files and database with optional filters
 * Hybrid approach: Local Build with Claude plugins are always loaded from files,
 * merged with database plugins from external marketplaces
 */
export async function getPluginsPaginated(options: {
  limit?: number
  offset?: number
  search?: string
  sort?: SortOption
  type?: PluginType | 'all'
  marketplaceId?: string
  category?: string
}): Promise<PaginatedPlugins> {
  const {
    limit = 50,
    offset = 0,
    search,
    sort = 'relevance',
    type = 'all',
    marketplaceId,
    category,
  } = options

  // Check if filtering to Build with Claude only
  const isBWCOnly = marketplaceId === BUILD_WITH_CLAUDE_ID ||
                    marketplaceId === BUILD_WITH_CLAUDE_MARKETPLACE

  // Check if filtering to a non-BWC marketplace (skip local plugins)
  const isOtherMarketplace = marketplaceId &&
                             marketplaceId !== 'all' &&
                             !isBWCOnly

  // 1. Get local Build with Claude plugins (always loaded from files)
  let localPlugins: UnifiedPlugin[] = []
  if (!isOtherMarketplace) {
    const allLocalPlugins = getLocalBuildWithClaudePlugins()
    localPlugins = filterLocalPlugins(allLocalPlugins, { search, type, marketplaceId, category })
    localPlugins = sortPlugins(localPlugins, sort, search)
  }

  // 2. If only Build with Claude, return local results directly
  if (isBWCOnly) {
    const paginatedLocal = localPlugins.slice(offset, offset + limit)
    return {
      plugins: paginatedLocal,
      total: localPlugins.length,
      limit,
      offset,
      hasMore: offset + paginatedLocal.length < localPlugins.length,
    }
  }

  // 3. For 'all' marketplaces or other marketplaces, also query database
  // Build where conditions for database query
  const conditions = []
  conditions.push(eq(plugins.active, true))

  // Type filter
  if (type && type !== 'all') {
    conditions.push(eq(plugins.type, type))
  }

  // Marketplace filter for database (skip BWC since we handle it locally)
  if (marketplaceId && marketplaceId !== 'all') {
    // Only compare against marketplace_id (UUID column) if the value is a valid UUID
    const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(marketplaceId)
    if (isUUID) {
      conditions.push(
        or(
          eq(plugins.marketplaceId, marketplaceId),
          eq(plugins.marketplaceName, marketplaceId)
        )
      )
    } else {
      conditions.push(eq(plugins.marketplaceName, marketplaceId))
    }
  }

  // Category filter (supports comma-separated categories with OR logic)
  if (category) {
    const categories = category.split(',').map(c => c.trim()).filter(Boolean)
    if (categories.length === 1) {
      conditions.push(sql`${categories[0]} = ANY(${plugins.categories})`)
    } else if (categories.length > 1) {
      // OR logic: plugin matches if ANY of its categories is in the selected list
      conditions.push(sql`${plugins.categories} && ARRAY[${sql.join(categories.map(c => sql`${c}`), sql`, `)}]::text[]`)
    }
  }

  // Search filter
  if (search) {
    const searchPattern = `%${search}%`
    conditions.push(
      or(
        ilike(plugins.name, searchPattern),
        ilike(plugins.description, searchPattern),
        sql`${search} = ANY(${plugins.keywords})`
      )
    )
  }

  // Determine sort order for database
  let orderBy
  switch (sort) {
    case 'name':
      orderBy = asc(plugins.name)
      break
    case 'name-desc':
      orderBy = desc(plugins.name)
      break
    case 'newest':
      orderBy = desc(plugins.updatedAt)
      break
    case 'oldest':
      orderBy = asc(plugins.updatedAt)
      break
    case 'updated':
      orderBy = desc(plugins.updatedAt)
      break
    case 'stars':
      orderBy = sql`COALESCE(${plugins.stars}, 0) DESC`
      break
    case 'relevance':
    default:
      if (search) {
        orderBy = sql`
          CASE
            WHEN ${plugins.name} ILIKE ${search} THEN 0
            WHEN ${plugins.name} ILIKE ${`${search}%`} THEN 1
            WHEN ${plugins.name} ILIKE ${`%${search}%`} THEN 2
            WHEN ${plugins.description} ILIKE ${`%${search}%`} THEN 3
            ELSE 4
          END,
          COALESCE(${plugins.stars}, 0) DESC
        `
      } else {
        orderBy = asc(plugins.name)
      }
      break
  }

  const whereClause = conditions.length > 0 ? and(...conditions) : undefined

  // Query database
  const [dbResults, dbCountResult] = await Promise.all([
    db
      .select({
        id: plugins.id,
        name: plugins.name,
        namespace: plugins.namespace,
        slug: plugins.slug,
        description: plugins.description,
        version: plugins.version,
        author: plugins.author,
        type: plugins.type,
        categories: plugins.categories,
        keywords: plugins.keywords,
        repository: plugins.repository,
        stars: plugins.stars,
        installCommand: plugins.installCommand,
        marketplaceId: plugins.marketplaceId,
        marketplaceName: plugins.marketplaceName,
        updatedAt: plugins.updatedAt,
      })
      .from(plugins)
      .where(whereClause)
      .orderBy(orderBy)
      .limit(1000), // Get more to allow merging and deduplication

    db
      .select({ count: sql<number>`count(*)` })
      .from(plugins)
      .where(whereClause),
  ])

  // Transform database results to UnifiedPlugin format
  const dbPlugins: UnifiedPlugin[] = dbResults.map((p) => ({
    type: (p.type as PluginType) || 'plugin',
    name: p.name,
    description: p.description || '',
    category: p.categories?.[0] || 'uncategorized',
    tags: p.keywords || [],
    marketplaceId: p.marketplaceId || undefined,
    marketplaceName: p.marketplaceName || undefined,
    repository: p.repository || undefined,
    stars: p.stars,
    installCommand: p.installCommand || undefined,
    namespace: p.namespace,
    author: p.author || undefined,
    version: p.version || undefined,
  }))

  // 4. Merge local and DB plugins (local first for relevance sort)
  // Deduplicate by name+type (local takes precedence)
  const seen = new Set<string>()
  const merged: UnifiedPlugin[] = []

  // Add local plugins first
  for (const p of localPlugins) {
    const key = `${p.type}:${p.name.toLowerCase()}`
    if (!seen.has(key)) {
      seen.add(key)
      merged.push(p)
    }
  }

  // Add database plugins (skip duplicates)
  for (const p of dbPlugins) {
    const key = `${p.type}:${p.name.toLowerCase()}`
    if (!seen.has(key)) {
      seen.add(key)
      merged.push(p)
    }
  }

  // 5. Re-sort the merged list
  const sortedMerged = sortPlugins(merged, sort, search)

  // 6. Paginate
  const total = sortedMerged.length
  const paginatedResults = sortedMerged.slice(offset, offset + limit)

  return {
    plugins: paginatedResults,
    total,
    limit,
    offset,
    hasMore: offset + paginatedResults.length < total,
  }
}

/**
 * Get list of marketplaces for filter dropdown
 * Includes Build with Claude (from local files), registered marketplaces, and plugin sources
 */
export async function getPluginMarketplaces(): Promise<MarketplaceOption[]> {
  // Get local Build with Claude plugin count
  const localPlugins = getLocalBuildWithClaudePlugins()
  const localCount = localPlugins.length

  // Get registered marketplaces from marketplaces table
  const dbMarketplaces = await db
    .select({
      id: marketplaces.id,
      name: marketplaces.name,
      displayName: marketplaces.displayName,
      pluginCount: marketplaces.pluginCount,
    })
    .from(marketplaces)
    .where(eq(marketplaces.active, true))
    .orderBy(desc(marketplaces.pluginCount))

  // Also get unique marketplaceNames from plugins (to include sources not in marketplaces table)
  const pluginMarketplaces = await db
    .select({
      marketplaceName: plugins.marketplaceName,
      count: sql<number>`count(*)`,
    })
    .from(plugins)
    .where(eq(plugins.active, true))
    .groupBy(plugins.marketplaceName)

  // Start with Build with Claude from local files
  const results: MarketplaceOption[] = [{
    id: BUILD_WITH_CLAUDE_ID,
    name: BUILD_WITH_CLAUDE_ID,
    displayName: BUILD_WITH_CLAUDE_MARKETPLACE,
    pluginCount: localCount,
  }]

  // Map db marketplaces to result format (skip Build with Claude as we handle it locally)
  const existingNames = new Set([BUILD_WITH_CLAUDE_MARKETPLACE])
  for (const m of dbMarketplaces) {
    if (!existingNames.has(m.displayName)) {
      results.push({
        id: m.id,
        name: m.name,
        displayName: m.displayName,
        pluginCount: m.pluginCount,
      })
      existingNames.add(m.displayName)
    }
  }

  // Add any marketplace names from plugins that aren't already in results
  for (const pm of pluginMarketplaces) {
    if (pm.marketplaceName && !existingNames.has(pm.marketplaceName)) {
      results.push({
        id: pm.marketplaceName,
        name: pm.marketplaceName,
        displayName: pm.marketplaceName,
        pluginCount: Number(pm.count),
      })
      existingNames.add(pm.marketplaceName)
    }
  }

  // Sort by plugin count descending (Build with Claude will naturally be at top if it has most plugins)
  return results.sort((a, b) => b.pluginCount - a.pluginCount)
}

/**
 * Get plugin stats for the UI (matching plugin-server.ts format)
 * Merges local Build with Claude plugins with database plugins
 */
export async function getPluginStatsForUI(): Promise<{
  total: number
  subagents: number
  commands: number
  hooks: number
  skills: number
  plugins: number
}> {
  // Get local Build with Claude plugins
  const localPlugins = getLocalBuildWithClaudePlugins()

  // Count local plugins by type
  const localCounts = {
    subagents: 0,
    commands: 0,
    hooks: 0,
    skills: 0,
    plugins: 0,
  }

  for (const p of localPlugins) {
    switch (p.type) {
      case 'subagent':
        localCounts.subagents++
        break
      case 'command':
        localCounts.commands++
        break
      case 'hook':
        localCounts.hooks++
        break
      case 'skill':
        localCounts.skills++
        break
      case 'plugin':
      default:
        localCounts.plugins++
        break
    }
  }

  // Get database stats
  const typeStats = await db
    .select({
      type: plugins.type,
      count: sql<number>`count(*)`,
    })
    .from(plugins)
    .where(eq(plugins.active, true))
    .groupBy(plugins.type)

  const dbCounts = {
    subagents: 0,
    commands: 0,
    hooks: 0,
    skills: 0,
    plugins: 0,
  }

  for (const stat of typeStats) {
    const count = Number(stat.count)

    switch (stat.type) {
      case 'subagent':
        dbCounts.subagents = count
        break
      case 'command':
        dbCounts.commands = count
        break
      case 'hook':
        dbCounts.hooks = count
        break
      case 'skill':
        dbCounts.skills = count
        break
      case 'plugin':
      case 'mcp':
      default:
        dbCounts.plugins += count
        break
    }
  }

  // Use local counts as the primary source (since we always load from local files)
  // Add database counts for types that might have additional external plugins
  // Note: We use MAX of local and db counts since local files are authoritative for BWC
  const counts = {
    total: 0,
    subagents: Math.max(localCounts.subagents, dbCounts.subagents),
    commands: Math.max(localCounts.commands, dbCounts.commands),
    hooks: Math.max(localCounts.hooks, dbCounts.hooks),
    skills: Math.max(localCounts.skills, dbCounts.skills),
    plugins: localCounts.plugins + dbCounts.plugins, // Plugins can be additive (external plugins)
  }

  counts.total = counts.subagents + counts.commands + counts.hooks + counts.skills + counts.plugins

  return counts
}

/**
 * Get plugin stats by type and marketplace
 */
export async function getPluginStats(): Promise<{
  total: number
  byType: Record<string, number>
  byMarketplace: Record<string, number>
}> {
  // Count by type
  const typeStats = await db
    .select({
      type: plugins.type,
      count: sql<number>`count(*)`,
    })
    .from(plugins)
    .where(eq(plugins.active, true))
    .groupBy(plugins.type)

  // Count by marketplace
  const marketplaceStats = await db
    .select({
      marketplaceName: plugins.marketplaceName,
      count: sql<number>`count(*)`,
    })
    .from(plugins)
    .where(eq(plugins.active, true))
    .groupBy(plugins.marketplaceName)

  const byType: Record<string, number> = {}
  let total = 0

  for (const stat of typeStats) {
    byType[stat.type] = Number(stat.count)
    total += Number(stat.count)
  }

  const byMarketplace: Record<string, number> = {}
  for (const stat of marketplaceStats) {
    if (stat.marketplaceName) {
      byMarketplace[stat.marketplaceName] = Number(stat.count)
    }
  }

  return { total, byType, byMarketplace }
}

export interface PluginCategory {
  name: string
  count: number
}

/**
 * Get unique plugin categories with counts from all sources (local + database)
 * Returns semantic categories like development, ai-powered, workflow-automation, etc.
 */
export async function getPluginCategories(): Promise<PluginCategory[]> {
  const categoryCounts: Record<string, number> = {}

  // Get categories from database plugins (semantic categories)
  try {
    const dbCategories = await db
      .select({ category: sql<string>`unnest(${plugins.categories})` })
      .from(plugins)
      .where(and(
        eq(plugins.active, true),
        eq(plugins.type, 'plugin')
      ))

    // Count database categories
    for (const row of dbCategories) {
      if (row.category) {
        categoryCounts[row.category] = (categoryCounts[row.category] || 0) + 1
      }
    }
  } catch (e) {
    console.warn('Error fetching database categories:', e)
  }

  // Also include local plugin categories
  const localPlugins = getLocalBuildWithClaudePlugins()
  const pluginsOnly = localPlugins.filter(p => p.type === 'plugin')
  for (const p of pluginsOnly) {
    const category = p.category || 'uncategorized'
    categoryCounts[category] = (categoryCounts[category] || 0) + 1
  }

  // Convert to array and sort by count descending
  return Object.entries(categoryCounts)
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count)
}

/**
 * Get total count of plugins (type='plugin' only) from all sources
 */
export async function getPluginOnlyCount(): Promise<number> {
  // Count local plugins
  const localPlugins = getLocalBuildWithClaudePlugins()
  const localCount = localPlugins.filter(p => p.type === 'plugin').length

  // Count database plugins
  const dbCount = await db
    .select({ count: sql<number>`count(*)` })
    .from(plugins)
    .where(and(
      eq(plugins.active, true),
      eq(plugins.type, 'plugin')
    ))

  return localCount + Number(dbCount[0]?.count || 0)
}

/**
 * Get list of marketplaces for skill filter dropdown
 * Same as getPluginMarketplaces() but counts only type='skill' items
 */
export async function getSkillMarketplaces(): Promise<MarketplaceOption[]> {
  // Get local Build with Claude skill count
  const localPlugins = getLocalBuildWithClaudePlugins()
  const localSkillCount = localPlugins.filter(p => p.type === 'skill').length

  // Count actual skills from the plugins table, joined with marketplaces for display metadata
  const dbSkillCounts = await db
    .select({
      id: marketplaces.id,
      name: marketplaces.name,
      displayName: marketplaces.displayName,
      count: sql<number>`count(*)`,
    })
    .from(plugins)
    .innerJoin(marketplaces, eq(plugins.marketplaceId, marketplaces.id))
    .where(and(eq(plugins.active, true), eq(plugins.type, 'skill'), eq(marketplaces.active, true)))
    .groupBy(marketplaces.id, marketplaces.name, marketplaces.displayName)
    .orderBy(desc(sql`count(*)`))

  // Also get skills with marketplaceName but no matching marketplaceId
  const unmatchedSkills = await db
    .select({
      marketplaceName: plugins.marketplaceName,
      count: sql<number>`count(*)`,
    })
    .from(plugins)
    .where(and(eq(plugins.active, true), eq(plugins.type, 'skill'), sql`${plugins.marketplaceId} IS NULL`))
    .groupBy(plugins.marketplaceName)

  // Start with Build with Claude from local files
  const results: MarketplaceOption[] = [{
    id: BUILD_WITH_CLAUDE_ID,
    name: BUILD_WITH_CLAUDE_ID,
    displayName: BUILD_WITH_CLAUDE_MARKETPLACE,
    pluginCount: localSkillCount,
  }]

  // Add DB marketplaces that actually have skills (skip Build with Claude as we handle it locally)
  const existingNames = new Set([BUILD_WITH_CLAUDE_MARKETPLACE])
  for (const m of dbSkillCounts) {
    if (!existingNames.has(m.displayName)) {
      results.push({
        id: m.id,
        name: m.name,
        displayName: m.displayName,
        pluginCount: Number(m.count),
      })
      existingNames.add(m.displayName)
    }
  }

  // Add any unmatched marketplace names from plugins that aren't already in results
  for (const pm of unmatchedSkills) {
    if (pm.marketplaceName && !existingNames.has(pm.marketplaceName)) {
      results.push({
        id: pm.marketplaceName,
        name: pm.marketplaceName,
        displayName: pm.marketplaceName,
        pluginCount: Number(pm.count),
      })
      existingNames.add(pm.marketplaceName)
    }
  }

  // Sort by count descending
  return results.sort((a, b) => b.pluginCount - a.pluginCount)
}

/**
 * Get unique skill categories with counts from all sources (local + database)
 */
export async function getSkillCategories(): Promise<PluginCategory[]> {
  const categoryCounts: Record<string, number> = {}

  // Get categories from database plugins where type='skill'
  try {
    const dbCategories = await db
      .select({ category: sql<string>`unnest(${plugins.categories})` })
      .from(plugins)
      .where(and(
        eq(plugins.active, true),
        eq(plugins.type, 'skill')
      ))

    for (const row of dbCategories) {
      if (row.category) {
        categoryCounts[row.category] = (categoryCounts[row.category] || 0) + 1
      }
    }
  } catch (e) {
    console.warn('Error fetching database skill categories:', e)
  }

  // Also include local skill categories
  const localPlugins = getLocalBuildWithClaudePlugins()
  const skillsOnly = localPlugins.filter(p => p.type === 'skill')
  for (const p of skillsOnly) {
    const category = p.category || 'uncategorized'
    categoryCounts[category] = (categoryCounts[category] || 0) + 1
  }

  return Object.entries(categoryCounts)
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count)
}

/**
 * Get total count of skills (type='skill' only) from all sources
 */
export async function getSkillOnlyCount(): Promise<number> {
  // Count local skills
  const localPlugins = getLocalBuildWithClaudePlugins()
  const localCount = localPlugins.filter(p => p.type === 'skill').length

  // Count database skills
  const dbCount = await db
    .select({ count: sql<number>`count(*)` })
    .from(plugins)
    .where(and(
      eq(plugins.active, true),
      eq(plugins.type, 'skill')
    ))

  return localCount + Number(dbCount[0]?.count || 0)
}

/**
 * Get skills paginated
 */
export async function getSkillsPaginated(options: {
  limit?: number
  offset?: number
  search?: string
  marketplaceId?: string
  category?: string
}): Promise<{
  skills: Array<{
    id: string
    name: string
    slug: string
    description: string | null
    category: string | null
    marketplaceName: string | null
    repository: string | null
  }>
  total: number
  hasMore: boolean
}> {
  const { limit = 50, offset = 0, search, marketplaceId, category } = options

  const conditions = [eq(skills.active, true)]

  if (marketplaceId) {
    conditions.push(eq(skills.marketplaceId, marketplaceId))
  }

  if (category) {
    conditions.push(eq(skills.category, category))
  }

  if (search) {
    const searchPattern = `%${search}%`
    const searchCondition = or(
      ilike(skills.name, searchPattern),
      ilike(skills.description, searchPattern)
    )
    if (searchCondition) {
      conditions.push(searchCondition)
    }
  }

  const whereClause = conditions.length > 0 ? and(...conditions) : undefined

  const [results, countResult] = await Promise.all([
    db
      .select({
        id: skills.id,
        name: skills.name,
        slug: skills.slug,
        description: skills.description,
        category: skills.category,
        marketplaceName: skills.marketplaceName,
        repository: skills.repository,
      })
      .from(skills)
      .where(whereClause)
      .orderBy(asc(skills.name))
      .limit(limit)
      .offset(offset),

    db
      .select({ count: sql<number>`count(*)` })
      .from(skills)
      .where(whereClause),
  ])

  const total = Number(countResult[0]?.count || 0)

  return {
    skills: results,
    total,
    hasMore: offset + results.length < total,
  }
}

/**
 * Get plugin by slug or name
 */
export async function getPluginBySlug(slug: string): Promise<UnifiedPlugin | null> {
  const result = await db
    .select()
    .from(plugins)
    .where(or(eq(plugins.slug, slug), eq(plugins.name, slug)))
    .limit(1)

  if (!result.length) return null

  const p = result[0]
  return {
    type: (p.type as PluginType) || 'plugin',
    name: p.name,
    description: p.description || '',
    category: p.categories?.[0] || 'uncategorized',
    tags: p.keywords || [],
    marketplaceId: p.marketplaceId || undefined,
    marketplaceName: p.marketplaceName || undefined,
    repository: p.repository || undefined,
    stars: p.stars,
    installCommand: p.installCommand || undefined,
    namespace: p.namespace,
    author: p.author || undefined,
    version: p.version || undefined,
  }
}
