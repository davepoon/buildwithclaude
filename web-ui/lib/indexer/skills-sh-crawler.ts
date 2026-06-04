/**
 * skills.sh listing crawler (key-less).
 *
 * The skills.sh REST API is key-gated, but the website (www.skills.sh) is a
 * Next.js app that server-renders the skill leaderboard into the page HTML.
 * We fetch the listing/topic pages with a plain browser User-Agent and parse
 * the rendered markup — no API key, no headless browser.
 *
 * Each skill row looks like:
 *   <a href="/owner/repo/slug"> ... <h3>slug</h3> <p>owner/repo</p>
 *     <svg ... aria-label="Weekly installs: 3,961, 3,943, ... , 4,594"> ...
 *
 * Identity (owner/repo + slug) comes from the href (robust); the install
 * signal is the most recent value from the sparkline's aria-label (skills.sh
 * doesn't render a cumulative total in the listing — that's on detail pages).
 *
 * Pure + runtime-agnostic: no DB, no Trigger.dev, no Next imports — safe to run
 * locally, in a cron route, or inside a Trigger.dev task.
 */

const BASE = 'https://www.skills.sh'
const UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36'

// Reserved top-level paths that are never an `owner` in /owner/repo/slug.
const RESERVED = new Set([
  'topic', 'agent', 'docs', 'official', 'trending', 'hot', 'audits', 'about',
  'contact', 'privacy', 'terms', '_next', 'api', 'favicon.ico',
])

export interface CatalogSkill {
  id: string          // "owner/repo/slug"
  source: string      // "owner/repo"
  slug: string        // skill slug
  installs: number    // most recent weekly installs (popularity signal; 0 if unknown)
  installUrl: string  // "https://github.com/owner/repo"
  topic?: string      // skills.sh topic slug it was found under (used for categorization)
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms))
}

async function fetchPage(path: string, timeoutMs = 20000): Promise<string | null> {
  const controller = new AbortController()
  const t = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const res = await fetch(`${BASE}${path}`, {
      headers: { 'User-Agent': UA, Accept: 'text/html' },
      signal: controller.signal,
      redirect: 'follow',
    })
    if (!res.ok) {
      console.warn(`[skills.sh] ${path} -> HTTP ${res.status}`)
      return null
    }
    return await res.text()
  } catch (err) {
    console.warn(`[skills.sh] ${path} fetch failed:`, err instanceof Error ? err.message : err)
    return null
  } finally {
    clearTimeout(t)
  }
}

/** Latest weekly installs from `aria-label="Weekly installs: a, b, ... , z"`. */
function latestWeeklyInstalls(rowHtml: string): number {
  const m = rowHtml.match(/aria-label="Weekly installs:\s*([0-9,\s]+)"/)
  if (!m) return 0
  const nums = m[1]
    .split(',')
    .map((s) => parseInt(s.replace(/[^0-9]/g, ''), 10))
    .filter((n) => Number.isFinite(n))
  return nums.length ? nums[nums.length - 1] : 0
}

/**
 * Parse all GitHub skill rows from a listing page.
 * GitHub skills have 3-segment paths (/owner/repo/slug); well-known/domain
 * skills (2-segment) are skipped — we can't source their content from GitHub.
 */
function parseSkills(html: string): CatalogSkill[] {
  const out: CatalogSkill[] = []
  const seen = new Set<string>()
  // Anchor for each skill row, capturing the href and the row body up to the
  // next anchor (lazy) so the sparkline we read belongs to this row.
  const rowRe = /<a[^>]+href="(\/[^"]+)"[^>]*>([\s\S]*?)(?=<a[^>]+href="\/|<\/a><\/(?:div|li)>|$)/g
  let m: RegExpExecArray | null
  while ((m = rowRe.exec(html)) !== null) {
    const href = m[1]
    const body = m[2]
    const segs = href.split('/').filter(Boolean)
    if (segs.length !== 3) continue
    const [owner, repo, slug] = segs
    if (RESERVED.has(owner)) continue
    // Skip obvious non-skill asset/links.
    if (/\.(js|css|svg|png|jpg|woff2?|ico)$/.test(slug)) continue
    const id = `${owner}/${repo}/${slug}`
    if (seen.has(id)) continue
    seen.add(id)
    out.push({
      id,
      source: `${owner}/${repo}`,
      slug,
      installs: latestWeeklyInstalls(body),
      installUrl: `https://github.com/${owner}/${repo}`,
    })
  }
  return out
}

/** Discover topic slugs from /topic (hrefs like /topic/<slug>). */
function parseTopics(html: string): string[] {
  const set = new Set<string>()
  const re = /href="\/topic\/([a-z0-9-]+)"/g
  let m: RegExpExecArray | null
  while ((m = re.exec(html)) !== null) set.add(m[1])
  return Array.from(set)
}

export interface CrawlOptions {
  includeTopics?: boolean   // also crawl every /topic/<slug> page (default true)
  delayMs?: number          // politeness delay between page fetches (default 350)
  maxTopics?: number        // cap topic pages (default: all)
}

/**
 * Crawl skills.sh listing pages and return a de-duped catalog (keyed by
 * "owner/repo/slug"). Merges installs by taking the max seen across pages.
 */
export async function fetchSkillsShCatalog(opts: CrawlOptions = {}): Promise<Map<string, CatalogSkill>> {
  const { includeTopics = true, delayMs = 350, maxTopics } = opts
  const catalog = new Map<string, CatalogSkill>()

  const merge = (skills: CatalogSkill[], topic?: string) => {
    for (const s of skills) {
      const prev = catalog.get(s.id)
      if (!prev) {
        catalog.set(s.id, topic ? { ...s, topic } : s)
      } else {
        // Keep the higher install count; capture a topic if we didn't have one.
        catalog.set(s.id, {
          ...prev,
          installs: Math.max(prev.installs, s.installs),
          topic: prev.topic || topic,
        })
      }
    }
  }

  // Base listing views (no topic context).
  const pages = ['/', '/trending', '/hot', '/official']
  for (const p of pages) {
    const html = await fetchPage(p)
    if (html) {
      const skills = parseSkills(html)
      if (skills.length === 0) console.warn(`[skills.sh] ${p} parsed 0 skills (markup change?)`)
      merge(skills)
    }
    await sleep(delayMs)
  }

  // Topic pages multiply coverage of the long tail.
  if (includeTopics) {
    const topicIndex = await fetchPage('/topic')
    let topics = topicIndex ? parseTopics(topicIndex) : []
    if (maxTopics) topics = topics.slice(0, maxTopics)
    console.log(`[skills.sh] crawling ${topics.length} topic pages`)
    for (const t of topics) {
      await sleep(delayMs)
      const html = await fetchPage(`/topic/${t}`)
      if (html) merge(parseSkills(html), t)
    }
  }

  console.log(`[skills.sh] catalog: ${catalog.size} unique GitHub skills`)
  return catalog
}
