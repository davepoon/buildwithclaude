'use client'

import Link from 'next/link'
import type { Story } from '@/lib/stories-types'
import { Wallpaper, CoverGlyph, CategoryTag, PlatformTag, StoryMeta } from './primitives'

interface StoryCardProps {
  story: Story
  density?: 'roomy' | 'compact'
  showCover?: boolean
  layout?: 'vertical' | 'horizontal'
}

const TARGET_LABEL: Record<string, string> = {
  plugin: 'plugin',
  skill: 'skill',
  hook: 'hook',
  subagent: 'subagent',
  command: 'command',
  'mcp-server': 'MCP server',
}

export function StoryCard({
  story,
  density = 'roomy',
  showCover = true,
  layout = 'vertical',
}: StoryCardProps) {
  const isCompact = density === 'compact'
  const padding = isCompact ? 16 : 22
  const titleSize = isCompact ? 19 : 22

  return (
    <Link
      href={`/stories/${story.slug}`}
      className="story-card-link"
      style={{ textDecoration: 'none', color: 'inherit', display: 'block', height: '100%' }}
    >
      <article
        style={{
          background: 'hsl(0 0% 7%)',
          border: '1px solid hsl(0 0% 13%)',
          borderRadius: 12,
          overflow: 'hidden',
          transition: 'border-color 0.2s, transform 0.2s',
          display: 'flex',
          flexDirection: layout === 'horizontal' ? 'row' : 'column',
          height: '100%',
        }}
        onMouseEnter={e => {
          e.currentTarget.style.borderColor = 'hsl(18 55% 48% / 0.4)'
        }}
        onMouseLeave={e => {
          e.currentTarget.style.borderColor = 'hsl(0 0% 13%)'
        }}
      >
        {showCover && (
          <div
            style={{
              position: 'relative',
              width: layout === 'horizontal' ? 220 : '100%',
              aspectRatio: layout === 'horizontal' ? undefined : '16/9',
              height: layout === 'horizontal' ? 'auto' : undefined,
              flexShrink: 0,
              borderRight: layout === 'horizontal' ? '1px solid hsl(0 0% 13%)' : undefined,
              borderBottom: layout === 'horizontal' ? undefined : '1px solid hsl(0 0% 13%)',
              overflow: 'hidden',
            }}
          >
            {story.coverImage ? (
              <>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={story.coverImage}
                  alt={story.coverAlt ?? story.title}
                  style={{
                    width: '100%',
                    height: '100%',
                    objectFit: 'cover',
                    display: 'block',
                  }}
                />
                <div style={{ position: 'absolute', top: 12, left: 12, display: 'flex', gap: 6 }}>
                  <CategoryTag category={story.category} />
                </div>
              </>
            ) : (
              <Wallpaper palette={story.cover}>
                <div
                  style={{
                    position: 'absolute',
                    inset: 0,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <CoverGlyph category={story.category} palette={story.cover} />
                </div>
                <div style={{ position: 'absolute', top: 12, left: 12, display: 'flex', gap: 6 }}>
                  <CategoryTag category={story.category} />
                </div>
              </Wallpaper>
            )}
          </div>
        )}
        <div
          style={{
            padding,
            display: 'flex',
            flexDirection: 'column',
            gap: isCompact ? 10 : 14,
            flex: 1,
            minWidth: 0,
          }}
        >
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {!showCover && <CategoryTag category={story.category} />}
            {story.platforms.map(p => (
              <PlatformTag key={p} name={p} />
            ))}
          </div>

          <h3
            style={{
              fontFamily: 'var(--font-serif)',
              fontSize: titleSize,
              lineHeight: 1.2,
              letterSpacing: '-0.015em',
              color: 'hsl(0 0% 98%)',
              margin: 0,
              fontWeight: 400,
              textWrap: 'balance',
            }}
          >
            {story.title}
          </h3>

          {!isCompact && (
            <p
              style={{
                fontSize: 14,
                lineHeight: 1.55,
                color: 'hsl(0 0% 60%)',
                margin: 0,
                display: '-webkit-box',
                WebkitLineClamp: 2,
                WebkitBoxOrient: 'vertical',
                overflow: 'hidden',
                textWrap: 'pretty',
              }}
            >
              {story.excerpt}
            </p>
          )}

          <span
            style={{
              fontSize: 12,
              color: 'hsl(18 55% 65%)',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              width: 'fit-content',
            }}
          >
            <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.2">
              <path d="M3 8h10M9 4l4 4-4 4" />
            </svg>
            {TARGET_LABEL[story.target.kind] ?? story.target.kind}
            {' · '}
            <span style={{ fontFamily: 'var(--font-mono)', color: 'hsl(0 0% 80%)' }}>
              {story.target.name}
            </span>
          </span>

          <div style={{ marginTop: 'auto', paddingTop: isCompact ? 4 : 8 }}>
            <StoryMeta story={story} size={isCompact ? 22 : 26} />
          </div>
        </div>
      </article>
    </Link>
  )
}
