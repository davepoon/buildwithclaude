'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { Check, Copy, Download, FileArchive } from 'lucide-react'
import { generateCategoryDisplayName } from '@/lib/hooks-types'
import {
  generateHookConfigString,
  generateHookZipBundle,
  extractScriptFromContent,
  isSimpleScript
} from '@/lib/hook-utils'
import type { Hook } from '@/lib/hooks-types'

interface HookCardProps {
  hook: Hook
}

export function HookCard({ hook }: HookCardProps) {
  const [copied, setCopied] = useState(false)
  const [downloading, setDownloading] = useState(false)

  const categoryName = generateCategoryDisplayName(hook.category)

  // Determine if hook needs ZIP (complex script)
  const script = hook.script || extractScriptFromContent(hook.content)
  const needsZip = script ? !isSimpleScript(script) : false

  const handleCopy = async (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    const configJson = generateHookConfigString(hook)
    await navigator.clipboard.writeText(configJson)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const handleDownload = async (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
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
        const configJson = generateHookConfigString(hook)
        const blob = new Blob([configJson], { type: 'application/json' })
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

  return (
    <Link href={`/hook/${hook.slug}`}>
      <div className="p-5 rounded-lg border border-border hover:border-primary/40 transition-colors h-full flex flex-col bg-card">
        <div className="mb-3">
          <h3 className="font-medium mb-1">{hook.name}</h3>
          <div className="flex flex-wrap items-center gap-2">
            <span className="px-2 py-0.5 rounded-full bg-muted text-xs text-muted-foreground">{categoryName}</span>
            <span className="px-2 py-0.5 rounded-full bg-muted text-xs text-muted-foreground font-mono">{hook.event}</span>
          </div>
        </div>

        <p className="text-sm text-muted-foreground line-clamp-2 flex-1 mb-3">
          {hook.description}
        </p>

        {hook.matcher && hook.matcher !== '*' && (
          <p className="text-xs text-muted-foreground/70 font-mono mb-4 truncate">
            {hook.matcher}
          </p>
        )}

        <TooltipProvider>
          <div className="flex gap-2">
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
              <TooltipContent>Copy JSON config</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7 px-2 text-xs text-muted-foreground hover:text-foreground"
                  onClick={handleDownload}
                  disabled={downloading}
                >
                  {needsZip ? (
                    <FileArchive className="h-3 w-3 mr-1" />
                  ) : (
                    <Download className="h-3 w-3 mr-1" />
                  )}
                  {downloading ? '...' : needsZip ? 'ZIP' : 'Download'}
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                {needsZip ? 'Download ZIP with config and script' : 'Download JSON config'}
              </TooltipContent>
            </Tooltip>
          </div>
        </TooltipProvider>
      </div>
    </Link>
  )
}
