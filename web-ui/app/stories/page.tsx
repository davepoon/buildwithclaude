import type { Metadata } from 'next'
import { getAllStories, getPinnedStory, getStoryBySlug } from '@/lib/stories-server'
import { StoriesIndexClient } from './stories-client'

export const metadata: Metadata = {
  title: 'Stories — Build with Claude',
  description:
    'Community-contributed posts from plugin and skill authors. Real notes on shipping, learning, and what they would do differently.',
}

const GUIDE_SLUG = 'how-to-share-your-story'

export default function StoriesPage() {
  const allStories = getAllStories()
  const pinned = getPinnedStory()
  const guide = getStoryBySlug(GUIDE_SLUG)
  const excluded = new Set<string>()
  if (pinned) excluded.add(pinned.slug)
  if (guide) excluded.add(guide.slug)
  const rest = allStories.filter(s => !excluded.has(s.slug))

  return <StoriesIndexClient pinned={pinned} stories={rest} guide={guide} />
}
