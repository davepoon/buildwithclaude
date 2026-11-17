import { db } from '@/lib/db/client'
import { plugins, skills, marketplaces } from '@/lib/db/schema'
import { getGitHubClient } from '@/lib/github/client'
import { eq, and, sql, inArray } from 'drizzle-orm'
import { z } from 'zod'
import { expandSkillCollection } from './skill-expander'
import { resolveMarketplaceSkills } from './marketplace-skills'
import { KNOWN_MARKETPLACE_REPOS } from './marketplace-indexer'

// Plugin schema for GitHub marketplace data
const PluginSchema = z.object({
  id: z.string(),
  name: z.string(),
  namespace: z.string(),
  version: z.string().optional(),
  description: z.string().optional().nullable(),
  category: z.string().optional().nullable(),
  keywords: z.array(z.string()).optional().nullable(),
  skills: z.array(z.string()).optional().nullable(),
  source: z.unknown().optional(),
  author: z.string().optional().nullable(),
  gitUrl: z.string().optional().nullable(),
  stars: z.number().optional().default(0),
  downloads: z.number().optional().default(0),
  verified: z.boolean().optional().default(false),
  metadata: z.object({
    homepage: z.string().optional().nullable(),
    repository: z.string().optional().nullable(),
    license: z.string().optional().nullable(),
    commands: z.union([z.array(z.string()), z.record(z.string(), z.unknown())]).optional().nullable(),
    agents: z.union([z.array(z.string()), z.record(z.string(), z.unknown())]).optional().nullable(),
    mcpServers: z.union([z.array(z.string()), z.record(z.string(), z.unknown())]).optional().nullable(),
  }).passthrough().optional().nullable(),
  createdAt: z.string().optional(),
  updatedAt: z.string().optional(),
})

type Plugin = z.infer<typeof PluginSchema>

export interface PluginIndexResult {
  indexed: number
  failed: number
  skipped: number
  unchanged?: number   // marketplaces skipped via change-detection (no new commits)
  reindexed?: number   // marketplaces that had changes and were re-fetched
  examined?: number    // marketplaces checked for changes this run (all active ones)
  missing?: number     // repositories GitHub could not resolve (deleted or private)
  deferred?: number    // changed marketplaces left for the next run (over the per-run cap)
  skillsInserted?: number
  durationMs: number
}

// How many *changed* marketplaces to re-fetch per run. Checking for changes is
// one batched request per 100 repos, so every marketplace is checked every run;
// only the file fetch + skill expansion of a changed one is expensive (several
// throttled requests each). The cap bounds a run after a long outage; the
// overflow keeps its place at the front of the queue for the next run.
const DEFAULT_CHANGED_PER_RUN = 2500

type PluginUpsertRecord = {
  name: string
  namespace: string
  slug: string
  marketplaceId: string
  marketplaceName: string
  repository: string
  description: string
  version: string | undefined
  author: string
  type: string
  categories: string[]
  keywords: string[]
  installCommand: string
  stars: number
  lastIndexedAt: Date
}

type SkillUpsertRecord = {
  name: string
  slug: string
  marketplaceId: string
  marketplaceName: string
  repository: string
  description: string
  category: string | null | undefined
  lastIndexedAt: Date
}

/**
 * Fetch plugins from GitHub repository marketplace.json
 */
async function fetchGitHubMarketplacePlugins(repoFullName: string): Promise<Plugin[]> {
  const github = getGitHubClient()
  const plugins: Plugin[] = []

  // Try standard paths for marketplace.json
  const paths = [
    '.claude-plugin/marketplace.json',
    'marketplace.json',
    'plugins.json',
    'registry.json',
  ]

  for (const path of paths) {
    try {
      const content = await github.fetchFileContent(repoFullName, path)
      const data = JSON.parse(content)

      // Handle different formats
      if (data.plugins && Array.isArray(data.plugins)) {
        // Standard marketplace.json format
        for (const plugin of data.plugins) {
          plugins.push({
            id: `${repoFullName}/${plugin.name || plugin.slug}`,
            name: plugin.name || plugin.slug,
            namespace: repoFullName.split('/')[0],
            version: plugin.version,
            description: plugin.description,
            category: plugin.category,
            keywords: plugin.keywords || plugin.tags,
            skills: plugin.skills,
            source: plugin.source,
            author: plugin.author || repoFullName.split('/')[0],
            gitUrl: plugin.repository || `https://github.com/${repoFullName}`,
            stars: 0,
            downloads: 0,
            verified: false,
          })
        }
        break
      } else if (data.subagents || data.commands || data.hooks) {
        // buildwithclaude registry.json format
        for (const subagent of data.subagents || []) {
          if (!subagent.name) {
            console.warn(`Skipping subagent without name in ${repoFullName}`)
            continue
          }
          plugins.push({
            id: `${repoFullName}/subagent/${subagent.name}`,
            name: subagent.name,
            namespace: repoFullName.split('/')[0],
            version: subagent.version,
            description: subagent.description,
            category: subagent.category || 'subagent',
            keywords: subagent.tags,
            skills: [],
            author: repoFullName.split('/')[0],
            gitUrl: `https://github.com/${repoFullName}`,
            stars: 0,
            downloads: 0,
            verified: false,
            metadata: {
              agents: [subagent.name],
            },
          })
        }
        for (const command of data.commands || []) {
          if (!command.name) {
            console.warn(`Skipping command without name in ${repoFullName}`)
            continue
          }
          plugins.push({
            id: `${repoFullName}/command/${command.name}`,
            name: command.name,
            namespace: repoFullName.split('/')[0],
            version: command.version,
            description: command.description,
            category: command.category || 'command',
            keywords: command.tags,
            skills: [],
            author: repoFullName.split('/')[0],
            gitUrl: `https://github.com/${repoFullName}`,
            stars: 0,
            downloads: 0,
            verified: false,
            metadata: {
              commands: [command.name],
            },
          })
        }
        for (const hook of data.hooks || []) {
          if (!hook.name) {
            console.warn(`Skipping hook without name in ${repoFullName}`)
            continue
          }
          plugins.push({
            id: `${repoFullName}/hook/${hook.name}`,
            name: hook.name,
            namespace: repoFullName.split('/')[0],
            version: hook.version,
            description: hook.description,
            category: hook.category || 'hook',
            keywords: hook.tags,
            skills: [],
            author: repoFullName.split('/')[0],
            gitUrl: `https://github.com/${repoFullName}`,
            stars: 0,
            downloads: 0,
            verified: false,
          })
        }
        for (const skill of data.skills || []) {
          if (!skill.name) {
            console.warn(`Skipping skill without name in ${repoFullName}`)
            continue
          }
          plugins.push({
            id: `${repoFullName}/skill/${skill.name}`,
            name: skill.name,
            namespace: repoFullName.split('/')[0],
            version: skill.version,
            description: skill.description,
            category: skill.category || 'skill',
            keywords: skill.tags,
            skills: [],
            author: repoFullName.split('/')[0],
            gitUrl: `https://github.com/${repoFullName}`,
            stars: 0,
            downloads: 0,
            verified: false,
          })
        }
        // Process actual Claude Code plugins (directories with .claude-plugin/plugin.json)
        for (const plugin of data.plugins || []) {
          if (!plugin.name) {
            console.warn(`Skipping plugin without name in ${repoFullName}`)
            continue
          }
          plugins.push({
            id: `${repoFullName}/plugin/${plugin.name}`,
            name: plugin.name,
            namespace: repoFullName.split('/')[0],
            version: plugin.version,
            description: plugin.description,
            category: 'plugin',
            keywords: plugin.keywords || [],
            skills: [],
            author: typeof plugin.author === 'object' ? plugin.author?.name : plugin.author || repoFullName.split('/')[0],
            gitUrl: plugin.repository || `https://github.com/${repoFullName}`,
            stars: 0,
            downloads: 0,
            verified: false,
            metadata: {
              installCommand: plugin.installCommand,
              file: plugin.file,
            },
          })
        }
        break
      }
    } catch {
      // Try next path
      continue
    }
  }

  return plugins
}

/**
 * Index plugins from active marketplaces — incrementally.
 *
 * Each run:
 *   1. Fetches GitHub metadata for every active marketplace in batches
 *      (fetchReposMetadata), and refreshes any card whose description, link or
 *      stars drifted.
 *   2. Skips the expensive file-fetch + skill-expansion when the repo has no
 *      new commits since our last full index (pushed_at <= source_pushed_at).
 *   3. Re-fetches the changed ones, stalest first, up to `batchSize` per run.
 *   4. Batches all DB writes, flushing in windows so a killed run keeps its
 *      progress.
 *
 * last_indexed_at means "confirmed current as of": it is bumped when a
 * marketplace is found unchanged or is re-fetched, and left alone when its
 * repo is missing or it was deferred, so those stay at the front of the queue.
 */
export async function indexPlugins(
  options: { batchSize?: number } = {},
): Promise<PluginIndexResult> {
  const startTime = Date.now()
  const batchSize = options.batchSize ?? DEFAULT_CHANGED_PER_RUN
  const github = getGitHubClient()
  await github.assertAuthenticated()
  const now = new Date()

  // Every active marketplace, stalest first.
  const marketplaceSlice = await db
    .select({
      id: marketplaces.id,
      name: marketplaces.name,
      displayName: marketplaces.displayName,
      repository: marketplaces.repository,
      namespace: marketplaces.namespace,
      sourcePushedAt: marketplaces.sourcePushedAt,
      description: marketplaces.description,
      url: marketplaces.url,
      stars: marketplaces.stars,
    })
    .from(marketplaces)
    .where(eq(marketplaces.active, true))
    .orderBy(sql`${marketplaces.lastIndexedAt} ASC NULLS FIRST`)

  const repoPathOf = (m: { repository: string }) => m.repository.replace('https://github.com/', '')
  const isLocal = (m: { name: string; displayName: string }) =>
    m.name === 'davepoon/buildwithclaude' || m.displayName === 'Build with Claude'

  console.log(`Incremental plugin index: checking ${marketplaceSlice.length} marketplaces for changes`)
  const metaByRepo = await github.fetchReposMetadata(
    marketplaceSlice.filter((m) => !isLocal(m)).map(repoPathOf),
  )

  const pluginRecords: PluginUpsertRecord[] = []
  const skillRecords: SkillUpsertRecord[] = []
  const collectionNamespaces = new Set<string>()
  const changedUpdates: Array<{ id: string; pluginCount: number; sourcePushedAt: Date | null }> = []
  const bumpIds: string[] = [] // unchanged / skipped / failed → bulk last_indexed_at bump
  // Card metadata (GitHub About) that drifted. Editing About does not move
  // pushed_at, so this is tracked separately from change-detection.
  const metaUpdates: Array<{ id: string; description: string; url: string; stars: number }> = []
  let metaRefreshed = 0

  const MAX_SKILL_EXPANSIONS = 10
  const expandedRepos = new Set<string>()
  let expansionCount = 0

  let indexed = 0
  let skillsInserted = 0
  let skipped = 0
  let unchanged = 0
  let reindexed = 0
  let failed = 0
  let missing = 0
  let deferred = 0
  let attempted = 0 // changed marketplaces we spent requests on this run

  // Persist accumulated work in windows so a run killed by maxDuration still
  // makes durable progress — and the bumped last_indexed_at rotates finished
  // marketplaces to the back of the queue, so the next run resumes where this
  // one stopped instead of re-processing the head of the list.
  const FLUSH_EVERY = 300
  let processedSinceFlush = 0

  const flush = async () => {
    if (pluginRecords.length) {
      const r = await batchUpsertPlugins(pluginRecords)
      indexed += r.indexed
      failed += r.failed
      pluginRecords.length = 0
    }
    if (skillRecords.length) {
      skillsInserted += await batchUpsertSkills(skillRecords)
      skillRecords.length = 0
    }
    // Deactivate parent collection entries that were expanded into individual skills.
    for (const ns of collectionNamespaces) {
      try {
        await db
          .update(plugins)
          .set({ active: false, updatedAt: now })
          .where(and(eq(plugins.namespace, ns), eq(plugins.type, 'skill')))
      } catch (error) {
        console.error(`Failed to deactivate collection entry ${ns}:`, error)
      }
    }
    collectionNamespaces.clear()
    // Changed marketplaces: record new source_pushed_at + plugin count + freshness.
    for (const u of changedUpdates) {
      try {
        await db
          .update(marketplaces)
          .set({
            pluginCount: u.pluginCount,
            sourcePushedAt: u.sourcePushedAt,
            lastIndexedAt: now,
            updatedAt: now,
          })
          .where(eq(marketplaces.id, u.id))
      } catch (error) {
        console.error(`Failed to update marketplace ${u.id}:`, error)
      }
    }
    changedUpdates.length = 0
    for (const { id, ...meta } of metaUpdates) {
      try {
        await db.update(marketplaces).set({ ...meta, updatedAt: now }).where(eq(marketplaces.id, id))
        metaRefreshed++
      } catch (error) {
        console.error(`Failed to refresh metadata for marketplace ${id}:`, error)
      }
    }
    metaUpdates.length = 0
    // Unchanged / skipped / failed: bulk-bump last_indexed_at so they rotate to
    // the back. updated_at is left alone: nothing about the row changed.
    for (let i = 0; i < bumpIds.length; i += 500) {
      const chunk = bumpIds.slice(i, i + 500)
      try {
        await db
          .update(marketplaces)
          .set({ lastIndexedAt: now })
          .where(inArray(marketplaces.id, chunk))
      } catch (error) {
        console.error(`Failed to bump ${chunk.length} marketplaces:`, error)
      }
    }
    bumpIds.length = 0
  }

  for (const marketplace of marketplaceSlice) {
    if (processedSinceFlush >= FLUSH_EVERY) {
      await flush()
      processedSinceFlush = 0
    }
    processedSinceFlush++

    // Build with Claude is served from local files — never crawl it, but rotate it.
    if (isLocal(marketplace)) {
      skipped++
      bumpIds.push(marketplace.id)
      continue
    }

    const repoPath = repoPathOf(marketplace)
    const repoMeta = metaByRepo.get(repoPath)
    if (!repoMeta) {
      missing++ // deleted or private; nothing to refresh
      continue
    }

    // Keep the card's description, link and stars in step with GitHub. The
    // marketplace crawl only adds repos it has not seen, so this is the one
    // place existing marketplaces are refreshed.
    if (!KNOWN_MARKETPLACE_REPOS.has(repoPath)) {
      const fresh = {
        description: repoMeta.description || marketplace.description || '',
        url: repoMeta.homepage || repoMeta.html_url,
        stars: repoMeta.stargazers_count,
      }
      if (
        fresh.description !== (marketplace.description ?? '') ||
        fresh.url !== marketplace.url ||
        fresh.stars !== marketplace.stars
      ) {
        metaUpdates.push({ id: marketplace.id, ...fresh })
      }
    }

    const pushedAt = repoMeta.pushed_at ? new Date(repoMeta.pushed_at) : null
    const unchangedSinceLastIndex =
      pushedAt && marketplace.sourcePushedAt && pushedAt <= marketplace.sourcePushedAt

    if (unchangedSinceLastIndex) {
      unchanged++
      bumpIds.push(marketplace.id) // source_pushed_at stays; just bump last_indexed_at
      continue
    }

    if (attempted >= batchSize) {
      deferred++ // over this run's cap; stays at the front of the queue
      continue
    }
    attempted++

    // Changed (or first index): fetch + expand, accumulate for batch upsert.
    try {
      const fetchedPlugins = await fetchGitHubMarketplacePlugins(repoPath)
      const expandedPlugins: Plugin[] = []

      for (const plugin of fetchedPlugins) {
        const pluginType = determinePluginType(plugin)
        const isExternalSkillRepo =
          pluginType === 'skill' &&
          plugin.gitUrl &&
          plugin.gitUrl !== marketplace.repository &&
          expansionCount < MAX_SKILL_EXPANSIONS

        if (isExternalSkillRepo) {
          try {
            const expanded = await expandSkillCollection(
              plugin.gitUrl!,
              marketplace.repository,
              expandedRepos,
            )
            if (expanded && expanded.length > 0) {
              expansionCount++
              collectionNamespaces.add(`@${plugin.namespace}/${plugin.name}`)
              for (const skill of expanded) {
                expandedPlugins.push({
                  id: `${plugin.namespace}/${skill.slug}`,
                  name: skill.name,
                  namespace: plugin.namespace,
                  description: skill.description,
                  category: skill.category || plugin.category,
                  keywords: plugin.keywords,
                  skills: [],
                  author: skill.owner || plugin.author,
                  gitUrl: skill.repoUrl,
                  stars: skill.stars,
                  downloads: 0,
                  verified: false,
                })
              }
              console.log(`Expanded ${plugin.name} into ${expanded.length} individual skills`)
              continue
            }
          } catch (error) {
            console.error(`Failed to expand skill collection ${plugin.name}:`, error)
          }
        }

        expandedPlugins.push(plugin)
      }

      // Accumulate records (skip nameless entries — createSlug needs a name).
      for (const plugin of expandedPlugins) {
        if (!plugin.name) continue
        const pluginType = determinePluginType(plugin)
        pluginRecords.push({
          name: plugin.name,
          namespace: `@${plugin.namespace}/${plugin.name}`,
          slug: createSlug(plugin.name),
          marketplaceId: marketplace.id,
          marketplaceName: marketplace.displayName,
          repository: plugin.gitUrl || marketplace.repository,
          description: plugin.description || '',
          version: plugin.version,
          author: plugin.author || plugin.namespace,
          type: pluginType,
          categories: plugin.category ? [plugin.category] : [],
          keywords: plugin.keywords || [],
          installCommand: `bwc add --plugin ${plugin.namespace}/${plugin.name}`,
          stars: plugin.stars ?? 0,
          lastIndexedAt: now,
        })

        if (plugin.skills && plugin.skills.length > 0) {
          const declaredSkills = await resolveMarketplaceSkills(
            plugin, repoPath, (repo, path) => github.fetchFileContent(repo, path),
          )
          for (const skill of declaredSkills) {
            skillRecords.push({
              ...skill,
              marketplaceId: marketplace.id,
              marketplaceName: marketplace.displayName,
              repository: plugin.gitUrl || marketplace.repository,
              lastIndexedAt: now,
            })
          }
        }
      }

      reindexed++
      changedUpdates.push({
        id: marketplace.id,
        pluginCount: expandedPlugins.length,
        sourcePushedAt: pushedAt,
      })
    } catch (error) {
      console.error(`Failed to index marketplace ${marketplace.displayName}:`, error)
      failed++
      bumpIds.push(marketplace.id)
    }
  }

  // Flush the final partial window.
  await flush()

  console.log(
    `Incremental plugin index done: examined ${marketplaceSlice.length}, reindexed ${reindexed}, ` +
      `unchanged ${unchanged}, deferred ${deferred}, missing ${missing}, skipped ${skipped}, failed ${failed}, ` +
      `metadata refreshed ${metaRefreshed}, ` +
      `plugins upserted ${indexed}, skills ${skillsInserted}`,
  )

  return {
    indexed,
    failed,
    skipped,
    unchanged,
    reindexed,
    examined: marketplaceSlice.length,
    missing,
    deferred,
    skillsInserted,
    durationMs: Date.now() - startTime,
  }
}

/**
 * Batch-upsert plugin records in chunks to avoid thousands of sequential round-trips.
 */
async function batchUpsertPlugins(
  records: PluginUpsertRecord[],
  chunkSize = 50,
): Promise<{ indexed: number; failed: number }> {
  let indexed = 0
  let failed = 0
  for (let i = 0; i < records.length; i += chunkSize) {
    const batch = records.slice(i, i + chunkSize)
    try {
      await db
        .insert(plugins)
        .values(batch)
        .onConflictDoUpdate({
          target: plugins.namespace,
          set: {
            description: sql`EXCLUDED.description`,
            version: sql`EXCLUDED.version`,
            author: sql`EXCLUDED.author`,
            type: sql`EXCLUDED.type`,
            categories: sql`EXCLUDED.categories`,
            keywords: sql`EXCLUDED.keywords`,
            stars: sql`EXCLUDED.stars`,
            marketplaceId: sql`EXCLUDED.marketplace_id`,
            marketplaceName: sql`EXCLUDED.marketplace_name`,
            repository: sql`EXCLUDED.repository`,
            installCommand: sql`EXCLUDED.install_command`,
            lastIndexedAt: sql`EXCLUDED.last_indexed_at`,
            updatedAt: sql`NOW()`,
          },
        })
      indexed += batch.length
    } catch (error) {
      console.error(`Batch upsert failed for ${batch.length} plugins:`, error)
      failed += batch.length
    }
  }
  return { indexed, failed }
}

/**
 * Batch-insert skill records (collection skills referenced by name).
 */
async function batchUpsertSkills(
  records: SkillUpsertRecord[],
  chunkSize = 100,
): Promise<number> {
  let inserted = 0
  for (let i = 0; i < records.length; i += chunkSize) {
    const batch = records.slice(i, i + chunkSize)
    try {
      await db.insert(skills).values(batch).onConflictDoNothing()
      inserted += batch.length
    } catch (error) {
      console.error('Batch skill insert failed:', error)
    }
  }
  return inserted
}

/**
 * Create URL-safe slug from name
 */
function createSlug(name: string): string {
  if (!name) {
    throw new Error('createSlug called with undefined or empty name')
  }
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
}

/**
 * Determine plugin type from metadata
 */
function determinePluginType(plugin: Plugin): string {
  // Check metadata for type indicators (handle both array and object formats)
  const hasAgents = Array.isArray(plugin.metadata?.agents) ? plugin.metadata.agents.length > 0 : !!plugin.metadata?.agents
  const hasCommands = Array.isArray(plugin.metadata?.commands) ? plugin.metadata.commands.length > 0 : !!plugin.metadata?.commands
  const hasMcpServers = Array.isArray(plugin.metadata?.mcpServers) ? plugin.metadata.mcpServers.length > 0 : !!plugin.metadata?.mcpServers

  if (hasAgents) return 'subagent'
  if (hasCommands) return 'command'
  if (hasMcpServers) return 'mcp'

  // Check category
  const category = plugin.category?.toLowerCase() || ''
  if (category === 'plugin') return 'plugin'
  if (category.includes('agent') || category.includes('subagent')) return 'subagent'
  if (category.includes('command')) return 'command'
  if (category.includes('hook')) return 'hook'
  if (category.includes('skill')) return 'skill'

  // Default to plugin
  return 'plugin'
}

/**
 * Index a single marketplace by ID
 */
export async function indexMarketplacePlugins(marketplaceId: string): Promise<PluginIndexResult> {
  const marketplace = await db
    .select({
      id: marketplaces.id,
      name: marketplaces.name,
      displayName: marketplaces.displayName,
      repository: marketplaces.repository,
    })
    .from(marketplaces)
    .where(eq(marketplaces.id, marketplaceId))
    .limit(1)

  if (!marketplace.length) {
    return { indexed: 0, failed: 1, skipped: 0, durationMs: 0 }
  }

  // Temporarily set only this marketplace as active to use indexPlugins
  const startTime = Date.now()
  let indexed = 0
  let failed = 0

  const mp = marketplace[0]

  try {
    // Fetch plugins from GitHub repository
    const repoPath = mp.repository.replace('https://github.com/', '')
    const fetchedPlugins = await fetchGitHubMarketplacePlugins(repoPath)

    for (const plugin of fetchedPlugins) {
      try {
        const slug = createSlug(plugin.name)
        const pluginType = determinePluginType(plugin)

        await db
          .insert(plugins)
          .values({
            name: plugin.name,
            namespace: `@${plugin.namespace}/${plugin.name}`,
            slug,
            marketplaceId: mp.id,
            marketplaceName: mp.displayName,
            repository: plugin.gitUrl || mp.repository,
            description: plugin.description || '',
            version: plugin.version,
            author: plugin.author || plugin.namespace,
            type: pluginType,
            categories: plugin.category ? [plugin.category] : [],
            keywords: plugin.keywords || [],
            installCommand: `bwc add --plugin ${plugin.namespace}/${plugin.name}`,
            stars: plugin.stars,
            lastIndexedAt: new Date(),
          })
          .onConflictDoUpdate({
            target: plugins.namespace,
            set: {
              description: sql`EXCLUDED.description`,
              version: sql`EXCLUDED.version`,
              author: sql`EXCLUDED.author`,
              type: sql`EXCLUDED.type`,
              categories: sql`EXCLUDED.categories`,
              keywords: sql`EXCLUDED.keywords`,
              stars: sql`EXCLUDED.stars`,
              lastIndexedAt: sql`EXCLUDED.last_indexed_at`,
              updatedAt: sql`NOW()`,
            },
          })

        indexed++
      } catch {
        failed++
      }
    }

    await db
      .update(marketplaces)
      .set({
        pluginCount: fetchedPlugins.length,
        lastIndexedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(marketplaces.id, mp.id))
  } catch (error) {
    console.error(`Failed to index marketplace ${mp.displayName}:`, error)
    failed = 1
  }

  return {
    indexed,
    failed,
    skipped: 0,
    durationMs: Date.now() - startTime,
  }
}
