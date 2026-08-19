import type {
  MCPEnvironmentVariable,
  MCPPackage,
  MCPRemote,
} from './mcp-types.ts'

type RemoteProjectConfig = {
  type: 'http' | 'sse'
  url: string
}

type LocalProjectConfig = {
  command: 'npx' | 'docker'
  args: string[]
  env?: Record<string, string>
}

export interface MCPProjectConfig {
  mcpServers: Record<string, RemoteProjectConfig | LocalProjectConfig>
}

export interface MCPProjectConfigInput {
  serverName: string
  packages?: MCPPackage[]
  remotes?: MCPRemote[]
  environmentVariables?: MCPEnvironmentVariable[]
}

const ENVIRONMENT_VARIABLE_NAME = /^[A-Za-z_][A-Za-z0-9_]*$/

function normalizeRemote(remote: MCPRemote): RemoteProjectConfig | null {
  const url = remote.url.trim()

  try {
    const parsed = new URL(url)
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return null
  } catch {
    return null
  }

  if (remote.type === 'sse') return { type: 'sse', url }
  if (remote.type === 'http' || remote.type === 'streamable-http') {
    return { type: 'http', url }
  }

  return null
}

function isUsableIdentifier(identifier: string): boolean {
  return identifier.trim().length > 0 && !/\s/.test(identifier)
}

function requiredEnvironment(
  environmentVariables: MCPEnvironmentVariable[],
): Record<string, string> | undefined {
  const entries = environmentVariables
    .filter(({ name, required }) => required === true && ENVIRONMENT_VARIABLE_NAME.test(name.trim()))
    .map(({ name }) => {
      const normalizedName = name.trim()
      return [normalizedName, `\${${normalizedName}}`] as const
    })

  if (entries.length === 0) return undefined
  return Object.fromEntries(entries)
}

function localEntry(
  packages: MCPPackage[],
  environmentVariables: MCPEnvironmentVariable[],
): LocalProjectConfig | null {
  const npmPackage = packages.find((item) => (
    item.registryType === 'npm'
    && item.transport === 'stdio'
    && isUsableIdentifier(item.identifier)
  ))
  const ociPackage = packages.find((item) => (
    item.registryType === 'oci'
    && item.transport === 'stdio'
    && isUsableIdentifier(item.identifier)
  ))
  const selectedPackage = npmPackage || ociPackage

  if (!selectedPackage) return null

  const identifier = selectedPackage.identifier.trim()
  const entry: LocalProjectConfig = selectedPackage.registryType === 'npm'
    ? { command: 'npx', args: ['-y', identifier] }
    : { command: 'docker', args: ['run', '--rm', '-i', identifier] }
  const env = requiredEnvironment(environmentVariables)

  return env ? { ...entry, env } : entry
}

export function buildMCPProjectConfig({
  serverName,
  packages = [],
  remotes = [],
  environmentVariables = [],
}: MCPProjectConfigInput): MCPProjectConfig | null {
  const normalizedName = serverName.trim()
  if (!normalizedName || /[\u0000-\u001f]/.test(normalizedName)) return null

  const entry = remotes.map(normalizeRemote).find((item) => item !== null)
    || localEntry(packages, environmentVariables)
  if (!entry) return null

  return {
    mcpServers: {
      [normalizedName]: entry,
    },
  }
}

export function serializeMCPProjectConfig(config: MCPProjectConfig): string {
  return `${JSON.stringify(config, null, 2)}\n`
}
