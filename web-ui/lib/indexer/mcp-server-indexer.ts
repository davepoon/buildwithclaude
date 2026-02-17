import { db } from '@/lib/db/client'
import { mcpServers, mcpServerStats } from '@/lib/db/schema'
import { eq, sql } from 'drizzle-orm'
import { safeDbQuery } from '@/lib/db/safe-query'

export interface MCPServerIndexResult {
  indexed: number
  failed: number
  skipped: number
  durationMs: number
  sources: {
    officialMcp: number
    docker: number
  }
}

export interface StatsSyncResult {
  updated: number
  failed: number
  durationMs: number
}

interface RawMCPServer {
  name: string
  display_name: string
  full_name?: string
  category: string
  description: string
  version?: string
  server_type?: string
  vendor?: string
  logo_url?: string
  verification?: {
    status: string
    maintainer?: string
  }
  sources?: {
    github?: string
    docker?: string
    npm?: string
    official?: string
    documentation?: string
  }
  stats?: {
    github_stars?: number
    docker_pulls?: number
    npm_downloads?: number
    last_updated?: string
  }
  source_registry?: {
    type: string
    url?: string
  }
  packages?: unknown[]
  remotes?: unknown[]
  environment_variables?: unknown[]
  installation_methods?: unknown[]
  tags?: string[]
}

/**
 * Main indexing function - indexes MCP servers from all sources
 */
export async function indexMCPServers(): Promise<MCPServerIndexResult> {
  const startTime = Date.now()

  let indexed = 0
  let failed = 0
  let skipped = 0
  const sources = {
    officialMcp: 0,
    docker: 0,
  }

  console.log('Starting MCP server indexing...')

  // Index from Official MCP Registry
  try {
    const officialServers = await fetchOfficialMCPServers()
    console.log(`Fetched ${officialServers.length} servers from Official MCP Registry`)

    for (const server of officialServers) {
      try {
        const wasIndexed = await upsertMCPServer(server, 'official-mcp')
        if (wasIndexed) {
          indexed++
          sources.officialMcp++
        } else {
          skipped++
        }
      } catch (error) {
        console.error(`Failed to index official MCP server ${server.name}:`, error)
        failed++
      }
    }
  } catch (error) {
    console.error('Failed to fetch from Official MCP Registry:', error)
  }

  // Index from Docker Hub
  try {
    const dockerServers = await fetchDockerMCPServers()
    console.log(`Fetched ${dockerServers.length} servers from Docker Hub`)

    for (const server of dockerServers) {
      try {
        const wasIndexed = await upsertMCPServer(server, 'docker')
        if (wasIndexed) {
          indexed++
          sources.docker++
        } else {
          skipped++
        }
      } catch (error) {
        console.error(`Failed to index Docker MCP server ${server.name}:`, error)
        failed++
      }
    }
  } catch (error) {
    console.error('Failed to fetch from Docker Hub:', error)
  }

  const result: MCPServerIndexResult = {
    indexed,
    failed,
    skipped,
    durationMs: Date.now() - startTime,
    sources,
  }

  console.log(`MCP server indexing complete:`, result)
  return result
}

/**
 * Sync stats for all MCP servers from their sources
 */
export async function syncMCPServerStats(): Promise<StatsSyncResult> {
  const startTime = Date.now()
  let updated = 0
  let failed = 0

  console.log('Starting MCP server stats sync...')

  // Use a minimal column projection so one missing non-critical column
  // doesn't break the entire scheduled sync run.
  const { data: servers, fromDb } = await safeDbQuery(
    () =>
      db
        .select({
          id: mcpServers.id,
          name: mcpServers.name,
          sourceRegistry: mcpServers.sourceRegistry,
          dockerUrl: mcpServers.dockerUrl,
          githubUrl: mcpServers.githubUrl,
          githubStars: mcpServers.githubStars,
          dockerPulls: mcpServers.dockerPulls,
          npmDownloads: mcpServers.npmDownloads,
        })
        .from(mcpServers)
        .where(eq(mcpServers.active, true)),
    [],
    'syncMCPServerStats:loadServers'
  )

  if (!fromDb) {
    console.warn('Skipping MCP stats sync because database query failed. This often means the DB schema is behind the app schema.')
    return {
      updated: 0,
      failed: 0,
      durationMs: Date.now() - startTime,
    }
  }

  for (const server of servers) {
    try {
      let statsUpdated = false

      // Sync Docker stats
      if (server.dockerUrl && server.sourceRegistry === 'docker') {
        const dockerStats = await fetchDockerStats(server.name)
        if (dockerStats) {
          await db
            .update(mcpServers)
            .set({
              dockerPulls: dockerStats.pulls,
              lastStatsSync: new Date(),
              updatedAt: new Date(),
            })
            .where(eq(mcpServers.id, server.id))

          // Record historical stats
          await db.insert(mcpServerStats).values({
            mcpServerId: server.id,
            dockerPulls: dockerStats.pulls,
            githubStars: server.githubStars || 0,
            npmDownloads: server.npmDownloads || 0,
          })

          statsUpdated = true
        }
      }

      // Sync GitHub stats
      if (server.githubUrl) {
        const githubStats = await fetchGitHubStats(server.githubUrl)
        if (githubStats) {
          await db
            .update(mcpServers)
            .set({
              githubStars: githubStats.stars,
              lastStatsSync: new Date(),
              updatedAt: new Date(),
            })
            .where(eq(mcpServers.id, server.id))

          if (!statsUpdated) {
            await db.insert(mcpServerStats).values({
              mcpServerId: server.id,
              githubStars: githubStats.stars,
              dockerPulls: server.dockerPulls || 0,
              npmDownloads: server.npmDownloads || 0,
            })
          }

          statsUpdated = true
        }
      }

      if (statsUpdated) {
        updated++
      }
    } catch (error) {
      console.error(`Failed to sync stats for ${server.name}:`, error)
      failed++
    }
  }

  const result: StatsSyncResult = {
    updated,
    failed,
    durationMs: Date.now() - startTime,
  }

  console.log(`MCP server stats sync complete:`, result)
  return result
}

/**
 * Upsert a single MCP server to the database
 */
async function upsertMCPServer(server: RawMCPServer, sourceRegistry: string): Promise<boolean> {
  const slug = generateSlug(server.name, sourceRegistry)

  await db
    .insert(mcpServers)
    .values({
      name: server.name,
      displayName: server.display_name,
      slug,
      description: server.description || null,
      version: server.version || null,
      category: server.category || 'utilities',
      tags: server.tags || [],
      serverType: server.server_type || 'stdio',
      vendor: server.vendor || null,
      logoUrl: server.logo_url || null,
      sourceRegistry,
      sourceUrl: server.source_registry?.url || null,
      githubUrl: server.sources?.github || null,
      dockerUrl: server.sources?.docker || null,
      npmUrl: server.sources?.npm || null,
      documentationUrl: server.sources?.documentation || server.sources?.official || null,
      githubStars: server.stats?.github_stars || 0,
      dockerPulls: server.stats?.docker_pulls || 0,
      npmDownloads: server.stats?.npm_downloads || 0,
      packages: server.packages ? JSON.stringify(server.packages) : null,
      remotes: server.remotes ? JSON.stringify(server.remotes) : null,
      environmentVariables: server.environment_variables ? JSON.stringify(server.environment_variables) : null,
      installationMethods: server.installation_methods ? JSON.stringify(server.installation_methods) : null,
      verificationStatus: server.verification?.status || 'community',
      active: true,
      lastIndexedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: mcpServers.slug,
      set: {
        displayName: sql`EXCLUDED.display_name`,
        description: sql`EXCLUDED.description`,
        version: sql`EXCLUDED.version`,
        category: sql`EXCLUDED.category`,
        tags: sql`EXCLUDED.tags`,
        serverType: sql`EXCLUDED.server_type`,
        vendor: sql`EXCLUDED.vendor`,
        logoUrl: sql`EXCLUDED.logo_url`,
        sourceUrl: sql`EXCLUDED.source_url`,
        githubUrl: sql`EXCLUDED.github_url`,
        dockerUrl: sql`EXCLUDED.docker_url`,
        npmUrl: sql`EXCLUDED.npm_url`,
        documentationUrl: sql`EXCLUDED.documentation_url`,
        githubStars: sql`EXCLUDED.github_stars`,
        dockerPulls: sql`EXCLUDED.docker_pulls`,
        npmDownloads: sql`EXCLUDED.npm_downloads`,
        packages: sql`EXCLUDED.packages`,
        remotes: sql`EXCLUDED.remotes`,
        environmentVariables: sql`EXCLUDED.environment_variables`,
        installationMethods: sql`EXCLUDED.installation_methods`,
        verificationStatus: sql`EXCLUDED.verification_status`,
        lastIndexedAt: sql`EXCLUDED.last_indexed_at`,
        updatedAt: sql`NOW()`,
      },
    })

  return true
}

/**
 * Generate a unique slug for the MCP server
 */
function generateSlug(name: string, sourceRegistry: string): string {
  const baseName = name.toLowerCase().replace(/[^a-z0-9-]/g, '-').replace(/-+/g, '-')
  return `${sourceRegistry}-${baseName}`
}

// ============================================================================
// Official MCP Registry Fetcher
// ============================================================================

interface OfficialMCPResponse {
  servers: Array<{
    server: {
      name: string
      title?: string
      description?: string
      version?: string
      repository?: { url?: string }
      website?: string
      packages?: Array<{
        registryType: string
        identifier: string
        transport?: { type?: string } | string
        environmentVariables?: Array<{ name: string; description?: string; required?: boolean }>
      }>
      remotes?: Array<{ type: string; url: string }>
      icons?: unknown[]
    }
    _meta?: {
      'io.modelcontextprotocol.registry/official'?: {
        publishedAt?: string
        updatedAt?: string
      }
      publishedAt?: string
      updatedAt?: string
    }
  }>
  metadata?: {
    nextCursor?: string
  }
}

async function fetchOfficialMCPServers(): Promise<RawMCPServer[]> {
  const servers: RawMCPServer[] = []
  let cursor: string | null = null
  let pageCount = 0
  const maxPages = 20

  try {
    do {
      const url = new URL('https://registry.modelcontextprotocol.io/v0.1/servers')
      url.searchParams.set('limit', '100')
      url.searchParams.set('version', 'latest')
      if (cursor) {
        url.searchParams.set('cursor', cursor)
      }

      const response = await fetch(url.toString())
      if (!response.ok) {
        throw new Error(`Registry API returned ${response.status}`)
      }

      const data = (await response.json()) as OfficialMCPResponse
      pageCount++

      for (const entry of data.servers) {
        const server = entry.server
        const meta = entry._meta?.['io.modelcontextprotocol.registry/official'] || entry._meta || {}

        if (!server || !server.name) {
          continue
        }

        const shortName = getShortName(server.name)
        const category = categorizeServer(server.name, server.description || '')

        servers.push({
          name: shortName,
          display_name: server.title || formatServerName(server.name),
          full_name: server.name,
          category,
          description: server.description || `MCP server: ${server.name}`,
          version: server.version,
          server_type: determineServerType(server.packages, server.remotes),
          vendor: server.name.includes('/') ? server.name.split('/')[0] : 'Community',
          verification: {
            status: 'verified',
            maintainer: server.name.includes('/') ? server.name.split('/')[0] : 'Community',
          },
          sources: {
            github: server.repository?.url,
            official: server.website || server.repository?.url,
          },
          stats: {
            last_updated: meta.updatedAt || meta.publishedAt,
          },
          source_registry: {
            type: 'official-mcp',
            url: `https://registry.modelcontextprotocol.io/servers/${encodeURIComponent(server.name)}`,
          },
          packages: server.packages,
          remotes: server.remotes,
          environment_variables: extractEnvVars(server.packages),
          installation_methods: buildInstallationMethods(shortName, server.packages, server.remotes),
          tags: [],
        })
      }

      cursor = data.metadata?.nextCursor || null
      console.log(`  Fetched page ${pageCount}: ${data.servers.length} servers`)
    } while (cursor && pageCount < maxPages)

    return servers
  } catch (error) {
    console.error('Failed to fetch from Official MCP Registry:', error)
    return []
  }
}

// ============================================================================
// Docker Hub Fetcher
// ============================================================================

interface DockerHubResponse {
  results: Array<{
    name: string
    description?: string
    pull_count?: number
    star_count?: number
    last_updated?: string
  }>
  next?: string
}

async function fetchDockerMCPServers(): Promise<RawMCPServer[]> {
  const servers: RawMCPServer[] = []

  try {
    let url: string | null = 'https://hub.docker.com/v2/namespaces/mcp/repositories?page_size=100'

    while (url) {
      const response = await fetch(url)
      if (!response.ok) {
        throw new Error(`Docker Hub API returned ${response.status}`)
      }

      const data = (await response.json()) as DockerHubResponse

      for (const repo of data.results) {
        const name = repo.name
        const description = repo.description || `MCP server for ${name}`
        const category = categorizeServer(name, description)

        servers.push({
          name: name.toLowerCase().replace(/[^a-z0-9-]/g, '-'),
          display_name: formatServerName(name),
          category,
          description,
          server_type: 'stdio',
          vendor: extractVendor(name),
          verification: {
            status: 'verified',
            maintainer: 'Docker',
          },
          sources: {
            docker: `https://hub.docker.com/r/mcp/${name}`,
          },
          stats: {
            docker_pulls: repo.pull_count || 0,
            last_updated: repo.last_updated,
          },
          source_registry: {
            type: 'docker',
            url: `https://hub.docker.com/r/mcp/${name.toLowerCase()}`,
          },
          installation_methods: [
            {
              type: 'docker',
              recommended: true,
              command: `docker mcp server enable ${name.toLowerCase()}`,
              claudeCode: null, // Docker MCP Toolkit not directly supported by Claude Code CLI
              requirements: ['Docker Desktop', 'Docker MCP Toolkit'],
            },
          ],
          tags: extractTags(name, description),
        })
      }

      url = data.next || null
    }

    return servers
  } catch (error) {
    console.error('Failed to fetch from Docker Hub:', error)
    return []
  }
}

// ============================================================================
// Stats Fetchers
// ============================================================================

async function fetchDockerStats(serverName: string): Promise<{ pulls: number } | null> {
  try {
    const response = await fetch(`https://hub.docker.com/v2/namespaces/mcp/repositories/${serverName}`)
    if (!response.ok) return null

    const data = await response.json()
    return { pulls: data.pull_count || 0 }
  } catch {
    return null
  }
}

async function fetchGitHubStats(githubUrl: string): Promise<{ stars: number } | null> {
  try {
    // Extract owner/repo from GitHub URL
    const match = githubUrl.match(/github\.com\/([^/]+)\/([^/]+)/)
    if (!match) return null

    const [, owner, repo] = match
    const apiUrl = `https://api.github.com/repos/${owner}/${repo.replace(/\.git$/, '')}`

    const headers: HeadersInit = {
      Accept: 'application/vnd.github.v3+json',
    }

    // Use GitHub token if available
    if (process.env.GITHUB_TOKEN) {
      headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`
    }

    const response = await fetch(apiUrl, { headers })
    if (!response.ok) return null

    const data = await response.json()
    return { stars: data.stargazers_count || 0 }
  } catch {
    return null
  }
}

// ============================================================================
// Helper Functions
// ============================================================================

function formatServerName(name: string): string {
  if (!name) return 'Unknown Server'
  const baseName = name.includes('/') ? name.split('/').pop() : name
  return (baseName || 'unknown')
    .replace(/-mcp$/, '')
    .replace(/[-_]/g, ' ')
    .split(' ')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ')
}

function getShortName(name: string): string {
  if (!name) return 'unknown'
  const baseName = name.includes('/') ? name.split('/').pop() : name
  return (baseName || 'unknown').toLowerCase().replace(/[^a-z0-9-]/g, '-')
}

function categorizeServer(name: string, description: string): string {
  const text = `${name} ${description}`.toLowerCase()

  if (text.match(/\b(ai|llm|gpt|claude|model|machine learning|ml|neural|embedding|vector)\b/)) {
    return 'ai-task-management'
  }
  if (text.match(/\b(database|db|sql|sqlite|mysql|postgres|postgresql|mongo|mongodb|redis|supabase)\b/)) {
    return 'database'
  }
  if (text.match(/\b(aws|amazon|azure|gcp|google cloud|cloud|kubernetes|k8s|docker|serverless)\b/)) {
    return 'cloud-infrastructure'
  }
  if (text.match(/\b(github|gitlab|git|ci|cd|devops|deploy|pipeline)\b/)) {
    return 'developer-tools'
  }
  if (text.match(/\b(search|brave|google|bing|query|find|discover)\b/)) {
    return 'web-search'
  }
  if (text.match(/\b(browser|chrome|puppeteer|playwright|selenium|web|scrape|crawl)\b/)) {
    return 'browser-automation'
  }
  if (text.match(/\b(file|filesystem|fs|directory|folder|storage)\b/)) {
    return 'file-system'
  }
  if (text.match(/\b(notion|slack|discord|email|calendar|todo|task|project)\b/)) {
    return 'productivity'
  }
  if (text.match(/\b(finance|trading|stock|crypto|blockchain|bitcoin|payment)\b/)) {
    return 'blockchain-crypto'
  }
  if (text.match(/\b(image|video|audio|media|youtube|spotify|music|photo)\b/)) {
    return 'media-generation'
  }

  return 'utilities'
}

function extractVendor(name: string): string {
  const nameLower = name.toLowerCase()

  const vendorMap: Record<string, string> = {
    github: 'GitHub',
    aws: 'AWS',
    azure: 'Microsoft',
    google: 'Google',
    slack: 'Slack',
    notion: 'Notion',
    docker: 'Docker',
    kubernetes: 'Kubernetes',
    terraform: 'HashiCorp',
    mongodb: 'MongoDB',
    postgres: 'PostgreSQL',
    redis: 'Redis',
    mysql: 'MySQL',
    sqlite: 'SQLite',
    supabase: 'Supabase',
  }

  for (const [key, vendor] of Object.entries(vendorMap)) {
    if (nameLower.includes(key)) return vendor
  }

  return 'MCP'
}

function extractTags(name: string, description: string): string[] {
  const tags: string[] = []
  const text = `${name} ${description}`.toLowerCase()

  const tagKeywords = ['aws', 'github', 'docker', 'kubernetes', 'database', 'api', 'ai', 'search', 'security', 'monitoring']
  for (const keyword of tagKeywords) {
    if (text.includes(keyword)) tags.push(keyword)
  }

  return [...new Set(tags)]
}

function determineServerType(
  packages?: Array<{ transport?: { type?: string } | string }>,
  remotes?: Array<{ type: string }>
): string {
  if (remotes?.some((r) => r.type === 'streamable-http' || r.type === 'http')) {
    return 'http'
  }
  if (remotes?.some((r) => r.type === 'sse')) {
    return 'sse'
  }
  return 'stdio'
}

function extractEnvVars(packages?: Array<{ environmentVariables?: Array<{ name: string; description?: string; required?: boolean }> }>): unknown[] {
  const envVars: Array<{ name: string; description: string; required: boolean }> = []
  for (const pkg of packages || []) {
    for (const env of pkg.environmentVariables || []) {
      if (!envVars.find((e) => e.name === env.name)) {
        envVars.push({
          name: env.name,
          description: env.description || '',
          required: env.required !== false,
        })
      }
    }
  }
  return envVars
}

function buildInstallationMethods(
  serverName: string,
  packages?: Array<{ registryType: string; identifier: string; environmentVariables?: Array<{ name: string }> }>,
  remotes?: Array<{ type: string; url: string }>
): unknown[] {
  const methods: Array<{ type: string; recommended: boolean; command: string; claudeCode: string | null; requirements: string[] }> = []

  const npmPkg = packages?.find((p) => p.registryType === 'npm')
  if (npmPkg) {
    // Build environment variable flags for Claude Code CLI
    const envVars = npmPkg.environmentVariables || []
    const envFlags = envVars.map((e) => `-e ${e.name}=<value>`).join(' ')

    methods.push({
      type: 'npm',
      recommended: true,
      command: `npx -y ${npmPkg.identifier}`,
      claudeCode: envFlags
        ? `claude mcp add ${serverName} ${envFlags} -- npx -y ${npmPkg.identifier}`
        : `claude mcp add ${serverName} -- npx -y ${npmPkg.identifier}`,
      requirements: ['Node.js'],
    })
  }

  const ociPkg = packages?.find((p) => p.registryType === 'oci')
  if (ociPkg) {
    methods.push({
      type: 'docker',
      recommended: !npmPkg,
      command: `docker run -i ${ociPkg.identifier}`,
      claudeCode: null, // Docker not directly supported by Claude Code CLI
      requirements: ['Docker'],
    })
  }

  const httpRemote = remotes?.find((r) => r.type === 'streamable-http' || r.type === 'http')
  if (httpRemote) {
    methods.push({
      type: 'remote',
      recommended: !npmPkg && !ociPkg,
      command: httpRemote.url,
      claudeCode: `claude mcp add --transport http ${serverName} ${httpRemote.url}`,
      requirements: [],
    })
  }

  return methods
}
