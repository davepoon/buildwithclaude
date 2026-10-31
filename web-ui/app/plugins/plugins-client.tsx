'use client'

import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { UnifiedPluginCard } from '@/components/unified-plugin-card'
import { Input } from '@/components/ui/input'
import { Package, Store, Loader2 } from 'lucide-react'
import { FilterBar, FilterHeading, FilterSearch, SingleSelectFilter, CategoryFilter, SortSelect } from '@/components/filter-controls'
import { CreateMarketplaceBanner } from '@/components/create-marketplace-banner'
import type { UnifiedPlugin } from '@/lib/plugin-types'
import type { MarketplaceOption, SortOption, PluginCategory } from '@/lib/plugin-db-server'

interface PluginsPageClientProps {
  initialPlugins: UnifiedPlugin[]
  initialHasMore: boolean
  categories: PluginCategory[]
  totalPlugins: number
  marketplaces: MarketplaceOption[]
}

const ITEMS_PER_PAGE = 24

const SORT_OPTIONS = [
  { value: 'relevance', label: 'Relevance' },
  { value: 'stars', label: 'Most Stars' },
  { value: 'newest', label: 'Newest' },
  { value: 'oldest', label: 'Oldest' },
  { value: 'name', label: 'A to Z' },
  { value: 'name-desc', label: 'Z to A' },
]

export default function PluginsPageClient({
  initialPlugins,
  initialHasMore,
  categories,
  totalPlugins,
  marketplaces,
}: PluginsPageClientProps) {
  // State
  const [plugins, setPlugins] = useState<UnifiedPlugin[]>(initialPlugins)
  const [hasMore, setHasMore] = useState(initialHasMore)
  const [isLoading, setIsLoading] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [selectedCategories, setSelectedCategories] = useState<string[]>([])
  const [selectedMarketplace, setSelectedMarketplace] = useState<string>('all')
  const [sort, setSort] = useState<SortOption>('relevance')

  // Refs
  const loadMoreRef = useRef<HTMLDivElement>(null)
  const offsetRef = useRef(initialPlugins.length)
  const isFirstRender = useRef(true)
  // Monotonic request id: ignore responses superseded by a newer request so a
  // slow fetch can't overwrite a faster, more recent one (latest-wins).
  const reqIdRef = useRef(0)

  // URL sync
  const searchParams = useSearchParams()
  const router = useRouter()

  const updateURL = useCallback((newParams: { q?: string; category?: string[]; source?: string; sort?: string }) => {
    const params = new URLSearchParams(searchParams.toString())

    if (newParams.q !== undefined) {
      if (newParams.q === '') params.delete('q')
      else params.set('q', newParams.q)
    }
    if (newParams.category !== undefined) {
      if (newParams.category.length === 0) params.delete('category')
      else params.set('category', newParams.category.join(','))
    }
    if (newParams.source !== undefined) {
      if (newParams.source === 'all') params.delete('source')
      else params.set('source', newParams.source)
    }
    if (newParams.sort !== undefined) {
      if (newParams.sort === 'relevance') params.delete('sort')
      else params.set('sort', newParams.sort)
    }

    const qs = params.toString()
    router.replace(qs ? `/plugins?${qs}` : '/plugins', { scroll: false })
  }, [searchParams, router])

  // Initialize state from URL on mount
  useEffect(() => {
    const qParam = searchParams.get('q')
    const categoryParam = searchParams.get('category')
    const sourceParam = searchParams.get('source')
    const sortParam = searchParams.get('sort')

    if (qParam) {
      setSearchQuery(qParam)
      setDebouncedSearch(qParam)
    }
    if (categoryParam) {
      const cats = categoryParam.split(',').filter(Boolean)
      setSelectedCategories(cats)
    }
    if (sourceParam) {
      setSelectedMarketplace(sourceParam)
    }
    if (sortParam && ['relevance', 'stars', 'newest', 'oldest', 'name', 'name-desc'].includes(sortParam)) {
      setSort(sortParam as SortOption)
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps -- only on mount

  // Debounce search query
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchQuery)
      updateURL({ q: searchQuery })
    }, 300)
    return () => clearTimeout(timer)
  }, [searchQuery]) // eslint-disable-line react-hooks/exhaustive-deps

  // Reset and fetch when filters change
  useEffect(() => {
    const fetchFiltered = async () => {
      const reqId = ++reqIdRef.current
      setIsLoading(true)
      try {
        const params = new URLSearchParams({
          limit: ITEMS_PER_PAGE.toString(),
          offset: '0',
          sort,
          type: 'plugin', // Always filter to plugins only
        })
        if (debouncedSearch) {
          params.set('search', debouncedSearch)
        }
        if (selectedCategories.length > 0) {
          params.set('category', selectedCategories.join(','))
        }
        if (selectedMarketplace !== 'all') {
          params.set('marketplaceId', selectedMarketplace)
        }

        const response = await fetch(`/api/plugins/list?${params}`)
        const data = await response.json()

        if (reqId !== reqIdRef.current) return // superseded by a newer request
        setPlugins(data.plugins)
        setHasMore(data.hasMore)
        offsetRef.current = data.plugins.length
      } catch (error) {
        console.error('Error fetching plugins:', error)
      } finally {
        if (reqId === reqIdRef.current) setIsLoading(false)
      }
    }

    // Skip fetch on initial mount only if no URL params (server data matches)
    if (isFirstRender.current) {
      isFirstRender.current = false
      const hasUrlFilters = searchParams.get('q') || searchParams.get('category') || searchParams.get('source') || searchParams.get('sort')
      if (!hasUrlFilters) return
    }

    fetchFiltered()
  }, [debouncedSearch, selectedCategories, selectedMarketplace, sort])

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
        type: 'plugin', // Always filter to plugins only
      })
      if (debouncedSearch) {
        params.set('search', debouncedSearch)
      }
      if (selectedCategories.length > 0) {
        params.set('category', selectedCategories.join(','))
      }
      if (selectedMarketplace !== 'all') {
        params.set('marketplaceId', selectedMarketplace)
      }

      const response = await fetch(`/api/plugins/list?${params}`)
      const data = await response.json()

      if (reqId !== reqIdRef.current) return // superseded by a newer request
      setPlugins((prev) => [...prev, ...data.plugins])
      setHasMore(data.hasMore)
      offsetRef.current += data.plugins.length
    } catch (error) {
      console.error('Error loading more plugins:', error)
    } finally {
      if (reqId === reqIdRef.current) setIsLoading(false)
    }
  }, [isLoading, hasMore, debouncedSearch, selectedCategories, selectedMarketplace, sort])

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

  // Filter marketplaces: remove duplicates by displayName and entries with 0 plugins
  // Sort with "Build with Claude" first, then by pluginCount descending
  const filteredMarketplaces = useMemo(() => {
    const seen = new Set<string>()
    const filtered = marketplaces.filter(mp => {
      // Skip if 0 plugins
      if (mp.pluginCount === 0) return false
      // Skip if duplicate displayName
      if (seen.has(mp.displayName)) return false
      seen.add(mp.displayName)
      return true
    })

    // Sort: "Build with Claude" first, then by pluginCount descending
    return filtered.sort((a, b) => {
      const aIsBWC = a.displayName.toLowerCase().includes('build with claude')
      const bIsBWC = b.displayName.toLowerCase().includes('build with claude')
      if (aIsBWC && !bIsBWC) return -1
      if (!aIsBWC && bIsBWC) return 1
      return b.pluginCount - a.pluginCount
    })
  }, [marketplaces])

  const marketplaceOptions = useMemo(
    () => filteredMarketplaces.map(mp => ({ value: mp.id, label: mp.displayName, count: mp.pluginCount })),
    [filteredMarketplaces]
  )
  const categoryOptions = useMemo(
    () => categories.map(cat => ({ value: cat.name, count: cat.count })),
    [categories]
  )

  // Format category name for display
  const formatCategoryName = (name: string) => {
    return name
      .split('-')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ')
  }

  return (
    <div className="min-h-screen">
      <div className="container mx-auto px-4 py-12">
        {/* Header: the h1 docks into the sticky filter area while scrolling */}
        <FilterHeading>
          <Package className="h-8 w-8 text-primary" />
          Plugins
        </FilterHeading>
        <p className="text-muted-foreground mb-8">
          Browse {totalPlugins.toLocaleString()} plugins for development, AI-powered workflows, productivity, and more
        </p>

        {/* Create Marketplace CTA */}
        <CreateMarketplaceBanner />

        {/* Search, Marketplace Filter, Category Filter, and Sort */}
        <FilterBar>
          <FilterSearch>
            <Input
              type="text"
              placeholder="Search plugins..."
              aria-label="Search plugins"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="bg-card border-border"
            />
          </FilterSearch>
          {filteredMarketplaces.length > 0 && (
            <SingleSelectFilter
              icon={Store}
              value={selectedMarketplace}
              options={marketplaceOptions}
              allLabel="All Sources"
              allCount={totalPlugins}
              placeholder="Select source"
              searchPlaceholder="Search sources..."
              emptyText="No source found."
              onChange={(value) => { setSelectedMarketplace(value); updateURL({ source: value }) }}
            />
          )}
          <SortSelect
            value={sort}
            options={SORT_OPTIONS}
            onChange={(value) => { setSort(value as SortOption); updateURL({ sort: value }) }}
          />
          {/* Category multi-select combobox */}
          <CategoryFilter
            selected={selectedCategories}
            options={categoryOptions}
            formatLabel={formatCategoryName}
            onChange={(newCats) => { setSelectedCategories(newCats); updateURL({ category: newCats }) }}
          />
        </FilterBar>

        {/* Results count */}
        {(selectedCategories.length > 0 || selectedMarketplace !== 'all' || debouncedSearch) && (
          <p className="text-sm text-muted-foreground mb-6">
            Showing {plugins.length.toLocaleString()} result{plugins.length !== 1 ? 's' : ''}
            {selectedCategories.length > 0 && ` in ${selectedCategories.map(c => formatCategoryName(c)).join(', ')}`}
            {selectedMarketplace !== 'all' && ` from ${filteredMarketplaces.find(m => m.id === selectedMarketplace)?.displayName}`}
            {debouncedSearch && ` matching "${debouncedSearch}"`}
          </p>
        )}

        {/* Plugin grid */}
        {plugins.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {plugins.map((plugin) => (
              <UnifiedPluginCard
                key={`${plugin.namespace || plugin.marketplaceName || 'unknown'}-${plugin.type}-${plugin.name}`}
                plugin={plugin}
              />
            ))}
          </div>
        ) : !isLoading ? (
          <div className="text-center py-16">
            <p className="text-muted-foreground">No plugins found</p>
          </div>
        ) : null}

        {/* Load more trigger / Loading indicator */}
        <div ref={loadMoreRef} className="pt-8 flex justify-center">
          {isLoading && (
            <div className="flex items-center gap-2 text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin" />
              <span>Loading...</span>
            </div>
          )}
          {!hasMore && plugins.length > 0 && !isLoading && (
            <p className="text-sm text-muted-foreground">
              Showing all {plugins.length.toLocaleString()} plugins
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
