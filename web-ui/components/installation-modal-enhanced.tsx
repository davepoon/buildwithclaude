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
import { Copy, Check, Puzzle, FileText } from 'lucide-react'
import { generatePluginCommands, generatePluginInstallScript, getMarketplaceAddCommand, type ResourceType } from '@/lib/plugin-utils'

interface InstallationModalEnhancedProps {
  isOpen: boolean
  onClose: () => void
  resourceType: ResourceType
  resourceName: string
  category: string
  markdownContent: string
  displayName?: string
}

export function InstallationModalEnhanced({
  isOpen,
  onClose,
  resourceType,
  resourceName,
  category,
  markdownContent,
  displayName
}: InstallationModalEnhancedProps) {
  const [copiedMarkdown, setCopiedMarkdown] = useState(false)
  const [copiedCommand, setCopiedCommand] = useState<string | null>(null)

  const pluginCommands = generatePluginCommands(resourceType, category)
  const installScript = generatePluginInstallScript(resourceType, category)
  const marketplaceAdd = getMarketplaceAddCommand()

  const handleCopyMarkdown = async () => {
    await navigator.clipboard.writeText(markdownContent)
    setCopiedMarkdown(true)
    setTimeout(() => setCopiedMarkdown(false), 2000)
  }

  const handleCopyCommand = async (command: string, commandKey: string) => {
    await navigator.clipboard.writeText(command)
    setCopiedCommand(commandKey)
    setTimeout(() => setCopiedCommand(null), 2000)
  }

  const handleCopyAllCommands = async () => {
    await navigator.clipboard.writeText(installScript)
    setCopiedCommand('all')
    setTimeout(() => setCopiedCommand(null), 2000)
  }

  const resourceLabel = resourceType === 'subagent' ? 'agent' : resourceType

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>Install {displayName || resourceName}</DialogTitle>
          <DialogDescription>
            Choose how you want to install this {resourceLabel}
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="plugin" className="flex-1 flex flex-col">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="plugin" className="flex items-center gap-2">
              <Puzzle className="h-4 w-4" />
              Plugin Install
            </TabsTrigger>
            <TabsTrigger value="markdown" className="flex items-center gap-2">
              <FileText className="h-4 w-4" />
              Copy Markdown
            </TabsTrigger>
          </TabsList>

          <TabsContent value="plugin" className="flex-1 overflow-auto space-y-4">
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">
                Install using Claude Code&apos;s plugin system:
              </p>

              {/* Step 1: Add marketplace */}
              <div className="space-y-2">
                <h4 className="text-sm font-semibold">Step 1: Add the marketplace (one-time)</h4>
                <div className="flex items-center justify-between p-3 bg-muted rounded-lg font-mono text-sm">
                  <span className="min-w-0 wrap-anywhere">{marketplaceAdd}</span>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="ml-2 shrink-0"
                    onClick={() => handleCopyCommand(marketplaceAdd, 'marketplace')}
                  >
                    {copiedCommand === 'marketplace' ? (
                      <Check className="h-4 w-4 text-green-600" />
                    ) : (
                      <Copy className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              </div>

              {/* Step 2: Install plugin */}
              <div className="space-y-2">
                <h4 className="text-sm font-semibold">Step 2: Install the {category} {resourceLabel}s</h4>
                <div className="flex items-center justify-between p-3 bg-muted rounded-lg font-mono text-sm">
                  <span className="min-w-0 wrap-anywhere">{pluginCommands.install}</span>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="ml-2 shrink-0"
                    onClick={() => handleCopyCommand(pluginCommands.install, 'install')}
                  >
                    {copiedCommand === 'install' ? (
                      <Check className="h-4 w-4 text-green-600" />
                    ) : (
                      <Copy className="h-4 w-4" />
                    )}
                  </Button>
                </div>
                <div className="text-xs text-muted-foreground pl-1">
                  This installs all {resourceLabel}s in the {category} category
                </div>
              </div>

              {/* Alternative: Install all */}
              <div className="pt-4 border-t space-y-2">
                <h4 className="text-sm font-semibold text-muted-foreground">Or install all {resourceLabel}s:</h4>
                <div className="flex items-center justify-between p-2 bg-muted/50 rounded font-mono text-xs">
                  <span className="min-w-0 wrap-anywhere">{pluginCommands.installBundle}</span>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-6 px-2 ml-2 shrink-0"
                    onClick={() => handleCopyCommand(pluginCommands.installBundle, 'bundle')}
                  >
                    {copiedCommand === 'bundle' ? (
                      <Check className="h-3 w-3 text-green-600" />
                    ) : (
                      <Copy className="h-3 w-3" />
                    )}
                  </Button>
                </div>
              </div>

              {/* Copy all commands */}
              <div className="pt-4 border-t">
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={handleCopyAllCommands}
                >
                  {copiedCommand === 'all' ? (
                    <>
                      <Check className="h-4 w-4 mr-2 text-green-600" />
                      Copied all commands!
                    </>
                  ) : (
                    <>
                      <Copy className="h-4 w-4 mr-2" />
                      Copy all commands
                    </>
                  )}
                </Button>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="markdown" className="flex-1 overflow-auto">
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Copy the markdown content to manually install this single {resourceLabel}:
              </p>

              <div className="relative">
                <pre className="p-4 bg-muted rounded-lg overflow-auto max-h-[400px] text-sm">
                  <code>{markdownContent}</code>
                </pre>
              </div>

              <div className="text-xs text-muted-foreground">
                Save to: <code className="bg-muted px-1 rounded">~/.claude/{resourceType === 'subagent' ? 'agents' : 'commands'}/{resourceName}.md</code>
              </div>

              <Button
                variant="outline"
                className="w-full"
                onClick={handleCopyMarkdown}
              >
                {copiedMarkdown ? (
                  <>
                    <Check className="h-4 w-4 mr-2 text-green-600" />
                    Copied markdown!
                  </>
                ) : (
                  <>
                    <Copy className="h-4 w-4 mr-2" />
                    Copy markdown content
                  </>
                )}
              </Button>
            </div>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  )
}
