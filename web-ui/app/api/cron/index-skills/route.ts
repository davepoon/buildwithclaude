import { NextRequest, NextResponse } from 'next/server'
import { indexSkillsFromSkillsSh } from '@/lib/indexer/skills-sh-indexer'

export const dynamic = 'force-dynamic'
export const maxDuration = 300

/**
 * Cron endpoint for the skills.sh indexer (key-less web crawl + incremental
 * content sync). Mirrors the other /api/cron/* routes; also invocable locally
 * via curl. Optional `?batchSize=` overrides the content-sync slice size.
 */
export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const batchParam = request.nextUrl.searchParams.get('batchSize')
  const batchSize = batchParam ? Math.max(1, parseInt(batchParam, 10) || 0) : undefined

  try {
    console.log('skills.sh indexer CRON started')
    const result = await indexSkillsFromSkillsSh(batchSize ? { batchSize } : {})
    console.log(
      `skills.sh indexer done: discovered ${result.discovered}, contentSynced ${result.contentSynced} in ${result.durationMs}ms`,
    )
    return NextResponse.json({ success: true, ...result })
  } catch (error) {
    console.error('skills.sh CRON indexer failed:', error)
    return NextResponse.json(
      { error: 'Indexing failed', message: error instanceof Error ? error.message : String(error) },
      { status: 500 },
    )
  }
}
