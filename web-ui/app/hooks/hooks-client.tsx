'use client'

import { useState, useMemo, useEffect, useRef } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { HookCard } from '@/components/hook-card'
import { Input } from '@/components/ui/input'
import { Webhook, Loader2, Zap } from 'lucide-react'
import { FilterBar, FilterHeading, FilterSearch, CategoryFilter, SingleSelectFilter } from '@/components/filter-controls'
import { useDebounce } from '@/hooks/use-debounce'
import { type Hook, type CategoryMetadata, generateCategoryDisplayName } from '@/lib/hooks-types'

const ITEMS_PER_PAGE = 24
const SEARCH_LIMIT = 100

interface HooksPageClientProps {
  allHooks: Hook[]
  categories: CategoryMetadata[]
  eventTypes: string[]
}

export default function HooksPageClient({ allHooks, categories, eventTypes }: HooksPageClientProps) {
  const searchParams = useSearchParams()
  const router = useRouter()
  const [selectedCategory, setSelectedCategory] = useState<string | 'all'>('all')
  const [selectedEvent, setSelectedEvent] = useState<string | 'all'>('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [displayCount, setDisplayCount] = useState(ITEMS_PER_PAGE)
  const loadMoreRef = useRef<HTMLDivElement>(null)

  const [searchedSlugs, setSearchedSlugs] = useState<string[] | null>(null)
  const [searchTotal, setSearchTotal] = useState(0)
  const [searching, setSearching] = useState(false)
  const debouncedQuery = useDebounce(searchQuery, 300)

  useEffect(() => {
    const categoryParam = searchParams.get('category')
    const eventParam = searchParams.get('event')
    if (categoryParam && categories.some((cat) => cat.id === categoryParam)) {
      setSelectedCategory(categoryParam)
    }
    if (eventParam && eventTypes.includes(eventParam)) {
      setSelectedEvent(eventParam)
    }
    const qParam = searchParams.get('q')
    if (qParam) setSearchQuery(qParam)
  }, [searchParams, categories, eventTypes])

  const updateURL = (category: string | 'all', event: string | 'all', q?: string) => {
    const params = new URLSearchParams(searchParams.toString())
    if (category === 'all') params.delete('category')
    else params.set('category', category)
    if (event === 'all') params.delete('event')
    else params.set('event', event)
    if (q !== undefined) {
      if (q === '') params.delete('q')
      else params.set('q', q)
    }
    const qs = params.toString()
    router.replace(qs ? `/hooks?${qs}` : '/hooks', { scroll: false })
  }

  const handleCategoryChange = (category: string | 'all') => {
    setSelectedCategory(category)
    updateURL(category, selectedEvent)
  }

  const handleEventChange = (event: string | 'all') => {
    setSelectedEvent(event)
    updateURL(selectedCategory, event)
  }

  // Search via Meilisearch (category as a server filter); event is applied
  // client-side after hydration since /api/search has no event param.
  useEffect(() => {
    const q = debouncedQuery.trim()
    updateURL(selectedCategory, selectedEvent, q)
    if (!q) {
      setSearchedSlugs(null)
      setSearching(false)
      return
    }
    const ac = new AbortController()
    setSearching(true)
    const params = new URLSearchParams({ type: 'hook', q, limit: String(SEARCH_LIMIT) })
    if (selectedCategory !== 'all') params.set('category', selectedCategory)
    fetch(`/api/search?${params}`, { signal: ac.signal })
      .then((r) => r.json())
      .then((data) => {
        setSearchedSlugs((data.hits ?? []).map((h: { slug: string }) => h.slug))
        setSearchTotal(data.totalHits ?? 0)
        setSearching(false)
      })
      .catch((err) => {
        if (err?.name !== 'AbortError') setSearching(false)
      })
    return () => ac.abort()
  }, [debouncedQuery, selectedCategory]) // eslint-disable-line react-hooks/exhaustive-deps

  const categoryOptions = useMemo(
    () => categories.map((cat) => ({ value: cat.id, label: cat.displayName, count: cat.count })),
    [categories],
  )

  const eventOptions = useMemo(() => {
    const counts = new Map<string, number>()
    for (const h of allHooks) counts.set(h.event, (counts.get(h.event) ?? 0) + 1)
    return eventTypes.map((event) => ({ value: event, label: event, count: counts.get(event) ?? 0 }))
  }, [allHooks, eventTypes])

  const bySlug = useMemo(() => new Map(allHooks.map((h) => [h.slug, h])), [allHooks])

  const filteredHooks = useMemo(() => {
    let list: Hook[]
    if (searchedSlugs !== null) {
      list = searchedSlugs.map((slug) => bySlug.get(slug)).filter(Boolean) as Hook[]
    } else {
      list = selectedCategory === 'all' ? allHooks : allHooks.filter((h) => h.category === selectedCategory)
    }
    if (selectedEvent !== 'all') list = list.filter((h) => h.event === selectedEvent)
    return list
  }, [searchedSlugs, bySlug, allHooks, selectedCategory, selectedEvent])

  const displayedHooks = filteredHooks.slice(0, displayCount)
  const hasMore = displayCount < filteredHooks.length

  useEffect(() => {
    setDisplayCount(ITEMS_PER_PAGE)
  }, [selectedCategory, selectedEvent, searchedSlugs])

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore) {
          setDisplayCount((prev) => prev + ITEMS_PER_PAGE)
        }
      },
      { threshold: 0.1, rootMargin: '100px' },
    )
    if (loadMoreRef.current) observer.observe(loadMoreRef.current)
    return () => observer.disconnect()
  }, [hasMore])

  const isSearching = searchedSlugs !== null
  const cappedResults = isSearching && searchTotal > filteredHooks.length

  return (
    <div className="min-h-screen">
      <div className="container mx-auto px-4 py-12">
        {/* Header: the h1 docks into the sticky filter area while scrolling */}
        <FilterHeading>
          <Webhook className="h-8 w-8 text-orange-500" />
          Hooks
        </FilterHeading>
        <p className="text-muted-foreground mb-10">{allHooks.length} automation hooks for Claude Code</p>

        {/* Search, category and event filters */}
        <FilterBar>
          <FilterSearch>
            <Input
              type="text"
              placeholder="Search hooks..."
              aria-label="Search hooks"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="bg-card border-border"
            />
            {searching && (
              <Loader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-muted-foreground" />
            )}
          </FilterSearch>
          <SingleSelectFilter
            icon={Zap}
            value={selectedEvent}
            options={eventOptions}
            allLabel="All Events"
            allCount={allHooks.length}
            placeholder="Select event"
            searchPlaceholder="Search events..."
            emptyText="No event found."
            onChange={handleEventChange}
          />
          {/* Category filter, single-select */}
          <CategoryFilter
            single
            selected={selectedCategory === 'all' ? [] : [selectedCategory]}
            options={categoryOptions}
            onChange={(next) => handleCategoryChange(next[0] ?? 'all')}
          />
        </FilterBar>

        {/* Results count */}
        {(selectedCategory !== 'all' || selectedEvent !== 'all' || isSearching) && (
          <p className="text-sm text-muted-foreground mb-6">
            {filteredHooks.length} result{filteredHooks.length !== 1 ? 's' : ''}
            {selectedCategory !== 'all' && ` in ${generateCategoryDisplayName(selectedCategory)}`}
            {selectedEvent !== 'all' && ` for ${selectedEvent}`}
            {cappedResults && ` (top matches of ${searchTotal.toLocaleString()} — refine to narrow)`}
          </p>
        )}

        {/* Grid */}
        {filteredHooks.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {displayedHooks.map((hook) => (
              <HookCard key={hook.slug} hook={hook} />
            ))}
          </div>
        ) : (
          <div className="text-center py-16">
            <p className="text-muted-foreground">No hooks found</p>
          </div>
        )}

        {/* Load more trigger / Loading indicator */}
        <div ref={loadMoreRef} className="pt-8 flex justify-center">
          {hasMore && <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />}
          {!hasMore && displayedHooks.length > 0 && (
            <p className="text-sm text-muted-foreground">Showing all {filteredHooks.length} hooks</p>
          )}
        </div>
      </div>
    </div>
  )
}
