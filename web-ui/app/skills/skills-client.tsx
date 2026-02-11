'use client'

import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { UnifiedPluginCard } from '@/components/unified-plugin-card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command'
import { Badge } from '@/components/ui/badge'
import { Sparkles, Store, Loader2, ArrowUpDown, Check, ChevronsUpDown, X, Tags } from 'lucide-react'
import { CreateMarketplaceBanner } from '@/components/create-marketplace-banner'
import { cn } from '@/lib/utils'
import type { UnifiedPlugin } from '@/lib/plugin-types'
import type { MarketplaceOption, SortOption, PluginCategory } from '@/lib/plugin-db-server'

interface SkillsPageClientProps {
  initialSkills: UnifiedPlugin[]
  initialHasMore: boolean
  categories: PluginCategory[]
  totalSkills: number
  marketplaces: MarketplaceOption[]
}

const ITEMS_PER_PAGE = 24

export default function SkillsPageClient({
  initialSkills,
  initialHasMore,
  categories,
  totalSkills,
  marketplaces,
}: SkillsPageClientProps) {
  // State
  const [skills, setSkills] = useState<UnifiedPlugin[]>(initialSkills)
  const [hasMore, setHasMore] = useState(initialHasMore)
  const [isLoading, setIsLoading] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [selectedCategories, setSelectedCategories] = useState<string[]>([])
  const [selectedMarketplace, setSelectedMarketplace] = useState<string>('all')
  const [sort, setSort] = useState<SortOption>('relevance')
  const [marketplaceOpen, setMarketplaceOpen] = useState(false)
  const [categoryOpen, setCategoryOpen] = useState(false)

  // Refs
  const loadMoreRef = useRef<HTMLDivElement>(null)
  const offsetRef = useRef(initialSkills.length)
  const isFirstRender = useRef(true)

  // Debounce search query
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchQuery)
    }, 300)
    return () => clearTimeout(timer)
  }, [searchQuery])

  // Reset and fetch when filters change
  useEffect(() => {
    const fetchFiltered = async () => {
      setIsLoading(true)
      try {
        const params = new URLSearchParams({
          limit: ITEMS_PER_PAGE.toString(),
          offset: '0',
          sort,
          type: 'skill',
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

        setSkills(data.plugins)
        setHasMore(data.hasMore)
        offsetRef.current = data.plugins.length
      } catch (error) {
        console.error('Error fetching skills:', error)
      } finally {
        setIsLoading(false)
      }
    }

    // Skip fetch on initial mount (we have server-rendered data)
    if (isFirstRender.current) {
      isFirstRender.current = false
      return
    }

    fetchFiltered()
  }, [debouncedSearch, selectedCategories, selectedMarketplace, sort])

  // Load more function
  const loadMore = useCallback(async () => {
    if (isLoading || !hasMore) return

    setIsLoading(true)
    try {
      const params = new URLSearchParams({
        limit: ITEMS_PER_PAGE.toString(),
        offset: offsetRef.current.toString(),
        sort,
        type: 'skill',
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

      setSkills((prev) => [...prev, ...data.plugins])
      setHasMore(data.hasMore)
      offsetRef.current += data.plugins.length
    } catch (error) {
      console.error('Error loading more skills:', error)
    } finally {
      setIsLoading(false)
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

  // Filter marketplaces: remove duplicates by displayName and entries with 0 skills
  const filteredMarketplaces = useMemo(() => {
    const seen = new Set<string>()
    const filtered = marketplaces.filter(mp => {
      if (mp.pluginCount === 0) return false
      if (seen.has(mp.displayName)) return false
      seen.add(mp.displayName)
      return true
    })

    return filtered.sort((a, b) => {
      const aIsBWC = a.displayName.toLowerCase().includes('build with claude')
      const bIsBWC = b.displayName.toLowerCase().includes('build with claude')
      if (aIsBWC && !bIsBWC) return -1
      if (!aIsBWC && bIsBWC) return 1
      return b.pluginCount - a.pluginCount
    })
  }, [marketplaces])

  // Get selected marketplace display name
  const selectedMarketplaceDisplay = useMemo(() => {
    if (selectedMarketplace === 'all') {
      return `All Sources (${totalSkills.toLocaleString()})`
    }
    const mp = filteredMarketplaces.find(m => m.id === selectedMarketplace)
    return mp ? `${mp.displayName} (${mp.pluginCount.toLocaleString()})` : 'Select source...'
  }, [selectedMarketplace, filteredMarketplaces, totalSkills])

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
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-display-2 mb-2 flex items-center gap-3">
            <Sparkles className="h-8 w-8 text-yellow-500" />
            Skills
          </h1>
          <p className="text-muted-foreground">
            Browse {totalSkills.toLocaleString()} skills for Claude Code
          </p>
        </div>

        <CreateMarketplaceBanner variant="skill" />

        {/* Search, Marketplace Filter, and Sort */}
        <div className="flex flex-col sm:flex-row gap-4 mb-6">
          <Input
            type="text"
            placeholder="Search skills..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="max-w-md bg-card border-border"
          />
          {filteredMarketplaces.length > 0 && (
            <Popover open={marketplaceOpen} onOpenChange={setMarketplaceOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  role="combobox"
                  aria-expanded={marketplaceOpen}
                  className="w-[280px] justify-between bg-card border-border group gap-2"
                >
                  <span className="flex items-center gap-4 truncate">
                    <Store className="h-4 w-4 text-muted-foreground group-hover:text-foreground shrink-0" />
                    <span className="truncate">{selectedMarketplaceDisplay}</span>
                  </span>
                  <ChevronsUpDown className="h-4 w-4 shrink-0 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-[280px] p-0">
                <Command>
                  <CommandInput placeholder="Search sources..." />
                  <CommandList>
                    <CommandEmpty>No source found.</CommandEmpty>
                    <CommandGroup>
                      <CommandItem
                        value="all"
                        onSelect={() => {
                          setSelectedMarketplace('all')
                          setMarketplaceOpen(false)
                        }}
                      >
                        <Check
                          className={cn(
                            "mr-2 h-4 w-4",
                            selectedMarketplace === 'all' ? "opacity-100" : "opacity-0"
                          )}
                        />
                        All Sources ({totalSkills.toLocaleString()})
                      </CommandItem>
                      {filteredMarketplaces.map((mp) => (
                        <CommandItem
                          key={mp.id}
                          value={mp.displayName}
                          onSelect={() => {
                            setSelectedMarketplace(mp.id)
                            setMarketplaceOpen(false)
                          }}
                        >
                          <Check
                            className={cn(
                              "mr-2 h-4 w-4",
                              selectedMarketplace === mp.id ? "opacity-100" : "opacity-0"
                            )}
                          />
                          {mp.displayName} ({mp.pluginCount.toLocaleString()})
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
          )}
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

        {/* Category multi-select combobox */}
        <div className="mb-8">
          <div className="flex flex-wrap items-center gap-2">
            {/* Selected category pills */}
            {selectedCategories.map((catName) => {
              const cat = categories.find(c => c.name === catName)
              return (
                <Badge
                  key={catName}
                  variant="secondary"
                  className="pl-2 pr-1 py-1 gap-1 text-sm bg-primary/10 text-primary border-primary/20"
                >
                  {formatCategoryName(catName)}
                  {cat && <span className="text-xs opacity-70">({cat.count})</span>}
                  <button
                    onClick={() => setSelectedCategories(prev => prev.filter(c => c !== catName))}
                    className="ml-1 rounded-full p-0.5 hover:bg-primary/20 transition-colors"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
              )
            })}

            {/* Category combobox */}
            <Popover open={categoryOpen} onOpenChange={setCategoryOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  role="combobox"
                  aria-expanded={categoryOpen}
                  className="h-8 gap-2 bg-card border-border border-dashed group"
                >
                  <Tags className="h-4 w-4 text-muted-foreground group-hover:text-foreground transition-colors" />
                  <span className="text-muted-foreground group-hover:text-foreground transition-colors">
                    {selectedCategories.length === 0 ? 'Filter by categories...' : 'Add category'}
                  </span>
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-[300px] p-0" align="start">
                <Command>
                  <CommandInput placeholder="Search categories..." />
                  <CommandList className="max-h-[300px]">
                    <CommandEmpty>No category found.</CommandEmpty>
                    <CommandGroup>
                      {selectedCategories.length > 0 && (
                        <CommandItem
                          onSelect={() => setSelectedCategories([])}
                          className="text-muted-foreground"
                        >
                          <X className="mr-2 h-4 w-4" />
                          Clear all filters
                        </CommandItem>
                      )}
                      {categories.map((cat) => {
                        const isSelected = selectedCategories.includes(cat.name)
                        return (
                          <CommandItem
                            key={cat.name}
                            value={cat.name}
                            className="group"
                            onSelect={() => {
                              if (isSelected) {
                                setSelectedCategories(prev => prev.filter(c => c !== cat.name))
                              } else {
                                setSelectedCategories(prev => [...prev, cat.name])
                              }
                            }}
                          >
                            <Check
                              className={cn(
                                "mr-2 h-4 w-4",
                                isSelected ? "opacity-100" : "opacity-0"
                              )}
                            />
                            <span className="flex-1">{formatCategoryName(cat.name)}</span>
                            <span className="text-xs text-muted-foreground group-data-[selected=true]:text-accent-foreground transition-colors">({cat.count})</span>
                          </CommandItem>
                        )
                      })}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
          </div>
        </div>

        {/* Results count */}
        {(selectedCategories.length > 0 || selectedMarketplace !== 'all' || debouncedSearch) && (
          <p className="text-sm text-muted-foreground mb-6">
            Showing {skills.length.toLocaleString()} result{skills.length !== 1 ? 's' : ''}
            {selectedCategories.length > 0 && ` in ${selectedCategories.map(c => formatCategoryName(c)).join(', ')}`}
            {selectedMarketplace !== 'all' && ` from ${filteredMarketplaces.find(m => m.id === selectedMarketplace)?.displayName}`}
            {debouncedSearch && ` matching "${debouncedSearch}"`}
          </p>
        )}

        {/* Skill grid */}
        {skills.length > 0 ? (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {skills.map((skill) => (
              <UnifiedPluginCard
                key={`${skill.namespace || skill.marketplaceName || 'unknown'}-${skill.type}-${skill.name}`}
                plugin={skill}
              />
            ))}
          </div>
        ) : !isLoading ? (
          <div className="text-center py-16">
            <p className="text-muted-foreground">No skills found</p>
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
          {!hasMore && skills.length > 0 && !isLoading && (
            <p className="text-sm text-muted-foreground">
              Showing all {skills.length.toLocaleString()} skills
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
