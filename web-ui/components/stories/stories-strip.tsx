import Link from 'next/link'
import type { Story } from '@/lib/stories-types'
import { StoryCard } from './story-card'

interface StoriesStripProps {
  stories: Story[]
}

export function StoriesStrip({ stories }: StoriesStripProps) {
  if (stories.length === 0) return null

  return (
    <section style={{ padding: '72px 0 56px' }} className="border-t border-border">
      <div className="container mx-auto px-4" style={{ maxWidth: 1280 }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'flex-end',
            justifyContent: 'space-between',
            marginBottom: 28,
            gap: 24,
            flexWrap: 'wrap',
          }}
        >
          <div style={{ maxWidth: 580 }}>
            <div
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 8,
                fontSize: 11,
                letterSpacing: '0.14em',
                textTransform: 'uppercase',
                color: 'hsl(18 55% 60%)',
                marginBottom: 12,
                fontWeight: 500,
              }}
            >
              <span
                style={{
                  width: 6,
                  height: 6,
                  borderRadius: 999,
                  background: 'hsl(18 55% 60%)',
                }}
              />
              Stories from the community
            </div>
            <h2
              style={{
                fontFamily: 'var(--font-serif)',
                fontSize: 'clamp(28px, 4vw, 40px)',
                lineHeight: 1.15,
                letterSpacing: '-0.02em',
                color: 'hsl(0 0% 98%)',
                margin: 0,
                fontWeight: 400,
                textWrap: 'balance',
              }}
            >
              How builders are using Claude.
            </h2>
            <p
              style={{
                marginTop: 12,
                fontSize: 15,
                lineHeight: 1.55,
                color: 'hsl(0 0% 60%)',
                maxWidth: 520,
                textWrap: 'pretty',
              }}
            >
              Real posts from plugin and skill authors about how they shipped, what they learned, and what they&apos;d do differently.
            </p>
          </div>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
            <Link
              href="/contribute"
              style={{
                padding: '8px 16px',
                fontSize: 13,
                fontWeight: 500,
                borderRadius: 999,
                color: 'hsl(0 0% 98%)',
                background: 'hsl(18 55% 48%)',
                border: 'none',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                whiteSpace: 'nowrap',
                textDecoration: 'none',
              }}
            >
              Share your story
              <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M3 8h10M9 4l4 4-4 4" />
              </svg>
            </Link>
            <Link
              href="/stories"
              style={{
                padding: '8px 16px',
                fontSize: 13,
                fontWeight: 500,
                borderRadius: 999,
                color: 'hsl(0 0% 80%)',
                background: 'transparent',
                border: '1px solid hsl(0 0% 18%)',
                whiteSpace: 'nowrap',
                textDecoration: 'none',
              }}
            >
              All stories
            </Link>
          </div>
        </div>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
            gap: 20,
          }}
          className="stories-strip-grid"
        >
          {stories.slice(0, 3).map(s => (
            <StoryCard key={s.slug} story={s} density="roomy" />
          ))}
        </div>
      </div>
    </section>
  )
}
