// Types for the unified plugins page

export interface Subagent {
  name: string
  category: string
  description: string
  version: string
  file: string
  path: string
  tools: string[]
  tags: string[]
}

export interface Command {
  name: string
  category: string
  description: string
  version: string
  file: string
  path: string
  argumentHint: string
  model: string
  prefix: string
  tags: string[]
}

export interface Hook {
  name: string
  category: string
  description: string
  event: string
  matcher: string
  language: string
  version: string
  file: string
  path: string
  tags: string[]
}

export interface ExternalPlugin {
  name: string
  namespace: string
  description: string
  repository: string
  stars: number
  installCommand: string
  categories: string[]
  skills: string[]
  version: string
  author: string
  keywords: string[]
  updatedAt?: string
}

export type PluginType = 'subagent' | 'command' | 'hook' | 'skill' | 'plugin'

export interface UnifiedPlugin {
  type: PluginType
  name: string
  description: string
  category: string
  tags: string[]
  // Marketplace source tracking
  marketplaceId?: string
  marketplaceName?: string
  // For plugins from repositories
  repository?: string
  stars?: number
  installs?: number
  installCommand?: string
  namespace?: string
  author?: string
  version?: string
  // For internal/local plugins
  file?: string
  path?: string
  // Slug for download/install endpoints
  slug?: string
  // DB-sourced rows (ISO string); local/BWC plugins omit
  updatedAt?: string
}

export interface PluginRegistryData {
  subagents: Subagent[]
  commands: Command[]
  hooks: Hook[]
  externalPlugins: ExternalPlugin[]
}
