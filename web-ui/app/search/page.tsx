import { Suspense } from 'react'
import type { Metadata } from 'next'
import SearchClient from './search-client'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Search | Build with Claude',
  description:
    'Search across plugins, skills, subagents, commands, hooks, MCP servers, marketplaces, and themes.',
}

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>
}) {
  const params = await searchParams
  const initialQuery = typeof params.q === 'string' ? params.q : ''

  return (
    <Suspense fallback={null}>
      <SearchClient initialQuery={initialQuery} />
    </Suspense>
  )
}
