import type { CSSProperties, ReactNode } from 'react'
import type { Story, StoryCategory, StoryCover } from '@/lib/stories-types'

export const COVER_GRADIENTS: Record<StoryCover, { from: string; to: string; accent: string }> = {
  brown:  { from: '#3a2520', to: '#1f1310', accent: '#c96a50' },
  blue:   { from: '#1f2a3a', to: '#101620', accent: '#5a8fc9' },
  green:  { from: '#1f2f25', to: '#101a14', accent: '#6ab089' },
  purple: { from: '#2a1f3a', to: '#161020', accent: '#9a7ac9' },
}

const NOISE_SVG_URL = 'data:image/svg+xml;utf8,' + encodeURIComponent(
  `<svg xmlns='http://www.w3.org/2000/svg' width='180' height='180'>
    <filter id='n'>
      <feTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='2' seed='3' stitchTiles='stitch'/>
      <feColorMatrix values='0 0 0 0 1  0 0 0 0 1  0 0 0 0 1  0 0 0 0.32 0'/>
    </filter>
    <rect width='100%' height='100%' filter='url(#n)' opacity='0.55'/>
  </svg>`
)

interface WallpaperProps {
  palette?: StoryCover
  children?: ReactNode
  style?: CSSProperties
  className?: string
}

export function Wallpaper({ palette = 'brown', children, style, className }: WallpaperProps) {
  const c = COVER_GRADIENTS[palette] ?? COVER_GRADIENTS.brown
  return (
    <div
      className={className}
      style={{
        position: 'relative',
        width: '100%',
        height: '100%',
        background: `linear-gradient(160deg, ${c.from} 0%, ${c.to} 100%)`,
        overflow: 'hidden',
        ...style,
      }}
    >
      <div
        style={{
          position: 'absolute',
          inset: 0,
          backgroundImage: `url("${NOISE_SVG_URL}")`,
          backgroundSize: '180px 180px',
          mixBlendMode: 'overlay',
          opacity: 0.65,
        }}
      />
      <div
        style={{
          position: 'absolute',
          top: '-30%',
          right: '-15%',
          width: '70%',
          height: '120%',
          background: `radial-gradient(ellipse at center, ${c.accent}33 0%, transparent 60%)`,
          pointerEvents: 'none',
        }}
      />
      {children}
    </div>
  )
}

interface CoverGlyphProps {
  category: StoryCategory | string
  palette?: StoryCover
}

export function CoverGlyph({ category, palette = 'brown' }: CoverGlyphProps) {
  const c = COVER_GRADIENTS[palette] ?? COVER_GRADIENTS.brown
  const stroke = c.accent
  const common = {
    width: 88,
    height: 88,
    fill: 'none',
    stroke,
    strokeWidth: 1,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    opacity: 0.85,
  }
  switch (category) {
    case 'Plugins':
      return (
        <svg viewBox="0 0 24 24" {...common}>
          <path d="M5 7h6V3h2v4h6v6h-4v8H9v-8H5z" />
          <circle cx="12" cy="12" r="1.2" fill={stroke} stroke="none" />
        </svg>
      )
    case 'Skills':
      return (
        <svg viewBox="0 0 24 24" {...common}>
          <path d="M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M5.6 18.4l2.1-2.1M16.3 7.7l2.1-2.1" />
          <circle cx="12" cy="12" r="3" />
        </svg>
      )
    case 'Hooks':
      return (
        <svg viewBox="0 0 24 24" {...common}>
          <path d="M12 3v8a4 4 0 0 1-4 4H4" />
          <circle cx="12" cy="3" r="1.4" fill={stroke} stroke="none" />
          <path d="M4 11v8M20 11v8M16 7v12" />
        </svg>
      )
    case 'Subagents':
      return (
        <svg viewBox="0 0 24 24" {...common}>
          <rect x="4" y="7" width="16" height="12" rx="2" />
          <circle cx="9" cy="13" r="1.2" fill={stroke} stroke="none" />
          <circle cx="15" cy="13" r="1.2" fill={stroke} stroke="none" />
          <path d="M12 3v4M9 19l-2 2M15 19l2 2" />
        </svg>
      )
    case 'Commands':
      return (
        <svg viewBox="0 0 24 24" {...common}>
          <rect x="3" y="5" width="18" height="14" rx="2" />
          <path d="M7 10l3 2-3 2M12 14h5" />
        </svg>
      )
    default:
      return (
        <svg viewBox="0 0 24 24" {...common}>
          <circle cx="12" cy="12" r="6" />
          <path d="M12 6v6l4 2" />
        </svg>
      )
  }
}

interface AvatarProps {
  author: { name: string; avatarHue?: number }
  size?: number
}

export function Avatar({ author, size = 32 }: AvatarProps) {
  const h = author.avatarHue ?? 28
  const initials = author.name.split(' ').map(w => w[0]).slice(0, 2).join('')
  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: 999,
        background: `linear-gradient(135deg, hsl(${h} 45% 55%) 0%, hsl(${(h + 30) % 360} 40% 35%) 100%)`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: 'rgba(255,255,255,0.92)',
        fontSize: size * 0.36,
        fontWeight: 600,
        letterSpacing: '0.02em',
        fontFamily: 'var(--font-sans)',
        flexShrink: 0,
      }}
    >
      {initials}
    </div>
  )
}

const CATEGORY_COLORS: Record<StoryCategory, { c: string; bg: string }> = {
  Plugins:   { c: 'hsl(280 50% 65%)', bg: 'hsl(280 50% 55% / 0.10)' },
  Skills:    { c: 'hsl(45 75% 60%)',  bg: 'hsl(45 75% 55% / 0.10)' },
  Subagents: { c: 'hsl(210 65% 65%)', bg: 'hsl(210 65% 55% / 0.10)' },
  Commands:  { c: 'hsl(145 50% 60%)', bg: 'hsl(145 50% 50% / 0.10)' },
  Hooks:     { c: 'hsl(20 70% 65%)',  bg: 'hsl(20 70% 55% / 0.10)' },
}

export function CategoryTag({ category }: { category: StoryCategory | string }) {
  const s = CATEGORY_COLORS[category as StoryCategory] ?? CATEGORY_COLORS.Plugins
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        padding: '3px 9px',
        fontSize: 11,
        fontWeight: 500,
        letterSpacing: '0.01em',
        borderRadius: 999,
        color: s.c,
        background: s.bg,
        whiteSpace: 'nowrap',
      }}
    >
      {category}
    </span>
  )
}

export function PlatformTag({ name }: { name: string }) {
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        padding: '3px 8px',
        fontSize: 11,
        fontWeight: 400,
        letterSpacing: '0.01em',
        borderRadius: 4,
        color: 'hsl(0 0% 65%)',
        background: 'hsl(0 0% 10%)',
        border: '1px solid hsl(0 0% 16%)',
        whiteSpace: 'nowrap',
      }}
    >
      {name}
    </span>
  )
}

interface StoryMetaProps {
  story: Story
  showAvatar?: boolean
  size?: number
}

export function StoryMeta({ story, showAvatar = true, size = 26 }: StoryMetaProps) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 12, color: 'hsl(0 0% 60%)' }}>
      {showAvatar && <Avatar author={story.author} size={size} />}
      <span style={{ color: 'hsl(0 0% 80%)', fontWeight: 500 }}>{story.author.name}</span>
      <span style={{ color: 'hsl(0 0% 30%)' }}>·</span>
      <span>{story.date}</span>
      <span style={{ color: 'hsl(0 0% 30%)' }}>·</span>
      <span>{story.readTime} min read</span>
    </div>
  )
}
