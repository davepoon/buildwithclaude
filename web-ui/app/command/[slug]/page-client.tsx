'use client'

import { Fragment, useState } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { ArrowLeft, Copy, Download, Check, ExternalLink } from 'lucide-react'
import { generateCommandMarkdown } from '@/lib/utils'
import { generateCategoryDisplayName, type Command } from '@/lib/commands-types'
import { generatePluginCommands, getMarketplaceAddCommand } from '@/lib/plugin-utils'

interface CommandPageClientProps {
  command: Command
}

export function CommandPageClient({ command }: CommandPageClientProps) {
  const [copied, setCopied] = useState(false)
  const [copiedCommand, setCopiedCommand] = useState<string | null>(null)

  const categoryName = generateCategoryDisplayName(command.category)
  const commandName = `/${command.slug.replace(/-/g, '_')}`
  const pluginCommands = generatePluginCommands('command', command.category)
  const marketplaceAdd = getMarketplaceAddCommand()

  const handleCopy = async () => {
    const markdown = generateCommandMarkdown(command)
    await navigator.clipboard.writeText(markdown)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const handleDownload = () => {
    const markdown = generateCommandMarkdown(command)
    const blob = new Blob([markdown], { type: 'text/markdown' })
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${command.slug}.md`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    window.URL.revokeObjectURL(url)
  }

  const lines = command.content.split('\n')
  const formattedContent = lines.map((line, i) => {
    if (line.startsWith('## ')) {
      return <h2 key={i} className="text-xl font-medium mt-6 mb-3">{line.replace('## ', '')}</h2>
    }
    if (line.startsWith('### ')) {
      return <h3 key={i} className="text-lg font-medium mt-4 mb-2">{line.replace('### ', '')}</h3>
    }
    if (line.startsWith('# ')) {
      return <h1 key={i} className="text-2xl font-medium mt-6 mb-3">{line.replace('# ', '')}</h1>
    }
    if (line.startsWith('- ')) {
      return <li key={i} className="ml-6 list-disc">{line.replace('- ', '')}</li>
    }
    if (/^\d+\. /.test(line)) {
      return <li key={i} className="ml-6 list-decimal">{line.replace(/^\d+\. /, '')}</li>
    }
    if (line.startsWith('```')) {
      return <div key={i} className="font-mono text-sm bg-muted p-2 rounded my-2">{line}</div>
    }
    if (line.includes('`')) {
      const parts = line.split('`')
      return (
        <p key={i} className="mb-3">
          {parts.map((part, j) =>
            j % 2 === 0 ? part : <code key={j} className="bg-muted px-1 rounded text-sm">{part}</code>
          )}
        </p>
      )
    }
    if (line.trim()) {
      return <p key={i} className="mb-3">{line}</p>
    }
    return <br key={i} />
  })

  return (
    <div className="min-h-screen">
      <div className="container mx-auto px-4 py-12 max-w-3xl">
        {/* Back */}
        <Link href="/commands" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground -mt-1 py-1 mb-7">
          <ArrowLeft className="h-4 w-4" />
          Back to Commands
        </Link>

        {/* Header */}
        <div className="mb-10">
          <div className="flex items-start justify-between gap-4 mb-4">
            <h1 className="text-display-2 font-mono min-w-0 wrap-break-word">
              {commandName.split('_').map((part, i, parts) => (
                <Fragment key={i}>{part}{i < parts.length - 1 && <>_<wbr /></>}</Fragment>
              ))}
            </h1>
            <div className="flex gap-2 shrink-0">
              <Button size="sm" variant="ghost" onClick={handleCopy}>
                {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
              </Button>
              <Button size="sm" variant="ghost" onClick={handleDownload}>
                <Download className="h-4 w-4" />
              </Button>
            </div>
          </div>
          <p className="text-sm text-muted-foreground mb-3">{categoryName}</p>
          <p className="text-lg text-muted-foreground mb-4">{command.description}</p>
          {command.argumentHint && (
            <p className="text-sm text-muted-foreground">
              <span className="font-medium">Arguments:</span> <code className="bg-muted px-2 py-1 rounded">{command.argumentHint}</code>
            </p>
          )}
        </div>

        {/* About Slash Commands */}
        <div className="mb-10 p-4 bg-card rounded-lg border border-border">
          <h3 className="text-sm font-medium mb-2">About Slash Commands</h3>
          <p className="text-sm text-muted-foreground">
            Type the command in Claude Code to trigger it.
            Some commands accept arguments (shown as <code className="bg-muted px-1 rounded">&lt;arg&gt;</code>).
            Commands run specialized workflows or prompts to help with specific tasks.
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
                <span className="break-all">{marketplaceAdd}</span>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={async () => {
                    await navigator.clipboard.writeText(marketplaceAdd)
                    setCopiedCommand('marketplace')
                    setTimeout(() => setCopiedCommand(null), 2000)
                  }}
                >
                  {copiedCommand === 'marketplace' ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                </Button>
              </div>
            </div>
            <div>
              <p className="text-sm text-muted-foreground mb-2">
                Step 2: Install the {categoryName} commands
              </p>
              <div className="bg-card rounded-lg p-4 font-mono text-sm flex items-center justify-between border border-border">
                <span className="break-all">{pluginCommands.install}</span>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={async () => {
                    await navigator.clipboard.writeText(pluginCommands.install)
                    setCopiedCommand('install')
                    setTimeout(() => setCopiedCommand(null), 2000)
                  }}
                >
                  {copiedCommand === 'install' ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                </Button>
              </div>
            </div>
          </div>
        </div>

        {/* Usage */}
        <div className="mb-10">
          <h2 className="text-lg font-medium mb-4">Usage</h2>
          <div className="bg-card rounded-lg p-4 border border-border">
            <code className="text-sm wrap-break-word">{commandName} {command.argumentHint || ''}</code>
          </div>
        </div>

        {/* Content */}
        <div className="mb-10">
          <h2 className="text-lg font-medium mb-4">Command Instructions</h2>
          <div className="bg-card rounded-lg p-6 border border-border prose prose-sm max-w-none wrap-break-word">
            {formattedContent}
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-3 flex-wrap">
          <a
            href={`https://github.com/davepoon/buildwithclaude/blob/main/commands/${command.slug}.md`}
            target="_blank"
            rel="noopener noreferrer"
          >
            <Button className="gap-2">
              <ExternalLink className="h-4 w-4" />
              View on GitHub
            </Button>
          </a>
          <Link href="/commands">
            <Button variant="outline">Browse More</Button>
          </Link>
        </div>
      </div>
    </div>
  )
}
