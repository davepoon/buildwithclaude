'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { Monitor } from 'lucide-react'
import { FilterBar, CategoryFilter, SingleSelectFilter } from '@/components/filter-controls'
import type { Story } from '@/lib/stories-types'
import { StoryCard } from '@/components/stories/story-card'
import { FeaturedHero } from '@/components/stories/featured-hero'

const CATEGORIES = ['Plugins', 'Skills', 'Subagents', 'Commands', 'Hooks'] as const
const PLATFORMS = ['Claude Code', 'Claude Desktop', 'Agent SDK', 'OpenClaw'] as const

interface StoriesIndexClientProps {
  pinned: Story | null
  stories: Story[]
  guide?: Story | null
}

export function StoriesIndexClient({ pinned, stories, guide }: StoriesIndexClientProps) {
  const [category, setCategory] = useState<string>('all')
  const [platform, setPlatform] = useState<string>('all')

  const filtered = useMemo(() => {
    return stories.filter(s => {
      if (category !== 'all' && s.category !== category) return false
      if (platform !== 'all' && !s.platforms.includes(platform)) return false
      return true
    })
  }, [stories, category, platform])

  // Category and platform counts in one pass over the stories
  const { categoryOptions, platformOptions } = useMemo(() => {
    const counts = new Map<string, number>()
    const add = (key: string) => counts.set(key, (counts.get(key) ?? 0) + 1)
    for (const s of stories) {
      add(`c:${s.category}`)
      for (const p of s.platforms) add(`p:${p}`)
    }
    return {
      categoryOptions: CATEGORIES.map(c => ({ value: c, label: c, count: counts.get(`c:${c}`) ?? 0 })),
      platformOptions: PLATFORMS.map(p => ({ value: p, label: p, count: counts.get(`p:${p}`) ?? 0 })),
    }
  }, [stories])

  return (
    <div>
      <section style={{ padding: '64px 0 32px' }}>
        <div className="container mx-auto px-4" style={{ maxWidth: 1280 }}>
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 8,
              fontSize: 11,
              letterSpacing: '0.14em',
              textTransform: 'uppercase',
              color: 'hsl(18 55% 60%)',
              marginBottom: 16,
              fontWeight: 500,
            }}
          >
            <span style={{ width: 6, height: 6, borderRadius: 999, background: 'hsl(18 55% 60%)' }} />
            Community stories
          </div>
          <div className="stories-index-header">
            <h1
              style={{
                fontFamily: 'var(--font-serif)',
                fontSize: 'clamp(40px, 5vw, 60px)',
                lineHeight: 1.05,
                letterSpacing: '-0.02em',
                color: 'hsl(0 0% 98%)',
                margin: 0,
                fontWeight: 400,
              }}
            >
              Posts from people who actually shipped something.
            </h1>
            <div>
              <p
                style={{
                  marginTop: 20,
                  fontSize: 15,
                  lineHeight: 1.6,
                  color: 'hsl(0 0% 65%)',
                  marginBottom: 18,
                  textWrap: 'pretty',
                }}
              >
                Plugin authors, skill writers, and the occasional hook obsessive — sharing how they built it and what they learned.
              </p>
              <Link
                href="/contribute"
                style={{
                  padding: '10px 18px',
                  fontSize: 13,
                  fontWeight: 500,
                  borderRadius: 999,
                  background: 'hsl(18 55% 48%)',
                  color: 'white',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 8,
                  whiteSpace: 'nowrap',
                  textDecoration: 'none',
                }}
              >
                Share your story
                <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <path d="M3 8h10M9 4l4 4-4 4" />
                </svg>
              </Link>
            </div>
          </div>
        </div>
      </section>

      {guide && (
        <section style={{ padding: '8px 0 0' }}>
          <div className="container mx-auto px-4" style={{ maxWidth: 1280 }}>
            <Link
              href={`/stories/${guide.slug}`}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 16,
                padding: '14px 20px',
                borderRadius: 12,
                background:
                  'linear-gradient(90deg, hsl(18 55% 48% / 0.12) 0%, hsl(18 55% 48% / 0.04) 100%)',
                border: '1px solid hsl(18 55% 48% / 0.3)',
                color: 'inherit',
                textDecoration: 'none',
                flexWrap: 'wrap',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 14, minWidth: 0 }}>
                <div
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: 10,
                    flexShrink: 0,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    background: 'hsl(18 55% 48% / 0.18)',
                    border: '1px solid hsl(18 55% 48% / 0.3)',
                    color: 'hsl(18 70% 70%)',
                  }}
                >
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
                    <path d="M8 1.5v13M1.5 8h13" />
                  </svg>
                </div>
                <div style={{ minWidth: 0 }}>
                  <div
                    style={{
                      fontSize: 11,
                      letterSpacing: '0.12em',
                      textTransform: 'uppercase',
                      color: 'hsl(18 70% 70%)',
                      fontWeight: 500,
                      marginBottom: 2,
                    }}
                  >
                    Share your story
                  </div>
                  <div style={{ fontSize: 14, color: 'hsl(0 0% 90%)' }}>
                    First time writing for Build with Claude? Read{' '}
                    <span
                      style={{
                        fontFamily: 'var(--font-serif)',
                        fontStyle: 'italic',
                        color: 'white',
                      }}
                    >
                      {guide.title}
                    </span>{' '}
                    — a 4-minute walkthrough.
                  </div>
                </div>
              </div>
              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  fontSize: 13,
                  fontWeight: 500,
                  color: 'hsl(18 70% 70%)',
                  whiteSpace: 'nowrap',
                }}
              >
                Read the walkthrough
                <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <path d="M3 8h10M9 4l4 4-4 4" />
                </svg>
              </span>
            </Link>
          </div>
        </section>
      )}

      {pinned && (
        <section style={{ padding: '32px 0 8px' }}>
          <div className="container mx-auto px-4" style={{ maxWidth: 1280 }}>
            <FeaturedHero story={pinned} />
          </div>
        </section>
      )}

      <section className="md:pt-7" style={{ paddingBottom: 48 }}>
        <div className="container mx-auto px-4" style={{ maxWidth: 1280 }}>
          <FilterBar dock={false}>
            <SingleSelectFilter
              icon={Monitor}
              value={platform}
              options={platformOptions}
              allLabel="All Platforms"
              allCount={stories.length}
              placeholder="Select platform"
              searchPlaceholder="Search platforms..."
              emptyText="No platform found."
              onChange={setPlatform}
            />
            {/* Category filter, single-select */}
            <CategoryFilter
              single
              selected={category === 'all' ? [] : [category]}
              options={categoryOptions}
              onChange={(next) => setCategory(next[0] ?? 'all')}
            />
          </FilterBar>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'baseline',
              marginBottom: 24,
            }}
          >
            <p style={{ fontSize: 13, color: 'hsl(0 0% 55%)', margin: 0 }}>
              {filtered.length} {filtered.length === 1 ? 'story' : 'stories'}
              {category !== 'all' && ` in ${category}`}
              {platform !== 'all' && ` for ${platform}`}
            </p>
          </div>

          {filtered.length === 0 ? (
            <div
              style={{
                padding: 60,
                textAlign: 'center',
                border: '1px dashed hsl(0 0% 18%)',
                borderRadius: 12,
              }}
            >
              <p style={{ color: 'hsl(0 0% 55%)', margin: 0 }}>
                No stories match that combination yet.
              </p>
            </div>
          ) : (
            <div
              style={{
                display: 'grid',
                gap: 18,
              }}
              className="stories-index-grid grid-cols-1 sm:grid-cols-2"
            >
              {filtered.map(s => (
                <StoryCard key={s.slug} story={s} density="roomy" />
              ))}
            </div>
          )}
        </div>
      </section>
    </div>
  )
}
