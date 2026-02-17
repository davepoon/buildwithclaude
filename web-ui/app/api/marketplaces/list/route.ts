import { NextRequest, NextResponse } from 'next/server'
import { getMarketplacesPaginated, type SortOption } from '@/lib/marketplace-server'

export const dynamic = 'force-dynamic'

const validSortOptions: SortOption[] = ['relevance', 'stars', 'newest', 'oldest', 'name', 'name-desc']

/**
 * GET /api/marketplaces/list
 * Paginated marketplace list for infinite scroll
 */
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams

  const limit = Math.min(parseInt(searchParams.get('limit') || '20', 10), 100)
  const offset = parseInt(searchParams.get('offset') || '0', 10)
  const search = searchParams.get('search') || undefined
  const sortParam = searchParams.get('sort') as SortOption | null
  const sort = sortParam && validSortOptions.includes(sortParam) ? sortParam : 'relevance'

  try {
    const result = await getMarketplacesPaginated({ limit, offset, search, sort })

    return NextResponse.json(result, {
      headers: { 'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300' }
    })
  } catch (error) {
    console.error('Error fetching marketplaces:', error)
    return NextResponse.json(
      { marketplaces: [], total: 0, hasMore: false },
      { status: 200 }
    )
  }
}
