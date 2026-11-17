'use client'

import { useEffect, useRef } from 'react'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'

// The ad tag from the Carbon dashboard, unmodified (placement policy: no self-hosting, no edits).
const CARBON_SRC = '//cdn.carbonads.com/carbon.js?serve=CWBI65Q7&placement=buildwithclaudecom&format=cover'

/**
 * The page's single Carbon ad (cover format, 400px wide at most). Render it once per page.
 * A new ad is requested on each client-side navigation, which the policy allows for SPAs.
 */
export function CarbonAd({ className }: { className?: string }) {
  const slot = useRef<HTMLDivElement>(null)
  const pathname = usePathname()

  useEffect(() => {
    const el = slot.current
    if (!el) return
    // Deferred so React's development double-mount doesn't request two ads.
    const timer = setTimeout(() => {
      const script = document.createElement('script')
      script.src = CARBON_SRC
      script.async = true
      script.id = '_carbonads_js'
      el.appendChild(script)
    })
    return () => {
      clearTimeout(timer)
      el.replaceChildren()
    }
  }, [pathname])

  // min-height is the cover's height at full width, reserved so nothing shifts when the ad arrives.
  // Under 360px the cover turns into a tall stacked card, so on phones the slot borrows 10px from each page gutter.
  return (
    <div
      ref={slot}
      className={cn('carbon-ad min-h-[260px] w-full max-w-[400px] max-[419px]:-mx-2.5 max-[419px]:w-[calc(100%+1.25rem)]', className)}
    />
  )
}

/** Add to the container of a single-column detail page that renders <CarbonAdRail />: the rail is positioned against it. */
export const AD_RAIL_CONTAINER = 'relative'

/**
 * The ad for detail pages. On wide screens it rests in the bottom right corner of the window, in the
 * margin beside the centered content, and stays there while the page scrolls: visible on load (Carbon's
 * placement policy) without sitting next to the title. It takes the margin's width, up to the ad's full
 * 400px, so the content column never moves. Otherwise it is an in-flow block where it sits in the markup.
 * `column` is the page container's max width.
 */
export function CarbonAdRail({ column = '48rem' }: { column?: string }) {
  return (
    <div
      className="mb-10 xl:absolute xl:inset-y-12 xl:left-full xl:mb-0 xl:ml-6 xl:flex xl:w-[min(400px,calc((100vw-var(--column))/2-3rem))] xl:flex-col xl:justify-end"
      style={{ '--column': column } as React.CSSProperties}
    >
      {/* flex + justify-end: a short ad rests on the bottom of its reserved space, not the top */}
      <CarbonAd className="xl:sticky xl:bottom-6 xl:flex xl:flex-col xl:justify-end" />
    </div>
  )
}
