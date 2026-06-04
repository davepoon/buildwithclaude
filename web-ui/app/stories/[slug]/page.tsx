import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { getAllStories, getStoryBySlug } from '@/lib/stories-server'
import { Wallpaper, CoverGlyph, Avatar, CategoryTag, PlatformTag } from '@/components/stories/primitives'
import { StoryCard } from '@/components/stories/story-card'
import { StoryContent } from '@/components/stories/story-content'

interface StoryPageProps {
  params: Promise<{ slug: string }>
}

// Byline links sit over the cover image, so keep them white with a faint underline.
const authorLinkStyle = {
  color: 'inherit',
  textDecoration: 'underline',
  textDecorationColor: 'rgba(255,255,255,0.4)',
  textUnderlineOffset: 3,
} as const

export const dynamicParams = false

export async function generateStaticParams() {
  return getAllStories().map(s => ({ slug: s.slug }))
}

export async function generateMetadata({ params }: StoryPageProps): Promise<Metadata> {
  const { slug } = await params
  const story = getStoryBySlug(slug)
  if (!story) return { title: 'Story not found' }
  return {
    title: `${story.title} — Build with Claude`,
    description: story.excerpt,
  }
}

export default async function StoryPage({ params }: StoryPageProps) {
  const { slug } = await params
  const story = getStoryBySlug(slug)
  if (!story) notFound()

  const allStories = getAllStories()
  const related = allStories
    .filter(s => s.slug !== story.slug &&
      (s.category === story.category || s.platforms.some(p => story.platforms.includes(p))))
    .slice(0, 3)

  return (
    <article>
      <section style={{ position: 'relative' }}>
        <div
          style={{
            position: 'absolute',
            inset: '0 0 auto 0',
            height: 480,
            overflow: 'hidden',
          }}
        >
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
                    'linear-gradient(to bottom, rgba(10,10,10,0.62) 0%, rgba(10,10,10,0.48) 48%, rgba(10,10,10,0.74) 86%, hsl(0 0% 4%) 100%)',
                }}
              />
            </>
          ) : (
            <Wallpaper palette={story.cover}>
              <div
                style={{
                  position: 'absolute',
                  inset: 0,
                  background:
                    'linear-gradient(to bottom, rgba(10,10,10,0.62) 0%, rgba(10,10,10,0.48) 48%, rgba(10,10,10,0.74) 86%, hsl(0 0% 4%) 100%)',
                }}
              />
            </Wallpaper>
          )}
        </div>

        <div
          className="container mx-auto px-4"
          style={{
            maxWidth: 760,
            position: 'relative',
            paddingTop: 80,
            paddingBottom: 56,
          }}
        >
          <Link
            href="/stories"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              fontSize: 12,
              color: 'rgba(255,255,255,0.7)',
              background: 'rgba(0,0,0,0.4)',
              border: '1px solid rgba(255,255,255,0.15)',
              borderRadius: 999,
              padding: '6px 14px',
              backdropFilter: 'blur(8px)',
              marginBottom: 28,
              textDecoration: 'none',
            }}
          >
            <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M13 8H3M7 4L3 8l4 4" />
            </svg>
            All stories
          </Link>

          <div style={{ display: 'flex', gap: 8, marginBottom: 22, flexWrap: 'wrap' }}>
            <CategoryTag category={story.category} />
            {story.platforms.map(p => <PlatformTag key={p} name={p} />)}
          </div>

          <h1
            style={{
              fontFamily: 'var(--font-serif)',
              fontSize: 'clamp(36px, 5vw, 56px)',
              lineHeight: 1.05,
              letterSpacing: '-0.02em',
              color: 'white',
              margin: 0,
              fontWeight: 400,
              textWrap: 'balance',
              textShadow: '0 1px 2px rgba(0,0,0,0.4), 0 4px 28px rgba(0,0,0,0.55)',
            }}
          >
            {story.title}
          </h1>

          <p
            style={{
              marginTop: 20,
              fontSize: 19,
              lineHeight: 1.5,
              color: 'rgba(255,255,255,0.88)',
              fontFamily: 'var(--font-serif)',
              fontStyle: 'italic',
              textWrap: 'pretty',
              maxWidth: 640,
              textShadow: '0 1px 14px rgba(0,0,0,0.5)',
            }}
          >
            {story.excerpt}
          </p>

          <div
            style={{
              marginTop: 36,
              paddingTop: 28,
              borderTop: '1px solid rgba(255,255,255,0.1)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: 16,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
              <Avatar author={story.author} size={44} />
              <div>
                <div style={{ fontSize: 14, fontWeight: 500, color: 'white', textShadow: '0 1px 8px rgba(0,0,0,0.55)' }}>
                  {story.author.url ? (
                    <a href={story.author.url} target="_blank" rel="noopener noreferrer" style={authorLinkStyle}>{story.author.name}</a>
                  ) : (
                    story.author.name
                  )}
                </div>
                <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.7)', textShadow: '0 1px 8px rgba(0,0,0,0.55)' }}>
                  {story.author.social ? (
                    <a href={story.author.social} target="_blank" rel="noopener noreferrer" style={authorLinkStyle}>@{story.author.handle}</a>
                  ) : (
                    <>@{story.author.handle}</>
                  )}
                  {' · '}{story.date} · {story.readTime} min read
                </div>
              </div>
            </div>
            <Link
              href={story.target.href}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 8,
                padding: '8px 14px',
                fontSize: 13,
                borderRadius: 8,
                background: 'rgba(255,255,255,0.08)',
                border: '1px solid rgba(255,255,255,0.15)',
                color: 'white',
                textDecoration: 'none',
                backdropFilter: 'blur(8px)',
              }}
            >
              <span style={{ color: 'rgba(255,255,255,0.6)', fontSize: 12 }}>{story.target.kind}</span>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 13 }}>
                {story.target.name}
              </span>
              <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M6 3h7v7M13 3L4 12" />
              </svg>
            </Link>
          </div>
        </div>
      </section>

      <section>
        <div className="container mx-auto px-4" style={{ maxWidth: 680, padding: '32px 16px 80px' }}>
          <StoryContent content={story.content} slug={story.slug} pullQuote={story.pullQuote} />


          <div
            style={{
              marginTop: 40,
              padding: 24,
              borderRadius: 12,
              background: 'hsl(0 0% 7%)',
              border: '1px solid hsl(0 0% 14%)',
              display: 'flex',
              gap: 18,
              alignItems: 'center',
            }}
          >
            <div
              style={{
                width: 56,
                height: 56,
                borderRadius: 12,
                flexShrink: 0,
                overflow: 'hidden',
                border: '1px solid hsl(0 0% 14%)',
              }}
            >
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
                  <div style={{ transform: 'scale(0.5)' }}>
                    <CoverGlyph category={story.category} palette={story.cover} />
                  </div>
                </div>
              </Wallpaper>
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div
                style={{
                  fontSize: 11,
                  color: 'hsl(0 0% 50%)',
                  letterSpacing: '0.08em',
                  textTransform: 'uppercase',
                  marginBottom: 4,
                }}
              >
                Featured {story.target.kind}
              </div>
              <div
                style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: 16,
                  color: 'hsl(0 0% 95%)',
                  fontWeight: 500,
                }}
              >
                {story.target.name}
              </div>
            </div>
            <Link
              href={story.target.href}
              style={{
                padding: '8px 16px',
                fontSize: 13,
                fontWeight: 500,
                borderRadius: 999,
                background: 'hsl(18 55% 48%)',
                color: 'white',
                textDecoration: 'none',
              }}
            >
              View
            </Link>
          </div>
        </div>
      </section>

      {related.length > 0 && (
        <section style={{ borderTop: '1px solid hsl(0 0% 12%)', padding: '60px 0 96px' }}>
          <div className="container mx-auto px-4" style={{ maxWidth: 1280 }}>
            <h2
              style={{
                fontFamily: 'var(--font-serif)',
                fontSize: 28,
                fontWeight: 400,
                color: 'hsl(0 0% 98%)',
                margin: 0,
                marginBottom: 28,
                letterSpacing: '-0.015em',
              }}
            >
              Keep reading
            </h2>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
                gap: 18,
              }}
              className="stories-related-grid"
            >
              {related.map(s => (
                <StoryCard key={s.slug} story={s} density="compact" />
              ))}
            </div>
          </div>
        </section>
      )}
    </article>
  )
}
