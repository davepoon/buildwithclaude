import { NextRequest, NextResponse } from 'next/server'
import { reindexAll, reindexMarkdown, reindexType } from '@/lib/search/indexer'
import { isSearchEnabled } from '@/lib/search/meilisearch-client'
import { isSearchContentType } from '@/lib/search/search-types'

export const dynamic = 'force-dynamic'
export const maxDuration = 300 // 5 minutes max

/**
 * POST /api/admin/reindex-search
 *
 * Rebuilds the Meilisearch `bwc_content` index from the source of truth
 * (repo files + Postgres). This is the canonical post-deploy rebuild and the way
 * to (re)index deploy-static content (agents/commands/hooks/local plugins/local
 * skills), which can otherwise lag behind deployed file changes.
 *
 * Query params:
 *   ?mode=full      (default) full rebuild of all 7 types
 *   ?mode=markdown  refresh deploy-static types (subagent/command/hook/skill/plugin)
 *   ?mode=type&type=<t>  refresh a single type
 *
 * Auth: Authorization: Bearer ${ADMIN_API_TOKEN}
 */
export async function POST(request: NextRequest) {
  const authHeader = request.headers.get('authorization')
  const expectedToken = process.env.ADMIN_API_TOKEN

  if (!expectedToken) {
    return NextResponse.json({ error: 'Admin API not configured' }, { status: 503 })
  }
  if (authHeader !== `Bearer ${expectedToken}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  if (!isSearchEnabled()) {
    return NextResponse.json(
      { success: false, error: 'Search not configured (MEILISEARCH_HOST / MEILISEARCH_API_KEY unset)' },
      { status: 503 },
    )
  }

  const mode = request.nextUrl.searchParams.get('mode') ?? 'full'
  const typeParam = request.nextUrl.searchParams.get('type')

  try {
    if (mode === 'markdown') {
      const result = await reindexMarkdown()
      return NextResponse.json({ success: true, mode, ...result })
    }

    if (mode === 'type') {
      if (!typeParam || !isSearchContentType(typeParam)) {
        return NextResponse.json(
          { error: 'mode=type requires a valid ?type= (subagent|command|hook|skill|plugin|mcp-server|marketplace|theme)' },
          { status: 400 },
        )
      }
      const result = await reindexType(typeParam)
      return NextResponse.json({ success: true, mode, ...result })
    }

    const result = await reindexAll()
    return NextResponse.json({ success: true, mode: 'full', ...result })
  } catch (error) {
    console.error('Search reindex failed:', error)
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : String(error) },
      { status: 500 },
    )
  }
}
