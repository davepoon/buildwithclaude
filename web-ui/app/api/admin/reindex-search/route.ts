import { NextRequest, NextResponse } from 'next/server'
import { reindexAll, reindexMarkdown, reindexType, searchIndexDrift } from '@/lib/search/indexer'
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
 *   ?mode=full      (default) sync all types
 *   ?mode=markdown  refresh deploy-static types (subagent/command/hook/skill/plugin)
 *   ?mode=type&type=<t>  refresh a single type
 *
 * Every mode is incremental: only documents whose content changed are sent,
 * and ones the source dropped are removed. Add &force=1 to allow a sync that
 * would delete more than half of a type (refused by default).
 *
 * GET changes nothing and reports drift per type ({ source, indexed, stale,
 * extra }); all stale/extra at 0 means the index matches the site. Optional
 * ?type=<t> limits it to one type.
 *
 * Auth: Authorization: Bearer ${ADMIN_API_TOKEN}
 */
function guard(request: NextRequest): NextResponse | null {
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
  return null
}

export async function GET(request: NextRequest) {
  const denied = guard(request)
  if (denied) return denied
  const typeParam = request.nextUrl.searchParams.get('type')
  const only = typeParam && isSearchContentType(typeParam) ? [typeParam] : undefined
  if (typeParam && !only) {
    return NextResponse.json({ error: 'invalid ?type=' }, { status: 400 })
  }
  try {
    const types = await searchIndexDrift(only)
    const inSync = Object.values(types ?? {}).every((t) => 'stale' in t && t.stale === 0 && t.extra === 0)
    return NextResponse.json({ success: true, inSync, types })
  } catch (error) {
    console.error('Search drift check failed:', error)
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : String(error) },
      { status: 500 },
    )
  }
}

export async function POST(request: NextRequest) {
  const denied = guard(request)
  if (denied) return denied

  const mode = request.nextUrl.searchParams.get('mode') ?? 'full'
  const typeParam = request.nextUrl.searchParams.get('type')
  const force = request.nextUrl.searchParams.get('force') === '1'

  try {
    if (mode === 'markdown') {
      const result = await reindexMarkdown(force)
      return NextResponse.json({ success: true, mode, ...result })
    }

    if (mode === 'type') {
      if (!typeParam || !isSearchContentType(typeParam)) {
        return NextResponse.json(
          { error: 'mode=type requires a valid ?type= (subagent|command|hook|skill|plugin|mcp-server|marketplace|theme)' },
          { status: 400 },
        )
      }
      const result = await reindexType(typeParam, force)
      return NextResponse.json({ success: true, mode, ...result })
    }

    const result = await reindexAll(force)
    return NextResponse.json({ success: true, mode: 'full', ...result })
  } catch (error) {
    console.error('Search reindex failed:', error)
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : String(error) },
      { status: 500 },
    )
  }
}
