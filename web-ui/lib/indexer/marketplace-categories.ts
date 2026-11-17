/**
 * Extract categories from repository topics
 */
export function extractRepoCategories(repo: { topics?: string[] }): string[] {
  const categories = new Set<string>()

  for (const topic of repo.topics || []) {
    // Skip generic topics
    if (!topic.includes('claude') && !topic.includes('plugin') && !topic.includes('mcp')) {
      categories.add(topic)
    }
  }

  return Array.from(categories).slice(0, 5)
}

/**
 * Pick a marketplace's categories: curated known categories first, then the
 * plugin categories from its marketplace.json, then its repository topics.
 */
export function resolveMarketplaceCategories(
  known: { categories?: string[] } | undefined,
  jsonCategories: string[],
  repo: { topics?: string[] },
): string[] {
  if (known?.categories && known.categories.length > 0) return known.categories
  if (jsonCategories.length > 0) return jsonCategories
  return extractRepoCategories(repo)
}
