export type StoryCover = 'brown' | 'blue' | 'green' | 'purple'

export type StoryCategory = 'Plugins' | 'Skills' | 'Subagents' | 'Commands' | 'Hooks'

export type StoryTargetKind =
  | 'plugin'
  | 'skill'
  | 'hook'
  | 'subagent'
  | 'command'
  | 'mcp-server'

export interface StoryAuthor {
  name: string
  handle: string
  avatarHue: number
  /** Optional link for the author's name (e.g. personal site or profile). */
  url?: string
  /** Optional link for the @handle (e.g. their X / GitHub / social account). */
  social?: string
}

export interface StoryTarget {
  name: string
  kind: StoryTargetKind
  href: string
}

export interface Story {
  slug: string
  title: string
  excerpt: string
  author: StoryAuthor
  target: StoryTarget
  category: StoryCategory
  platforms: string[]
  cover: StoryCover
  date: string
  readTime: number
  featured?: boolean
  pinned?: boolean
  content: string
  coverImage?: string
  coverAlt?: string
  pullQuote?: string
}
