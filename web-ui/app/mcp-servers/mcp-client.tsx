'use client'

import { useState, useMemo, useEffect, useRef } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { MCPCard } from '@/components/mcp-card'
import { Input } from '@/components/ui/input'
import { ArrowUpDown, Loader2 } from 'lucide-react'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useDebounce } from '@/hooks/use-debounce'
import { type MCPServer, SOURCE_INDICATORS } from '@/lib/mcp-types'
import { type MCPCategoryMetadata } from '@/lib/mcp-server'

const ITEMS_PER_PAGE = 24
const SEARCH_LIMIT = 100

interface MCPPageClientProps {
  allServers: MCPServer[]
  categories: MCPCategoryMetadata[]
  popularServers?: MCPServer[]
  featuredServers?: MCPServer[]
  trendingServers?: MCPServer[]
}

function matchesSource(server: MCPServer, source: string): boolean {
  if (source === 'all') return true
  if (source === 'docker') {
    return server.source_registry?.type === 'docker' || server.docker_mcp_available === true
  }
  return server.source_registry?.type === source
}

export default function MCPPageClient({
  allServers,
  categories,
  popularServers = [],
  featuredServers = [],
}: MCPPageClientProps) {
  const searchParams = useSearchParams()
  const router = useRouter()
  const [selectedCategory, setSelectedCategory] = useState<string | 'all'>('all')
  const [selectedSource, setSelectedSource] = useState<string>('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [displayCount, setDisplayCount] = useState(ITEMS_PER_PAGE)
  const [sortBy, setSortBy] = useState<'stars' | 'newest' | 'oldest' | 'name' | 'name-desc'>('stars')
  const loadMoreRef = useRef<HTMLDivElement>(null)

  // Meilisearch results: ranked slugs for the current query (null = browse mode).
  const [searchedSlugs, setSearchedSlugs] = useState<string[] | null>(null)
  const [searchTotal, setSearchTotal] = useState(0)
  const [searching, setSearching] = useState(false)
  const debouncedQuery = useDebounce(searchQuery, 300)

  useEffect(() => {
    const categoryParam = searchParams.get('category')
    const sourceParam = searchParams.get('source')
    const sortParam = searchParams.get('sort')
    if (categoryParam && categories.some((cat) => cat.id === categoryParam)) {
      setSelectedCategory(categoryParam)
    }
    if (sourceParam && ['official-mcp', 'docker'].includes(sourceParam)) {
      setSelectedSource(sourceParam)
    }
    if (sortParam && ['stars', 'newest', 'oldest', 'name', 'name-desc'].includes(sortParam)) {
      setSortBy(sortParam as typeof sortBy)
    }
    const qParam = searchParams.get('q')
    if (qParam) setSearchQuery(qParam)
  }, [searchParams, categories])

  const updateURL = (newParams: { category?: string | 'all'; source?: string; sort?: string; q?: string }) => {
    const params = new URLSearchParams(searchParams.toString())
    if (newParams.category !== undefined) {
      if (newParams.category === 'all') params.delete('category')
      else params.set('category', newParams.category)
    }
    if (newParams.source !== undefined) {
      if (newParams.source === 'all') params.delete('source')
      else params.set('source', newParams.source)
    }
    if (newParams.sort !== undefined) {
      if (newParams.sort === 'stars') params.delete('sort')
      else params.set('sort', newParams.sort)
    }
    if (newParams.q !== undefined) {
      if (newParams.q === '') params.delete('q')
      else params.set('q', newParams.q)
    }
    const qs = params.toString()
    router.replace(qs ? `/mcp-servers?${qs}` : '/mcp-servers', { scroll: false })
  }

  const handleCategoryChange = (category: string | 'all') => {
    setSelectedCategory(category)
    updateURL({ category })
  }

  const handleSourceChange = (source: string) => {
    setSelectedSource(source)
    updateURL({ source })
  }

  // Run Meilisearch on query change; category/source filters are applied
  // client-side after hydration (relevance order is preserved during search).
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
    fetch(`/api/search?type=mcp-server&q=${encodeURIComponent(q)}&limit=${SEARCH_LIMIT}`, { signal: ac.signal })
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
  }, [debouncedQuery]) // eslint-disable-line react-hooks/exhaustive-deps

  const bySlug = useMemo(() => new Map(allServers.map((s) => [s.path, s])), [allServers])

  const filteredServers = useMemo(() => {
    if (searchedSlugs !== null) {
      // Search mode: hydrate ranked items, then apply category + source filters.
      return searchedSlugs
        .map((slug) => bySlug.get(slug))
        .filter(Boolean)
        .filter((s) => {
          const server = s as MCPServer
          if (selectedCategory !== 'all' && server.category !== selectedCategory) return false
          if (!matchesSource(server, selectedSource)) return false
          return true
        }) as MCPServer[]
    }

    // Browse mode: full filter + sort over all servers.
    let filtered = allServers
    if (selectedCategory !== 'all') filtered = filtered.filter((s) => s.category === selectedCategory)
    if (selectedSource !== 'all') filtered = filtered.filter((s) => matchesSource(s, selectedSource))

    return [...filtered].sort((a, b) => {
      switch (sortBy) {
        case 'stars':
          return (b.stats?.github_stars || 0) - (a.stats?.github_stars || 0)
        case 'newest':
          return new Date(b.stats?.last_updated || 0).getTime() - new Date(a.stats?.last_updated || 0).getTime()
        case 'oldest':
          return new Date(a.stats?.last_updated || 0).getTime() - new Date(b.stats?.last_updated || 0).getTime()
        case 'name':
          return a.display_name.localeCompare(b.display_name)
        case 'name-desc':
          return b.display_name.localeCompare(a.display_name)
        default:
          return 0
      }
    })
  }, [searchedSlugs, bySlug, allServers, selectedCategory, selectedSource, sortBy])

  const sourceCounts = useMemo(() => {
    const officialMcp = allServers.filter((s) => s.source_registry?.type === 'official-mcp').length
    const docker = allServers.filter((s) => s.source_registry?.type === 'docker' || s.docker_mcp_available).length
    return { 'official-mcp': officialMcp, docker }
  }, [allServers])

  const isSearching = searchedSlugs !== null
  const hasActiveFilters = isSearching || selectedCategory !== 'all' || selectedSource !== 'all'

  const displayedServers = filteredServers.slice(0, displayCount)
  const hasMore = displayCount < filteredServers.length

  useEffect(() => {
    setDisplayCount(ITEMS_PER_PAGE)
  }, [searchedSlugs, selectedCategory, selectedSource, sortBy])

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

  const cappedResults = isSearching && searchTotal > filteredServers.length

  return (
    <div className="min-h-screen">
      <div className="container mx-auto px-4 py-12">
        {/* Header */}
        <div className="mb-10">
          <h1 className="text-display-2 mb-2">MCP Servers</h1>
          <p className="text-muted-foreground">{allServers.length} Model Context Protocol servers</p>
        </div>

        {/* Search */}
        <div className="mb-6 relative max-w-md">
          <Input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search MCP servers..."
            aria-label="Search MCP servers"
            className="bg-card border-border"
          />
          {searching && (
            <Loader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-muted-foreground" />
          )}
        </div>

        {/* Category filters */}
        <div className="flex gap-2 flex-wrap mb-4">
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

        {/* Source and Sort controls */}
        <div className="flex justify-between items-center mb-8 flex-wrap gap-4">
          <div className="flex flex-wrap gap-2">
            <span className="text-sm text-muted-foreground py-1.5">Source:</span>
            <button
              onClick={() => handleSourceChange('all')}
              className={`px-3 py-1.5 text-sm rounded-md whitespace-nowrap transition-colors ${
                selectedSource === 'all'
                  ? 'bg-muted text-foreground'
                  : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
              }`}
            >
              All ({allServers.length})
            </button>
            <button
              onClick={() => handleSourceChange('official-mcp')}
              className={`px-3 py-1.5 text-sm rounded-md whitespace-nowrap transition-colors ${
                selectedSource === 'official-mcp'
                  ? 'bg-muted text-foreground'
                  : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
              }`}
            >
              {SOURCE_INDICATORS['official-mcp'].icon} Official ({sourceCounts['official-mcp']})
            </button>
            <button
              onClick={() => handleSourceChange('docker')}
              className={`px-3 py-1.5 text-sm rounded-md whitespace-nowrap transition-colors ${
                selectedSource === 'docker'
                  ? 'bg-muted text-foreground'
                  : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
              }`}
            >
              {SOURCE_INDICATORS.docker.icon} Docker ({sourceCounts.docker})
            </button>
          </div>

          <Select
            value={sortBy}
            onValueChange={(value) => {
              setSortBy(value as typeof sortBy)
              updateURL({ sort: value })
            }}
          >
            <SelectTrigger className="w-[150px] bg-card border-border">
              <ArrowUpDown className="h-4 w-4 mr-2 text-muted-foreground" />
              <SelectValue placeholder="Sort by" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="stars">Most Stars</SelectItem>
              <SelectItem value="newest">Newest</SelectItem>
              <SelectItem value="oldest">Oldest</SelectItem>
              <SelectItem value="name">A to Z</SelectItem>
              <SelectItem value="name-desc">Z to A</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Featured Sections - Only show when no filters/search active */}
        {!hasActiveFilters && (popularServers.length > 0 || featuredServers.length > 0) && (
          <div className="mb-12">
            {popularServers.length > 0 && (
              <div className="mb-10">
                <h2 className="text-xl font-medium mb-4">Popular</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {popularServers.map((server) => (
                    <MCPCard key={server.path} server={server} />
                  ))}
                </div>
              </div>
            )}

            {featuredServers.length > 0 && (
              <div className="mb-10">
                <h2 className="text-xl font-medium mb-4">Featured</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {featuredServers.map((server) => (
                    <MCPCard key={server.path} server={server} />
                  ))}
                </div>
              </div>
            )}

            <hr className="border-border/50" />
          </div>
        )}

        {!hasActiveFilters && (popularServers.length > 0 || featuredServers.length > 0) && (
          <h2 className="text-xl font-medium mb-4 mt-8">All Servers</h2>
        )}

        {/* Results count */}
        {hasActiveFilters && (
          <p className="text-sm text-muted-foreground mb-6">
            {filteredServers.length} result{filteredServers.length !== 1 ? 's' : ''}
            {selectedCategory !== 'all' && ` in ${categories.find((c) => c.id === selectedCategory)?.displayName || selectedCategory}`}
            {cappedResults && ` (top matches of ${searchTotal.toLocaleString()} — refine to narrow)`}
          </p>
        )}

        {/* Grid */}
        {filteredServers.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {displayedServers.map((server) => (
              <MCPCard key={server.path} server={server} />
            ))}
          </div>
        ) : (
          <div className="text-center py-16">
            <p className="text-muted-foreground">No MCP servers found</p>
          </div>
        )}

        {/* Load more trigger / Loading indicator */}
        <div ref={loadMoreRef} className="py-8 flex justify-center">
          {hasMore && <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />}
          {!hasMore && displayedServers.length > 0 && (
            <p className="text-sm text-muted-foreground">
              Showing all {filteredServers.length} MCP servers
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
