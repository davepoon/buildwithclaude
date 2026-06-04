/**
 * Smart repository analyzer for discovering skills in non-standard formats.
 * Uses multi-strategy detection: plugin.json → SKILL.md → skills/ dir → README fallback.
 */

import matter from 'gray-matter'
import { getGitHubClient, type GitHubTreeEntry } from '@/lib/github/client'
import { parseMarketplaceJson } from './parser'
import { normalizeSkillCategory } from '@/lib/category-utils'

export interface AnalyzedSkill {
  name: string
  slug: string
  description: string
  category: string | null
  allowedTools?: string[]
  model?: string
  installCommand?: string
  content?: string
  sourcePath?: string // path of the SKILL.md within the source repo (for deep links / on-demand refetch)
  source: 'skill-md' | 'plugin-json' | 'marketplace-json' | 'readme-inferred'
}

export interface RepoAnalysisResult {
  repoFullName: string
  stars: number
  owner: string
  skills: AnalyzedSkill[]
  detectionMethod: string
}

const MAX_SKILLS_PER_REPO = 50
const MAX_DESCRIPTION_LENGTH = 2000
const MAX_NAME_LENGTH = 255

/**
 * Convert a slug-like string to Title Case (e.g. "design-taste-frontend" → "Design Taste Frontend")
 */
function humanizeName(slug: string): string {
  return slug
    .replace(/[-_]+/g, ' ')
    .replace(/\b\w/g, c => c.toUpperCase())
    .trim()
}

/**
 * Create URL-safe slug from name
 */
function createSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
}

/**
 * Truncate string to max length
 */
function truncate(str: string, max: number): string {
  return str.length > max ? str.slice(0, max) : str
}

/**
 * Map common topics/keywords to categories
 */
function inferCategory(topics: string[], nameDesc: string): string {
  const topicSet = new Set(topics.map(t => t.toLowerCase()))
  const text = nameDesc.toLowerCase()

  const categoryMap: Record<string, string[]> = {
    'development-code': ['development', 'dev', 'coding', 'programming', 'developer', 'testing', 'test', 'qa', 'database', 'sql', 'postgres', 'mongo', 'frontend', 'backend', 'api', 'server', 'rest', 'graphql', 'mobile', 'ios', 'android', 'react', 'css'],
    'ai-ml': ['ai', 'machine-learning', 'ml', 'artificial-intelligence', 'llm', 'deep-learning', 'neural', 'nlp'],
    'devops': ['devops', 'infrastructure', 'deployment', 'ci-cd', 'docker', 'kubernetes', 'terraform'],
    'security': ['security', 'auth', 'authentication', 'encryption', 'vulnerability', 'pentest'],
    'document-processing': ['documentation', 'docs', 'readme', 'pdf', 'markdown', 'document'],
    'analytics': ['data', 'analytics', 'visualization', 'data-science', 'dashboard', 'metrics'],
    'automation': ['automation', 'workflow', 'scripting', 'cron', 'pipeline'],
    'design': ['design', 'ui', 'ux', 'figma', 'sketch'],
    'communication': ['chat', 'messaging', 'slack', 'discord', 'notification'],
    'ecommerce': ['ecommerce', 'commerce', 'shop', 'payment', 'stripe'],
    'email': ['email', 'smtp', 'newsletter', 'mailgun'],
    'project-management': ['project-management', 'task', 'kanban', 'agile', 'jira', 'linear'],
    'social-media': ['social-media', 'twitter', 'marketing', 'seo'],
    'storage-docs': ['storage', 'cloud', 's3', 'bucket', 'file-storage'],
    'customer-support': ['support', 'helpdesk', 'ticket', 'zendesk'],
    'crm': ['crm', 'customer', 'salesforce', 'hubspot'],
    'business-productivity': ['productivity', 'spreadsheet', 'office', 'calendar'],
    'creative-collaboration': ['collaboration', 'creative', 'whiteboard', 'brainstorm'],
  }

  for (const [category, keywords] of Object.entries(categoryMap)) {
    for (const keyword of keywords) {
      if (topicSet.has(keyword) || text.includes(keyword)) {
        return category
      }
    }
  }

  return 'uncategorized'
}

/**
 * Analyze a GitHub repository and extract skills using multi-strategy detection.
 */
export async function analyzeRepository(repoFullName: string): Promise<RepoAnalysisResult> {
  const github = getGitHubClient()

  // 1. Fetch repo metadata
  const repo = await github.fetchRepoMetadata(repoFullName)

  // Skip forks
  if (repo.fork) {
    return {
      repoFullName,
      stars: repo.stargazers_count,
      owner: repo.owner.login,
      skills: [],
      detectionMethod: 'skipped-fork',
    }
  }

  // 2. Fetch repo tree
  let treeEntries: GitHubTreeEntry[] = []
  try {
    const tree = await github.fetchRepoTree(repoFullName)
    treeEntries = tree.tree
  } catch {
    // Tree fetch failed, continue with limited analysis
    console.warn(`Failed to fetch tree for ${repoFullName}, falling back to README`)
  }

  const filePaths = treeEntries.map(e => e.path)

  // 3. Strategy: Check for .claude-plugin/plugin.json or marketplace.json
  const marketplaceSkills = await tryMarketplaceJson(repoFullName, filePaths, repo.owner.login)
  if (marketplaceSkills.length > 0) {
    return {
      repoFullName,
      stars: repo.stargazers_count,
      owner: repo.owner.login,
      skills: marketplaceSkills.slice(0, MAX_SKILLS_PER_REPO),
      detectionMethod: 'marketplace-json',
    }
  }

  // 4. Strategy: Look for SKILL.md files
  const skillMdFiles = filePaths.filter(p => p.endsWith('SKILL.md'))
  if (skillMdFiles.length > 0) {
    const skills = await parseSkillMdFiles(repoFullName, skillMdFiles, repo.owner.login)
    if (skills.length > 0) {
      return {
        repoFullName,
        stars: repo.stargazers_count,
        owner: repo.owner.login,
        skills: skills.slice(0, MAX_SKILLS_PER_REPO),
        detectionMethod: 'skill-md',
      }
    }
  }

  // 5. Strategy: Look for skills/ directory with .md files
  const skillsDirFiles = filePaths.filter(p =>
    /^skills?\/[^/]+\.md$/i.test(p) || /^\.claude\/skills?\/[^/]+\.md$/i.test(p)
  )
  if (skillsDirFiles.length > 0) {
    const skills = await parseSkillMdFiles(repoFullName, skillsDirFiles, repo.owner.login)
    if (skills.length > 0) {
      return {
        repoFullName,
        stars: repo.stargazers_count,
        owner: repo.owner.login,
        skills: skills.slice(0, MAX_SKILLS_PER_REPO),
        detectionMethod: 'skills-directory',
      }
    }
  }

  // 6. Fallback: Infer from README
  const readmeSkill = await tryReadmeInference(repoFullName, filePaths, repo)
  if (readmeSkill) {
    return {
      repoFullName,
      stars: repo.stargazers_count,
      owner: repo.owner.login,
      skills: [readmeSkill],
      detectionMethod: 'readme-inferred',
    }
  }

  return {
    repoFullName,
    stars: repo.stargazers_count,
    owner: repo.owner.login,
    skills: [],
    detectionMethod: 'no-skills-found',
  }
}

/**
 * Try to parse marketplace.json or plugin.json from known paths.
 */
async function tryMarketplaceJson(
  repoFullName: string,
  filePaths: string[],
  owner: string,
): Promise<AnalyzedSkill[]> {
  const github = getGitHubClient()
  const jsonPaths = [
    '.claude-plugin/plugin.json',
    '.claude-plugin/marketplace.json',
    'marketplace.json',
    'plugin.json',
  ]

  for (const path of jsonPaths) {
    if (!filePaths.includes(path)) continue

    try {
      const content = await github.fetchFileContent(repoFullName, path)
      const parsed = parseMarketplaceJson(content, repoFullName)

      if (parsed && parsed.plugins) {
        return parsed.plugins.map(p => ({
          name: truncate(p.name, MAX_NAME_LENGTH),
          slug: createSlug(p.name),
          description: truncate(p.description || `Plugin from ${repoFullName}`, MAX_DESCRIPTION_LENGTH),
          category: normalizeSkillCategory(p.category || null),
          installCommand: `npx skills add ${repoFullName}`,
          source: path.includes('marketplace') ? 'marketplace-json' as const : 'plugin-json' as const,
        }))
      }
    } catch {
      continue
    }
  }

  return []
}

/**
 * Parse SKILL.md files and extract skill data from YAML frontmatter.
 */
async function parseSkillMdFiles(
  repoFullName: string,
  paths: string[],
  owner: string,
): Promise<AnalyzedSkill[]> {
  const github = getGitHubClient()
  const skills: AnalyzedSkill[] = []

  for (const filePath of paths.slice(0, MAX_SKILLS_PER_REPO)) {
    try {
      const content = await github.fetchFileContent(repoFullName, filePath)
      const { data, content: body } = matter(content)

      // Infer name from frontmatter, H1 heading, or directory/filename
      const dirName = filePath.split('/').slice(-2, -1)[0]
      const fileName = filePath.split('/').pop()?.replace(/\.md$/, '') || ''
      let name = data.name
      if (!name) {
        const h1Match = body.match(/^#\s+(.+)$/m)
        name = h1Match ? h1Match[1].trim() : humanizeName(dirName || fileName)
      }

      skills.push({
        name: truncate(name, MAX_NAME_LENGTH),
        slug: createSlug(name),
        description: truncate(
          data.description || body.split('\n').find(l => l.trim().length > 0) || `Skill from ${repoFullName}`,
          MAX_DESCRIPTION_LENGTH,
        ),
        category: normalizeSkillCategory(data.category || null),
        allowedTools: data['allowed-tools']
          ? String(data['allowed-tools']).split(',').map(t => t.trim())
          : undefined,
        model: data.model || undefined,
        installCommand: `npx skills add ${repoFullName}`,
        content: body,
        sourcePath: filePath,
        source: 'skill-md',
      })
    } catch {
      // Skip files that can't be parsed
      continue
    }
  }

  return skills
}

/**
 * Fallback: infer a single skill from the README and repo metadata.
 */
async function tryReadmeInference(
  repoFullName: string,
  filePaths: string[],
  repo: { name: string; description: string | null; topics: string[]; owner: { login: string } },
): Promise<AnalyzedSkill | null> {
  const github = getGitHubClient()

  // Must have some indication it's a skill/agent
  const nameDesc = `${repo.name} ${repo.description || ''} ${repo.topics.join(' ')}`.toLowerCase()
  const skillIndicators = ['skill', 'agent', 'claude', 'prompt', 'claude-code']
  if (!skillIndicators.some(ind => nameDesc.includes(ind))) {
    return null
  }

  // Try to fetch README
  const readmePaths = ['README.md', 'readme.md', 'Readme.md']
  let readmeContent = ''
  for (const rp of readmePaths) {
    if (!filePaths.includes(rp)) continue
    try {
      readmeContent = await github.fetchFileContent(repoFullName, rp)
      break
    } catch {
      continue
    }
  }

  // Extract description: repo description or first non-heading paragraph from README
  let description = repo.description || ''
  if (!description && readmeContent) {
    const lines = readmeContent.split('\n')
    for (const line of lines) {
      const trimmed = line.trim()
      if (trimmed && !trimmed.startsWith('#') && !trimmed.startsWith('!') && !trimmed.startsWith('[')) {
        description = trimmed
        break
      }
    }
  }

  if (!description) {
    description = `Skill from ${repoFullName}`
  }

  // Extract install command from code blocks in README
  let installCommand: string | undefined
  const codeBlockMatch = readmeContent.match(/```(?:bash|sh|shell)?\n([\s\S]*?npx\s+skills?\s+add\s+\S+[\s\S]*?)\n/)
  if (codeBlockMatch) {
    installCommand = codeBlockMatch[1].trim()
  } else {
    installCommand = `npx skills add ${repoFullName}`
  }

  const category = normalizeSkillCategory(inferCategory(repo.topics, nameDesc))

  // Derive display name from README H1 or humanize repo name
  let displayName: string
  if (readmeContent) {
    const h1Match = readmeContent.match(/^#\s+(.+)$/m)
    displayName = h1Match ? h1Match[1].trim() : humanizeName(repo.name)
  } else {
    displayName = humanizeName(repo.name)
  }

  return {
    name: truncate(displayName, MAX_NAME_LENGTH),
    slug: createSlug(repo.name),
    description: truncate(description, MAX_DESCRIPTION_LENGTH),
    category,
    installCommand,
    content: readmeContent,
    source: 'readme-inferred',
  }
}

/**
 * Check if a repo has skill indicators (used by auto-discovery).
 */
export function hasSkillIndicators(
  repo: { name: string; description: string | null; topics: string[] },
): boolean {
  const skillTopics = ['claude-code-skill', 'claude-skill', 'agent-skill', 'claude-agent-skill']
  if (repo.topics?.some(t => skillTopics.includes(t.toLowerCase()))) return true

  const nameDesc = `${repo.name} ${repo.description || ''}`.toLowerCase()
  return nameDesc.includes('skill') && nameDesc.includes('claude')
}
