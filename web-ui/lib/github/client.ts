import { z } from 'zod'

// Rate limiting configuration
const MIN_DELAY_MS = 2000 // 2 second delay between requests
const MAX_RETRIES = 3
const MAX_CONSECUTIVE_FAILURES = 5 // Circuit breaker threshold
const MAX_RATE_LIMIT_WAIT_MS = 15000 // Cap wait time at 15s for serverless

// GitHub API response schemas
const GitHubSearchItemSchema = z.object({
  name: z.string(),
  path: z.string(),
  sha: z.string(),
  url: z.string().url(),
  html_url: z.string().url(),
  repository: z.object({
    id: z.number(),
    full_name: z.string(),
    html_url: z.string().url(),
    owner: z.object({
      login: z.string(),
    }),
  }),
})

const GitHubRepoSchema = z.object({
  id: z.number(),
  full_name: z.string(),
  name: z.string(),
  description: z.string().nullable(),
  stargazers_count: z.number(),
  updated_at: z.string(),
  pushed_at: z.string().nullable().optional(), // last push to any branch — used for change-detection
  html_url: z.string().url(),
  homepage: z.string().nullable(),
  topics: z.array(z.string()).optional().default([]),
  fork: z.boolean().optional().default(false),
  owner: z.object({
    login: z.string(),
  }),
})

const GitHubSearchResponseSchema = z.object({
  total_count: z.number(),
  incomplete_results: z.boolean(),
  items: z.array(GitHubSearchItemSchema),
})

// Tree API response schema
const GitHubTreeEntrySchema = z.object({
  path: z.string(),
  mode: z.string(),
  type: z.enum(['blob', 'tree', 'commit']),
  sha: z.string(),
  size: z.number().optional(),
  url: z.string().url(),
})

const GitHubTreeResponseSchema = z.object({
  sha: z.string(),
  url: z.string().url(),
  tree: z.array(GitHubTreeEntrySchema),
  truncated: z.boolean(),
})

// Repository search response schema
const GitHubRepoSearchResponseSchema = z.object({
  total_count: z.number(),
  incomplete_results: z.boolean(),
  items: z.array(GitHubRepoSchema),
})

// Type exports
export type GitHubSearchItem = z.infer<typeof GitHubSearchItemSchema>
export type GitHubSearchResponse = z.infer<typeof GitHubSearchResponseSchema>
export type GitHubRepo = z.infer<typeof GitHubRepoSchema>
export type GitHubTreeEntry = z.infer<typeof GitHubTreeEntrySchema>
export type GitHubTreeResponse = z.infer<typeof GitHubTreeResponseSchema>

/**
 * GitHub API client with rate limiting and retry logic
 * Adapted from claude-plugins-registry for Node.js
 */
export class GitHubClient {
  private baseUrl = 'https://api.github.com'
  private apiVersion = '2022-11-28'
  private lastRequestTime = 0
  private consecutiveFailures = 0 // Circuit breaker counter

  private get headers(): HeadersInit {
    const headers: HeadersInit = {
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': this.apiVersion,
      'User-Agent': 'buildwithclaude-indexer',
    }

    if (process.env.GITHUB_TOKEN) {
      headers['Authorization'] = `Bearer ${process.env.GITHUB_TOKEN}`
    }

    return headers
  }

  /**
   * Throttle requests to respect rate limits
   */
  private async throttle(): Promise<void> {
    const now = Date.now()
    const elapsed = now - this.lastRequestTime

    if (elapsed < MIN_DELAY_MS) {
      await this.sleep(MIN_DELAY_MS - elapsed)
    }

    this.lastRequestTime = Date.now()
  }

  /**
   * Search for files matching a query
   */
  async searchCode(query: string, page: number = 1): Promise<GitHubSearchResponse> {
    await this.throttle()

    const url = `${this.baseUrl}/search/code?q=${encodeURIComponent(query)}&per_page=100&page=${page}`
    const response = await this.fetchWithRetry(url)

    if (!response.ok) {
      throw new Error(`GitHub search failed: ${response.status} ${response.statusText}`)
    }

    // Check rate limit
    const remaining = parseInt(response.headers.get('x-ratelimit-remaining') || '10')
    const resetTime = parseInt(response.headers.get('x-ratelimit-reset') || '0')

    console.log(
      `GitHub rate limit: ${remaining} remaining, resets at ${new Date(resetTime * 1000).toISOString()}`
    )

    if (remaining <= 2) {
      const waitSeconds = Math.max(0, resetTime - Math.floor(Date.now() / 1000) + 5)
      if (waitSeconds > 0) {
        console.warn(`Rate limit low. Waiting ${waitSeconds}s before continuing...`)
        await this.sleep(waitSeconds * 1000)
      }
    }

    const data = await response.json()
    return GitHubSearchResponseSchema.parse(data)
  }

  /**
   * Fetch raw file content from repository
   */
  async fetchFileContent(repoFullName: string, path: string): Promise<string> {
    await this.throttle()

    const url = `${this.baseUrl}/repos/${repoFullName}/contents/${path}`
    const response = await this.fetchWithRetry(url)

    if (!response.ok) {
      throw new Error(`Failed to fetch ${path} from ${repoFullName}: ${response.status}`)
    }

    const data = await response.json()

    // Decode base64 content
    if (data.encoding === 'base64' && data.content) {
      return Buffer.from(data.content, 'base64').toString('utf-8')
    }

    throw new Error(`Unexpected content encoding: ${data.encoding}`)
  }

  /**
   * Fetch repository metadata (stars, description, etc.)
   */
  async fetchRepoMetadata(repoFullName: string): Promise<GitHubRepo> {
    await this.throttle()

    const url = `${this.baseUrl}/repos/${repoFullName}`
    const response = await this.fetchWithRetry(url)

    if (!response.ok) {
      throw new Error(`Failed to fetch repo metadata for ${repoFullName}: ${response.status}`)
    }

    const data = await response.json()
    return GitHubRepoSchema.parse(data)
  }

  /**
   * Fetch the full file tree of a repository in a single API call
   */
  async fetchRepoTree(repoFullName: string, sha: string = 'HEAD'): Promise<GitHubTreeResponse> {
    await this.throttle()

    const url = `${this.baseUrl}/repos/${repoFullName}/git/trees/${sha}?recursive=1`
    const response = await this.fetchWithRetry(url)

    if (!response.ok) {
      throw new Error(`Failed to fetch tree for ${repoFullName}: ${response.status}`)
    }

    const data = await response.json()
    return GitHubTreeResponseSchema.parse(data)
  }

  /**
   * Search repositories by query (topics, keywords, etc.)
   */
  async searchRepositories(query: string, page: number = 1): Promise<{ repos: GitHubRepo[]; totalCount: number }> {
    await this.throttle()

    const url = `${this.baseUrl}/search/repositories?q=${encodeURIComponent(query)}&per_page=100&sort=stars&order=desc&page=${page}`
    const response = await this.fetchWithRetry(url)

    if (!response.ok) {
      throw new Error(`GitHub repository search failed: ${response.status} ${response.statusText}`)
    }

    // Check rate limit
    const remaining = parseInt(response.headers.get('x-ratelimit-remaining') || '10')
    const resetTime = parseInt(response.headers.get('x-ratelimit-reset') || '0')

    if (remaining <= 2) {
      const waitSeconds = Math.max(0, resetTime - Math.floor(Date.now() / 1000) + 5)
      if (waitSeconds > 0) {
        console.warn(`Rate limit low. Waiting ${waitSeconds}s before continuing...`)
        await this.sleep(waitSeconds * 1000)
      }
    }

    const data = await response.json()
    const parsed = GitHubRepoSearchResponseSchema.parse(data)
    return { repos: parsed.items, totalCount: parsed.total_count }
  }

  /**
   * Fetch with exponential backoff retry and circuit breaker
   */
  private async fetchWithRetry(url: string): Promise<Response> {
    // Circuit breaker: fail fast if too many consecutive failures
    if (this.consecutiveFailures >= MAX_CONSECUTIVE_FAILURES) {
      throw new Error(
        `Circuit breaker open: ${this.consecutiveFailures} consecutive failures. ` +
        `Failing fast to prevent timeout. Try again later.`
      )
    }

    let lastError: Error | null = null
    let rateLimited = false

    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      try {
        const response = await fetch(url, { headers: this.headers })

        // Handle rate limiting
        if (response.status === 429 || response.status === 403) {
          rateLimited = true
          const retryAfter = response.headers.get('retry-after')
          // Cap wait time to avoid consuming entire timeout budget
          const waitTime = Math.min(
            retryAfter ? parseInt(retryAfter) * 1000 : 1000 * Math.pow(2, attempt),
            MAX_RATE_LIMIT_WAIT_MS
          )
          console.warn(`Rate limited. Waiting ${waitTime / 1000}s before retry... (attempt ${attempt + 1}/${MAX_RETRIES})`)
          await this.sleep(waitTime)
          continue
        }

        // Success - reset circuit breaker
        this.consecutiveFailures = 0
        return response
      } catch (error) {
        lastError = error as Error

        if (attempt < MAX_RETRIES) {
          const delay = Math.min(1000 * Math.pow(2, attempt), 10000)
          console.log(`Request failed, retrying in ${delay}ms... (attempt ${attempt + 1}/${MAX_RETRIES})`)
          await this.sleep(delay)
        }
      }
    }

    // All retries exhausted - increment circuit breaker counter
    this.consecutiveFailures++
    console.warn(`GitHub request failed after ${MAX_RETRIES} retries. Consecutive failures: ${this.consecutiveFailures}/${MAX_CONSECUTIVE_FAILURES}`)

    if (rateLimited && !lastError) {
      throw new Error('GitHub API rate limit exceeded after retries')
    }

    throw lastError || new Error('Request failed after retries')
  }

  /**
   * Reset the circuit breaker (useful for new indexing runs)
   */
  resetCircuitBreaker(): void {
    this.consecutiveFailures = 0
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms))
  }
}

// Singleton instance for reuse
let clientInstance: GitHubClient | null = null

export function getGitHubClient(): GitHubClient {
  if (!clientInstance) {
    clientInstance = new GitHubClient()
  }
  return clientInstance
}
