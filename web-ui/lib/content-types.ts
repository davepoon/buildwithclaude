// Client-safe content-type metadata + the /api/search response contract.
// Kept free of server-only imports so it can be used in client components.

export type ContentType =
  | 'subagent'
  | 'command'
  | 'hook'
  | 'skill'
  | 'plugin'
  | 'mcp-server'
  | 'marketplace'
  | 'theme'

/** A single hit from GET /api/search (mirrors the backend SearchDocument + `_formatted`). */
export interface SearchHit {
  objectID: string
  type: ContentType
  slug: string
  name: string
  description: string
  category?: string
  tags?: string[]
  content?: string
  marketplace?: string
  stars?: number
  installs?: number
  url: string
  /** Highlighted/cropped variants; values contain sentinel tags (see HighlightedText). */
  _formatted?: Partial<Omit<SearchHit, '_formatted'>>
}

export interface SearchResponse {
  hits: SearchHit[]
  totalHits: number
  limit: number
  offset: number
  hasMore: boolean
  facetDistribution: Record<string, Record<string, number>>
  source: 'meilisearch' | 'fallback'
}

export const TYPE_LABELS: Record<ContentType, string> = {
  subagent: 'Subagent',
  command: 'Command',
  hook: 'Hook',
  skill: 'Skill',
  plugin: 'Plugin',
  'mcp-server': 'MCP Server',
  marketplace: 'Marketplace',
  theme: 'Theme',
}

export const TYPE_LABELS_PLURAL: Record<ContentType, string> = {
  subagent: 'Subagents',
  command: 'Commands',
  hook: 'Hooks',
  skill: 'Skills',
  plugin: 'Plugins',
  'mcp-server': 'MCP Servers',
  marketplace: 'Marketplaces',
  theme: 'Themes',
}

/** Fixed display order so result groups / facet tabs don't reshuffle as counts change. */
export const TYPE_ORDER: ContentType[] = [
  'plugin',
  'skill',
  'subagent',
  'command',
  'hook',
  'mcp-server',
  'marketplace',
  'theme',
]

/** Tailwind classes for a type badge (extends the unified-plugin-card palette). */
export function getTypeBadgeClasses(type: string): string {
  switch (type) {
    case 'subagent':
      return 'bg-blue-500/10 text-blue-500'
    case 'command':
      return 'bg-green-500/10 text-green-500'
    case 'hook':
      return 'bg-orange-500/10 text-orange-500'
    case 'skill':
      return 'bg-yellow-500/10 text-yellow-500'
    case 'plugin':
      return 'bg-purple-500/10 text-purple-500'
    case 'mcp-server':
      return 'bg-teal-500/10 text-teal-500'
    case 'marketplace':
      return 'bg-indigo-500/10 text-indigo-500'
    case 'theme':
      return 'bg-pink-500/10 text-pink-500'
    default:
      return 'bg-muted text-muted-foreground'
  }
}

export function formatCategoryName(name: string): string {
  return name
    .split('-')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ')
}
