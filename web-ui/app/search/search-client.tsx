'use client'

import { useEffect, useMemo, useState } from 'react'
import { Loader2, Search as SearchIcon } from 'lucide-react'
import { SearchBar } from '@/components/search-bar'
import { SearchResultCard } from '@/components/search-result-card'
import { useSearch } from '@/hooks/use-search'
import { cn } from '@/lib/utils'
import {
  TYPE_LABELS_PLURAL,
  TYPE_ORDER,
  type ContentType,
  type SearchHit,
} from '@/lib/content-types'

export default function SearchClient({ initialQuery }: { initialQuery: string }) {
  const [query, setQuery] = useState(initialQuery)
  const [type, setType] = useState<ContentType | 'all'>('all')

  // Keep the type out of params when "all" so it isn't sent/synced.
  const params = useMemo(() => ({ type: type === 'all' ? undefined : type }), [type])

  const { items, hasMore, loading, error, total, facets, loadMoreRef } = useSearch<SearchHit>({
    endpoint: '/api/search',
    query,
    params,
    resultsKey: 'hits',
    pageSize: 24,
    urlSync: { path: '/search' },
    fetchOnMount: true,
  })

  // Type facet counts. When a type is selected the API only returns that type's
  // facet, so remember the full distribution from the unfiltered ("all") view.
  const [allFacets, setAllFacets] = useState<Record<string, number>>({})
  useEffect(() => {
    if (type === 'all' && facets.type) setAllFacets(facets.type)
  }, [type, facets])
  const typeFacets = type === 'all' ? facets.type ?? allFacets : allFacets

  const tabs: { value: ContentType | 'all'; label: string; count?: number }[] = [
    { value: 'all', label: 'All', count: type === 'all' ? total : undefined },
    ...TYPE_ORDER.filter((t) => (typeFacets[t] ?? 0) > 0).map((t) => ({
      value: t,
      label: TYPE_LABELS_PLURAL[t],
      count: typeFacets[t],
    })),
  ]

  const trimmed = query.trim()

  return (
    <div className="min-h-screen">
      <div className="container mx-auto px-4 py-12">
        <div className="mb-6">
          <h1 className="text-display-2 mb-2 flex items-center gap-3">
            <SearchIcon className="h-8 w-8 text-primary" />
            Search
          </h1>
          <p className="text-muted-foreground">
            Search across plugins, skills, subagents, commands, hooks, MCP servers, and marketplaces.
          </p>
        </div>

        <div className="mb-6 max-w-2xl">
          <SearchBar value={query} onChange={setQuery} placeholder="Search everything…" />
        </div>

        {/* Type facet tabs */}
        <div className="mb-8 flex flex-wrap gap-2">
          {tabs.map((tab) => (
            <button
              key={tab.value}
              onClick={() => setType(tab.value)}
              className={cn(
                'rounded-md px-3 py-1.5 text-sm transition-colors',
                type === tab.value
                  ? 'bg-primary/10 font-medium text-primary'
                  : 'text-muted-foreground hover:bg-muted/50 hover:text-foreground',
              )}
            >
              {tab.label}
              {typeof tab.count === 'number' && (
                <span className="ml-1.5 text-xs opacity-70">{tab.count.toLocaleString()}</span>
              )}
            </button>
          ))}
        </div>

        {trimmed && !loading && (
          <p className="mb-6 text-sm text-muted-foreground">
            {total.toLocaleString()} result{total !== 1 ? 's' : ''} for “{trimmed}”
          </p>
        )}

        {error && (
          <p className="mb-6 text-sm text-muted-foreground">
            Search is temporarily unavailable. Please try again.
          </p>
        )}

        {items.length > 0 ? (
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
            {items.map((hit) => (
              <SearchResultCard key={hit.objectID} hit={hit} />
            ))}
          </div>
        ) : !loading && trimmed ? (
          <div className="py-16 text-center">
            <p className="text-muted-foreground">No results found for “{trimmed}”.</p>
          </div>
        ) : null}

        <div ref={loadMoreRef} className="flex justify-center py-8">
          {loading && (
            <div className="flex items-center gap-2 text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin" />
              <span>Loading…</span>
            </div>
          )}
          {!hasMore && items.length > 0 && !loading && (
            <p className="text-sm text-muted-foreground">
              Showing all {items.length.toLocaleString()} result{items.length !== 1 ? 's' : ''}
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
