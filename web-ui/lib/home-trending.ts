import { db } from '@/lib/db/client'
import { plugins } from '@/lib/db/schema'
import { and, desc, eq, gt, inArray, ne } from 'drizzle-orm'
import { safeDbQuery } from '@/lib/db/safe-query'
import { getMCPServersPaginated } from '@/lib/mcp-server-db'
import { getMarketplacesPaginated } from '@/lib/marketplace-server'
import { firstPerKey, relativeDay } from './home-picks'

/** One row on the homepage's ranked lists. `metric` is always a real, labelled signal. */
export interface TrendingItem {
  kind: 'skill' | 'plugin' | 'mcp' | 'marketplace'
  name: string
  /** Internal path, or the GitHub repo URL for marketplaces (they have no detail page) */
  href: string
  description: string
  /** "owner/repo" for skills and plugins, vendor for MCP servers */
  source?: string
  metric: number
  /** Pre-formatted on the server ("today", "3d ago", "Oct 28") so server and client render the same text */
  added?: string
}

export interface HomeTrending {
  /** Ranked by skills.sh weekly installs */
  skills: TrendingItem[]
  /** Plugin marketplaces ranked by GitHub stars. Individual plugins carry no usable star or install data. */
  marketplaces: TrendingItem[]
  /** Ranked by Docker pulls */
  mcp: TrendingItem[]
  /** Plugins and skills by first-indexed date, one per repo */
  justAdded: TrendingItem[]
}

const repoSlug = (url: string | null) => url?.replace(/^https?:\/\/github\.com\//, '').replace(/\/$/, '') || undefined

const cols = {
  name: plugins.name,
  slug: plugins.slug,
  description: plugins.description,
  type: plugins.type,
  repository: plugins.repository,
  installs: plugins.installs,
  createdAt: plugins.createdAt,
}
const listed = and(eq(plugins.active, true), ne(plugins.submissionStatus, 'rejected'))

type Row = { name: string; slug: string; description: string | null; type: string; repository: string | null; installs: number; createdAt: Date }

const toItem = (row: Row, metric: number): TrendingItem => ({
  kind: row.type === 'skill' ? 'skill' : 'plugin',
  name: row.name,
  href: `/${row.type === 'skill' ? 'skill' : 'plugin'}/${row.slug}`,
  description: row.description || '',
  source: repoSlug(row.repository),
  metric,
})

/**
 * Ranked lists for the homepage. Every list falls back to [] when the database
 * is unreachable (safeDbQuery), and the page hides what is empty.
 */
export async function getHomeTrending(limit = 10): Promise<HomeTrending> {
  const [skillRows, newRows, mcp, markets] = await Promise.all([
    safeDbQuery<Row[]>(
      () => db.select(cols).from(plugins)
        .where(and(listed, eq(plugins.type, 'skill'), gt(plugins.installs, 0)))
        .orderBy(desc(plugins.installs)).limit(limit * 4),
      [], 'homeTrending:skills',
    ),
    safeDbQuery<Row[]>(
      () => db.select(cols).from(plugins)
        .where(and(listed, inArray(plugins.type, ['plugin', 'skill'])))
        .orderBy(desc(plugins.createdAt)).limit(300),
      [], 'homeTrending:new',
    ),
    getMCPServersPaginated({ limit, sort: 'downloads' }).catch(() => ({ servers: [] })),
    getMarketplacesPaginated({ limit, sort: 'stars' }).catch(() => ({ marketplaces: [] })),
  ])

  const byRepo = (row: Row) => row.repository || row.slug

  return {
    skills: firstPerKey(skillRows.data, (r) => r.slug, limit).map((r) => toItem(r, r.installs)),
    marketplaces: markets.marketplaces
      // Rows link straight to the repo, so only accept real https URLs from the database
      .filter((m) => (m.stars ?? 0) > 0 && m.repository?.startsWith('https://'))
      .map((m) => ({
        kind: 'marketplace' as const,
        name: m.displayName || m.name,
        href: m.repository,
        description: m.description || '',
        source: repoSlug(m.repository),
        metric: m.stars ?? 0,
      })),
    justAdded: firstPerKey(newRows.data, byRepo, 8).map((r) => ({ ...toItem(r, 0), added: relativeDay(r.createdAt) })),
    mcp: mcp.servers
      .filter((s) => (s.dockerPulls ?? 0) > 0)
      .map((s) => ({
        kind: 'mcp' as const,
        name: s.displayName || s.name,
        href: `/mcp-server/${s.slug}`,
        description: s.description || '',
        source: s.vendor || undefined,
        metric: s.dockerPulls ?? 0,
      })),
  }
}
