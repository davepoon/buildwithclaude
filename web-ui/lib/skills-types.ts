/**
 * Type definitions for Skills
 */

export interface Skill {
  slug: string           // directory name
  name: string           // from frontmatter
  description: string    // from frontmatter
  category: string       // from frontmatter
  allowedTools?: string  // optional from frontmatter
  model?: string         // optional from frontmatter
  license?: string       // optional from frontmatter
  content: string        // markdown body content

  // Source metadata (populated by getSkillForDetail). Local file-skills are
  // isLocal=true; DB-imported skills carry their source repo + install command
  // so the detail page can render source-aware install/links instead of the
  // hardcoded BuildWithClaude repo.
  isLocal?: boolean
  repository?: string        // source GitHub repo URL (imported skills)
  installCommand?: string    // e.g. "npx skills add owner/repo"
  stars?: number
  installs?: number          // popularity signal (latest weekly installs)
  sourcePath?: string        // path of SKILL.md within the source repo
  submissionStatus?: string  // approved | flagged | rejected (imported skills)
  firstSeen?: string         // ISO date the skill was first indexed
  author?: string
}

// Re-export category utilities for convenience
export { generateCategoryDisplayName, getCategoryIcon, type CategoryMetadata } from './category-utils'
