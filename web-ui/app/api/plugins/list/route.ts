import { NextRequest, NextResponse } from 'next/server'
import { getPluginsPaginated, type SortOption } from '@/lib/plugin-db-server'
import type { PluginType } from '@/lib/plugin-types'

export const dynamic = 'force-dynamic'

const validSortOptions: SortOption[] = ['relevance', 'stars', 'name', 'updated']
const validTypes: (PluginType | 'all')[] = ['all', 'subagent', 'command', 'hook', 'skill', 'plugin']

/**
 * GET /api/plugins/list
 * Paginated plugin list with filtering
 */
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams

  const limit = Math.min(parseInt(searchParams.get('limit') || '50', 10), 100)
  const offset = parseInt(searchParams.get('offset') || '0', 10)
  const search = searchParams.get('search') || undefined
  const sortParam = searchParams.get('sort') as SortOption | null
  const sort = sortParam && validSortOptions.includes(sortParam) ? sortParam : 'relevance'
  const typeParam = searchParams.get('type') as PluginType | 'all' | null
  const type = typeParam && validTypes.includes(typeParam) ? typeParam : 'all'
  const marketplaceId = searchParams.get('marketplaceId') || undefined
  const category = searchParams.get('category') || undefined

  try {
    const result = await getPluginsPaginated({
      limit,
      offset,
      search,
      sort,
      type,
      marketplaceId,
      category,
    })

    return NextResponse.json(result, {
      headers: { 'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300' }
    })
  } catch (error) {
    console.error('Error fetching plugins:', error)
    return NextResponse.json(
      { plugins: [], total: 0, limit, offset, hasMore: false },
      { status: 200 }
    )
  }
}
