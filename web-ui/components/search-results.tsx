'use client'

import {
  Bot,
  CornerDownLeft,
  Loader2,
  Package,
  Palette,
  Server,
  Sparkles,
  SquareTerminal,
  Store,
  Webhook,
} from 'lucide-react'
import { CommandEmpty, CommandGroup, CommandItem } from '@/components/ui/command'
import { HighlightedText } from '@/components/highlighted-text'
import {
  TYPE_LABELS,
  TYPE_LABELS_PLURAL,
  TYPE_ORDER,
  getTypeBadgeClasses,
  type ContentType,
  type SearchHit,
} from '@/lib/content-types'

/**
 * Group-heading styling for the cmdk `Command` wrapper. Applied by both the ⌘K
 * palette and the homepage hero so result-group labels render identically.
 */
export const SEARCH_GROUP_HEADING_CLASS =
  '[&_[cmdk-group-heading]]:px-3 [&_[cmdk-group-heading]]:py-2 [&_[cmdk-group-heading]]:text-xs [&_[cmdk-group-heading]]:font-medium [&_[cmdk-group-heading]]:text-muted-foreground'

const QUICK_LINKS: { href: string; label: string; icon: React.ReactNode }[] = [
  { href: '/plugins', label: 'Plugins', icon: <Package className="h-4 w-4" /> },
  { href: '/skills', label: 'Skills', icon: <Sparkles className="h-4 w-4" /> },
  { href: '/subagents', label: 'Subagents', icon: <Bot className="h-4 w-4" /> },
  { href: '/commands', label: 'Commands', icon: <SquareTerminal className="h-4 w-4" /> },
  { href: '/hooks', label: 'Hooks', icon: <Webhook className="h-4 w-4" /> },
  { href: '/mcp-servers', label: 'MCP Servers', icon: <Server className="h-4 w-4" /> },
  { href: '/themes', label: 'Themes', icon: <Palette className="h-4 w-4" /> },
  { href: '/marketplaces', label: 'Marketplaces', icon: <Store className="h-4 w-4" /> },
]

function snippet(hit: SearchHit): string | undefined {
  return hit._formatted?.description || hit._formatted?.content || hit.description || undefined
}

function groupByType(hits: SearchHit[]): [ContentType, SearchHit[]][] {
  const groups = new Map<ContentType, SearchHit[]>()
  for (const hit of hits) {
    const list = groups.get(hit.type)
    if (list) list.push(hit)
    else groups.set(hit.type, [hit])
  }
  return TYPE_ORDER.filter((t) => groups.has(t)).map((t) => [t, groups.get(t)!])
}

/**
 * The shared result body rendered inside a cmdk `<CommandList>` — loading/error/
 * empty states, optional idle browse links, type-grouped hits, and a see-all
 * footer. `onSelect` receives a URL (internal route or external link); callers
 * decide how to navigate and how to dismiss their surface.
 */
export function SearchResults({
  hits,
  facets,
  loading,
  errored,
  trimmed,
  onSelect,
  showBrowseLinks = false,
}: {
  hits: SearchHit[]
  facets: Record<string, number>
  loading: boolean
  errored: boolean
  trimmed: string
  onSelect: (url: string) => void
  /** Show the "Browse" quick links when the query is empty (palette idle state). */
  showBrowseLinks?: boolean
}) {
  const grouped = groupByType(hits)

  return (
    <>
      <div aria-live="polite" className="sr-only">
        {loading ? 'Searching' : trimmed ? `${hits.length} results` : ''}
      </div>

      {loading && (
        <div className="flex items-center gap-2 px-4 py-6 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Searching…
        </div>
      )}

      {!loading && errored && (
        <div className="px-4 py-6 text-sm text-muted-foreground">
          Search is temporarily unavailable. Try the browse pages below.
        </div>
      )}

      {!loading && !errored && trimmed && hits.length === 0 && (
        <CommandEmpty>No results for “{trimmed}”. Try fewer or different keywords.</CommandEmpty>
      )}

      {/* Idle state: quick links to the browse pages. */}
      {!trimmed && showBrowseLinks && (
        <CommandGroup heading="Browse">
          {QUICK_LINKS.map((link) => (
            <CommandItem
              key={link.href}
              value={`go:${link.label}`}
              onSelect={() => onSelect(link.href)}
              className="group data-[selected=true]:bg-primary/15 data-[selected=true]:text-foreground"
            >
              <span className="text-muted-foreground group-data-[selected=true]:text-primary">
                {link.icon}
              </span>
              {link.label}
            </CommandItem>
          ))}
        </CommandGroup>
      )}

      {/* Grouped results. */}
      {grouped.map(([type, list]) => (
        <CommandGroup
          key={type}
          heading={`${TYPE_LABELS_PLURAL[type]}${facets[type] ? ` (${facets[type].toLocaleString()})` : ''}`}
        >
          {list.map((hit) => (
            <CommandItem
              key={hit.objectID}
              value={hit.objectID}
              onSelect={() => onSelect(hit.url)}
              className="gap-3 data-[selected=true]:bg-primary/15 data-[selected=true]:text-foreground"
            >
              <span
                className={`shrink-0 rounded px-1.5 py-0.5 text-[10px] font-medium ${getTypeBadgeClasses(type)}`}
              >
                {TYPE_LABELS[type]}
              </span>
              <span className="flex min-w-0 flex-col">
                <span className="truncate text-sm">
                  <HighlightedText text={hit._formatted?.name || hit.name} />
                </span>
                {snippet(hit) && (
                  <span className="truncate text-xs text-muted-foreground">
                    <HighlightedText text={snippet(hit)} />
                  </span>
                )}
              </span>
            </CommandItem>
          ))}
        </CommandGroup>
      ))}

      {/* See-all footer. */}
      {trimmed && hits.length > 0 && (
        <CommandGroup>
          <CommandItem
            value="__see_all__"
            onSelect={() => onSelect(`/search?q=${encodeURIComponent(trimmed)}`)}
            className="gap-2 text-sm text-primary data-[selected=true]:bg-primary/15 data-[selected=true]:text-primary"
          >
            <CornerDownLeft className="h-4 w-4" />
            See all results for “{trimmed}”
          </CommandItem>
        </CommandGroup>
      )}
    </>
  )
}
