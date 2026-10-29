'use client'

import { useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { ArrowLeft, Copy, Check, ExternalLink, Github, Box, Package, Terminal, AlertCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
  MCPServer,
  SOURCE_INDICATORS,
  getMCPCategoryDisplayName,
  getMCPCategoryIcon
} from '@/lib/mcp-types'

interface MCPServerPageClientProps {
  server: MCPServer
}

export default function MCPServerPageClient({ server }: MCPServerPageClientProps) {
  const [copiedConfig, setCopiedConfig] = useState<string | null>(null)
  const [copiedCommand, setCopiedCommand] = useState<string | null>(null)
  const [logoError, setLogoError] = useState(false)

  const categoryName = getMCPCategoryDisplayName(server.category)
  const categoryIcon = getMCPCategoryIcon(server.category)

  const handleCopyConfig = async (methodType: string, config: string) => {
    await navigator.clipboard.writeText(config)
    setCopiedConfig(methodType)
    setTimeout(() => setCopiedConfig(null), 2000)
  }

  const handleCopyCommand = async (methodType: string, command: string) => {
    await navigator.clipboard.writeText(command)
    setCopiedCommand(methodType)
    setTimeout(() => setCopiedCommand(null), 2000)
  }

  return (
    <div className="min-h-screen">
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        {/* Back button */}
        <Link href="/mcp-servers" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-primary -mt-1 py-1 mb-5">
          <ArrowLeft className="h-4 w-4" />
          Back to MCP Servers
        </Link>

        {/* Header */}
        <div className="mb-8">
          <div className="flex items-start gap-4 mb-4">
            {server.logo_url && !logoError ? (
              <div className="relative w-16 h-16 flex items-center justify-center flex-shrink-0">
                <Image
                  src={server.logo_url}
                  alt={`${server.vendor || server.display_name} logo`}
                  width={64}
                  height={64}
                  className="object-contain"
                  onError={() => setLogoError(true)}
                />
              </div>
            ) : (
              <span className="text-4xl flex-shrink-0">{categoryIcon}</span>
            )}
            <div className="flex-1">
              <h1 className="text-3xl font-bold mb-2">{server.display_name}</h1>
              <p className="text-lg text-muted-foreground">{server.description}</p>
            </div>
          </div>

          <div className="flex flex-wrap gap-2 items-center">
            <Badge variant="secondary">{categoryName}</Badge>
            <Badge variant="outline">Protocol v{server.protocol_version}</Badge>
            <Badge variant="outline">{server.server_type}</Badge>
            {/* Hidden: Execution type badge - data still available in server.execution_type */}
            {server.source_registry && (
              <Badge variant="outline">
                {SOURCE_INDICATORS[server.source_registry.type]?.icon} {SOURCE_INDICATORS[server.source_registry.type]?.label}
              </Badge>
            )}
          </div>
        </div>

        {/* Stats and Sources */}
        <div className="grid md:grid-cols-2 gap-6 mb-8">
          {/* Stats Card */}
          {server.stats && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Statistics</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {server.stats.github_stars && (
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">GitHub Stars</span>
                    <span className="font-mono">⭐ {server.stats.github_stars.toLocaleString()}</span>
                  </div>
                )}
                {server.stats.docker_pulls && (
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Docker Pulls</span>
                    <span className="font-mono">🐳 {server.stats.docker_pulls.toLocaleString()}</span>
                  </div>
                )}
                {server.stats.npm_downloads && (
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">NPM Downloads</span>
                    <span className="font-mono">📦 {server.stats.npm_downloads.toLocaleString()}</span>
                  </div>
                )}
                {server.stats.last_updated && (
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-muted-foreground">Last Updated</span>
                    <span className="font-mono break-all">{server.stats.last_updated}</span>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Sources Card */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Sources</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {(() => {
                const displayedUrls = new Set<string>()
                const sources = []
                
                // Add GitHub source if unique
                if (server.sources.github && !displayedUrls.has(server.sources.github)) {
                  displayedUrls.add(server.sources.github)
                  sources.push(
                    <a
                      key="github"
                      href={server.sources.github}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center justify-between hover:text-primary transition-colors"
                    >
                      <span className="flex items-center gap-2">
                        <Github className="h-4 w-4" />
                        GitHub Repository
                      </span>
                      <ExternalLink className="h-4 w-4" />
                    </a>
                  )
                }
                
                // Add Docker source if unique
                if (server.sources.docker && !displayedUrls.has(server.sources.docker)) {
                  displayedUrls.add(server.sources.docker)
                  sources.push(
                    <div key="docker">
                      <a
                        href={server.sources.docker}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center justify-between hover:text-primary transition-colors"
                      >
                        <span className="flex items-center gap-2">
                          <Box className="h-4 w-4" />
                          Docker Hub
                        </span>
                        <ExternalLink className="h-4 w-4" />
                      </a>
                      {/* Add last fetched info if this Docker URL matches source_registry */}
                      {server.source_registry?.url === server.sources.docker && 
                       server.source_registry.last_fetched && (
                        <div className="text-xs text-muted-foreground mt-1 ml-6">
                          Last fetched: {new Date(server.source_registry.last_fetched).toLocaleDateString('en-US', {
                            year: 'numeric',
                            month: '2-digit',
                            day: '2-digit',
                            timeZone: 'UTC'
                          })}
                        </div>
                      )}
                    </div>
                  )
                }
                
                // Add NPM source if unique
                if (server.sources.npm && !displayedUrls.has(server.sources.npm)) {
                  displayedUrls.add(server.sources.npm)
                  sources.push(
                    <a
                      key="npm"
                      href={server.sources.npm}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center justify-between hover:text-primary transition-colors"
                    >
                      <span className="flex items-center gap-2">
                        <Package className="h-4 w-4" />
                        NPM Package
                      </span>
                      <ExternalLink className="h-4 w-4" />
                    </a>
                  )
                }
                
                // Add Documentation if unique
                if (server.sources.documentation && !displayedUrls.has(server.sources.documentation)) {
                  displayedUrls.add(server.sources.documentation)
                  sources.push(
                    <a
                      key="docs"
                      href={server.sources.documentation}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center justify-between hover:text-primary transition-colors"
                    >
                      <span className="flex items-center gap-2">
                        📚 Documentation
                      </span>
                      <ExternalLink className="h-4 w-4" />
                    </a>
                  )
                }
                
                // Only add source_registry if it's a unique URL
                if (server.source_registry?.url && !displayedUrls.has(server.source_registry.url)) {
                  sources.push(
                    <div key="registry" className="pt-2 mt-2 border-t">
                      <a
                        href={server.source_registry.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center justify-between hover:text-primary transition-colors"
                      >
                        <span className="flex items-center gap-2">
                          {SOURCE_INDICATORS[server.source_registry.type]?.icon}
                          Source: {SOURCE_INDICATORS[server.source_registry.type]?.label}
                        </span>
                        <ExternalLink className="h-4 w-4" />
                      </a>
                      {server.source_registry.last_fetched && (
                        <div className="text-xs text-muted-foreground mt-1">
                          Last fetched: {new Date(server.source_registry.last_fetched).toLocaleDateString('en-US', {
                            year: 'numeric',
                            month: '2-digit',
                            day: '2-digit',
                            timeZone: 'UTC'
                          })}
                        </div>
                      )}
                    </div>
                  )
                }
                
                return sources
              })()}
            </CardContent>
          </Card>
        </div>

        {/* Installation Methods */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle>Installation</CardTitle>
            <CardDescription>
              Choose your preferred installation method below
            </CardDescription>
          </CardHeader>
          <CardContent>
            {(() => {
              const hasClaudeCommand = !!server.claude_mcp_add_command
              const hasDockerMcp = !!server.docker_mcp_available
              const claudeCommand = server.claude_mcp_add_command || `claude mcp add ${server.name}`
              const dockerCommand = server.docker_mcp_command || `docker mcp server enable mcp/${server.name}`
              const hasEnvVars = server.environment_variables && server.environment_variables.length > 0

              // Determine default tab and grid columns
              const showBothTabs = hasClaudeCommand && hasDockerMcp
              const defaultTab = hasClaudeCommand ? 'claude' : hasDockerMcp ? 'docker' : 'claude'

              return (
                <Tabs defaultValue={defaultTab}>
                  <TabsList className={`grid w-full ${showBothTabs ? 'grid-cols-2' : 'grid-cols-1'}`}>
                    {hasClaudeCommand && (
                      <TabsTrigger value="claude" className="flex items-center gap-2">
                        <Terminal className="h-4 w-4" />
                        Claude CLI {!hasDockerMcp && '(Recommended)'}
                      </TabsTrigger>
                    )}
                    {hasDockerMcp && (
                      <TabsTrigger value="docker" className="flex items-center gap-2">
                        <Terminal className="h-4 w-4" />
                        Docker MCP {!hasClaudeCommand && '(Recommended)'}
                      </TabsTrigger>
                    )}
                  </TabsList>

                  {hasClaudeCommand && (
                    <TabsContent value="claude" className="space-y-4">
                      <div>
                        <p className="text-sm text-muted-foreground mb-3">
                          Install using Claude Code CLI <span className="text-primary font-medium">(Recommended)</span>:
                        </p>
                        <div className="bg-muted p-4 rounded-lg overflow-x-auto flex items-start justify-between">
                          <code className="font-mono text-sm whitespace-pre-wrap break-all">{claudeCommand}</code>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleCopyCommand('claude', claudeCommand)}
                            className="ml-2 flex-shrink-0"
                          >
                            {copiedCommand === 'claude' ? (
                              <Check className="h-4 w-4 text-green-600" />
                            ) : (
                              <Copy className="h-4 w-4" />
                            )}
                          </Button>
                        </div>
                      </div>

                      {hasEnvVars && (
                        <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-lg text-sm">
                          <p className="font-semibold mb-2 text-amber-600 dark:text-amber-400 flex items-center gap-2">
                            <AlertCircle className="h-4 w-4" />
                            Required Configuration
                          </p>
                          <p className="text-muted-foreground mb-2">
                            Replace the following placeholders with your actual values:
                          </p>
                          <ul className="list-disc list-inside space-y-1 ml-2 text-muted-foreground">
                            {server.environment_variables!.map((env) => (
                              <li key={env.name}>
                                <code className="bg-muted px-1 rounded">{env.name}</code>
                                {env.description && <span> - {env.description}</span>}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}

                      <div className="space-y-2">
                        <p className="text-sm text-muted-foreground">This command will:</p>
                        <ul className="list-disc list-inside space-y-1 ml-2 text-sm text-muted-foreground">
                          <li>Add the MCP server to your Claude Code configuration</li>
                          <li>Configure the transport and connection settings</li>
                          <li>Make it available in Claude Code immediately</li>
                        </ul>
                      </div>

                      <div className="p-3 bg-secondary/50 rounded-lg text-sm">
                        <p className="font-semibold mb-2 text-foreground">Prerequisites:</p>
                        <ul className="list-disc list-inside space-y-1 ml-2 text-muted-foreground">
                          <li>Claude Code CLI must be installed</li>
                          {claudeCommand.includes('npx') && <li>Node.js must be installed</li>}
                          {claudeCommand.includes('docker run') && <li>Docker Desktop must be installed and running</li>}
                        </ul>
                      </div>
                    </TabsContent>
                  )}

                  {hasDockerMcp && (
                    <TabsContent value="docker" className="space-y-4">
                      <div>
                        <p className="text-sm text-muted-foreground mb-3">
                          Enable using Docker MCP Toolkit:
                        </p>
                        <div className="bg-muted p-4 rounded-lg overflow-x-auto flex items-center justify-between">
                          <code className="font-mono">{dockerCommand}</code>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleCopyCommand('docker', dockerCommand)}
                            className="ml-2 flex-shrink-0"
                          >
                            {copiedCommand === 'docker' ? (
                              <Check className="h-4 w-4 text-green-600" />
                            ) : (
                              <Copy className="h-4 w-4" />
                            )}
                          </Button>
                        </div>
                      </div>

                      <div className="space-y-2">
                        <p className="text-sm text-muted-foreground">This command will:</p>
                        <ul className="list-disc list-inside space-y-1 ml-2 text-sm text-muted-foreground">
                          <li>Enable the MCP server in Docker MCP Toolkit</li>
                          <li>Pull and configure the Docker container</li>
                          <li>Make it available through the Docker MCP gateway</li>
                        </ul>
                      </div>

                      <div className="p-3 bg-secondary/50 rounded-lg text-sm">
                        <p className="font-semibold mb-2 text-foreground">Prerequisites:</p>
                        <ul className="list-disc list-inside space-y-1 ml-2 text-muted-foreground">
                          <li>Docker Desktop must be installed and running</li>
                          <li>Docker MCP Toolkit must be enabled</li>
                        </ul>
                      </div>
                    </TabsContent>
                  )}

                  {!hasClaudeCommand && !hasDockerMcp && (
                    <div className="flex items-center justify-center p-8 text-center">
                      <div className="space-y-2">
                        <AlertCircle className="h-8 w-8 mx-auto text-muted-foreground" />
                        <p className="text-muted-foreground">
                          Installation instructions are not available for this server.
                          Please check the server&apos;s documentation.
                        </p>
                      </div>
                    </div>
                  )}
                </Tabs>
              )
            })()}
          </CardContent>
        </Card>

        {/* Additional Information */}
        <Card>
          <CardHeader>
            <CardTitle>Additional Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {server.verification.tested_with && (
              <div>
                <span className="font-semibold">Tested With:</span>
                <div className="flex flex-wrap gap-1 mt-1">
                  {server.verification.tested_with.map((client) => (
                    <Badge key={client} variant="outline" className="text-xs">
                      {client}
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            {server.verification.maintainer && (
              <div>
                <span className="font-semibold">Maintainer:</span> {server.verification.maintainer}
              </div>
            )}

            {server.verification.last_tested && (
              <div>
                <span className="font-semibold">Last Tested:</span> {server.verification.last_tested}
              </div>
            )}

            {server.tags.length > 0 && (
              <div>
                <span className="font-semibold">Tags:</span>
                <div className="flex flex-wrap gap-1 mt-1">
                  {server.tags.map((tag) => (
                    <Badge key={tag} variant="secondary" className="text-xs">
                      {tag}
                    </Badge>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}