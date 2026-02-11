'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { Check, Copy, Github, Terminal } from 'lucide-react'
import type { UnifiedPlugin } from '@/lib/plugin-types'

interface UnifiedPluginCardProps {
  plugin: UnifiedPlugin
}

const typeLabels: Record<string, string> = {
  subagent: 'Subagent',
  command: 'Command',
  hook: 'Hook',
  skill: 'Skill',
  plugin: 'Plugin',
}

function formatCategoryName(name: string): string {
  return name
    .split('-')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ')
}

function getTypeBadgeClasses(type: string): string {
  switch (type) {
    case 'subagent':
      return 'bg-blue-500/10 text-blue-500'
    case 'command':
      return 'bg-green-500/10 text-green-500'
    case 'hook':
      return 'bg-orange-500/10 text-orange-500'
    case 'skill':
      return 'bg-yellow-500/10 text-yellow-500'
    case 'plugin':
      return 'bg-purple-500/10 text-purple-500'
    default:
      return 'bg-muted text-muted-foreground'
  }
}

function isExternalPlugin(plugin: UnifiedPlugin): boolean {
  // Build with Claude plugins are always internal (even when loaded from DB without file path)
  if (plugin.marketplaceName === 'Build with Claude') return false
  // External plugins have a repository URL and no local file path
  return !!plugin.repository && !plugin.file
}

function getInstallCommand(plugin: UnifiedPlugin): string {
  // Use installCommand from DB if available
  if (plugin.installCommand) return plugin.installCommand
  // For actual plugins (type='plugin'), use the plugin name directly
  if (plugin.type === 'plugin') {
    return `/plugin install ${plugin.name}@buildwithclaude`
  }
  // Build install command based on type and category (parent plugin)
  const prefix = plugin.type === 'subagent' ? 'agents'
    : plugin.type === 'command' ? 'commands'
    : plugin.type === 'hook' ? 'hooks'
    : plugin.type === 'skill' ? 'all-skills'
    : 'plugins'
  return `/plugin install ${prefix}-${plugin.category}@buildwithclaude`
}

function getDetailUrl(plugin: UnifiedPlugin): string {
  switch (plugin.type) {
    case 'subagent': return `/subagent/${plugin.name}`
    case 'command': return `/command/${plugin.name}`
    case 'hook': return `/hook/${plugin.name}`
    case 'skill': return `/skill/${plugin.name}`
    case 'plugin':
      // Build with Claude plugins have internal detail pages
      if (plugin.marketplaceName === 'Build with Claude') {
        return `/plugin/${plugin.name}`
      }
      // External plugins link to their repository
      return plugin.repository || '#'
    default: return '#'
  }
}

function getOpenClawCommand(plugin: UnifiedPlugin): string {
  const name = plugin.name
  if (plugin.marketplaceName === 'Build with Claude') {
    return `mkdir -p ~/.openclaw/skills/${name} && curl -sL https://raw.githubusercontent.com/davepoon/buildwithclaude/main/plugins/all-skills/skills/${name}/SKILL.md -o ~/.openclaw/skills/${name}/SKILL.md`
  }
  // For external marketplace skills with a repository
  if (plugin.repository) {
    const repoUrl = plugin.repository.replace('github.com', 'raw.githubusercontent.com').replace(/\/$/, '')
    return `mkdir -p ~/.openclaw/skills/${name} && curl -sL ${repoUrl}/main/skills/${name}/SKILL.md -o ~/.openclaw/skills/${name}/SKILL.md`
  }
  return `mkdir -p ~/.openclaw/skills/${name} && curl -sL <SKILL.md URL> -o ~/.openclaw/skills/${name}/SKILL.md`
}

export function UnifiedPluginCard({ plugin }: UnifiedPluginCardProps) {
  const [copied, setCopied] = useState(false)
  const [copiedClaw, setCopiedClaw] = useState(false)
  const isExternal = isExternalPlugin(plugin)

  const githubUrl = plugin.file
    ? `https://github.com/davepoon/buildwithclaude/tree/main/${plugin.file}`
    : plugin.repository || 'https://github.com/davepoon/buildwithclaude'

  const handleCopy = async (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    const cmd = getInstallCommand(plugin)
    await navigator.clipboard.writeText(cmd)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const handleOpenRepo = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (githubUrl) {
      window.open(githubUrl, '_blank')
    }
  }

  const handleCopyOpenClaw = async (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    const cmd = getOpenClawCommand(plugin)
    await navigator.clipboard.writeText(cmd)
    setCopiedClaw(true)
    setTimeout(() => setCopiedClaw(false), 2000)
  }

  const cardContent = (
    <div className="p-5 rounded-lg border border-border hover:border-primary/40 transition-colors h-full flex flex-col bg-card">
      {/* Header: Name + Type Badge + Marketplace Badge */}
      <div className="mb-3">
        <h3 className="font-medium mb-1">{plugin.name}</h3>
        <div className="flex flex-wrap items-center gap-1">
          {plugin.type === 'plugin' && plugin.category && plugin.category !== 'uncategorized' ? (
            // Show category badge for plugins
            <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-purple-500/10 text-purple-500">
              {formatCategoryName(plugin.category)}
            </span>
          ) : (
            // Show type badge for non-plugins or uncategorized plugins
            <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${getTypeBadgeClasses(plugin.type)}`}>
              {typeLabels[plugin.type]}
            </span>
          )}
          {plugin.marketplaceName && (
            <span className="px-2 py-0.5 rounded-full bg-indigo-500/10 text-xs text-indigo-500 font-medium truncate max-w-[140px]">
              {plugin.marketplaceName}
            </span>
          )}
        </div>
      </div>

      {/* Description */}
      <p className="text-sm text-muted-foreground line-clamp-2 flex-1 mb-3">
        {plugin.description}
      </p>

      {/* Action Buttons */}
      <TooltipProvider>
        <div className="flex gap-2">
          {!isExternal && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7 px-2 text-xs text-muted-foreground hover:text-foreground"
                  onClick={handleCopy}
                >
                  {copied ? <Check className="h-3 w-3 mr-1" /> : <Copy className="h-3 w-3 mr-1" />}
                  {copied ? 'Copied' : 'Copy'}
                </Button>
              </TooltipTrigger>
              <TooltipContent>Copy install command</TooltipContent>
            </Tooltip>
          )}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                size="sm"
                variant="ghost"
                className="h-7 px-2 text-xs text-muted-foreground hover:text-foreground"
                onClick={handleOpenRepo}
              >
                <Github className="h-3 w-3 mr-1" />
                GitHub
              </Button>
            </TooltipTrigger>
            <TooltipContent>View on GitHub</TooltipContent>
          </Tooltip>
          {plugin.type === 'skill' && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7 px-2 text-xs text-muted-foreground hover:text-foreground"
                  onClick={handleCopyOpenClaw}
                >
                  {copiedClaw ? <Check className="h-3 w-3 mr-1" /> : <Terminal className="h-3 w-3 mr-1" />}
                  {copiedClaw ? 'Copied' : 'OpenClaw'}
                </Button>
              </TooltipTrigger>
              <TooltipContent>Copy OpenClaw install command</TooltipContent>
            </Tooltip>
          )}
        </div>
      </TooltipProvider>
    </div>
  )

  // Use Link for internal plugins, <a> for external
  if (isExternal) {
    return (
      <a href={plugin.repository || '#'} target="_blank" rel="noopener noreferrer">
        {cardContent}
      </a>
    )
  }

  return (
    <Link href={getDetailUrl(plugin)}>
      {cardContent}
    </Link>
  )
}
