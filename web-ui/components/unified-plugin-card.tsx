'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { Check, Copy, Download, Github, Terminal } from 'lucide-react'
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
    // Skills always have an on-site detail page (local files + DB-imported); route
    // by the URL-safe slug, which getSkillForDetail matches against slug or name.
    case 'skill': return `/skill/${plugin.slug || plugin.name}`
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
  return `curl -sL https://buildwithclaude.com/api/skills/${name}/download -o /tmp/${name}.zip && unzip -o /tmp/${name}.zip -d ~/.claude/skills/ && rm /tmp/${name}.zip`
}

export function UnifiedPluginCard({ plugin }: UnifiedPluginCardProps) {
  const [copied, setCopied] = useState(false)
  const [copiedClaw, setCopiedClaw] = useState(false)
  const [copiedInstall, setCopiedInstall] = useState(false)
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

  const handleDownload = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    window.location.href = `/api/skills/${plugin.name}/download`
  }

  const handleOpenRepo = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (githubUrl) {
      window.open(githubUrl, '_blank')
    }
  }

  const handleCopyInstall = async (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    await navigator.clipboard.writeText(`npx skills add davepoon/buildwithclaude -s ${plugin.name}`)
    setCopiedInstall(true)
    setTimeout(() => setCopiedInstall(false), 2000)
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
          {(plugin.type === 'plugin' || plugin.type === 'skill') && plugin.category && plugin.category !== 'uncategorized' ? (
            // Show the category (the "kind") instead of the type label — skills keep
            // the skill (yellow) accent, plugins keep purple.
            <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${plugin.type === 'skill' ? getTypeBadgeClasses('skill') : 'bg-purple-500/10 text-purple-500'}`}>
              {formatCategoryName(plugin.category)}
            </span>
          ) : (
            // Fallback to the type badge for uncategorized items.
            <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${getTypeBadgeClasses(plugin.type)}`}>
              {typeLabels[plugin.type]}
            </span>
          )}
          {plugin.marketplaceName && (
            <span className="px-2 py-0.5 rounded-full bg-indigo-500/10 text-xs text-indigo-500 font-medium truncate max-w-[140px]">
              {plugin.marketplaceName}
            </span>
          )}
          {typeof plugin.installs === 'number' && plugin.installs > 0 && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-muted text-xs text-muted-foreground font-medium">
              <Download className="h-3 w-3" />
              {plugin.installs.toLocaleString()}
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
          {plugin.type === 'skill' && !isExternal ? (
            <>
              {/* Install Skill (npx skills) */}
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7 px-2 text-xs text-muted-foreground hover:text-foreground"
                    onClick={handleCopyInstall}
                  >
                    {copiedInstall ? <Check className="h-3 w-3 mr-1" /> : <Copy className="h-3 w-3 mr-1" />}
                    {copiedInstall ? 'Copied' : 'Install Skill'}
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Copy: npx skills add davepoon/buildwithclaude -s {plugin.name}</TooltipContent>
              </Tooltip>
              {/* Download */}
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7 px-2 text-xs text-muted-foreground hover:text-foreground"
                    onClick={handleDownload}
                  >
                    <Download className="h-3 w-3 mr-1" />
                    Download
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Download skill zip</TooltipContent>
              </Tooltip>
              {/* OpenClaw */}
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
            </>
          ) : (
            <>
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
            </>
          )}
        </div>
      </TooltipProvider>
    </div>
  )

  // Skills always resolve to our on-site detail page (which itself links out to
  // the source repo for imported skills). Other external plugins still link out.
  if (isExternal && plugin.type !== 'skill') {
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
