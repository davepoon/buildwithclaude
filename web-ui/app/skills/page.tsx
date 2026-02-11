import { Suspense } from 'react'
import { getPluginsPaginated, getSkillMarketplaces, getSkillCategories, getSkillOnlyCount } from '@/lib/plugin-db-server'
import SkillsPageClient from './skills-client'

export const metadata = {
  title: 'Skills | BuildWithClaude',
  description: 'Browse Claude Code skills for document processing, development, business productivity, and creative tasks',
}

// Force dynamic rendering to always get fresh data from database
export const dynamic = 'force-dynamic'

const ITEMS_PER_PAGE = 24

export default async function SkillsPage() {
  const [{ plugins: skills, hasMore }, marketplaces, categories, totalSkills] = await Promise.all([
    getPluginsPaginated({ limit: ITEMS_PER_PAGE, offset: 0, sort: 'relevance', type: 'skill' }),
    getSkillMarketplaces(),
    getSkillCategories(),
    getSkillOnlyCount(),
  ])

  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    }>
      <SkillsPageClient
        initialSkills={skills}
        initialHasMore={hasMore}
        categories={categories}
        totalSkills={totalSkills}
        marketplaces={marketplaces}
      />
    </Suspense>
  )
}
