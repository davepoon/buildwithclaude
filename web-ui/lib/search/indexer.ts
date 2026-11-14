import { and, eq, ne } from 'drizzle-orm'
import { db } from '@/lib/db/client'
import { plugins, mcpServers, marketplaces } from '@/lib/db/schema'
import { getAllSubagents } from '@/lib/subagents-server'
import { getAllCommands } from '@/lib/commands-server'
import { getAllHooks } from '@/lib/hooks-server'
import { getAllSkills } from '@/lib/skills-server'
import { getLocalBuildWithClaudePlugins } from '@/lib/plugin-db-server'
import { themes } from '@/lib/themes'
import { getMeiliClient, getContentIndex, CONTENT_INDEX } from './meilisearch-client'
import {
  CONTENT_INDEX_SETTINGS,
  makeObjectID,
  urlForDocument,
  SEARCH_CONTENT_TYPES,
  type SearchContentType,
  type SearchDocument,
} from './search-types'

// Cap stored body length: keeps Meilisearch payloads modest and the index lean.
// The head of a doc carries the most relevant text; `content` is the lowest-
// priority searchable attribute anyway.
const CONTENT_MAX = 12_000
// Documents per addDocuments batch (small enough to bound each HTTP payload).
const ADD_CHUNK = 1000
// Generous wait bound for large delete/add tasks (the corpus is tens of
// thousands of docs). Outer route/cron limits are the real ceiling.
const WAIT = { timeout: 240_000 }

function splitList(value?: string | null): string[] {
  return value ? value.split(',').map((v) => v.trim()).filter(Boolean) : []
}

function truncate(value?: string | null): string | undefined {
  if (!value) return undefined
  return value.length > CONTENT_MAX ? value.slice(0, CONTENT_MAX) : value
}

function epoch(date?: Date | null): number {
  return date instanceof Date ? date.getTime() : 0
}

function dedupe(...lists: (string | undefined | null)[][]): string[] {
  const out = new Set<string>()
  for (const list of lists) for (const v of list) if (v) out.add(v)
  return [...out]
}

// ---------------------------------------------------------------------------
// Markdown-sourced transforms (read from plugins/*; change only on deploy).
// Each is wrapped so one bad source can never abort a full rebuild.
// ---------------------------------------------------------------------------

export function subagentsToDocs(): SearchDocument[] {
  try {
    return getAllSubagents().map((s) => ({
      objectID: makeObjectID('subagent', s.slug),
      type: 'subagent',
      slug: s.slug,
      name: s.name,
      description: s.description,
      category: s.category,
      categories: [s.category],
      tags: splitList(s.tools),
      content: truncate(s.content),
      stars: 0,
      installs: 0,
      updatedAt: 0,
      url: urlForDocument('subagent', s.slug),
    }))
  } catch (e) {
    console.warn('[search] subagentsToDocs failed:', e)
    return []
  }
}

export function commandsToDocs(): SearchDocument[] {
  try {
    return getAllCommands().map((c) => ({
      objectID: makeObjectID('command', c.slug),
      type: 'command',
      slug: c.slug,
      name: c.slug, // commands have no name field; the slug is the display title
      description: c.description,
      category: c.category,
      categories: [c.category],
      tags: splitList(c.allowedTools),
      content: truncate(c.content),
      model: c.model,
      stars: 0,
      installs: 0,
      updatedAt: 0,
      url: urlForDocument('command', c.slug),
    }))
  } catch (e) {
    console.warn('[search] commandsToDocs failed:', e)
    return []
  }
}

export function hooksToDocs(): SearchDocument[] {
  try {
    return getAllHooks().map((h) => ({
      objectID: makeObjectID('hook', h.slug),
      type: 'hook',
      slug: h.slug,
      name: h.name,
      description: h.description,
      category: h.category,
      categories: [h.category],
      // Surface event/matcher/language for search (they are also discrete filters).
      tags: dedupe([h.event, h.matcher, h.language]),
      content: truncate(h.content),
      event: h.event,
      language: h.language,
      stars: 0,
      installs: 0,
      updatedAt: 0,
      url: urlForDocument('hook', h.slug),
    }))
  } catch (e) {
    console.warn('[search] hooksToDocs failed:', e)
    return []
  }
}

export function localSkillsToDocs(): SearchDocument[] {
  try {
    return getAllSkills().map((s) => ({
      objectID: makeObjectID('skill', s.slug),
      type: 'skill',
      slug: s.slug,
      name: s.name,
      description: s.description,
      category: s.category,
      categories: [s.category],
      tags: splitList(s.allowedTools),
      content: truncate(s.content),
      model: s.model,
      stars: 0,
      installs: 0,
      updatedAt: 0,
      url: urlForDocument('skill', s.slug),
    }))
  } catch (e) {
    console.warn('[search] localSkillsToDocs failed:', e)
    return []
  }
}

/** Themes come from the curated lib/themes.json listing (changes only on deploy). */
export function themesToDocs(): SearchDocument[] {
  return themes.map((t) => ({
    objectID: makeObjectID('theme', t.slug),
    type: 'theme',
    slug: t.slug,
    name: t.name,
    description: t.description,
    category: t.kind,
    categories: [t.kind],
    tags: dedupe(['theme', t.kind, t.author, t.appearance]),
    stars: 0,
    installs: 0,
    updatedAt: 0,
    url: urlForDocument('theme', t.slug, t.name),
  }))
}

// ---------------------------------------------------------------------------
// DB-sourced transforms (Postgres is source of truth; refreshed by cron).
// Queried directly so we get the sortable signals (stars/installs/updatedAt).
// ---------------------------------------------------------------------------

/**
 * Detail link for a plugin search doc, mirroring UnifiedPluginCard.getDetailUrl:
 * only Build with Claude plugins have an on-site page (app/plugin/[slug], which
 * resolves by name from local marketplace files); every external-marketplace
 * plugin links to its repository. Without this, external plugins linked to
 * /plugin/<slug>, which 404s because that route only resolves local plugins.
 * Falls back to the /plugins list on the (currently non-existent) case of an
 * external plugin with no repository.
 */
function pluginDetailUrl(
  marketplaceName: string | null | undefined,
  name: string,
  repository: string | null | undefined,
): string {
  if (marketplaceName === 'Build with Claude') return `/plugin/${name}`
  return repository || '/plugins'
}

export async function pluginsToDocs(): Promise<SearchDocument[]> {
  const docs: SearchDocument[] = []

  // 1. DB plugins (external marketplaces)
  try {
    const rows = await db
      .select({
        slug: plugins.slug,
        name: plugins.name,
        description: plugins.description,
        content: plugins.content,
        categories: plugins.categories,
        keywords: plugins.keywords,
        marketplaceName: plugins.marketplaceName,
        marketplaceId: plugins.marketplaceId,
        repository: plugins.repository,
        stars: plugins.stars,
        installs: plugins.installs,
        updatedAt: plugins.updatedAt,
      })
      .from(plugins)
      .where(
        and(
          eq(plugins.active, true),
          eq(plugins.type, 'plugin'),
          ne(plugins.submissionStatus, 'rejected'),
        ),
      )
    for (const p of rows) {
      docs.push({
        objectID: makeObjectID('plugin', p.slug),
        type: 'plugin',
        slug: p.slug,
        name: p.name,
        description: p.description ?? '',
        category: p.categories?.[0],
        categories: p.categories ?? [],
        tags: p.keywords ?? [],
        content: truncate(p.content),
        marketplace: p.marketplaceName ?? undefined,
        marketplaceId: p.marketplaceId ?? undefined,
        stars: p.stars ?? 0,
        installs: p.installs ?? 0,
        updatedAt: epoch(p.updatedAt),
        url: pluginDetailUrl(p.marketplaceName, p.name, p.repository),
      })
    }
  } catch (e) {
    console.warn('[search] pluginsToDocs (db) failed:', e)
  }

  // 2. Local Build with Claude plugins (from marketplace.json) — not in the DB
  // table, but shown on /plugins, so they must be searchable. Their detail URL
  // and slug key on `name` (see UnifiedPluginCard.getDetailUrl).
  try {
    const local = getLocalBuildWithClaudePlugins().filter((p) => p.type === 'plugin')
    for (const p of local) {
      const slug = p.slug ?? p.name
      docs.push({
        objectID: makeObjectID('plugin', slug),
        type: 'plugin',
        slug,
        name: p.name,
        description: p.description ?? '',
        category: p.category,
        categories: p.category ? [p.category] : [],
        tags: p.tags ?? [],
        marketplace: p.marketplaceName ?? undefined,
        marketplaceId: p.marketplaceId ?? undefined,
        stars: p.stars ?? 0,
        installs: p.installs ?? 0,
        updatedAt: 0,
        url: pluginDetailUrl(p.marketplaceName, p.name, p.repository),
      })
    }
  } catch (e) {
    console.warn('[search] pluginsToDocs (local) failed:', e)
  }

  return docs
}

/**
 * DB-imported skills live in the `plugins` table with type='skill' (this is the
 * source the skill detail page resolves from). Local file skills are indexed
 * separately by localSkillsToDocs(); dedupe keeps the local copy on collision.
 */
export async function dbSkillsToDocs(): Promise<SearchDocument[]> {
  try {
    const rows = await db
      .select({
        slug: plugins.slug,
        name: plugins.name,
        description: plugins.description,
        content: plugins.content,
        categories: plugins.categories,
        keywords: plugins.keywords,
        marketplaceName: plugins.marketplaceName,
        marketplaceId: plugins.marketplaceId,
        stars: plugins.stars,
        installs: plugins.installs,
        updatedAt: plugins.updatedAt,
      })
      .from(plugins)
      .where(
        and(
          eq(plugins.active, true),
          eq(plugins.type, 'skill'),
          ne(plugins.submissionStatus, 'rejected'),
        ),
      )
    return rows.map((p) => ({
      objectID: makeObjectID('skill', p.slug),
      type: 'skill',
      slug: p.slug,
      name: p.name,
      description: p.description ?? '',
      category: p.categories?.[0],
      categories: p.categories ?? [],
      tags: p.keywords ?? [],
      content: truncate(p.content),
      marketplace: p.marketplaceName ?? undefined,
      marketplaceId: p.marketplaceId ?? undefined,
      stars: p.stars ?? 0,
      installs: p.installs ?? 0,
      updatedAt: epoch(p.updatedAt),
      url: urlForDocument('skill', p.slug),
    }))
  } catch (e) {
    console.warn('[search] dbSkillsToDocs failed:', e)
    return []
  }
}

export async function mcpServersToDocs(): Promise<SearchDocument[]> {
  try {
    const rows = await db
      .select({
        slug: mcpServers.slug,
        name: mcpServers.name,
        displayName: mcpServers.displayName,
        description: mcpServers.description,
        category: mcpServers.category,
        tags: mcpServers.tags,
        vendor: mcpServers.vendor,
        sourceRegistry: mcpServers.sourceRegistry,
        githubStars: mcpServers.githubStars,
        dockerPulls: mcpServers.dockerPulls,
        npmDownloads: mcpServers.npmDownloads,
        updatedAt: mcpServers.updatedAt,
      })
      .from(mcpServers)
      .where(eq(mcpServers.active, true))
    return rows.map((m) => ({
      objectID: makeObjectID('mcp-server', m.slug),
      type: 'mcp-server',
      slug: m.slug,
      name: m.displayName || m.name,
      description: m.description ?? '',
      category: m.category,
      categories: m.category ? [m.category] : [],
      tags: dedupe(m.tags ?? [], [m.vendor]),
      vendor: m.vendor ?? undefined,
      sourceRegistry: m.sourceRegistry,
      stars: m.githubStars ?? 0,
      installs: Math.max(m.dockerPulls ?? 0, m.npmDownloads ?? 0),
      updatedAt: epoch(m.updatedAt),
      url: urlForDocument('mcp-server', m.slug),
    }))
  } catch (e) {
    console.warn('[search] mcpServersToDocs failed:', e)
    return []
  }
}

export async function marketplacesToDocs(): Promise<SearchDocument[]> {
  try {
    const rows = await db
      .select({
        namespace: marketplaces.namespace,
        name: marketplaces.name,
        displayName: marketplaces.displayName,
        description: marketplaces.description,
        categories: marketplaces.categories,
        maintainerName: marketplaces.maintainerName,
        stars: marketplaces.stars,
        installs: marketplaces.installs,
        updatedAt: marketplaces.updatedAt,
      })
      .from(marketplaces)
      .where(eq(marketplaces.active, true))
    return rows.map((m) => ({
      objectID: makeObjectID('marketplace', m.namespace),
      type: 'marketplace',
      slug: m.namespace,
      name: m.displayName,
      description: m.description ?? '',
      category: m.categories?.[0],
      categories: m.categories ?? [],
      tags: dedupe(m.categories ?? [], [m.maintainerName]),
      marketplace: m.displayName,
      stars: m.stars ?? 0,
      installs: m.installs ?? 0,
      updatedAt: epoch(m.updatedAt),
      url: urlForDocument('marketplace', m.namespace, m.displayName),
    }))
  } catch (e) {
    console.warn('[search] marketplacesToDocs failed:', e)
    return []
  }
}

// ---------------------------------------------------------------------------
// Aggregation
// ---------------------------------------------------------------------------

/** Skill docs from both sources, deduped by objectID with the local file winning. */
async function skillDocs(): Promise<SearchDocument[]> {
  const local = localSkillsToDocs()
  const dbSkills = await dbSkillsToDocs()
  const seen = new Set(local.map((d) => d.objectID))
  return [...local, ...dbSkills.filter((d) => !seen.has(d.objectID))]
}

export async function docsForType(type: SearchContentType): Promise<SearchDocument[]> {
  switch (type) {
    case 'subagent':
      return subagentsToDocs()
    case 'command':
      return commandsToDocs()
    case 'hook':
      return hooksToDocs()
    case 'skill':
      return skillDocs()
    case 'plugin':
      return pluginsToDocs()
    case 'mcp-server':
      return mcpServersToDocs()
    case 'marketplace':
      return marketplacesToDocs()
    case 'theme':
      return themesToDocs()
  }
}

/** Every document for a full rebuild (markdown + DB), deduped by objectID. */
export async function allDocs(): Promise<SearchDocument[]> {
  const groups = await Promise.all([
    Promise.resolve(subagentsToDocs()),
    Promise.resolve(commandsToDocs()),
    Promise.resolve(hooksToDocs()),
    skillDocs(),
    pluginsToDocs(),
    mcpServersToDocs(),
    marketplacesToDocs(),
    Promise.resolve(themesToDocs()),
  ])
  const seen = new Set<string>()
  const out: SearchDocument[] = []
  for (const group of groups) {
    for (const doc of group) {
      if (!seen.has(doc.objectID)) {
        seen.add(doc.objectID)
        out.push(doc)
      }
    }
  }
  return out
}

// ---------------------------------------------------------------------------
// Provisioning + indexing operations
// ---------------------------------------------------------------------------

/** Idempotently ensure the index exists and its settings are applied. */
export async function ensureContentIndex(): Promise<boolean> {
  const client = getMeiliClient()
  if (!client) return false
  try {
    await client.getIndex(CONTENT_INDEX) // throws if missing
  } catch {
    await client.createIndex(CONTENT_INDEX, { primaryKey: 'objectID' }).waitTask()
  }
  await client.index(CONTENT_INDEX).updateSettings(CONTENT_INDEX_SETTINGS).waitTask()
  return true
}

async function addDocs(docs: SearchDocument[]): Promise<number> {
  const index = getContentIndex()
  if (!index || docs.length === 0) return 0
  // Enqueue every chunk (fast HTTP POSTs), then wait once. Meilisearch processes
  // tasks FIFO, so when the last add task finishes, all prior ones are done —
  // avoids N serial waitTask round-trips.
  let lastTaskUid: number | undefined
  for (let i = 0; i < docs.length; i += ADD_CHUNK) {
    const enqueued = await index.addDocuments(docs.slice(i, i + ADD_CHUNK), { primaryKey: 'objectID' })
    lastTaskUid = enqueued.taskUid
  }
  if (lastTaskUid !== undefined) {
    await index.tasks.waitForTask(lastTaskUid, WAIT)
  }
  return docs.length
}

export interface ReindexTypeResult {
  type: SearchContentType
  added: number
  durationMs: number
  skipped?: boolean
}

/** Refresh a single type: delete that type's docs then re-add. Reflects deletions. */
export async function reindexType(type: SearchContentType): Promise<ReindexTypeResult> {
  const start = Date.now()
  if (!(await ensureContentIndex())) {
    return { type, added: 0, durationMs: 0, skipped: true }
  }
  const index = getContentIndex()!
  const docs = await docsForType(type)
  await index.deleteDocuments({ filter: `type = "${type}"` }).waitTask(WAIT)
  const added = await addDocs(docs)
  return { type, added, durationMs: Date.now() - start }
}

/**
 * Refresh deploy-static content. `plugin` includes local Build with Claude
 * marketplace entries plus DB rows, so new local plugins do not wait for the
 * external marketplace indexer to make them searchable.
 */
export async function reindexMarkdown(): Promise<{ added: number; durationMs: number; byType: Record<string, number>; skipped?: boolean }> {
  const start = Date.now()
  if (!(await ensureContentIndex())) return { added: 0, durationMs: 0, byType: {}, skipped: true }
  const byType: Record<string, number> = {}
  let added = 0
  for (const type of ['subagent', 'command', 'hook', 'skill', 'plugin', 'theme'] as SearchContentType[]) {
    const r = await reindexType(type)
    byType[type] = r.added
    added += r.added
  }
  return { added, durationMs: Date.now() - start, byType }
}

/** Full rebuild: gather everything, clear the index, re-add. */
export async function reindexAll(): Promise<{ added: number; durationMs: number; byType: Record<string, number>; skipped?: boolean }> {
  const start = Date.now()
  if (!(await ensureContentIndex())) return { added: 0, durationMs: 0, byType: {}, skipped: true }
  const index = getContentIndex()!
  const docs = await allDocs()
  await index.deleteAllDocuments().waitTask(WAIT)
  const added = await addDocs(docs)
  const byType: Record<string, number> = {}
  for (const t of SEARCH_CONTENT_TYPES) byType[t] = 0
  for (const d of docs) byType[d.type] = (byType[d.type] ?? 0) + 1
  return { added, durationMs: Date.now() - start, byType }
}
