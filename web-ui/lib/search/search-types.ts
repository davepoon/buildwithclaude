import type { Settings } from 'meilisearch'
import { createHash } from 'node:crypto'

/**
 * The seven content types BuildWithClaude indexes into Meilisearch. Values are
 * chosen to match the singular detail-route directory names (`app/<type>/[slug]`)
 * so a document's detail URL is derivable as `/<type>/<slug>` for the six types
 * that have detail pages. Marketplaces have no per-item route → they deep-link
 * into `/marketplaces?q=<name>`, which pre-filters the listing so the clicked
 * marketplace surfaces as the top result (see `urlForDocument`).
 */
export type SearchContentType =
  | 'subagent'
  | 'command'
  | 'hook'
  | 'skill'
  | 'plugin'
  | 'mcp-server'
  | 'marketplace'

export const SEARCH_CONTENT_TYPES: SearchContentType[] = [
  'subagent',
  'command',
  'hook',
  'skill',
  'plugin',
  'mcp-server',
  'marketplace',
]

export function isSearchContentType(value: string): value is SearchContentType {
  return (SEARCH_CONTENT_TYPES as string[]).includes(value)
}

/**
 * Build a Meilisearch primary key. Meilisearch only permits `[a-zA-Z0-9_-]` in
 * document ids, so the raw `${type}:${slug}` form (colon, and slugs like a
 * marketplace's `@owner/repo` namespace) must be sanitized. Slugs that require
 * sanitizing get a stable digest suffix so distinct values cannot collapse.
 */
export function makeObjectID(type: SearchContentType, slug: string): string {
  const safeSlug = slug.replace(/[^a-zA-Z0-9_-]+/g, '_')
  if (safeSlug === slug) return `${type}__${safeSlug}`

  const digest = createHash('sha256').update(slug).digest('hex').slice(0, 16)
  return `${type}__${safeSlug}__${digest}`
}

/**
 * Detail-page route for a document. Six types map to `app/<type>/[slug]`;
 * marketplaces have no per-item page, so they deep-link into the listing
 * pre-filtered by `name` (falling back to `slug`) so the clicked marketplace
 * appears as the top result.
 */
export function urlForDocument(type: SearchContentType, slug: string, name?: string): string {
  if (type === 'marketplace') return `/marketplaces?q=${encodeURIComponent(name ?? slug)}`
  return `/${type}/${slug}`
}

/**
 * A single document in the unified `bwc_content` index. The shape is the union
 * of the fields the 7 content sources expose; source-specific fields are
 * optional. Numerics default to 0 so they remain sortable for every type.
 */
export interface SearchDocument {
  /** Primary key. `${type}:${slug}` — globally unique across types, deterministic
   *  (re-indexing upserts in place), and reusable as a stable React key. */
  objectID: string
  type: SearchContentType
  slug: string
  name: string
  description: string
  /** Primary category (single value) — used for the facet/display. */
  category?: string
  /** All categories (multi-valued for plugins/marketplaces; [category] otherwise).
   *  Filtered against for accurate multi-category filtering. */
  categories: string[]
  /** Flattened multi-value field: tools / keywords / tags depending on source. */
  tags: string[]
  /** Markdown body. Absent for DB-only types without a body (e.g. mcp-server). */
  content?: string
  // facet / filter fields (source-specific)
  marketplace?: string
  /** Marketplace id ('build-with-claude' or a UUID) — for the plugins/skills source filter. */
  marketplaceId?: string
  event?: string
  language?: string
  model?: string
  vendor?: string
  sourceRegistry?: string
  // sortable numerics (default 0)
  stars: number
  installs: number
  /** Epoch milliseconds; 0 when the source has no timestamp. */
  updatedAt: number
  /** Pre-computed detail route so the UI can link without a type→url map. */
  url: string
}

/**
 * Non-HTML highlight delimiters. Meilisearch wraps matched terms in these tags
 * inside `_formatted`; the frontend splits on them and renders `<mark>` React
 * nodes — never `dangerouslySetInnerHTML`, so highlighting is XSS-safe.
 * U+0001/U+0002 are control chars that never occur in real content.
 */
export const HIGHLIGHT_PRE_TAG = ''
export const HIGHLIGHT_POST_TAG = ''

/**
 * Index settings — the single source of truth shared by provisioning and tests.
 * searchableAttributes order encodes priority (name beats body), matching the
 * existing relevance heuristics in the DB loaders. Custom ranking rules append
 * popularity tie-breakers after the default text-relevance rules.
 */
export const CONTENT_INDEX_SETTINGS: Settings = {
  searchableAttributes: ['name', 'description', 'category', 'tags', 'content'],
  filterableAttributes: [
    'type',
    'category',
    'categories',
    'tags',
    'marketplace',
    'marketplaceId',
    'event',
    'language',
    'model',
    'vendor',
    'sourceRegistry',
  ],
  sortableAttributes: ['stars', 'installs', 'updatedAt'],
  rankingRules: [
    'words',
    'typo',
    'proximity',
    'attribute',
    'sort',
    'exactness',
    'stars:desc',
    'installs:desc',
  ],
  typoTolerance: {
    enabled: true,
    // Let short tech terms (git, npm, sql) still tolerate a typo.
    minWordSizeForTypos: { oneTypo: 4, twoTypos: 8 },
  },
  pagination: { maxTotalHits: 2000 },
}
