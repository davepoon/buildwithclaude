'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { MarketplaceRegistryItem } from '@/components/marketplace-registry-item'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Package, Sparkles, Loader2, ArrowUpDown } from 'lucide-react'
import { CreateMarketplaceBanner } from '@/components/create-marketplace-banner'
import type { MarketplaceRegistry } from '@/lib/marketplace-types'
import type { SortOption } from '@/lib/marketplace-server'

interface MarketplacesPageClientProps {
  initialMarketplaces: MarketplaceRegistry[]
  initialHasMore: boolean
  // Seeds the search box (from a `?q=` deep-link). The server already filtered
  // the initial list to match, so no refetch is needed on mount.
  initialQuery?: string
  totals: {
    totalPlugins: number
    totalSkills: number
    totalMarketplaces: number
  }
}

function formatNumber(num: number): string {
  if (num >= 1_000_000) return `${(num / 1_000_000).toFixed(1)}M`
  if (num >= 1_000) return `${(num / 1_000).toFixed(1)}k`
  return num.toLocaleString()
}

const ITEMS_PER_PAGE = 20

export default function MarketplacesPageClient({
  initialMarketplaces,
  initialHasMore,
  initialQuery = '',
  totals,
}: MarketplacesPageClientProps) {
  const [marketplaces, setMarketplaces] = useState<MarketplaceRegistry[]>(initialMarketplaces)
  const [hasMore, setHasMore] = useState(initialHasMore)
  const [isLoading, setIsLoading] = useState(false)
  const [query, setQuery] = useState(initialQuery)
  const [debouncedQuery, setDebouncedQuery] = useState(initialQuery)
  const [sort, setSort] = useState<SortOption>('relevance')

  const loadMoreRef = useRef<HTMLDivElement>(null)
  const offsetRef = useRef(initialMarketplaces.length)
  const isFirstRender = useRef(true)
  // Monotonic request id: ignore responses superseded by a newer request.
  const reqIdRef = useRef(0)

  // Debounce search query
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(query)
    }, 300)
    return () => clearTimeout(timer)
  }, [query])

  // Reset when search or sort changes
  useEffect(() => {
    const fetchInitial = async () => {
      const reqId = ++reqIdRef.current
      setIsLoading(true)
      try {
        const params = new URLSearchParams({
          limit: ITEMS_PER_PAGE.toString(),
          offset: '0',
          sort,
        })
        if (debouncedQuery) {
          params.set('search', debouncedQuery)
        }

        const response = await fetch(`/api/marketplaces/list?${params}`)
        const data = await response.json()

        if (reqId !== reqIdRef.current) return // superseded by a newer request
        setMarketplaces(data.marketplaces)
        setHasMore(data.hasMore)
        offsetRef.current = data.marketplaces.length
      } catch (error) {
        console.error('Error fetching marketplaces:', error)
      } finally {
        if (reqId === reqIdRef.current) setIsLoading(false)
      }
    }

    // Skip fetch on initial mount (we have server-rendered data)
    if (isFirstRender.current) {
      isFirstRender.current = false
      return
    }

    fetchInitial()
  }, [debouncedQuery, sort])

  // Load more function
  const loadMore = useCallback(async () => {
    if (isLoading || !hasMore) return

    const reqId = ++reqIdRef.current
    setIsLoading(true)
    try {
      const params = new URLSearchParams({
        limit: ITEMS_PER_PAGE.toString(),
        offset: offsetRef.current.toString(),
        sort,
      })
      if (debouncedQuery) {
        params.set('search', debouncedQuery)
      }

      const response = await fetch(`/api/marketplaces/list?${params}`)
      const data = await response.json()

      if (reqId !== reqIdRef.current) return // superseded by a newer request
      setMarketplaces((prev) => [...prev, ...data.marketplaces])
      setHasMore(data.hasMore)
      offsetRef.current += data.marketplaces.length
    } catch (error) {
      console.error('Error loading more marketplaces:', error)
    } finally {
      if (reqId === reqIdRef.current) setIsLoading(false)
    }
  }, [isLoading, hasMore, debouncedQuery, sort])

  // Intersection Observer for infinite scroll
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore && !isLoading) {
          loadMore()
        }
      },
      { threshold: 0.1, rootMargin: '100px' }
    )

    if (loadMoreRef.current) {
      observer.observe(loadMoreRef.current)
    }

    return () => observer.disconnect()
  }, [hasMore, isLoading, loadMore])

  return (
    <div className="min-h-screen">
      <div className="container mx-auto px-4 py-12">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-display-2 mb-2">Plugin Marketplaces</h1>
          <p className="text-muted-foreground mb-4">
            Community-maintained registries for Claude Code plugins and skills
          </p>
          <div className="flex items-center gap-4 text-sm">
            <span className="flex items-center gap-1.5 text-primary">
              <Package className="h-4 w-4" />
              {formatNumber(totals.totalPlugins)} plugins
            </span>
            <span className="flex items-center gap-1.5 text-amber-500">
              <Sparkles className="h-4 w-4" />
              {formatNumber(totals.totalSkills)} skills
            </span>
            <span className="text-muted-foreground">
              across {totals.totalMarketplaces} marketplaces
            </span>
          </div>
        </div>

        {/* Create Marketplace CTA */}
        <CreateMarketplaceBanner />

        {/* Search and Sort */}
        <div className="mb-8 flex flex-col sm:flex-row gap-4">
          <Input
            type="text"
            placeholder="Search marketplaces..."
            aria-label="Search marketplaces"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="max-w-md bg-card border-border"
          />
          <Select value={sort} onValueChange={(value) => setSort(value as SortOption)}>
            <SelectTrigger className="w-[150px] bg-card border-border">
              <ArrowUpDown className="h-4 w-4 mr-2 text-muted-foreground" />
              <SelectValue placeholder="Sort by" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="relevance">Relevance</SelectItem>
              <SelectItem value="stars">Most Stars</SelectItem>
              <SelectItem value="newest">Newest</SelectItem>
              <SelectItem value="oldest">Oldest</SelectItem>
              <SelectItem value="name">A to Z</SelectItem>
              <SelectItem value="name-desc">Z to A</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Marketplace list */}
        {marketplaces.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {marketplaces.map((marketplace) => (
              <MarketplaceRegistryItem key={marketplace.id || marketplace.name} marketplace={marketplace} />
            ))}
          </div>
        ) : !isLoading ? (
          <div className="text-center py-16">
            <p className="text-muted-foreground">No marketplaces found</p>
          </div>
        ) : null}

        {/* Load more trigger / Loading indicator */}
        <div ref={loadMoreRef} className="py-8 flex justify-center">
          {isLoading && (
            <div className="flex items-center gap-2 text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin" />
              <span>Loading...</span>
            </div>
          )}
          {!hasMore && marketplaces.length > 0 && (
            <p className="text-sm text-muted-foreground">
              Showing all {marketplaces.length} marketplaces
            </p>
          )}
        </div>

      </div>
    </div>
  )
}
