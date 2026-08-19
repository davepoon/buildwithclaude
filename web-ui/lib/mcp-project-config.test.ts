import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
  buildMCPProjectConfig,
  serializeMCPProjectConfig,
  type MCPProjectConfig,
  type MCPProjectConfigInput,
} from './mcp-project-config.ts'

describe('buildMCPProjectConfig', () => {
  it('prefers a valid remote and normalizes streamable HTTP', () => {
    const input: MCPProjectConfigInput = {
      serverName: 'github',
      packages: [{ registryType: 'npm', identifier: '@scope/github-mcp', transport: 'stdio' }],
      remotes: [{ type: 'streamable-http', url: 'https://mcp.example.com' }],
    }

    assert.deepEqual(buildMCPProjectConfig(input), {
      mcpServers: {
        github: { type: 'http', url: 'https://mcp.example.com' },
      },
    })
  })

  it('builds an npm stdio package with required environment placeholders', () => {
    const input: MCPProjectConfigInput = {
      serverName: 'local-search',
      packages: [{ registryType: 'npm', identifier: '@scope/search-mcp', transport: 'stdio' }],
      environmentVariables: [
        { name: 'SEARCH_API_KEY', required: true },
        { name: 'OPTIONAL_REGION', required: false },
      ],
    }

    assert.deepEqual(buildMCPProjectConfig(input), {
      mcpServers: {
        'local-search': {
          command: 'npx',
          args: ['-y', '@scope/search-mcp'],
          env: { SEARCH_API_KEY: '${SEARCH_API_KEY}' },
        },
      },
    })
  })

  it('builds an OCI stdio package when no remote or npm package is usable', () => {
    const input: MCPProjectConfigInput = {
      serverName: 'docker-tools',
      packages: [
        { registryType: 'npm', identifier: '', transport: 'stdio' },
        { registryType: 'oci', identifier: 'ghcr.io/acme/tools:1.2.0', transport: 'stdio' },
      ],
    }

    assert.deepEqual(buildMCPProjectConfig(input), {
      mcpServers: {
        'docker-tools': {
          command: 'docker',
          args: ['run', '--rm', '-i', 'ghcr.io/acme/tools:1.2.0'],
        },
      },
    })
  })

  it('normalizes SSE remotes and rejects unsupported or incomplete records', () => {
    assert.deepEqual(buildMCPProjectConfig({
      serverName: 'events',
      remotes: [{ type: 'sse', url: 'https://mcp.example.com/events' }],
    }), {
      mcpServers: {
        events: { type: 'sse', url: 'https://mcp.example.com/events' },
      },
    })

    assert.equal(buildMCPProjectConfig({
      serverName: 'unsupported',
      packages: [{ registryType: 'npm', identifier: '@scope/tool', transport: 'http' }],
      remotes: [{ type: 'http', url: 'not-a-url' }],
    }), null)
  })

  it('deduplicates required environment placeholders and ignores optional values', () => {
    const config = buildMCPProjectConfig({
      serverName: 'dedupe',
      packages: [{ registryType: 'npm', identifier: 'dedupe-mcp', transport: 'stdio' }],
      environmentVariables: [
        { name: 'TOKEN', required: true },
        { name: 'TOKEN', required: true },
        { name: 'OPTIONAL', required: false },
        { name: ' ', required: true },
      ],
    })

    const localConfig = config as MCPProjectConfig & {
      mcpServers: { dedupe: { env?: Record<string, string> } }
    }
    assert.deepEqual(localConfig.mcpServers.dedupe.env, { TOKEN: '${TOKEN}' })
  })

  it('serializes a stable two-space JSON document with a trailing newline', () => {
    const config = buildMCPProjectConfig({
      serverName: 'github',
      remotes: [{ type: 'http', url: 'https://mcp.example.com' }],
    })

    assert.equal(serializeMCPProjectConfig(config!), '{\n  "mcpServers": {\n    "github": {\n      "type": "http",\n      "url": "https://mcp.example.com"\n    }\n  }\n}\n')
  })
})
