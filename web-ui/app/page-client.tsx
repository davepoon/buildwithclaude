'use client'

import { useState } from 'react'
import Link from 'next/link'
import { ArrowRight, ArrowUpRight, Bot, Check, Copy, Package, Palette, Server, Sparkles, SquareTerminal, Store, Webhook } from 'lucide-react'
import { CarbonAd } from '@/components/carbon-ad'
import { HeroSearch } from '@/components/hero-search'
import { StoriesStrip } from '@/components/stories/stories-strip'
import { ThemeCard } from '@/components/theme-card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import type { HomeTrending, TrendingItem } from '@/lib/home-trending'
import type { Story } from '@/lib/stories-types'
import type { Theme } from '@/lib/themes'

export interface Pick {
  name: string
  href: string
  description: string
}

interface HomePageClientProps {
  counts: { plugins: number; skills: number; mcp: number; subagents: number; commands: number; hooks: number; themes: number }
  trending: HomeTrending
  picks: { subagents: Pick[]; commands: Pick[]; hooks: Pick[]; plugins: Pick[]; skills: Pick[] }
  heroThemes: Array<{ name: string; preview: string }>
  featuredStories: Story[]
  featuredThemes: Theme[]
}

const MARKETPLACE_COMMAND = '/plugin marketplace add davepoon/buildwithclaude'

const COMPACT = new Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 1 })
const compact = (n: number) => COMPACT.format(n)

const KIND_ICON = { skill: Sparkles, plugin: Package, mcp: Server, marketplace: Store } as const

// One entry per ranked list: what it ranks by is stated wherever a number is shown.
const BOARDS = [
  { key: 'skills', label: 'Skills', noun: 'Skill', metric: 'Installs / week', unit: 'installs/wk', href: '/skills', all: 'All skills' },
  { key: 'marketplaces', label: 'Plugin marketplaces', noun: 'Marketplace', metric: 'GitHub stars', unit: 'stars', href: '/marketplaces', all: 'All marketplaces' },
  { key: 'mcp', label: 'MCP servers', noun: 'Server', metric: 'Docker pulls', unit: 'pulls', href: '/mcp-servers', all: 'All MCP servers' },
] as const

const focusRing = 'outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background'

/** Marketplaces have no detail page, so their rows open the repo in a new tab; everything else is an in-app link. */
function ItemLink({ href, children, ...rest }: { href: string; children: React.ReactNode; className?: string; tabIndex?: number; style?: React.CSSProperties }) {
  return href.startsWith('http') ? (
    <a href={href} target="_blank" rel="noopener noreferrer" {...rest}>
      {children}
    </a>
  ) : (
    <Link href={href} {...rest}>
      {children}
    </Link>
  )
}

function HeroBackdrop() {
  // The wavy terracotta strokes from the old hero panel, kept as a faint ground behind the search.
  return (
    <svg
      aria-hidden
      className="pointer-events-none absolute inset-x-0 top-0 h-full w-full [mask-image:radial-gradient(ellipse_75%_90%_at_50%_0%,#000_10%,transparent_72%)]"
      viewBox="0 0 1440 560"
      preserveAspectRatio="xMidYMin slice"
      fill="none"
      stroke="#c96a50"
      strokeOpacity="0.26"
    >
      <path d="M-40 70 Q180 10 360 80 T720 60 T1080 95 T1480 40" strokeWidth="1.5" />
      <path d="M-40 150 Q220 90 430 160 T860 130 T1200 175 T1480 120" strokeWidth="1" />
      <path d="M-40 235 Q160 290 390 225 T800 270 T1160 210 T1480 255" strokeWidth="1.5" />
      <path d="M-40 320 Q240 265 470 330 T900 290 T1240 345 T1480 300" strokeWidth="1" />
      <path d="M-40 405 Q190 455 410 395 T830 440 T1190 390 T1480 430" strokeWidth="1.5" />
      <path d="M-40 490 Q230 440 450 500 T880 465 T1220 515 T1480 475" strokeWidth="1" />
    </svg>
  )
}

// Where the hero's floating tiles sit (wide screens only), as [side, offset from that side, top, size in px at 1440 wide].
// Kept clear of the centered column and the type shortcuts row.
const TILE_SLOTS = [
  ['left', '4%', '6%', 128],
  ['left', '14%', '23%', 104],
  ['left', '2%', '39%', 112],
  ['left', '12.5%', '51%', 120],
  ['left', '1.5%', '67%', 96],
  ['right', '5%', '4%', 112],
  ['right', '13.5%', '19%', 128],
  ['right', '3%', '35%', 120],
  ['right', '13%', '50%', 104],
  ['right', '2%', '65%', 112],
] as const

// The inner column of each side only fits beside the search on xl screens.
const INNER_SLOTS = new Set([1, 3, 6, 8])

interface HeroTile {
  name: string
  href: string
  label: string
  image?: string
  icon?: React.ElementType
}

function WavyStrokes({ className }: { className?: string }) {
  return (
    <svg aria-hidden className={className} viewBox="0 0 120 120" preserveAspectRatio="none" fill="none" stroke="currentColor">
      <path d="M-10 22 Q20 4 46 24 T96 18 T140 30" strokeWidth="2" />
      <path d="M-10 58 Q26 78 52 54 T100 66 T140 50" strokeWidth="1.5" />
      <path d="M-10 96 Q22 78 50 98 T98 88 T140 102" strokeWidth="2" />
    </svg>
  )
}

const tileWidth = (size: number) => `min(${size}px, ${(size / 14.4).toFixed(2)}vw)`
const tileDrift = (i: number) => ({ animationDelay: `${-i * 1.3}s`, animationDuration: `${7 + (i % 4)}s` })

/** Real catalog items drifting around the search: theme previews and the current top items. Decorative layout, real links. */
function HeroTiles({ tiles }: { tiles: HeroTile[] }) {
  return (
    <div className="hero-tiles pointer-events-none absolute inset-0 hidden overflow-hidden min-[1100px]:block">
      {tiles.slice(0, TILE_SLOTS.length).map((tile, i) => {
        const [side, offset, top, size] = TILE_SLOTS[i]
        // The right-hand slots are drawn by HeroAdColumn, under the ad
        if (side === 'right') return null
        return (
          <ItemLink
            key={`${tile.href}${tile.name}`}
            href={tile.href}
            className={`hero-tile group pointer-events-auto absolute rounded-xl ${INNER_SLOTS.has(i) ? 'hidden xl:block' : 'block'} ${focusRing}`}
            style={{ [side]: offset, top, width: tileWidth(size), ...tileDrift(i) }}
          >
            <TileFace tile={tile} i={i} />
          </ItemLink>
        )
      })}
    </div>
  )
}

function TileFace({ tile, i }: { tile: HeroTile; i: number }) {
  const Icon = tile.icon
  return (
    <>
            <span
              className={`relative block aspect-square overflow-hidden rounded-xl border border-white/10 transition-transform duration-300 ease-out group-hover:scale-[1.05] ${
                tile.image ? 'bg-card' : i % 3 === 1 ? 'bg-[#c96a50] text-[#9a4a3a]' : 'bg-card text-[#c96a50]/45'
              }`}
            >
              {tile.image ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={tile.image} alt="" loading="lazy" decoding="async" className="absolute inset-0 h-full w-full object-cover" />
              ) : (
                <>
                  <WavyStrokes className="absolute inset-0 h-full w-full" />
                  {Icon && <Icon className="absolute left-1/2 top-1/2 h-6 w-6 -translate-x-1/2 -translate-y-1/2 text-white" />}
                </>
              )}
            </span>
            <span className="mt-2 block truncate text-xs text-foreground/80 transition-colors group-hover:text-foreground">{tile.name}</span>
            <span className="block truncate text-[11px] text-muted-foreground">{tile.label}</span>
    </>
  )
}

/**
 * The page's one ad, as the largest box in the hero's right-hand column with the right-side tiles
 * flowing under it. It is above the fold on desktop, as Carbon's placement policy asks. Carbon decides
 * the ad's height (a short card or a tall cover), so the tiles take whatever room is left and fade out.
 * Below 1100px the tiles are hidden and there is no room beside the search: the ad sits centered under the hero.
 */
function HeroAdColumn({ tiles }: { tiles: Array<HeroTile & { slot: number }> }) {
  return (
    <div className="relative px-4 pb-14 md:pb-20 min-[1100px]:absolute min-[1100px]:bottom-0 min-[1100px]:right-[1.5%] min-[1100px]:top-10 min-[1100px]:flex min-[1100px]:w-[clamp(10.5rem,calc(23vw-5.2rem),15rem)] min-[1100px]:flex-col min-[1100px]:gap-7 min-[1100px]:p-0">
      <CarbonAd className="mx-auto shrink-0 min-[1100px]:min-h-[230px]" />
      <div className="hidden min-h-0 flex-1 flex-col gap-6 overflow-hidden px-1 [mask-image:linear-gradient(to_bottom,#000_55%,transparent_96%)] min-[1100px]:flex">
        {tiles.map((tile, n) => (
          <ItemLink
            key={`${tile.href}${tile.name}`}
            href={tile.href}
            className={`hero-tile group block shrink-0 rounded-xl ${n % 2 ? 'self-start' : 'self-end'} ${focusRing}`}
            style={{ width: tileWidth(TILE_SLOTS[tile.slot][3]), ...tileDrift(tile.slot) }}
          >
            <TileFace tile={tile} i={tile.slot} />
          </ItemLink>
        ))}
      </div>
    </div>
  )
}

/** The old hero's terracotta panel with its wavy strokes, framing a dark card. */
function Panel({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <div className="relative overflow-hidden rounded-3xl bg-[#c96a50] p-2.5 sm:p-6 lg:p-10">
      <WavyStrokes className="absolute inset-0 h-full w-full text-[#9a4a3a] opacity-50" />
      <div className={`relative rounded-2xl bg-background p-4 shadow-[0_30px_80px_-20px_rgb(0_0_0/0.6)] sm:p-8 lg:p-12 ${className}`}>{children}</div>
    </div>
  )
}

function Ticker({ label, items }: { label: string; items: Array<{ name: string; href: string; icon: React.ElementType; detail: string }> }) {
  // The list is rendered twice so the track can loop seamlessly at -50%; the copy is hidden from AT and the tab order.
  const row = (copy: boolean) =>
    items.map((item) => {
      const Icon = item.icon
      return (
        <li key={`${copy}${item.href}`} aria-hidden={copy || undefined}>
          <ItemLink
            href={item.href}
            tabIndex={copy ? -1 : undefined}
            className={`group/t flex items-center gap-2.5 whitespace-nowrap px-6 py-3.5 text-sm ${focusRing} focus-visible:ring-inset focus-visible:ring-offset-0`}
          >
            <Icon className="h-3.5 w-3.5 text-muted-foreground transition-colors group-hover/t:text-[#e89a7a]" />
            <span className="text-foreground/90 transition-colors group-hover/t:text-foreground">{item.name}</span>
            <span className="font-mono text-xs tabular-nums text-muted-foreground">{item.detail}</span>
          </ItemLink>
        </li>
      )
    })

  return (
    <section aria-label={label} className="ticker flex border-y border-border">
      <div className="flex shrink-0 items-center gap-2 border-r border-border px-4 text-xs font-medium uppercase tracking-[0.12em] text-[#e89a7a] sm:px-6">
        <span className="h-1.5 w-1.5 rounded-full bg-[#e89a7a]" />
        {label}
      </div>
      <div className="ticker-viewport min-w-0 flex-1">
        <ul className="ticker-track flex w-max" style={{ animationDuration: `${items.length * 4.5}s` }}>
          {row(false)}
          {row(true)}
        </ul>
      </div>
    </section>
  )
}

function Leaderboard({ board, items }: { board: (typeof BOARDS)[number]; items: TrendingItem[] }) {
  return (
    <>
      <div className="grid grid-cols-[2rem_minmax(0,1fr)_auto] gap-x-4 border-b border-border px-2 pb-2.5 text-xs text-muted-foreground">
        <span>#</span>
        <span>{board.noun}</span>
        <span>{board.metric}</span>
      </div>
      <ol>
        {items.map((item, i) => (
          <li key={item.href} className="border-b border-border">
            <ItemLink
              href={item.href}
              className={`group grid grid-cols-[2rem_minmax(0,1fr)_auto] items-baseline gap-x-4 rounded-md px-2 py-3.5 transition-colors hover:bg-card ${focusRing}`}
            >
              <span className={`font-mono text-sm tabular-nums ${i < 3 ? 'text-[#e89a7a]' : 'text-muted-foreground'}`}>{i + 1}</span>
              <span className="min-w-0">
                <span className="flex min-w-0 items-baseline gap-2.5">
                  <span className="truncate font-medium transition-colors group-hover:text-[#e89a7a]">{item.name}</span>
                  {item.source && <span className="hidden shrink-0 text-sm text-muted-foreground sm:inline">{item.source}</span>}
                  {item.href.startsWith('http') && <ArrowUpRight aria-label="Opens on GitHub" className="h-3.5 w-3.5 shrink-0 self-center text-muted-foreground" />}
                </span>
                {item.description && <span className="mt-0.5 block truncate text-sm text-muted-foreground">{item.description}</span>}
              </span>
              <span className="font-mono text-sm tabular-nums">{compact(item.metric)}</span>
            </ItemLink>
          </li>
        ))}
      </ol>
      <Link href={board.href} className={`mt-5 inline-flex items-center gap-1.5 rounded-sm py-1 text-sm text-muted-foreground transition-colors hover:text-foreground ${focusRing}`}>
        {board.all} <ArrowRight className="h-3.5 w-3.5" />
      </Link>
    </>
  )
}

function CopyCommand() {
  const [copied, setCopied] = useState(false)
  const copy = async () => {
    await navigator.clipboard.writeText(MARKETPLACE_COMMAND)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }
  return (
    <div className="flex min-w-0 max-w-full items-center gap-2 rounded-lg border border-border bg-card py-1.5 pl-4 pr-1.5">
      <code className="min-w-0 break-words font-mono text-sm">
        <span className="text-[#e89a7a]">/plugin</span> marketplace add davepoon/<wbr />buildwithclaude
      </code>
      <button
        type="button"
        onClick={copy}
        aria-label={copied ? 'Copied' : 'Copy command'}
        className={`shrink-0 rounded-md p-2 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground ${focusRing}`}
      >
        {copied ? <Check className="h-4 w-4 text-[#e89a7a]" /> : <Copy className="h-4 w-4" />}
      </button>
    </div>
  )
}

export default function HomePageClient({ counts, trending, picks, heroThemes, featuredStories, featuredThemes }: HomePageClientProps) {
  const types = [
    { href: '/plugins', label: 'Plugins', count: counts.plugins, icon: Package },
    { href: '/skills', label: 'Skills', count: counts.skills, icon: Sparkles },
    { href: '/mcp-servers', label: 'MCP servers', count: counts.mcp, icon: Server },
    { href: '/subagents', label: 'Subagents', count: counts.subagents, icon: Bot },
    { href: '/commands', label: 'Commands', count: counts.commands, icon: SquareTerminal },
    { href: '/hooks', label: 'Hooks', count: counts.hooks, icon: Webhook },
    { href: '/themes', label: 'Themes', count: counts.themes, icon: Palette },
  ]

  const boards = BOARDS.filter((b) => trending[b.key].length > 0)
  const hasRankings = boards.length > 0

  // Interleave the lists so the ticker mixes types instead of running one list after another.
  const tickerItems = Array.from({ length: 8 }, (_, i) => boards.flatMap((b) => (trending[b.key][i] ? [{ ...trending[b.key][i], unit: b.unit }] : []))).flat()

  // Hero tiles: today's theme previews mixed with the top ranked items, or daily picks when rankings are unavailable.
  const KIND_LABEL = { skill: 'Skill', plugin: 'Plugin', mcp: 'MCP server', marketplace: 'Marketplace' } as const
  const itemTiles: HeroTile[] = hasRankings
    ? tickerItems.slice(0, 6).map((t) => ({ name: t.name, href: t.href, label: KIND_LABEL[t.kind], icon: KIND_ICON[t.kind] }))
    : [
        ...picks.subagents.slice(0, 2).map((p) => ({ ...p, label: 'Subagent', icon: Bot })),
        ...picks.commands.slice(0, 2).map((p) => ({ ...p, label: 'Command', icon: SquareTerminal })),
        ...picks.hooks.slice(0, 2).map((p) => ({ ...p, label: 'Hook', icon: Webhook })),
      ]
  const themeTiles: HeroTile[] = heroThemes.map((t) => ({ name: t.name, href: '/themes', label: 'Theme', image: t.preview }))
  // Slot order alternates sides of the page; put a theme image at every third slot so both sides get pictures.
  const heroTiles = TILE_SLOTS.flatMap((_, i) => {
    const tile = i % 3 === 0 ? themeTiles[i / 3] : itemTiles[i - Math.floor(i / 3) - 1]
    return tile ? [tile] : []
  })

  // Collections with no popularity signal get a daily rotation. Plugins and skills join only when their rankings are unavailable.
  const pickColumns = [
    ...(hasRankings
      ? []
      : [
          { label: 'Plugins', href: '/plugins', icon: Package, count: counts.plugins, items: picks.plugins },
          { label: 'Skills', href: '/skills', icon: Sparkles, count: counts.skills, items: picks.skills },
        ]),
    { label: 'Subagents', href: '/subagents', icon: Bot, count: counts.subagents, items: picks.subagents },
    { label: 'Commands', href: '/commands', icon: SquareTerminal, count: counts.commands, items: picks.commands },
    { label: 'Hooks', href: '/hooks', icon: Webhook, count: counts.hooks, items: picks.hooks },
  ]

  const picksBody = (
    <>
          <h2 className="text-display-2">From the collection</h2>
          <p className="mt-2 max-w-xl text-muted-foreground">A different handful every day from the Build with Claude repo.</p>
          <div className="mt-10 grid gap-x-12 gap-y-12 md:grid-cols-2 lg:grid-cols-3">
            {pickColumns.map(({ label, href, icon: Icon, count, items }) => (
              <div key={href} className="min-w-0">
                <h3 className="flex items-center gap-2.5 border-b border-border pb-3 font-sans text-base font-medium tracking-normal">
                  <Icon className="h-4 w-4 text-[#e89a7a]" />
                  {label}
                </h3>
                <ul>
                  {items.map((item) => (
                    <li key={item.href} className="border-b border-border">
                      <Link href={item.href} className={`group block rounded-md px-2 py-3 transition-colors hover:bg-card ${focusRing}`}>
                        <span className="block truncate font-medium transition-colors group-hover:text-[#e89a7a]">{item.name}</span>
                        <span className="block truncate text-sm text-muted-foreground">{item.description}</span>
                      </Link>
                    </li>
                  ))}
                </ul>
                <Link href={href} className={`mt-4 inline-flex items-center gap-1.5 rounded-sm py-1 text-sm text-muted-foreground transition-colors hover:text-foreground ${focusRing}`}>
                  All {count.toLocaleString('en-US')} {label.toLowerCase()} <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              </div>
            ))}
          </div>
    </>
  )

  return (
    <div className="min-h-screen">
      {/* Hero: search is the page */}
      {/* Not clipped: the search results dropdown hangs below the hero. The decorative layers clip themselves. */}
      <section className="relative">
        <HeroBackdrop />
        <HeroTiles tiles={heroTiles} />
        <div className="container relative mx-auto px-4 pb-10 pt-16 text-center md:pt-28 min-[1100px]:pb-20 xl:pb-28 xl:pt-36">
          <h1 className="mx-auto max-w-4xl text-balance font-serif text-[clamp(2.75rem,7.2vw,5rem)] leading-[1.04] tracking-[-0.02em]">
            Discover <span className="text-[#e89a7a]">everything</span> for Claude
          </h1>
          <p className="mx-auto mt-5 max-w-xl text-pretty text-lg leading-relaxed text-muted-foreground">
            Plugins, skills, subagents, commands, hooks, MCP servers and themes from every community marketplace, searchable in one place.
          </p>

          <div className="mx-auto mt-9 max-w-[42rem] text-left">
            <HeroSearch />
          </div>

          <nav aria-label="Browse by type" className="mx-auto mt-6 flex max-w-5xl flex-wrap justify-center gap-x-1 gap-y-1 min-[1100px]:max-[1699px]:max-w-[42rem]">
            {types.map(({ href, label, count, icon: Icon }) => (
              <Link
                key={href}
                href={href}
                className={`group inline-flex items-center gap-2 rounded-full px-3.5 py-2 text-sm text-foreground/90 transition-colors hover:bg-secondary hover:text-foreground ${focusRing}`}
              >
                <Icon className="h-4 w-4 text-muted-foreground transition-colors group-hover:text-[#e89a7a]" />
                {label}
                <span className="font-mono text-xs tabular-nums text-muted-foreground">{compact(count)}</span>
              </Link>
            ))}
          </nav>

        </div>
        <HeroAdColumn tiles={[5, 7, 9].flatMap((slot) => (heroTiles[slot] ? [{ ...heroTiles[slot], slot }] : []))} />
      </section>

      {hasRankings ? (
        <Ticker label="Trending" items={tickerItems.map((t) => ({ name: t.name, href: t.href, icon: KIND_ICON[t.kind], detail: `${compact(t.metric)} ${t.unit}` }))} />
      ) : (
        <Ticker
          label="Today's picks"
          items={Array.from({ length: 5 }, (_, i) => pickColumns.flatMap((c) => (c.items[i] ? [{ name: c.items[i].name, href: c.items[i].href, icon: c.icon, detail: c.label.replace(/s$/, '') }] : []))).flat()}
        />
      )}

      {/* Rankings by real signal, plus what was indexed most recently */}
      {hasRankings && (
        <section className="container mx-auto px-4 py-16 md:py-24">
          <Panel className="grid gap-x-16 gap-y-14 lg:grid-cols-[minmax(0,1fr)_20rem]">
            <Tabs defaultValue={boards[0].key} className="min-w-0">
              <div className="mb-7 flex flex-wrap items-end justify-between gap-x-6 gap-y-4">
                <h2 className="text-display-2">Trending now</h2>
                <TabsList className="max-w-full justify-start overflow-x-auto [scrollbar-width:none]">
                  {boards.map((b) => (
                    <TabsTrigger key={b.key} value={b.key}>
                      {b.label}
                    </TabsTrigger>
                  ))}
                </TabsList>
              </div>
              {boards.map((b) => (
                <TabsContent key={b.key} value={b.key} className="mt-0">
                  <Leaderboard board={b} items={trending[b.key]} />
                </TabsContent>
              ))}
            </Tabs>

            {trending.justAdded.length > 0 && (
              <aside aria-labelledby="just-added" className="min-w-0">
                <h2 id="just-added" className="text-display-3 mb-7 lg:mt-2.5">
                  Just added
                </h2>
                <ul className="border-t border-border">
                  {trending.justAdded.map((item) => {
                    const Icon = KIND_ICON[item.kind]
                    return (
                      <li key={item.href} className="border-b border-border">
                        <Link href={item.href} className={`group flex items-baseline gap-3 rounded-md px-2 py-3 transition-colors hover:bg-card ${focusRing}`}>
                          <Icon className="h-3.5 w-3.5 shrink-0 translate-y-0.5 text-muted-foreground" />
                          <span className="min-w-0 flex-1">
                            <span className="block truncate font-medium transition-colors group-hover:text-[#e89a7a]">{item.name}</span>
                            {item.source && <span className="block truncate text-sm text-muted-foreground">{item.source}</span>}
                          </span>
                          <span className="shrink-0 font-mono text-xs tabular-nums text-muted-foreground">{item.added}</span>
                        </Link>
                      </li>
                    )
                  })}
                </ul>
              </aside>
            )}
          </Panel>
        </section>
      )}

      {/* Without rankings (database unreachable) the daily picks take the panel instead */}
      {!hasRankings && (
        <section className="container mx-auto px-4 py-16 md:py-24">
          <Panel>{picksBody}</Panel>
        </section>
      )}

      {/* Themes: the one visual shelf */}
      {featuredThemes.length > 0 && (
        <section className="border-t border-border py-16 md:py-20">
          <div className="container mx-auto px-4">
            <div className="mb-8 flex items-end justify-between gap-6">
              <h2 className="text-display-2">Themes</h2>
              <Link href="/themes" className={`inline-flex items-center gap-1.5 rounded-sm py-1 text-sm text-muted-foreground transition-colors hover:text-foreground ${focusRing}`}>
                All {counts.themes} themes <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </div>
            <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
              {featuredThemes.map((theme) => (
                <ThemeCard key={theme.slug} theme={theme} />
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Daily picks for the collections that have no popularity data */}
      {hasRankings && (
        <section className="border-t border-border py-16 md:py-20">
          <div className="container mx-auto px-4">{picksBody}</div>
        </section>
      )}

      <StoriesStrip stories={featuredStories} />

      {/* The curated marketplace: one quiet line */}
      <section className="border-t border-border py-12">
        <div className="container mx-auto flex flex-col items-start justify-between gap-5 px-4 md:flex-row md:items-center">
          <p className="text-muted-foreground">
            <span className="text-foreground">Want the curated set inside Claude Code?</span> Add the Build with Claude marketplace.
          </p>
          <CopyCommand />
        </div>
      </section>
    </div>
  )
}
