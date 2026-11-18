import matter from 'gray-matter'

export interface MarketplaceSkillPlugin {
  name: string
  skills?: string[] | null
  source?: unknown
  category?: string | null
}

// Only resolve paths inside a local plugin. Remote/pinned sources need their
// own repository/ref resolution; never fetch them from the marketplace repo.
function localPath(value: unknown): string | null {
  if (typeof value !== 'string' || value.startsWith('/') || /[:\\?#]/.test(value)) return null
  const parts = value.split('/')
  if (parts.includes('..')) return null
  return parts.filter(part => part && part !== '.').join('/')
}

/**
 * Repository a marketplace entry's `source` points at, when the plugin lives
 * outside the marketplace repo: { source: 'github', repo: 'owner/name' } or
 * { source: 'url' | 'git-subdir', url }. Local paths and npm return undefined.
 */
export function sourceRepoUrl(source: unknown): string | undefined {
  if (!source || typeof source !== 'object') return undefined
  const { repo, url } = source as { repo?: unknown; url?: unknown }
  if (typeof repo === 'string' && /^[\w.-]+\/[\w.-]+$/.test(repo)) return `https://github.com/${repo}`
  if (typeof url === 'string' && /^https:\/\//.test(url)) return url.replace(/\.git$/, '')
  return undefined
}

/** Resolve locally declared skill paths, retaining legacy metadata on failure. */
export async function resolveMarketplaceSkills(
  plugin: MarketplaceSkillPlugin,
  repoFullName: string,
  fetchFileContent: (repo: string, path: string) => Promise<string>,
) {
  const source = localPath(plugin.source === undefined ? '.' : plugin.source)
  const skills = []

  for (const entry of plugin.skills || []) {
    // Manifests are untrusted: some list skills as objects. Skip those rather
    // than fail the whole marketplace.
    if (typeof entry !== 'string' || !entry) continue
    let name = entry
    let description = `Skill from ${plugin.name}`
    const skillPath = localPath(entry)

    // Plain names belong to legacy registries, not filesystem declarations.
    if (source !== null && skillPath && (entry.includes('/') || entry === 'SKILL.md')) {
      const filePath = [source, skillPath, skillPath.endsWith('.md') ? '' : 'SKILL.md']
        .filter(Boolean).join('/')
      try {
        const content = await fetchFileContent(repoFullName, filePath)
        // gray-matter also supports executable JavaScript frontmatter. Only
        // allow YAML before invoking it on untrusted repository content.
        if (!/^\uFEFF?---[ \t]*(?:yaml|yml)?[ \t]*\r?\n/.test(content)) {
          throw new Error('Only YAML frontmatter is supported')
        }
        const { data } = matter(content)
        if (typeof data.name === 'string' && data.name.trim()) {
          name = data.name.trim().slice(0, 255)
        }
        if (typeof data.description === 'string' && data.description.trim()) {
          description = data.description.trim()
        }
      } catch {
        // A missing file or malformed frontmatter must not discard the plugin
        // or prevent the remaining declared skills from being indexed.
      }
    }

    skills.push({
      name,
      slug: name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''),
      description,
      category: plugin.category,
    })
  }

  return skills
}
