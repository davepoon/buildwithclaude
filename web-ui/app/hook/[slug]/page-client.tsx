'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { ArrowLeft, Copy, Download, Check, ExternalLink, FileArchive } from 'lucide-react'
import {
  generateHookConfigString,
  generateHookZipBundle,
  extractScriptFromContent,
  isSimpleScript
} from '@/lib/hook-utils'
import { generateCategoryDisplayName, type Hook } from '@/lib/hooks-types'

interface HookPageClientProps {
  hook: Hook
}

export function HookPageClient({ hook }: HookPageClientProps) {
  const [copied, setCopied] = useState(false)
  const [copiedConfig, setCopiedConfig] = useState(false)
  const [downloading, setDownloading] = useState(false)

  const categoryName = generateCategoryDisplayName(hook.category)

  // Determine if hook needs ZIP (complex script)
  const script = hook.script || extractScriptFromContent(hook.content)
  const needsZip = script ? !isSimpleScript(script) : false

  // Generate the JSON config string
  const configString = generateHookConfigString(hook)

  const handleCopy = async () => {
    await navigator.clipboard.writeText(configString)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const handleCopyConfig = async () => {
    await navigator.clipboard.writeText(configString)
    setCopiedConfig(true)
    setTimeout(() => setCopiedConfig(false), 2000)
  }

  const handleDownload = async () => {
    setDownloading(true)

    try {
      if (needsZip) {
        // Download as ZIP bundle
        const blob = await generateHookZipBundle(hook)
        const url = window.URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `${hook.slug}-hook.zip`
        document.body.appendChild(a)
        a.click()
        document.body.removeChild(a)
        window.URL.revokeObjectURL(url)
      } else {
        // Download as JSON file only
        const blob = new Blob([configString], { type: 'application/json' })
        const url = window.URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `${hook.slug}-hook.json`
        document.body.appendChild(a)
        a.click()
        document.body.removeChild(a)
        window.URL.revokeObjectURL(url)
      }
    } finally {
      setDownloading(false)
    }
  }

  const lines = hook.content.split('\n')
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
        <Link href="/hooks" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground -mt-1 py-1 mb-7">
          <ArrowLeft className="h-4 w-4" />
          Back to Hooks
        </Link>

        {/* Header */}
        <div className="mb-10">
          <div className="flex items-start justify-between gap-4 mb-4">
            <h1 className="text-display-2 min-w-0 wrap-break-word">{hook.name}</h1>
            <div className="flex gap-2 shrink-0">
              <Button size="sm" variant="ghost" onClick={handleCopy} title="Copy JSON config">
                {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={handleDownload}
                disabled={downloading}
                title={needsZip ? 'Download ZIP with config and script' : 'Download JSON config'}
              >
                {needsZip ? <FileArchive className="h-4 w-4" /> : <Download className="h-4 w-4" />}
              </Button>
            </div>
          </div>
          <div className="flex items-center gap-2 text-sm text-muted-foreground mb-3">
            <span>{categoryName}</span>
            <span>·</span>
            <span className="font-mono">{hook.event}</span>
          </div>
          <p className="text-lg text-muted-foreground mb-4">{hook.description}</p>

          <div className="text-sm text-muted-foreground">
            <span className="font-medium">Matcher:</span>{' '}
            <code className="bg-muted px-2 py-1 rounded font-mono">{hook.matcher}</code>
          </div>
        </div>

        {/* Configuration */}
        <div className="mb-10">
          <h2 className="text-lg font-medium mb-4">Configuration</h2>
          <p className="text-sm text-muted-foreground mb-2">
            Add to your <code className="bg-muted px-1 rounded">.claude/settings.json</code>:
          </p>
          <div className="relative bg-card rounded-lg border border-border">
            <pre className="p-4 font-mono text-sm overflow-x-auto">
              {configString}
            </pre>
            <Button
              size="sm"
              variant="ghost"
              className="absolute top-2 right-2"
              onClick={handleCopyConfig}
            >
              {copiedConfig ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
            </Button>
          </div>

          {needsZip && (
            <div className="mt-4 p-3 bg-amber-500/10 rounded border border-amber-500/20">
              <p className="text-sm text-amber-600 dark:text-amber-400">
                This hook includes a script file. Download the ZIP bundle for complete installation with script and instructions.
              </p>
            </div>
          )}
        </div>

        {/* Content */}
        <div className="mb-10">
          <h2 className="text-lg font-medium mb-4">Hook Details</h2>
          <div className="bg-card rounded-lg p-6 border border-border prose prose-sm max-w-none wrap-break-word">
            {formattedContent}
          </div>
        </div>

        {/* Event Info */}
        <div className="mb-10 p-4 bg-card rounded-lg border border-border">
          <h3 className="text-sm font-medium mb-2">About {hook.event} Hooks</h3>
          <p className="text-sm text-muted-foreground">
            {hook.event === 'PostToolUse' && 'PostToolUse hooks run after a tool completes execution. They can modify the result or trigger additional actions.'}
            {hook.event === 'PreToolUse' && 'PreToolUse hooks run before a tool executes. They can validate, modify, or block the tool call.'}
            {hook.event === 'Stop' && 'Stop hooks run when Claude Code finishes its response. They can perform cleanup or final actions.'}
            {hook.event === 'Notification' && 'Notification hooks run when Claude Code sends a notification. They can customize how notifications are displayed.'}
            {hook.event === 'SessionStart' && 'SessionStart hooks run when Claude Code starts a new session. They can perform initialization tasks.'}
            {hook.event === 'SessionEnd' && 'SessionEnd hooks run when Claude Code ends a session. They can perform cleanup tasks.'}
            {hook.event === 'UserPromptSubmit' && 'UserPromptSubmit hooks run when the user submits a prompt. They can modify or validate the input.'}
            {hook.event === 'PreCompact' && 'PreCompact hooks run before Claude Code compacts the conversation. They can preserve important context.'}
            {hook.event === 'SubagentStop' && 'SubagentStop hooks run when a subagent task completes. They can process or log results.'}
          </p>
        </div>

        {/* Actions */}
        <div className="flex gap-3 flex-wrap">
          <a
            href={`https://github.com/davepoon/buildwithclaude/blob/main/plugins/all-hooks/hooks/${hook.slug}.md`}
            target="_blank"
            rel="noopener noreferrer"
          >
            <Button className="gap-2">
              <ExternalLink className="h-4 w-4" />
              View on GitHub
            </Button>
          </a>
          <Link href="/hooks">
            <Button variant="outline">Browse More</Button>
          </Link>
        </div>
      </div>
    </div>
  )
}
