'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Command as CommandPrimitive } from 'cmdk'
import { Search, X } from 'lucide-react'
import { CommandList } from '@/components/ui/command'
import { useContentSearch } from '@/hooks/use-content-search'
import { SearchResults, SEARCH_GROUP_HEADING_CLASS } from '@/components/search-results'
import { cn } from '@/lib/utils'

/**
 * The homepage hero's primary action: a prominent search field that shows the
 * same live, grouped autocomplete dropdown as the ⌘K palette (they share
 * `useContentSearch` + `SearchResults`). Picking a result navigates to it;
 * the see-all footer (and an empty submit) lands on the full /search page.
 * The global ⌘K palette is still available via the nav (hinted by the chip).
 */
export function HeroSearch() {
  const router = useRouter()
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)
  const { hits, facets, loading, errored, trimmed } = useContentSearch(query, { enabled: open })

  // Close the dropdown on outside click.
  useEffect(() => {
    if (!open) return
    const onPointerDown = (e: PointerEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('pointerdown', onPointerDown)
    return () => document.removeEventListener('pointerdown', onPointerDown)
  }, [open])

  const go = (url: string) => {
    setOpen(false)
    if (url.startsWith('http')) window.open(url, '_blank')
    else router.push(url)
  }

  const showDropdown = open && trimmed.length > 0

  return (
    <CommandPrimitive
      ref={rootRef}
      shouldFilter={false}
      label="Search the catalog"
      className={cn('relative max-w-xl', SEARCH_GROUP_HEADING_CLASS)}
      onKeyDown={(e) => {
        if (e.key === 'Escape') setOpen(false)
      }}
    >
      <div className="relative">
        <Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
        <CommandPrimitive.Input
          value={query}
          onValueChange={(v) => {
            setQuery(v)
            setOpen(true)
          }}
          onFocus={() => setOpen(true)}
          placeholder="Search plugins, skills, agents, commands, MCP servers, themes…"
          aria-label="Search the catalog"
          className="h-12 w-full rounded-xl border border-border bg-card pl-12 pr-12 text-base text-foreground outline-none transition-colors placeholder:text-muted-foreground focus:border-primary/60 focus:ring-2 focus:ring-primary/20"
        />
        {query ? (
          <button
            type="button"
            onClick={() => {
              setQuery('')
              setOpen(false)
            }}
            aria-label="Clear search"
            className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground transition-colors hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        ) : (
          <kbd className="pointer-events-none absolute right-4 top-1/2 hidden -translate-y-1/2 items-center rounded border border-border bg-muted px-1.5 py-0.5 text-[11px] font-medium text-muted-foreground sm:inline-flex">
            ⌘K
          </kbd>
        )}
      </div>

      {showDropdown && (
        <div className="absolute left-0 right-0 top-full z-50 mt-2 overflow-hidden rounded-xl border border-border bg-popover text-popover-foreground shadow-xl">
          <CommandList className="max-h-[60vh]">
            <SearchResults
              hits={hits}
              facets={facets}
              loading={loading}
              errored={errored}
              trimmed={trimmed}
              onSelect={go}
            />
          </CommandList>
        </div>
      )}
    </CommandPrimitive>
  )
}
