'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { ArrowLeft, Copy, Check, ExternalLink, User, Scale, Bot, Command, Webhook, Server, ChevronRight } from 'lucide-react'
import { generateCategoryDisplayName } from '@/lib/category-utils'
import type { Plugin } from '@/lib/plugins-types'

interface PluginPageClientProps {
  plugin: Plugin
}

const SKIP_KEYWORDS = new Set([
  'agents', 'subagents', 'agent', 'subagent',
  'commands', 'command', 'slash-commands', 'slash-command',
  'hooks', 'hook', 'automation', 'notifications',
  'mcp-servers', 'mcp', 'mcp-server', 'docker',
  'claude-code', 'claude', 'plugin', 'plugins',
  'ai', 'development', 'productivity', 'utilities',
])

function extractLinkedItems(plugin: Plugin): { name: string; href: string }[] {
  const items: { name: string; href: string }[] = []
  const skipSet = new Set([...SKIP_KEYWORDS, plugin.category])

  for (const keyword of plugin.keywords) {
    const normalizedKeyword = keyword.toLowerCase()
    if (skipSet.has(normalizedKeyword)) continue

    let href = ''
    switch (plugin.category) {
      case 'agents':
        href = `/subagent/${keyword}`
        break
      case 'commands':
        href = `/command/${keyword}`
        break
      case 'hooks':
        href = `/hook/${keyword}`
        break
      case 'mcp-servers':
        href = '/mcp-servers'
        break
      default:
        continue
    }
    items.push({ name: keyword, href })
  }
  return items
}

function getLinkedItemsConfig(category: string): { icon: React.ReactNode; label: string; singularLabel: string } {
  switch (category) {
    case 'agents':
      return { icon: <Bot className="h-4 w-4" />, label: 'Included Agents', singularLabel: 'Agent' }
    case 'commands':
      return { icon: <Command className="h-4 w-4" />, label: 'Included Commands', singularLabel: 'Command' }
    case 'hooks':
      return { icon: <Webhook className="h-4 w-4" />, label: 'Included Hooks', singularLabel: 'Hook' }
    case 'mcp-servers':
      return { icon: <Server className="h-4 w-4" />, label: 'Included MCP Servers', singularLabel: 'MCP Server' }
    default:
      return { icon: null, label: 'Included Items', singularLabel: 'Item' }
  }
}

export function PluginPageClient({ plugin }: PluginPageClientProps) {
  const [copiedMarketplace, setCopiedMarketplace] = useState(false)
  const [copiedInstall, setCopiedInstall] = useState(false)

  const categoryName = generateCategoryDisplayName(plugin.category)
  const marketplaceCommand = '/plugin marketplace add davepoon/buildwithclaude'
  const installCommand = `/plugin install ${plugin.name}`

  const linkedItems = extractLinkedItems(plugin)
  const linkedItemsConfig = getLinkedItemsConfig(plugin.category)

  const linkedItemNames = new Set(linkedItems.map(item => item.name.toLowerCase()))
  const displayKeywords = plugin.keywords.filter(k => !linkedItemNames.has(k.toLowerCase()) && !SKIP_KEYWORDS.has(k.toLowerCase()))

  const handleCopyMarketplace = async () => {
    await navigator.clipboard.writeText(marketplaceCommand)
    setCopiedMarketplace(true)
    setTimeout(() => setCopiedMarketplace(false), 2000)
  }

  const handleCopyInstall = async () => {
    await navigator.clipboard.writeText(installCommand)
    setCopiedInstall(true)
    setTimeout(() => setCopiedInstall(false), 2000)
  }

  return (
    <div className="min-h-screen">
      <div className="container mx-auto px-4 py-12 max-w-3xl">
        {/* Back */}
        <Link href="/plugins" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground -mt-1 py-1 mb-7">
          <ArrowLeft className="h-4 w-4" />
          Back to Plugins
        </Link>

        {/* Header */}
        <div className="mb-10">
          <div className="flex items-baseline gap-3 mb-2">
            <h1 className="text-display-2 font-mono min-w-0 wrap-break-word">{plugin.name}</h1>
            <span className="text-sm text-muted-foreground shrink-0">v{plugin.version}</span>
          </div>
          <p className="text-sm text-muted-foreground mb-3">{categoryName}</p>
          <p className="text-lg text-muted-foreground">{plugin.description}</p>
        </div>

        {/* What are Plugins */}
        <div className="mb-10 p-4 bg-card rounded-lg border border-border">
          <h3 className="text-sm font-medium mb-2">What are Plugins?</h3>
          <p className="text-sm text-muted-foreground">
            Plugins bundle commands, agents, skills, and hooks into a single installable package.
            First add the marketplace with <code className="bg-muted px-1 rounded">/plugin marketplace add davepoon/buildwithclaude</code>,
            then install any plugin from the collection.
          </p>
        </div>

        {/* Installation */}
        <div className="mb-10">
          <h2 className="text-lg font-medium mb-4">Installation</h2>
          <div className="space-y-4">
            <div>
              <p className="text-sm text-muted-foreground mb-2">
                Step 1: Add the marketplace (one-time)
              </p>
              <div className="bg-card rounded-lg p-4 font-mono text-sm flex items-center justify-between border border-border">
                <span className="break-all">{marketplaceCommand}</span>
                <Button
                  size="sm"
                  variant="ghost"
                  className="ml-2 shrink-0"
                  onClick={handleCopyMarketplace}
                >
                  {copiedMarketplace ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                </Button>
              </div>
            </div>
            <div>
              <p className="text-sm text-muted-foreground mb-2">
                Step 2: Install this plugin
              </p>
              <div className="bg-card rounded-lg p-4 font-mono text-sm flex items-center justify-between border border-border">
                <span className="break-all">{installCommand}</span>
                <Button
                  size="sm"
                  variant="ghost"
                  className="ml-2 shrink-0"
                  onClick={handleCopyInstall}
                >
                  {copiedInstall ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                </Button>
              </div>
            </div>
          </div>
        </div>

        {/* Linked Items */}
        {linkedItems.length > 0 && (
          <div className="mb-10">
            <h2 className="text-lg font-medium mb-4 flex items-center gap-2">
              {linkedItemsConfig.icon}
              {linkedItemsConfig.label}
            </h2>
            <div className="space-y-2">
              {linkedItems.map((item) => (
                <Link
                  key={item.name}
                  href={item.href}
                  className="flex items-center justify-between p-3 bg-card rounded-lg border border-border hover:border-primary/40 transition-colors"
                >
                  <span className="font-mono text-sm">{item.name}</span>
                  <ChevronRight className="h-4 w-4 text-muted-foreground" />
                </Link>
              ))}
            </div>
          </div>
        )}

        {/* Keywords */}
        {displayKeywords.length > 0 && (
          <div className="mb-10">
            <h2 className="text-lg font-medium mb-4">Keywords</h2>
            <div className="flex flex-wrap gap-2">
              {displayKeywords.map((keyword, idx) => (
                <span
                  key={idx}
                  className="text-sm px-3 py-1 rounded-full bg-muted text-muted-foreground"
                >
                  {keyword}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Details */}
        <div className="mb-10">
          <h2 className="text-lg font-medium mb-4">Details</h2>
          <div className="space-y-3 text-sm">
            <div className="flex items-center gap-3">
              <User className="h-4 w-4 text-muted-foreground" />
              <span className="text-muted-foreground">Author:</span>
              {plugin.author.url ? (
                <a href={plugin.author.url} target="_blank" rel="noopener noreferrer" className="py-1 -my-1 text-primary hover:underline">
                  {plugin.author.name}
                </a>
              ) : (
                <span>{plugin.author.name}</span>
              )}
            </div>
            <div className="flex items-center gap-3">
              <Scale className="h-4 w-4 text-muted-foreground" />
              <span className="text-muted-foreground">License:</span>
              <span>{plugin.license}</span>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-3 flex-wrap">
          {plugin.repository && (
            <a href={plugin.repository} target="_blank" rel="noopener noreferrer">
              <Button className="gap-2">
                <ExternalLink className="h-4 w-4" />
                View on GitHub
              </Button>
            </a>
          )}
          <Link href="/plugins">
            <Button variant="outline">Browse More</Button>
          </Link>
        </div>
      </div>
    </div>
  )
}
