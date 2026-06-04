'use client'

import { useState, useEffect } from 'react'
import { ArrowRight, Sparkles, X } from 'lucide-react'
import Link from 'next/link'

const STORAGE_KEY = 'create-marketplace-banner-dismissed'

interface CreateMarketplaceBannerProps {
  /** Reserved for future variants; only 'marketplace' is supported. */
  variant?: 'marketplace'
  /** When false, the banner can't be dismissed and always renders. Default true. */
  dismissible?: boolean
}

/**
 * Banner inviting maintainers to publish a marketplace.json so their plugins get
 * indexed. (Skill submission is no longer manual — skills are auto-synced from
 * skills.sh + the GitHub crawl — so this banner is marketplace-only.)
 */
export function CreateMarketplaceBanner({ dismissible = true }: CreateMarketplaceBannerProps) {
  // When dismissible, start hidden to avoid a flash before the localStorage check.
  const [isDismissed, setIsDismissed] = useState(dismissible)
  const [isVisible, setIsVisible] = useState(true)

  useEffect(() => {
    if (!dismissible) return
    const dismissed = localStorage.getItem(STORAGE_KEY)
    setIsDismissed(dismissed === 'true')
  }, [dismissible])

  const handleDismiss = () => {
    setIsVisible(false)
    setTimeout(() => {
      setIsDismissed(true)
      localStorage.setItem(STORAGE_KEY, 'true')
    }, 300)
  }

  if (dismissible && isDismissed) return null

  return (
    <div
      className={`group relative overflow-hidden rounded-xl border border-primary/20 bg-gradient-to-br from-primary/5 via-transparent to-primary/10 p-6 mb-8 transition-all duration-300 hover:border-primary/40 hover:shadow-[0_0_40px_-12px_hsl(18,55%,48%,0.3)] ${
        isVisible ? 'opacity-100' : 'opacity-0'
      }`}
    >
      {/* Close button (hidden when the banner is non-dismissible) */}
      {dismissible && (
        <button
          onClick={handleDismiss}
          className="absolute top-3 right-3 p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-primary/10 transition-colors z-10"
          aria-label="Dismiss banner"
        >
          <X className="h-4 w-4" />
        </button>
      )}

      {/* Decorative corner accent */}
      <div className="absolute -top-12 -right-12 h-32 w-32 rounded-full bg-primary/10 blur-2xl transition-transform duration-700 group-hover:scale-150" />
      <div className="absolute bottom-0 left-0 h-px w-1/3 bg-gradient-to-r from-primary/50 to-transparent" />

      <div className="relative pr-8">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-2">
              <Sparkles className="h-4 w-4 text-primary animate-pulse" />
              <span className="text-xs font-medium uppercase tracking-wider text-primary">
                Get Discovered
              </span>
            </div>
            <h3 className="text-lg font-serif tracking-tight mb-1">
              Create Your Own Marketplace
            </h3>
            <p className="text-sm text-muted-foreground max-w-md">
              Add a{' '}
              <code className="px-1.5 py-0.5 rounded bg-primary/10 text-primary text-xs font-mono">
                marketplace.json
              </code>{' '}
              to your GitHub repo. We&apos;ll automatically index your plugins for thousands of
              developers to discover.
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
    </div>
  )
}
