import { z } from 'zod'

// Rate limiting configuration
// 0.9s between requests is 4,000 an hour against GitHub's 5,000: at 0.75s a
// crawl ran at the limit and anything else on the token tipped it over.
const MIN_DELAY_MS = 900
const MAX_RETRIES = 3
const MAX_CONSECUTIVE_FAILURES = 5 // Circuit breaker threshold
const MAX_RATE_LIMIT_WAIT_MS = 65 * 60 * 1000 // The hourly limit resets within the hour

/** The requested file or repository does not exist (404), as opposed to a request that failed. */
export class GitHubNotFoundError extends Error {}
const REPO_BATCH = 100 // Repositories per GraphQL metadata request
const GRAPHQL_ATTEMPTS = 3
const FILE_BATCH = 20 // Repositories per GraphQL file-contents request

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
   * Throw if GITHUB_TOKEN is set but GitHub rejects it. Call before a crawl: a
   * dead token turns every request into a 401 that the per-repo error handling
   * would otherwise absorb, so the run "succeeds" having refreshed nothing.
   */
  async assertAuthenticated(): Promise<void> {
    const response = await fetch(`${this.baseUrl}/rate_limit`, { headers: this.headers })
    if (response.status === 401) {
      throw new Error('GITHUB_TOKEN was rejected by GitHub (401): it is expired or revoked. Replace it.')
    }
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
      const message = `Failed to fetch ${path} from ${repoFullName}: ${response.status}`
      throw response.status === 404 ? new GitHubNotFoundError(message) : new Error(message)
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
   * Fetch metadata for many repositories at once through the GraphQL API
   * (REPO_BATCH per request), so checking the whole catalog for changes costs
   * a few hundred requests instead of one per repository.
   *
   * Keys are the names as passed in. A repository GitHub cannot resolve
   * (deleted, private, bad name) maps to null. Throws only when a whole
   * request fails.
   */
  async fetchReposMetadata(repoFullNames: string[]): Promise<Map<string, GitHubRepo | null>> {
    const out = new Map<string, GitHubRepo | null>()
    for (let i = 0; i < repoFullNames.length; i += REPO_BATCH) {
      const batch = repoFullNames.slice(i, i + REPO_BATCH)
      const fields: string[] = []
      batch.forEach((fullName, n) => {
        const [owner, name] = fullName.split('/')
        if (!owner || !name) return out.set(fullName, null)
        // JSON.stringify yields a valid GraphQL string literal.
        fields.push(`r${n}: repository(owner: ${JSON.stringify(owner)}, name: ${JSON.stringify(name)}) { ...meta }`)
      })
      if (fields.length === 0) continue
      const query =
        `fragment meta on Repository { databaseId nameWithOwner name description stargazerCount updatedAt pushedAt ` +
        `url homepageUrl isFork owner { login } repositoryTopics(first: 20) { nodes { topic { name } } } }\n` +
        `query { ${fields.join('\n')} }`

      const data = await this.graphql(query)
      batch.forEach((fullName, n) => {
        const r = data[`r${n}`]
        if (out.has(fullName)) return
        out.set(
          fullName,
          r
            ? GitHubRepoSchema.parse({
                id: r.databaseId ?? 0,
                full_name: r.nameWithOwner,
                name: r.name,
                description: r.description,
                stargazers_count: r.stargazerCount,
                updated_at: r.updatedAt,
                pushed_at: r.pushedAt,
                html_url: r.url,
                homepage: r.homepageUrl || null,
                topics: r.repositoryTopics.nodes.map((t: { topic: { name: string } }) => t.topic.name),
                fork: r.isFork,
                owner: r.owner,
              })
            : null,
        )
      })
    }
    return out
  }

  /**
   * Fetch the text of the given paths from many repositories' default branches
   * (FILE_BATCH repositories per request). A repository maps to the paths that
   * exist in it. A repository is left out of the result, so the caller can fall
   * back to fetchFileContent, when its batch failed or a file came back
   * truncated or binary.
   */
  async fetchFiles(repoFullNames: string[], paths: string[]): Promise<Map<string, Record<string, string>>> {
    const out = new Map<string, Record<string, string>>()
    const files = paths
      .map((path, f) => `f${f}: object(expression: ${JSON.stringify(`HEAD:${path}`)}) { ... on Blob { text isTruncated } }`)
      .join(' ')
    for (let i = 0; i < repoFullNames.length; i += FILE_BATCH) {
      const batch = repoFullNames.slice(i, i + FILE_BATCH)
      const fields = batch.map((fullName, n) => {
        const [owner, name] = fullName.split('/')
        return `r${n}: repository(owner: ${JSON.stringify(owner ?? '')}, name: ${JSON.stringify(name ?? '')}) { ${files} }`
      })
      let data: Record<string, any> // eslint-disable-line @typescript-eslint/no-explicit-any
      try {
        data = await this.graphql(`query { ${fields.join('\n')} }`)
      } catch (error) {
        console.warn(`Batched file fetch failed for ${batch.length} repositories:`, error)
        continue
      }
      batch.forEach((fullName, n) => {
        const r = data[`r${n}`]
        if (!r) return
        const found: Record<string, string> = {}
        for (const [f, path] of paths.entries()) {
          const blob = r[`f${f}`]
          if (!blob) continue // no such file
          if (blob.isTruncated || typeof blob.text !== 'string') return
          found[path] = blob.text
        }
        out.set(fullName, found)
      })
    }
    return out
  }

  /**
   * Run one GraphQL query and return its `data`. Fields GitHub cannot resolve
   * come back null plus an `errors` entry each; that is expected. No `data` at
   * all is a failed request: GitHub answers 502 or a data-less 200 when a query
   * times out, and one of those in hundreds of requests must not end the run,
   * so it is retried before throwing.
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private async graphql(query: string): Promise<Record<string, any>> {
    let response!: Response
    let body: { data?: Record<string, any>; errors?: unknown } | null = null // eslint-disable-line @typescript-eslint/no-explicit-any
    for (let attempt = 0; attempt < GRAPHQL_ATTEMPTS && !body?.data; attempt++) {
      if (attempt > 0) {
        console.warn(`GitHub GraphQL batch failed (${response.status}), retrying...`)
        await this.sleep(5000 * attempt)
      }
      await this.throttle()
      response = await this.fetchWithRetry(`${this.baseUrl}/graphql`, {
        method: 'POST',
        body: JSON.stringify({ query }),
      })
      body = response.ok ? await response.json().catch(() => null) : null
    }
    if (!body?.data) {
      throw new Error(
        `GitHub GraphQL batch failed: ${response.status} ${JSON.stringify(body?.errors ?? '').slice(0, 300)}`,
      )
    }
    return body.data
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
  private async fetchWithRetry(url: string, init: RequestInit = {}): Promise<Response> {
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
        const response = await fetch(url, { ...init, headers: this.headers })

        // Handle rate limiting. GitHub also uses 403 for "forbidden" (a blocked
        // repository), which no amount of waiting fixes, so check the body.
        const limited =
          response.status === 429 ||
          (response.status === 403 && /rate limit|abuse/i.test(await response.clone().text()))
        if (limited) rateLimited = true
        if (limited && attempt < MAX_RETRIES) {
          // GitHub's guidance: honour retry-after; else, when the hourly quota
          // is spent, wait for its reset; else (secondary limit) wait a minute.
          const retryAfter = parseInt(response.headers.get('retry-after') || '')
          const reset = parseInt(response.headers.get('x-ratelimit-reset') || '')
          const spent = response.headers.get('x-ratelimit-remaining') === '0' && reset
          const waitTime = Math.min(
            retryAfter ? retryAfter * 1000 : spent ? Math.max(0, reset * 1000 - Date.now()) + 5000 : 60000,
            MAX_RATE_LIMIT_WAIT_MS
          )
          console.warn(`Rate limited. Waiting ${Math.round(waitTime / 1000)}s before retry... (attempt ${attempt + 1}/${MAX_RETRIES})`)
          await this.sleep(waitTime)
          continue
        }
        if (limited) break

        // GitHub answers a slow or overloaded request (the batched GraphQL
        // query especially) with a 5xx. Retry; the last attempt's response is
        // returned for the caller to report.
        if (response.status >= 500 && attempt < MAX_RETRIES) {
          const delay = Math.min(1000 * Math.pow(2, attempt), 10000)
          console.warn(`GitHub returned ${response.status}, retrying in ${delay}ms... (attempt ${attempt + 1}/${MAX_RETRIES})`)
          await this.sleep(delay)
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

    // All retries exhausted. A rate limit is GitHub working as designed, not
    // an outage, so it does not count toward the circuit breaker.
    if (!rateLimited) this.consecutiveFailures++
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
