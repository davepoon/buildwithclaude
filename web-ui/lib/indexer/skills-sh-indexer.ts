/**
 * skills.sh incremental indexer (key-less).
 *
 * Two phases per run:
 *   A. Discovery — crawl skills.sh listing/topic pages (no key) and upsert a
 *      lightweight `plugins` row (type='skill') per catalog skill: identity +
 *      install count + install command. Content is left null; the detail page
 *      already falls back to a cached raw.githubusercontent fetch, so pages work
 *      immediately. Discovery never touches last_indexed_at.
 *   B. Content (incremental) — take a slice of skills.sh rows (never-synced +
 *      most-installed first, then round-robin by staleness) and fetch each
 *      skill's SKILL.md straight from GitHub's raw CDN (raw.githubusercontent —
 *      NOT the rate-limited REST API) to fill content + sourcePath + category +
 *      description + submissionStatus. Batch-upsert with windowed flushing, and
 *      always bump last_indexed_at so rows rotate to the back (round-robin) —
 *      a killed run still persists its finished work.
 *
 * Pure + runtime-agnostic: reads env (GITHUB_TOKEN, POSTGRES_URL), no
 * Trigger.dev imports — runs locally, in a cron route, or in a scheduled task.
 */

import matter from 'gray-matter'
import { db } from '@/lib/db/client'
import { plugins } from '@/lib/db/schema'
import { and, eq, sql, inArray, isNull } from 'drizzle-orm'
import { scanSkillContent, getSubmissionStatus } from './content-scanner'
import { smartCategorizeSkill } from '@/lib/category-utils'
import { fetchSkillsShCatalog, type CatalogSkill, type CrawlOptions } from './skills-sh-crawler'

// These rows are intentionally stored with a NULL marketplaceName so the source
// is never surfaced in the UI (no marketplace badge, not in the marketplace
// filter). NULL also serves as this indexer's ownership marker — it's the only
// path that creates type='skill' rows without a marketplaceName.
const DEFAULT_CONTENT_BATCH = 300
const FLUSH_EVERY = 150

export interface SkillsShIndexResult {
  discovered: number   // catalog rows upserted in phase A
  examined: number     // rows looked at in phase B (the staleness slice)
  reposAnalyzed: number
  contentSynced: number
  failed: number
  durationMs: number
}

function repoFullNameOf(repository: string): string {
  return repository.replace('https://github.com/', '').replace(/\.git$/, '')
}

// Map skills.sh topic slugs → our skill category enum. skills.sh's topic is the
// best "what kind of skill" signal; unknown topics fall back to keyword inference.
const TOPIC_TO_CATEGORY: Record<string, string> = {
  react: 'development-code', nextjs: 'development-code', 'next-js': 'development-code',
  vue: 'development-code', svelte: 'development-code', angular: 'development-code',
  mobile: 'development-code', ios: 'development-code', android: 'development-code',
  databases: 'development-code', database: 'development-code', testing: 'development-code',
  web: 'development-code', frontend: 'development-code', backend: 'development-code',
  api: 'development-code', typescript: 'development-code', javascript: 'development-code',
  python: 'development-code', rust: 'development-code', go: 'development-code',
  design: 'design', 'design-ui': 'design', ui: 'design', ux: 'design', 'ui-ux': 'design',
  'agent-workflows': 'automation', 'agent-workflow': 'automation', agents: 'automation',
  automation: 'automation', workflow: 'automation', workflows: 'automation',
  devops: 'devops', deployment: 'devops', infrastructure: 'devops', cloud: 'devops',
  'ci-cd': 'devops', kubernetes: 'devops', docker: 'devops',
  marketing: 'social-media', social: 'social-media', 'social-media': 'social-media', seo: 'social-media',
  ai: 'ai-ml', 'ai-ml': 'ai-ml', ml: 'ai-ml', llm: 'ai-ml', 'machine-learning': 'ai-ml',
  data: 'analytics', analytics: 'analytics', 'data-science': 'analytics',
  security: 'security', documentation: 'document-processing', docs: 'document-processing',
  writing: 'document-processing', communication: 'communication',
  ecommerce: 'ecommerce', commerce: 'ecommerce', crm: 'crm', email: 'email',
  'project-management': 'project-management', support: 'customer-support',
  'customer-support': 'customer-support', productivity: 'business-productivity',
  business: 'business-productivity', finance: 'business-productivity',
}

function topicToCategory(topic?: string): string | undefined {
  if (!topic) return undefined
  return TOPIC_TO_CATEGORY[topic.toLowerCase().trim()]
}

// --- Phase A: discovery upsert -------------------------------------------------

async function discoveryUpsert(skills: CatalogSkill[], now: Date): Promise<number> {
  let upserted = 0
  const chunkSize = 50
  for (let i = 0; i < skills.length; i += chunkSize) {
    const batch = skills.slice(i, i + chunkSize).map((s) => {
      const owner = s.source.split('/')[0]
      return {
        name: s.slug, // provisional; phase B upgrades to the SKILL.md frontmatter name
        namespace: `@${owner}/${s.slug}`,
        slug: s.slug,
        // marketplaceName intentionally omitted (NULL) — see note above.
        repository: s.installUrl,
        description: `Skill from ${s.source}`,
        author: owner,
        type: 'skill' as const,
        categories: [topicToCategory(s.topic) || smartCategorizeSkill(null, s.slug, '')],
        keywords: [] as string[],
        installCommand: `npx skills add ${s.source}`,
        stars: 0,
        installs: s.installs,
      }
    })
    try {
      await db
        .insert(plugins)
        .values(batch)
        .onConflictDoUpdate({
          target: plugins.namespace,
          // Refresh only the cheap discovery fields; never clobber phase-B
          // content (content/sourcePath/name/description/categories/stars) or
          // last_indexed_at.
          set: {
            installs: sql`EXCLUDED.installs`,
            installCommand: sql`EXCLUDED.install_command`,
            repository: sql`EXCLUDED.repository`,
            updatedAt: sql`NOW()`,
          },
        })
      upserted += batch.length
    } catch (error) {
      console.error(`[skills.sh] discovery upsert failed for ${batch.length} rows:`, error)
    }
  }
  return upserted
}

// --- Phase B: incremental content sync ----------------------------------------

function rawSkillUrl(repo: string, path: string): string {
  return `https://raw.githubusercontent.com/${repo}/HEAD/${path.replace(/^\/+/, '')}`
}

/**
 * Fetch a skill's SKILL.md straight from GitHub's raw CDN — NOT the rate-limited
 * REST API — by trying conventional paths for the slug. The skills.sh slug is the
 * skill's install directory, so `<slug>/SKILL.md` hits for the vast majority.
 * Returns the frontmatter-stripped body + parsed frontmatter, or null if none
 * of the candidates exist.
 */
async function fetchSkillMd(
  repo: string,
  slug: string,
): Promise<{ content: string; frontmatter: Record<string, unknown>; sourcePath: string } | null> {
  const candidates = [
    `${slug}/SKILL.md`,
    `skills/${slug}/SKILL.md`,
    `.claude/skills/${slug}/SKILL.md`,
    `${slug}/skill.md`,
    'SKILL.md',
  ]
  for (const path of candidates) {
    try {
      const res = await fetch(rawSkillUrl(repo, path))
      if (!res.ok) continue
      const parsed = matter(await res.text())
      return { content: parsed.content, frontmatter: parsed.data as Record<string, unknown>, sourcePath: path }
    } catch {
      // try the next candidate
    }
  }
  return null
}

type ContentUpdate = {
  namespace: string
  name: string
  description: string
  categories: string[]
  content: string
  sourcePath: string
  submissionStatus: string
}

export async function indexSkillsFromSkillsSh(
  options: { batchSize?: number; crawl?: CrawlOptions } = {},
): Promise<SkillsShIndexResult> {
  const startTime = Date.now()
  const batchSize = options.batchSize ?? DEFAULT_CONTENT_BATCH
  const now = new Date()

  // Phase A: discovery (cheap, full catalog every run).
  const catalog = await fetchSkillsShCatalog(options.crawl)
  const discovered = await discoveryUpsert(Array.from(catalog.values()), now)

  // namespace -> skills.sh topic, used to categorize when the SKILL.md has no
  // `category` frontmatter and keyword inference comes back uncategorized.
  const topicByNamespace = new Map<string, string>()
  for (const s of catalog.values()) {
    if (s.topic) topicByNamespace.set(`@${s.source.split('/')[0]}/${s.slug}`, s.topic)
  }

  // Phase B: content sync over the stalest slice.
  const slice = await db
    .select({
      namespace: plugins.namespace,
      slug: plugins.slug,
      repository: plugins.repository,
      categories: plugins.categories,
    })
    .from(plugins)
    .where(and(eq(plugins.type, 'skill'), isNull(plugins.marketplaceName)))
    // Never-synced first (NULLS FIRST), most-installed first within that — so the
    // popular skills shown on /skills get real content + categories first — then
    // round-robin the already-synced by staleness to keep them fresh.
    .orderBy(sql`${plugins.lastIndexedAt} ASC NULLS FIRST, COALESCE(${plugins.installs}, 0) DESC`)
    .limit(batchSize)

  console.log(`[skills.sh] content sync: examining ${slice.length} stalest rows`)

  // Group the slice by source repo so each repo is analyzed once.
  const byRepo = new Map<string, typeof slice>()
  for (const row of slice) {
    const repo = repoFullNameOf(row.repository || '')
    if (!repo) continue
    if (!byRepo.has(repo)) byRepo.set(repo, [])
    byRepo.get(repo)!.push(row)
  }

  let reposAnalyzed = 0
  let contentSynced = 0
  let failed = 0
  let pending: ContentUpdate[] = []
  const bumpNamespaces: string[] = []

  const flush = async () => {
    for (const u of pending) {
      try {
        await db
          .update(plugins)
          .set({
            name: u.name,
            description: u.description,
            categories: u.categories,
            content: u.content,
            sourcePath: u.sourcePath,
            submissionStatus: u.submissionStatus,
            lastIndexedAt: now,
            updatedAt: now,
          })
          .where(eq(plugins.namespace, u.namespace))
        contentSynced++
      } catch (error) {
        console.error(`[skills.sh] content update failed for ${u.namespace}:`, error)
        failed++
      }
    }
    pending = []
    // Rows we couldn't fill (repo failed / no match): still bump so they rotate.
    for (let i = 0; i < bumpNamespaces.length; i += 500) {
      const chunk = bumpNamespaces.slice(i, i + 500)
      try {
        await db
          .update(plugins)
          .set({ lastIndexedAt: now, updatedAt: now })
          .where(inArray(plugins.namespace, chunk))
      } catch (error) {
        console.error(`[skills.sh] bump failed for ${chunk.length} rows:`, error)
      }
    }
    bumpNamespaces.length = 0
  }

  let processedSinceFlush = 0
  for (const [repo, rows] of byRepo) {
    reposAnalyzed++
    for (const row of rows) {
      const fetched = await fetchSkillMd(repo, row.slug)
      if (fetched && fetched.content.trim()) {
        const fm = fetched.frontmatter
        const name = (typeof fm.name === 'string' && fm.name.trim()) || row.slug
        const description =
          (typeof fm.description === 'string' && fm.description.trim()) ||
          fetched.content.split('\n').map((l) => l.trim()).find(Boolean)?.slice(0, 300) ||
          `Skill from ${repo}`
        const fmCategory = typeof fm.category === 'string' ? fm.category : null
        // Category precedence: SKILL.md frontmatter / keyword inference, then the
        // skills.sh topic, then whatever the row already had.
        const inferred = smartCategorizeSkill(fmCategory, name, description)
        const category =
          inferred !== 'uncategorized'
            ? inferred
            : topicToCategory(topicByNamespace.get(row.namespace)) || row.categories?.[0] || 'uncategorized'
        const scan = scanSkillContent(fetched.content, {
          name,
          description,
          installCommand: `npx skills add ${repo}`,
        })
        pending.push({
          namespace: row.namespace,
          name,
          description,
          categories: [category],
          content: fetched.content,
          sourcePath: fetched.sourcePath,
          submissionStatus: getSubmissionStatus(scan),
        })
      } else {
        // SKILL.md not at a conventional path — leave for the render-time fallback, rotate.
        bumpNamespaces.push(row.namespace)
      }
      processedSinceFlush++
      if (processedSinceFlush >= FLUSH_EVERY) { await flush(); processedSinceFlush = 0 }
    }
  }
  await flush()

  console.log(
    `[skills.sh] done: discovered ${discovered}, examined ${slice.length}, ` +
      `reposAnalyzed ${reposAnalyzed}, contentSynced ${contentSynced}, failed ${failed}`,
  )

  return {
    discovered,
    examined: slice.length,
    reposAnalyzed,
    contentSynced,
    failed,
    durationMs: Date.now() - startTime,
  }
}
