import Link from 'next/link'
import type { ReactNode } from 'react'

/**
 * Lightweight markdown renderer for story bodies. Supports paragraphs (with a
 * drop cap on the first one), headings, lists, blockquotes, fenced code blocks,
 * images, and inline links / code / bold. No external dependency, so it stays
 * in step with the editorial styling the story article already uses.
 *
 * Links: in-app paths (starting with "/") render as Next <Link>; everything
 * else opens in a new tab. Relative image names resolve into the story folder.
 */

const accent = 'hsl(18 55% 62%)'

const linkStyle = {
  color: accent,
  textDecoration: 'underline',
  textUnderlineOffset: 3,
  textDecorationThickness: 1,
} as const

const inlineCodeStyle = {
  fontFamily: 'var(--font-mono)',
  fontSize: '0.88em',
  background: 'hsl(0 0% 12%)',
  border: '1px solid hsl(0 0% 18%)',
  borderRadius: 5,
  padding: '1px 6px',
  color: 'hsl(0 0% 88%)',
} as const

function resolveStoryImage(src: string, slug: string): string | null {
  const s = src.trim()
  if (/^(javascript|data|vbscript|file):/i.test(s)) return null
  if (/^https?:\/\//i.test(s)) return s
  if (s.startsWith('/')) return s
  return `/stories/${slug}/${s.replace(/^\.?\//, '')}`
}

/** Parse inline links, `code`, and **bold** within a run of text. */
function renderInline(text: string, kp: string): ReactNode[] {
  const nodes: ReactNode[] = []
  const re = /\[([^\]]+)\]\(([^)\s]+)\)|`([^`]+)`|\*\*([^*]+)\*\*/g
  let last = 0
  let i = 0
  let m: RegExpExecArray | null
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) nodes.push(text.slice(last, m.index))
    if (m[1] !== undefined) {
      const label = m[1]
      const href = m[2]
      const internal = href.startsWith('/') && !href.startsWith('//')
      const external = /^(https?:|mailto:)/i.test(href)
      if (internal) {
        nodes.push(<Link key={`${kp}-${i}`} href={href} style={linkStyle}>{label}</Link>)
      } else if (external) {
        nodes.push(<a key={`${kp}-${i}`} href={href} target="_blank" rel="noopener noreferrer" style={linkStyle}>{label}</a>)
      } else {
        // Unsafe scheme (javascript:, data:, etc.) — render the label as plain text.
        nodes.push(label)
      }
    } else if (m[3] !== undefined) {
      nodes.push(<code key={`${kp}-${i}`} style={inlineCodeStyle}>{m[3]}</code>)
    } else if (m[4] !== undefined) {
      nodes.push(<strong key={`${kp}-${i}`} style={{ fontWeight: 600, color: 'hsl(0 0% 94%)' }}>{m[4]}</strong>)
    }
    last = re.lastIndex
    i++
  }
  if (last < text.length) nodes.push(text.slice(last))
  return nodes
}

type Block =
  | { type: 'paragraph'; text: string }
  | { type: 'heading'; level: 2 | 3; text: string }
  | { type: 'list'; ordered: boolean; items: string[] }
  | { type: 'quote'; text: string }
  | { type: 'code'; lang: string; text: string }
  | { type: 'image'; alt: string; src: string }

const IMAGE_LINE = /^!\[([^\]]*)\]\(\s*([^)\s]+)(?:\s+"[^"]*")?\s*\)$/
const SPECIAL = (l: string) =>
  l.startsWith('```') || /^#{2,3}\s/.test(l) || /^(-|\d+\.)\s/.test(l) || l.startsWith('> ') || IMAGE_LINE.test(l)

function tokenize(content: string): Block[] {
  const lines = content.split('\n')
  const blocks: Block[] = []
  let i = 0
  while (i < lines.length) {
    const line = lines[i].trim()
    if (line === '') { i++; continue }

    if (line.startsWith('```')) {
      const lang = line.slice(3).trim()
      const buf: string[] = []
      i++
      while (i < lines.length && !lines[i].trim().startsWith('```')) { buf.push(lines[i]); i++ }
      i++ // closing fence
      blocks.push({ type: 'code', lang, text: buf.join('\n') })
      continue
    }
    const img = line.match(IMAGE_LINE)
    if (img) { blocks.push({ type: 'image', alt: img[1], src: img[2] }); i++; continue }
    if (/^#{2,3}\s/.test(line)) {
      blocks.push({ type: 'heading', level: line.startsWith('### ') ? 3 : 2, text: line.replace(/^#{2,3}\s/, '') })
      i++; continue
    }
    if (/^(-|\d+\.)\s/.test(line)) {
      const ordered = /^\d+\.\s/.test(line)
      const items: string[] = []
      while (i < lines.length && /^(-|\d+\.)\s/.test(lines[i].trim())) {
        items.push(lines[i].trim().replace(/^(-|\d+\.)\s/, '')); i++
      }
      blocks.push({ type: 'list', ordered, items })
      continue
    }
    if (line.startsWith('> ')) {
      const buf: string[] = []
      while (i < lines.length && lines[i].trim().startsWith('>')) { buf.push(lines[i].trim().replace(/^>\s?/, '')); i++ }
      blocks.push({ type: 'quote', text: buf.join(' ') })
      continue
    }
    const buf: string[] = []
    while (i < lines.length && lines[i].trim() !== '' && !SPECIAL(lines[i].trim())) { buf.push(lines[i].trim()); i++ }
    blocks.push({ type: 'paragraph', text: buf.join(' ') })
  }
  return blocks
}

interface StoryContentProps {
  content: string
  slug: string
  pullQuote?: string
}

export function StoryContent({ content, slug, pullQuote }: StoryContentProps) {
  const blocks = tokenize(content)
  let firstParagraphSeen = false
  const out: ReactNode[] = []

  blocks.forEach((block, i) => {
    const k = `b-${i}`
    switch (block.type) {
      case 'paragraph': {
        const isLede = !firstParagraphSeen
        firstParagraphSeen = true
        if (isLede) {
          const first = block.text.charAt(0)
          out.push(
            <p key={k} style={{ fontSize: 21, lineHeight: 1.75, color: 'hsl(0 0% 90%)', margin: '0 0 26px', textWrap: 'pretty' }}>
              <span style={{ fontFamily: 'var(--font-serif)', float: 'left', fontSize: 72, lineHeight: 0.85, paddingTop: 8, paddingRight: 12, color: accent }}>{first}</span>
              {renderInline(block.text.slice(1), k)}
            </p>,
          )
          if (pullQuote) {
            out.push(
              <blockquote key={`${k}-pq`} style={{ borderLeft: `2px solid ${accent}`, padding: '8px 24px', margin: '30px 0', fontFamily: 'var(--font-serif)', fontSize: 22, lineHeight: 1.4, fontStyle: 'italic', color: 'hsl(0 0% 92%)' }}>
                &ldquo;{pullQuote}&rdquo;
              </blockquote>,
            )
          }
        } else {
          out.push(
            <p key={k} style={{ fontSize: 19, lineHeight: 1.75, color: 'hsl(0 0% 85%)', margin: '0 0 24px', textWrap: 'pretty' }}>
              {renderInline(block.text, k)}
            </p>,
          )
        }
        break
      }
      case 'heading': {
        const size = block.level === 2 ? 28 : 22
        out.push(
          <h2 key={k} style={{ fontFamily: 'var(--font-serif)', fontWeight: 400, fontSize: size, lineHeight: 1.2, color: 'hsl(0 0% 96%)', letterSpacing: '-0.01em', margin: '40px 0 14px' }}>
            {renderInline(block.text, k)}
          </h2>,
        )
        break
      }
      case 'list': {
        const Tag = block.ordered ? 'ol' : 'ul'
        out.push(
          <Tag key={k} style={{ margin: '0 0 24px', paddingLeft: 26, color: 'hsl(0 0% 85%)', fontSize: 19, lineHeight: 1.7 }}>
            {block.items.map((it, j) => (
              <li key={j} style={{ margin: '0 0 8px' }}>{renderInline(it, `${k}-${j}`)}</li>
            ))}
          </Tag>,
        )
        break
      }
      case 'quote': {
        out.push(
          <blockquote key={k} style={{ borderLeft: `2px solid ${accent}`, padding: '8px 24px', margin: '30px 0', fontFamily: 'var(--font-serif)', fontSize: 22, lineHeight: 1.4, fontStyle: 'italic', color: 'hsl(0 0% 92%)' }}>
            {renderInline(block.text, k)}
          </blockquote>,
        )
        break
      }
      case 'code': {
        out.push(
          <pre key={k} style={{ margin: '0 0 24px', padding: '16px 18px', background: 'hsl(0 0% 8%)', border: '1px solid hsl(0 0% 16%)', borderRadius: 10, overflow: 'auto', fontSize: 13.5, lineHeight: 1.6 }}>
            <code style={{ fontFamily: 'var(--font-mono)', color: 'hsl(0 0% 86%)', whiteSpace: 'pre' }}>{block.text}</code>
          </pre>,
        )
        break
      }
      case 'image': {
        const src = resolveStoryImage(block.src, slug)
        if (src) {
          out.push(
            <figure key={k} style={{ margin: '32px 0' }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={src} alt={block.alt} style={{ width: '100%', height: 'auto', borderRadius: 12, border: '1px solid hsl(0 0% 14%)', display: 'block' }} />
              {block.alt && (
                <figcaption style={{ marginTop: 10, fontSize: 13, color: 'hsl(0 0% 55%)', textAlign: 'center' }}>{block.alt}</figcaption>
              )}
            </figure>,
          )
        }
        break
      }
    }
  })

  return <>{out}</>
}
