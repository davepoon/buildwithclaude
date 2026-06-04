import fs from 'fs'
import path from 'path'
import matter from 'gray-matter'
import { and, eq, or } from 'drizzle-orm'
import { db } from './db/client'
import { plugins } from './db/schema'
import { Skill } from './skills-types'
import { CategoryMetadata, generateCategoryMetadata } from './category-utils'

export function getAllSkills(): Skill[] {
  const skillsDirectory = path.join(process.cwd(), '../plugins/all-skills/skills')

  if (!fs.existsSync(skillsDirectory)) {
    console.warn('Skills directory not found:', skillsDirectory)
    return []
  }

  const dirNames = fs.readdirSync(skillsDirectory)

  const skills = dirNames
    .filter(dirName => {
      const skillPath = path.join(skillsDirectory, dirName, 'SKILL.md')
      return fs.existsSync(skillPath)
    })
    .map(dirName => {
      const filePath = path.join(skillsDirectory, dirName, 'SKILL.md')
      const fileContents = fs.readFileSync(filePath, 'utf8')
      const { data, content } = matter(fileContents)

      const category = data.category || 'uncategorized'

      return {
        slug: dirName,
        name: data.name || dirName,
        description: data.description || '',
        category,
        allowedTools: data['allowed-tools'],
        model: data.model,
        license: data.license,
        content
      }
    })

  return skills.sort((a, b) => a.name.localeCompare(b.name))
}

export function getSkillBySlug(slug: string): Skill | null {
  const skillsDirectory = path.join(process.cwd(), '../plugins/all-skills/skills')
  const filePath = path.join(skillsDirectory, slug, 'SKILL.md')

  if (!fs.existsSync(filePath)) {
    return null
  }

  const fileContents = fs.readFileSync(filePath, 'utf8')
  const { data, content } = matter(fileContents)
  const category = data.category || 'uncategorized'

  return {
    slug,
    name: data.name || slug,
    description: data.description || '',
    category,
    allowedTools: data['allowed-tools'],
    model: data.model,
    license: data.license,
    content
  }
}

/**
 * Build the raw.githubusercontent URL for a SKILL.md given a repo URL + in-repo path.
 * Returns null if the repository isn't a parseable GitHub URL.
 */
function rawGithubUrl(repository: string, sourcePath: string): string | null {
  const match = repository.match(/github\.com\/([^/]+)\/([^/?#]+)/)
  if (!match) return null
  const owner = match[1]
  const repo = match[2].replace(/\.git$/, '')
  const cleanPath = sourcePath.replace(/^\/+/, '')
  return `https://raw.githubusercontent.com/${owner}/${repo}/HEAD/${cleanPath}`
}

/**
 * Fetch a SKILL.md body on demand from the source repo. Prefers the known
 * sourcePath; for legacy rows without one, tries conventional locations keyed
 * by the slug. Returns the frontmatter-stripped body + parsed frontmatter, or
 * null if nothing is reachable. Results are cached (Next fetch revalidate).
 */
async function fetchSkillBody(
  repository: string,
  slug: string,
  sourcePath?: string | null,
): Promise<{ content: string; frontmatter: Record<string, unknown> } | null> {
  const candidates = sourcePath
    ? [sourcePath]
    : [`${slug}/SKILL.md`, `skills/${slug}/SKILL.md`, `.claude/skills/${slug}/SKILL.md`, 'SKILL.md']

  for (const candidate of candidates) {
    const url = rawGithubUrl(repository, candidate)
    if (!url) continue
    try {
      const res = await fetch(url, { next: { revalidate: 3600 } })
      if (!res.ok) continue
      const parsed = matter(await res.text())
      return { content: parsed.content, frontmatter: parsed.data }
    } catch {
      // Try the next candidate.
    }
  }
  return null
}

/**
 * Resolve a skill for its detail page from either source:
 *   1. a local SKILL.md file (isLocal: true) — unchanged BuildWithClaude behavior, or
 *   2. a DB-imported/crawled skill row (isLocal: false) — body from the persisted
 *      `content` column, falling back to an on-demand (cached) raw.githubusercontent
 *      fetch for legacy rows that predate the column.
 * Returns null if neither source has the slug.
 */
export async function getSkillForDetail(slug: string): Promise<Skill | null> {
  // 1. Local file skill
  const local = getSkillBySlug(slug)
  if (local) {
    return { ...local, isLocal: true }
  }

  // 2. DB-imported skill (match on slug OR name, only type='skill')
  let rows: Array<typeof plugins.$inferSelect> = []
  try {
    rows = await db
      .select()
      .from(plugins)
      .where(and(eq(plugins.type, 'skill'), or(eq(plugins.slug, slug), eq(plugins.name, slug))))
      .limit(1)
  } catch {
    return null
  }

  if (!rows.length) return null
  const p = rows[0]

  // Body: prefer the persisted (frontmatter-stripped) body. For legacy rows with
  // no content, fetch SKILL.md on demand from the source repo and strip frontmatter.
  let content = p.content || ''
  let frontmatter: Record<string, unknown> = {}
  if (!content && p.repository) {
    const fetched = await fetchSkillBody(p.repository, p.slug, p.sourcePath)
    if (fetched) {
      content = fetched.content
      frontmatter = fetched.frontmatter
    }
  }

  const fmTools = frontmatter['allowed-tools']

  return {
    slug: p.slug,
    name: p.name,
    description: p.description || '',
    category: p.categories?.[0] || 'uncategorized',
    allowedTools: typeof fmTools === 'string' ? fmTools : undefined,
    model: typeof frontmatter.model === 'string' ? frontmatter.model : undefined,
    license: typeof frontmatter.license === 'string' ? frontmatter.license : undefined,
    content,
    isLocal: false,
    repository: p.repository || undefined,
    installCommand: p.installCommand || undefined,
    stars: p.stars,
    installs: p.installs,
    sourcePath: p.sourcePath || undefined,
    submissionStatus: p.submissionStatus,
    firstSeen: p.createdAt ? p.createdAt.toISOString() : undefined,
    author: p.author || undefined,
  }
}

export function getSkillsByCategory(category: string): Skill[] {
  return getAllSkills().filter(skill => skill.category === category)
}

export function searchSkills(query: string): Skill[] {
  const normalizedQuery = query.toLowerCase()
  return getAllSkills().filter(skill =>
    skill.name.toLowerCase().includes(normalizedQuery) ||
    skill.description.toLowerCase().includes(normalizedQuery) ||
    skill.content.toLowerCase().includes(normalizedQuery)
  )
}

/**
 * Get all unique categories from skills with counts
 */
export function getAllSkillCategories(): CategoryMetadata[] {
  const skills = getAllSkills()
  const categoryCounts: Record<string, number> = {}

  // Count skills per category
  skills.forEach(skill => {
    const category = skill.category
    categoryCounts[category] = (categoryCounts[category] || 0) + 1
  })

  return generateCategoryMetadata(categoryCounts)
}

/**
 * Get all unique category IDs
 */
export function getAllSkillCategoryIds(): string[] {
  const skills = getAllSkills()
  const categories = new Set(skills.map(s => s.category))
  return Array.from(categories).sort()
}
