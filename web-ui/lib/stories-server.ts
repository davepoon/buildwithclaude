import fs from 'fs'
import path from 'path'
import matter from 'gray-matter'
import type { Story, StoryCategory, StoryCover, StoryTargetKind } from './stories-types'

const STORIES_DIR = path.join(process.cwd(), '../stories')

const VALID_COVERS: StoryCover[] = ['brown', 'blue', 'green', 'purple']
const VALID_CATEGORIES: StoryCategory[] = ['Plugins', 'Skills', 'Subagents', 'Commands', 'Hooks']
const VALID_TARGET_KINDS: StoryTargetKind[] = [
  'plugin', 'skill', 'hook', 'subagent', 'command', 'mcp-server'
]
const SLUG_PATTERN = /^[a-z0-9][a-z0-9_-]{0,80}$/i
const COVER_FILE_PATTERN = /^cover\.(png|jpe?g|webp|svg)$/i
const ALLOWED_HREF_PROTOCOLS = new Set(['http:', 'https:', 'mailto:'])

function sanitizeHref(raw: unknown): string {
  if (typeof raw !== 'string') return '#'
  const trimmed = raw.trim()
  if (!trimmed) return '#'
  // In-app relative links are safe and the common case.
  if (trimmed.startsWith('/') && !trimmed.startsWith('//')) return trimmed
  // Reject dangerous schemes regardless of casing or whitespace.
  if (/^(javascript|data|vbscript|file):/i.test(trimmed)) return '#'
  try {
    const parsed = new URL(trimmed, 'https://example.invalid')
    return ALLOWED_HREF_PROTOCOLS.has(parsed.protocol) ? trimmed : '#'
  } catch {
    return '#'
  }
}

function optionalString(raw: unknown): string | undefined {
  if (typeof raw !== 'string') return undefined
  const trimmed = raw.trim()
  return trimmed ? trimmed : undefined
}

/** A sanitized href, or undefined when missing / unsafe (so it renders as plain text). */
function optionalHref(raw: unknown): string | undefined {
  if (typeof raw !== 'string' || !raw.trim()) return undefined
  const safe = sanitizeHref(raw)
  return safe === '#' ? undefined : safe
}

function findCoverImage(slug: string): string | undefined {
  const storyDir = path.join(STORIES_DIR, slug)
  let entries: string[]
  try {
    entries = fs.readdirSync(storyDir)
  } catch {
    return undefined
  }
  const cover = entries.find(f => COVER_FILE_PATTERN.test(f))
  return cover ? `/stories/${slug}/${cover}` : undefined
}

function parseStory(slug: string, raw: string, coverImage: string | undefined): Story {
  const { data, content } = matter(raw)

  const cover: StoryCover = VALID_COVERS.includes(data.cover) ? data.cover : 'brown'
  const category: StoryCategory = VALID_CATEGORIES.includes(data.category) ? data.category : 'Plugins'
  const targetKind: StoryTargetKind = VALID_TARGET_KINDS.includes(data.target?.kind)
    ? data.target.kind
    : 'plugin'

  return {
    slug,
    title: data.title ?? slug,
    excerpt: data.excerpt ?? '',
    author: {
      name: data.author?.name ?? 'Anonymous',
      handle: data.author?.handle ?? 'anon',
      avatarHue: Number.isFinite(data.author?.avatarHue) ? data.author.avatarHue : 28,
      url: optionalHref(data.author?.url),
      social: optionalHref(data.author?.social),
    },
    target: {
      name: data.target?.name ?? slug,
      kind: targetKind,
      href: sanitizeHref(data.target?.href),
    },
    category,
    platforms: Array.isArray(data.platforms) ? data.platforms : [],
    cover,
    date: data.date ?? '',
    readTime: Number.isFinite(data.readTime) ? data.readTime : 5,
    featured: Boolean(data.featured),
    pinned: Boolean(data.pinned),
    content: content.trim(),
    coverImage,
    coverAlt: optionalString(data.coverAlt),
    pullQuote: optionalString(data.pullQuote),
  }
}

function parseDate(value: string): number {
  const t = Date.parse(value)
  return Number.isNaN(t) ? 0 : t
}

function readStory(slug: string): Story | null {
  const indexPath = path.join(STORIES_DIR, slug, 'index.md')
  if (!fs.existsSync(indexPath)) return null
  const raw = fs.readFileSync(indexPath, 'utf8')
  return parseStory(slug, raw, findCoverImage(slug))
}

export function getAllStories(): Story[] {
  if (!fs.existsSync(STORIES_DIR)) return []

  const slugs = fs
    .readdirSync(STORIES_DIR, { withFileTypes: true })
    .filter(d => d.isDirectory() && SLUG_PATTERN.test(d.name))
    .map(d => d.name)

  const stories = slugs
    .map(readStory)
    .filter((s): s is Story => s !== null)

  return stories.sort((a, b) => parseDate(b.date) - parseDate(a.date))
}

export function getStoryBySlug(slug: string): Story | null {
  if (!SLUG_PATTERN.test(slug)) return null
  const storyDir = path.join(STORIES_DIR, slug)
  const resolved = path.resolve(storyDir)
  const resolvedRoot = path.resolve(STORIES_DIR)
  if (!resolved.startsWith(resolvedRoot + path.sep)) return null
  return readStory(slug)
}

export function getFeaturedStory(): Story | null {
  const all = getAllStories()
  return all.find(s => s.featured) ?? all[0] ?? null
}

export function getPinnedStory(): Story | null {
  const all = getAllStories()
  return all.find(s => s.pinned) ?? all[0] ?? null
}
