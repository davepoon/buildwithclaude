'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { Check, Copy, Star, ExternalLink, Package, Sparkles } from 'lucide-react'
import type { MarketplaceRegistry } from '@/lib/marketplace-types'

interface MarketplaceRegistryItemProps {
  marketplace: MarketplaceRegistry
}

function formatNumber(num: number): string {
  if (num >= 1_000_000) return `${(num / 1_000_000).toFixed(1)}M`
  if (num >= 1_000) return `${(num / 1_000).toFixed(1)}k`
  return num.toLocaleString()
}

export function MarketplaceRegistryItem({ marketplace }: MarketplaceRegistryItemProps) {
  const [copied, setCopied] = useState(false)

  const handleCopy = async (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    await navigator.clipboard.writeText(marketplace.installCommand)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="p-5 rounded-lg border border-border hover:border-primary/40 transition-all hover:shadow-sm bg-card">
      {/* Header: Name + Stats */}
      <div className="flex items-start justify-between gap-4 mb-2">
        <div className="flex items-center gap-2 min-w-0">
          <Package className="h-5 w-5 text-primary shrink-0" />
          <h3 className="font-medium truncate">{marketplace.displayName}</h3>
        </div>
        <div className="flex items-center gap-2 shrink-0 flex-wrap">
          <span className="flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium bg-primary/10 text-primary">
            <Package className="h-3.5 w-3.5" />
            {formatNumber(marketplace.pluginCount)}
          </span>
          {marketplace.skillCount > 0 && (
            <span className="flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium bg-yellow-500/10 text-yellow-500">
              <Sparkles className="h-3.5 w-3.5" />
              {formatNumber(marketplace.skillCount)}
            </span>
          )}
          {marketplace.stars !== undefined && marketplace.stars > 0 && (
            <span className="flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium bg-amber-500/10 text-amber-500">
              <Star className="h-3.5 w-3.5" />
              {formatNumber(marketplace.stars)}
            </span>
          )}
        </div>
      </div>

      {/* Repository link */}
      <a
        href={marketplace.repository}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-1 -mt-1 py-1 mb-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
        onClick={(e) => e.stopPropagation()}
      >
        <ExternalLink className="h-3 w-3" />
        {marketplace.maintainer.github}/{marketplace.name}
      </a>

      {/* Categories */}
      {marketplace.categories.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-3">
          {marketplace.categories.map((category) => (
            <span
              key={category}
              className="px-2 py-0.5 rounded-full bg-muted text-xs text-muted-foreground"
            >
              {category}
            </span>
          ))}
        </div>
      )}

      {/* Description */}
      <p className="text-sm text-muted-foreground line-clamp-2 mb-4">
        {marketplace.description}
      </p>

      {/* Install command */}
      <div className="flex items-center gap-2 bg-zinc-900 rounded-md px-3 py-2">
        <code className="text-xs text-zinc-300 flex-1 truncate font-mono">
          <span className="text-zinc-500">$</span> {marketplace.installCommand}
        </code>
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                size="sm"
                variant="ghost"
                className="h-6 w-6 p-0 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800"
                onClick={handleCopy}
              >
                {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
              </Button>
            </TooltipTrigger>
            <TooltipContent>{copied ? 'Copied!' : 'Copy command'}</TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>

      {/* Website link */}
      <div className="mt-3 flex justify-end">
        <a
          href={marketplace.url}
          target="_blank"
          rel="noopener noreferrer"
          className="text-sm text-primary hover:underline inline-flex items-center gap-1 py-1 -my-1"
          onClick={(e) => e.stopPropagation()}
        >
          Visit website
          <ExternalLink className="h-3 w-3" />
        </a>
      </div>
    </div>
  )
}
