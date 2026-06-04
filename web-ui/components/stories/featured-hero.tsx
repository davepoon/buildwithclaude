'use client'

import Link from 'next/link'
import type { Story } from '@/lib/stories-types'
import { Wallpaper, CoverGlyph, PlatformTag, StoryMeta } from './primitives'

interface FeaturedHeroProps {
  story: Story
}

export function FeaturedHero({ story }: FeaturedHeroProps) {
  return (
    <Link
      href={`/stories/${story.slug}`}
      style={{ textDecoration: 'none', color: 'inherit', display: 'block', height: '100%' }}
    >
      <article
        style={{
          position: 'relative',
          borderRadius: 14,
          overflow: 'hidden',
          minHeight: 380,
          height: '100%',
          border: '1px solid hsl(0 0% 13%)',
          display: 'flex',
          flexDirection: 'column',
          transition: 'border-color 0.3s',
        }}
        onMouseEnter={e => {
          e.currentTarget.style.borderColor = 'hsl(18 55% 48% / 0.4)'
        }}
        onMouseLeave={e => {
          e.currentTarget.style.borderColor = 'hsl(0 0% 13%)'
        }}
      >
        <div style={{ position: 'absolute', inset: 0 }}>
          {story.coverImage ? (
            <>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={story.coverImage}
                alt={story.coverAlt ?? story.title}
                style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
              />
              <div
                style={{
                  position: 'absolute',
                  inset: 0,
                  background:
                    'linear-gradient(to top, rgba(0,0,0,0.65) 0%, rgba(0,0,0,0.2) 45%, transparent 75%)',
                }}
              />
            </>
          ) : (
            <Wallpaper palette={story.cover}>
              <div
                style={{
                  position: 'absolute',
                  inset: 0,
                  display: 'flex',
                  alignItems: 'flex-start',
                  justifyContent: 'flex-end',
                  padding: '32px 36px',
                }}
              >
                <div style={{ transform: 'scale(1.8)', opacity: 0.6 }}>
                  <CoverGlyph category={story.category} palette={story.cover} />
                </div>
              </div>
              <div
                style={{
                  position: 'absolute',
                  inset: 0,
                  background:
                    'linear-gradient(to top, rgba(0,0,0,0.65) 0%, rgba(0,0,0,0.2) 45%, transparent 75%)',
                }}
              />
            </Wallpaper>
          )}
        </div>

        <div
          style={{
            position: 'relative',
            padding: '32px 32px 28px',
            display: 'flex',
            flexDirection: 'column',
            gap: 14,
            marginTop: 'auto',
            zIndex: 1,
          }}
        >
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                padding: '3px 10px',
                fontSize: 11,
                fontWeight: 500,
                borderRadius: 999,
                color: 'hsl(18 70% 70%)',
                background: 'hsl(18 55% 48% / 0.18)',
                border: '1px solid hsl(18 55% 48% / 0.3)',
              }}
            >
              <svg width="10" height="10" viewBox="0 0 16 16" fill="currentColor">
                <path d="M8 0l2.5 5.5L16 6l-4 4 1 6-5-3-5 3 1-6L0 6l5.5-.5z" />
              </svg>
              Editor&apos;s pick
            </span>
            {story.platforms.map(p => (
              <PlatformTag key={p} name={p} />
            ))}
          </div>

          <h3
            style={{
              fontFamily: 'var(--font-serif)',
              fontSize: 'clamp(26px, 3vw, 34px)',
              lineHeight: 1.1,
              letterSpacing: '-0.02em',
              color: 'white',
              margin: 0,
              fontWeight: 400,
              textWrap: 'balance',
            }}
          >
            {story.title}
          </h3>

          <p
            style={{
              fontSize: 14,
              lineHeight: 1.6,
              color: 'rgba(255,255,255,0.75)',
              margin: 0,
              maxWidth: 480,
              display: '-webkit-box',
              WebkitLineClamp: 2,
              WebkitBoxOrient: 'vertical',
              overflow: 'hidden',
            }}
          >
            {story.excerpt}
          </p>

          <StoryMeta story={story} size={32} />
        </div>
      </article>
    </Link>
  )
}
