'use client'

import { useState, useEffect } from 'react'
import { ArrowRight, Sparkles, X } from 'lucide-react'
import Link from 'next/link'

const VARIANT_CONFIG = {
  marketplace: {
    storageKey: 'create-marketplace-banner-dismissed',
    title: 'Create Your Own Marketplace',
    description: (
      <>
        Add a{' '}
        <code className="px-1.5 py-0.5 rounded bg-primary/10 text-primary text-xs font-mono">
          marketplace.json
        </code>{' '}
        to your GitHub repo. We&apos;ll automatically index your plugins for thousands of
        developers to discover.
      </>
    ),
  },
  skill: {
    storageKey: 'create-skill-banner-dismissed',
    title: 'Share Your Skills',
    description: (
      <>
        Add skills to your{' '}
        <code className="px-1.5 py-0.5 rounded bg-primary/10 text-primary text-xs font-mono">
          marketplace.json
        </code>{' '}
        and we&apos;ll automatically index them for developers to discover.
      </>
    ),
  },
} as const

interface CreateMarketplaceBannerProps {
  variant?: 'marketplace' | 'skill'
}

export function CreateMarketplaceBanner({ variant = 'marketplace' }: CreateMarketplaceBannerProps) {
  const config = VARIANT_CONFIG[variant]
  const [isDismissed, setIsDismissed] = useState(true) // Start hidden to avoid flash
  const [isVisible, setIsVisible] = useState(true)

  useEffect(() => {
    // Check localStorage on mount
    const dismissed = localStorage.getItem(config.storageKey)
    setIsDismissed(dismissed === 'true')
  }, [config.storageKey])

  const handleDismiss = () => {
    setIsVisible(false)
    // Wait for fade animation then update state
    setTimeout(() => {
      setIsDismissed(true)
      localStorage.setItem(config.storageKey, 'true')
    }, 300)
  }

  if (isDismissed) return null

  return (
    <div
      className={`group relative overflow-hidden rounded-xl border border-primary/20 bg-gradient-to-br from-primary/5 via-transparent to-primary/10 p-6 mb-8 transition-all duration-300 hover:border-primary/40 hover:shadow-[0_0_40px_-12px_hsl(18,55%,48%,0.3)] ${
        isVisible ? 'opacity-100' : 'opacity-0'
      }`}
    >
      {/* Close button */}
      <button
        onClick={handleDismiss}
        className="absolute top-3 right-3 p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-primary/10 transition-colors z-10"
        aria-label="Dismiss banner"
      >
        <X className="h-4 w-4" />
      </button>

      {/* Decorative corner accent */}
      <div className="absolute -top-12 -right-12 h-32 w-32 rounded-full bg-primary/10 blur-2xl transition-transform duration-700 group-hover:scale-150" />
      <div className="absolute bottom-0 left-0 h-px w-1/3 bg-gradient-to-r from-primary/50 to-transparent" />

      <div className="relative flex flex-col sm:flex-row sm:items-center justify-between gap-4 pr-8">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-2">
            <Sparkles className="h-4 w-4 text-primary animate-pulse" />
            <span className="text-xs font-medium uppercase tracking-wider text-primary">
              Get Discovered
            </span>
          </div>
          <h3 className="text-lg font-serif tracking-tight mb-1">
            {config.title}
          </h3>
          <p className="text-sm text-muted-foreground max-w-md">
            {config.description}
          </p>
        </div>

        <Link
          href="https://code.claude.com/docs/en/plugin-marketplaces#create-the-marketplace-file"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-primary/10 text-primary text-sm font-medium transition-all duration-300 hover:bg-primary hover:text-primary-foreground group/btn shrink-0"
        >
          Learn how
          <ArrowRight className="h-4 w-4 transition-transform duration-300 group-hover/btn:translate-x-1" />
        </Link>
      </div>
    </div>
  )
}
