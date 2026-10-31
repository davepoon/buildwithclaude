'use client'

import { useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Copy, Check, Terminal, AlertCircle } from 'lucide-react'
import { MCPEnvironmentVariable } from '@/lib/mcp-types'

interface MCPInstallationModalProps {
  isOpen: boolean
  onClose: () => void
  serverName: string
  displayName: string
  claudeMcpAddCommand?: string
  dockerMcpAvailable?: boolean
  dockerMcpCommand?: string
  environmentVariables?: MCPEnvironmentVariable[]
}

export function MCPInstallationModal({
  isOpen,
  onClose,
  serverName,
  displayName,
  claudeMcpAddCommand,
  dockerMcpAvailable,
  dockerMcpCommand,
  environmentVariables,
}: MCPInstallationModalProps) {
  const [copiedClaude, setCopiedClaude] = useState(false)
  const [copiedDocker, setCopiedDocker] = useState(false)

  // Use provided command or fall back to a generic message
  const claudeCommand = claudeMcpAddCommand || `claude mcp add ${serverName}`
  const dockerCommand = dockerMcpCommand || `docker mcp server enable mcp/${serverName}`

  const hasEnvVars = environmentVariables && environmentVariables.length > 0
  const hasClaudeCommand = !!claudeMcpAddCommand

  const handleCopyClaude = async () => {
    await navigator.clipboard.writeText(claudeCommand)
    setCopiedClaude(true)
    setTimeout(() => setCopiedClaude(false), 2000)
  }

  const handleCopyDocker = async () => {
    await navigator.clipboard.writeText(dockerCommand)
    setCopiedDocker(true)
    setTimeout(() => setCopiedDocker(false), 2000)
  }

  // Determine which tabs to show
  const showClaudeTab = hasClaudeCommand
  const showDockerTab = dockerMcpAvailable
  const defaultTab = showClaudeTab ? 'claude' : showDockerTab ? 'docker' : 'claude'

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>Install {displayName}</DialogTitle>
          <DialogDescription>
            Choose how you want to install this MCP server
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue={defaultTab} className="flex-1 flex flex-col">
          <TabsList className={`grid w-full ${showClaudeTab && showDockerTab ? 'grid-cols-2' : 'grid-cols-1'}`}>
            {showClaudeTab && (
              <TabsTrigger value="claude" className="flex items-center gap-2">
                <Terminal className="h-4 w-4" />
                Claude CLI {!showDockerTab && '(Recommended)'}
              </TabsTrigger>
            )}
            {showDockerTab && (
              <TabsTrigger value="docker" className="flex items-center gap-2">
                <Terminal className="h-4 w-4" />
                Docker MCP {!showClaudeTab && '(Recommended)'}
              </TabsTrigger>
            )}
          </TabsList>

          {showClaudeTab && (
            <TabsContent value="claude" className="flex-1 overflow-auto space-y-4">
              <div className="space-y-3">
                <p className="text-sm text-muted-foreground">
                  Install using Claude Code CLI{showDockerTab ? ' ' : ' '}
                  <span className="text-primary font-medium">(Recommended)</span>:
                </p>

                <div className="space-y-2">
                  <div className="flex items-start justify-between p-3 bg-muted rounded-lg font-mono text-sm">
                    <span className="min-w-0 wrap-anywhere whitespace-pre-wrap">{claudeCommand}</span>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="ml-2 shrink-0"
                      onClick={handleCopyClaude}
                    >
                      {copiedClaude ? (
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
                      {environmentVariables.map((env) => (
                        <li key={env.name}>
                          <code className="bg-muted px-1 rounded">{env.name}</code>
                          {env.description && <span> - {env.description}</span>}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                <div className="space-y-2 text-xs text-muted-foreground">
                  <p>This command will:</p>
                  <ul className="list-disc list-inside space-y-1 ml-2">
                    <li>Add the MCP server to your Claude Code configuration</li>
                    <li>Configure the transport and connection settings</li>
                    <li>Make it available in Claude Code immediately</li>
                  </ul>
                </div>

                <div className="mt-4 p-3 bg-secondary/50 rounded-lg text-sm">
                  <p className="font-semibold mb-2 text-foreground">Prerequisites:</p>
                  <ul className="list-disc list-inside space-y-1 ml-2 text-muted-foreground">
                    <li>Claude Code CLI must be installed</li>
                    {claudeCommand.includes('npx') && <li>Node.js must be installed</li>}
                    {claudeCommand.includes('docker run') && <li>Docker Desktop must be installed and running</li>}
                  </ul>
                </div>
              </div>
            </TabsContent>
          )}

          {showDockerTab && (
            <TabsContent value="docker" className="flex-1 overflow-auto space-y-4">
              <div className="space-y-3">
                <p className="text-sm text-muted-foreground">
                  Enable using Docker MCP Toolkit:
                </p>

                <div className="space-y-2">
                  <div className="flex items-center justify-between p-3 bg-muted rounded-lg font-mono text-sm">
                    <span className="min-w-0 wrap-anywhere">{dockerCommand}</span>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="ml-2 shrink-0"
                      onClick={handleCopyDocker}
                    >
                      {copiedDocker ? (
                        <Check className="h-4 w-4 text-green-600" />
                      ) : (
                        <Copy className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                </div>

                <div className="space-y-2 text-xs text-muted-foreground">
                  <p>This command will:</p>
                  <ul className="list-disc list-inside space-y-1 ml-2">
                    <li>Enable the MCP server in Docker MCP Toolkit</li>
                    <li>Pull and configure the Docker container</li>
                    <li>Make it available through the Docker MCP gateway</li>
                  </ul>
                </div>

                <div className="mt-4 p-3 bg-secondary/50 rounded-lg text-sm">
                  <p className="font-semibold mb-2 text-foreground">Prerequisites:</p>
                  <ul className="list-disc list-inside space-y-1 ml-2 text-muted-foreground">
                    <li>Docker Desktop must be installed and running</li>
                    <li>Docker MCP Toolkit must be enabled</li>
                  </ul>
                </div>
              </div>
            </TabsContent>
          )}

          {!showClaudeTab && !showDockerTab && (
            <div className="flex-1 flex items-center justify-center p-8 text-center">
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
      </DialogContent>
    </Dialog>
  )
}
