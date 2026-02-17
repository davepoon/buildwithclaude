import { NextRequest, NextResponse } from 'next/server'
import { getMCPServersPaginated, type SortOption } from '@/lib/mcp-server-db'

export const dynamic = 'force-dynamic'

const validSortOptions: SortOption[] = ['relevance', 'stars', 'downloads', 'name', 'updated']
const validSources = ['all', 'official-mcp', 'docker', 'github', 'community'] as const
const validVerifications = ['all', 'verified', 'community', 'experimental'] as const

/**
 * GET /api/mcp-servers/list
 * Paginated MCP server list with filtering
 *
 * Query params:
 * - limit: number (default 50, max 100)
 * - offset: number (default 0)
 * - search: string (search in name, displayName, description, tags)
 * - sort: 'relevance' | 'stars' | 'downloads' | 'name' | 'updated'
 * - category: string (filter by category)
 * - source: 'all' | 'official-mcp' | 'docker' | 'github' | 'community'
 * - verification: 'all' | 'verified' | 'community' | 'experimental'
 *
 * Response:
 * {
 *   servers: MCPServerWithParsedJSON[]
 *   total: number
 *   limit: number
 *   offset: number
 *   hasMore: boolean
 * }
 */
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams

  const limit = Math.min(parseInt(searchParams.get('limit') || '50', 10), 100)
  const offset = parseInt(searchParams.get('offset') || '0', 10)
  const search = searchParams.get('search') || undefined
  const sortParam = searchParams.get('sort') as SortOption | null
  const sort = sortParam && validSortOptions.includes(sortParam) ? sortParam : 'downloads'
  const sourceParam = searchParams.get('source') as (typeof validSources)[number] | null
  const sourceRegistry = sourceParam && validSources.includes(sourceParam) ? sourceParam : undefined
  const verificationParam = searchParams.get('verification') as (typeof validVerifications)[number] | null
  const verification = verificationParam && validVerifications.includes(verificationParam) ? verificationParam : undefined
  const category = searchParams.get('category') || undefined

  try {
    const result = await getMCPServersPaginated({
      limit,
      offset,
      search,
      sort,
      category,
      sourceRegistry,
      verification,
    })

    return NextResponse.json(result, {
      headers: { 'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300' }
    })
  } catch (error) {
    console.error('Error fetching MCP servers:', error)
    return NextResponse.json(
      { servers: [], total: 0, limit, offset, hasMore: false },
      { status: 200 }
    )
  }
}
