'use client'

import { useState, useMemo, useEffect, useRef } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { CommandCard } from '@/components/command-card'
import { Input } from '@/components/ui/input'
import { Terminal, Loader2 } from 'lucide-react'
import { useDebounce } from '@/hooks/use-debounce'
import { generateCategoryDisplayName } from '@/lib/commands-types'
import type { Command, CategoryMetadata } from '@/lib/commands-types'

const ITEMS_PER_PAGE = 24
const SEARCH_LIMIT = 100

interface CommandsPageClientProps {
  allCommands: Command[]
  categories: CategoryMetadata[]
}

export default function CommandsPageClient({ allCommands, categories }: CommandsPageClientProps) {
  const searchParams = useSearchParams()
  const router = useRouter()
  const [selectedCategory, setSelectedCategory] = useState<string | 'all'>('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [displayCount, setDisplayCount] = useState(ITEMS_PER_PAGE)
  const loadMoreRef = useRef<HTMLDivElement>(null)

  const [searchedSlugs, setSearchedSlugs] = useState<string[] | null>(null)
  const [searchTotal, setSearchTotal] = useState(0)
  const [searching, setSearching] = useState(false)
  const debouncedQuery = useDebounce(searchQuery, 300)

  useEffect(() => {
    const categoryParam = searchParams.get('category')
    if (categoryParam && categories.some((cat) => cat.id === categoryParam)) {
      setSelectedCategory(categoryParam)
    }
    const qParam = searchParams.get('q')
    if (qParam) setSearchQuery(qParam)
  }, [searchParams, categories])

  const updateURL = (next: { category?: string | 'all'; q?: string }) => {
    const params = new URLSearchParams(searchParams.toString())
    if (next.category !== undefined) {
      if (next.category === 'all') params.delete('category')
      else params.set('category', next.category)
    }
    if (next.q !== undefined) {
      if (next.q === '') params.delete('q')
      else params.set('q', next.q)
    }
    const qs = params.toString()
    router.replace(qs ? `/commands?${qs}` : '/commands', { scroll: false })
  }

  const handleCategoryChange = (category: string | 'all') => {
    setSelectedCategory(category)
    updateURL({ category })
  }

  useEffect(() => {
    const q = debouncedQuery.trim()
    updateURL({ q })
    if (!q) {
      setSearchedSlugs(null)
      setSearching(false)
      return
    }
    const ac = new AbortController()
    setSearching(true)
    const params = new URLSearchParams({ type: 'command', q, limit: String(SEARCH_LIMIT) })
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

  const bySlug = useMemo(() => new Map(allCommands.map((c) => [c.slug, c])), [allCommands])

  const filteredCommands = useMemo(() => {
    if (searchedSlugs !== null) {
      return searchedSlugs.map((slug) => bySlug.get(slug)).filter(Boolean) as Command[]
    }
    return selectedCategory === 'all'
      ? allCommands
      : allCommands.filter((c) => c.category === selectedCategory)
  }, [searchedSlugs, bySlug, allCommands, selectedCategory])

  const displayedCommands = filteredCommands.slice(0, displayCount)
  const hasMore = displayCount < filteredCommands.length

  useEffect(() => {
    setDisplayCount(ITEMS_PER_PAGE)
  }, [selectedCategory, searchedSlugs])

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
  const cappedResults = isSearching && searchTotal > filteredCommands.length

  return (
    <div className="min-h-screen">
      <div className="container mx-auto px-4 py-12">
        {/* Header */}
        <div className="mb-10">
          <h1 className="text-display-2 mb-2 flex items-center gap-3">
            <Terminal className="h-8 w-8 text-green-500" />
            Commands
          </h1>
          <p className="text-muted-foreground">{allCommands.length} slash commands</p>
        </div>

        {/* Search */}
        <div className="mb-6 relative max-w-md">
          <Input
            type="text"
            placeholder="Search commands..."
            aria-label="Search commands"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="bg-card border-border"
          />
          {searching && (
            <Loader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-muted-foreground" />
          )}
        </div>

        {/* Category filters */}
        <div className="flex gap-2 flex-wrap mb-8">
          <button
            onClick={() => handleCategoryChange('all')}
            className={`px-3 py-1.5 text-sm rounded-md transition-colors ${
              selectedCategory === 'all'
                ? 'bg-primary text-primary-foreground'
                : 'text-muted-foreground hover:text-foreground hover:bg-muted'
            }`}
          >
            All
          </button>
          {categories.map((cat) => (
            <button
              key={cat.id}
              onClick={() => handleCategoryChange(cat.id)}
              className={`px-3 py-1.5 text-sm rounded-md transition-colors ${
                selectedCategory === cat.id
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:text-foreground hover:bg-muted'
              }`}
            >
              {cat.displayName}
            </button>
          ))}
        </div>

        {/* Results count */}
        {(selectedCategory !== 'all' || isSearching) && (
          <p className="text-sm text-muted-foreground mb-6">
            {filteredCommands.length} result{filteredCommands.length !== 1 ? 's' : ''}
            {selectedCategory !== 'all' && ` in ${generateCategoryDisplayName(selectedCategory)}`}
            {cappedResults && ` (top ${filteredCommands.length} of ${searchTotal.toLocaleString()} — refine to narrow)`}
          </p>
        )}

        {/* Grid */}
        {filteredCommands.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {displayedCommands.map((command) => (
              <CommandCard key={command.slug} command={command} />
            ))}
          </div>
        ) : (
          <div className="text-center py-16">
            <p className="text-muted-foreground">No commands found</p>
          </div>
        )}

        {/* Load more trigger / Loading indicator */}
        <div ref={loadMoreRef} className="py-8 flex justify-center">
          {hasMore && <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />}
          {!hasMore && displayedCommands.length > 0 && (
            <p className="text-sm text-muted-foreground">
              Showing all {filteredCommands.length} commands
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
