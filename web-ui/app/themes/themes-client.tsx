'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { FilterBar, FilterHeading, FilterSearch } from '@/components/filter-controls'
import { ThemeCard } from '@/components/theme-card'
import { ExternalLink } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { Theme, ThemeKind } from '@/lib/themes'

type KindFilter = 'all' | ThemeKind

const KINDS: { value: KindFilter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'desktop', label: 'Desktop app' },
  { value: 'terminal', label: 'Terminal' },
]

const BUILDERS = [
  { name: 'Theme Generator', repo: 'denesszabo/claude-code-theme-generator', description: 'Browser editor for terminal themes with live preview and JSON export.' },
  { name: 'Theme Editor', repo: 'FEIF-L/claude-code-theme-editor', description: 'Visual editor covering every terminal color token.' },
  { name: 'Theme Designer', repo: 'aleslanger/claude-code-theme-designer', description: 'Design, preview and install terminal themes from the command line.' },
]

export default function ThemesPageClient({ themes, initialQuery = '' }: { themes: Theme[]; initialQuery?: string }) {
  const [query, setQuery] = useState(initialQuery)
  const [kind, setKind] = useState<KindFilter>('all')

  const counts = useMemo(() => ({
    all: themes.length,
    desktop: themes.filter(t => t.kind === 'desktop').length,
    terminal: themes.filter(t => t.kind === 'terminal').length,
  }), [themes])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return themes.filter(t =>
      (kind === 'all' || t.kind === kind) &&
      (!q || `${t.name} ${t.author} ${t.description}`.toLowerCase().includes(q))
    )
  }, [themes, query, kind])

  return (
    <div className="min-h-screen">
      <div className="container mx-auto px-4 py-12">
        <FilterHeading>Themes</FilterHeading>
        <p className="text-muted-foreground mb-8 max-w-2xl">
          Custom looks for Claude Code. Desktop app themes are mods that recolor the Code tab and can
          paint an animated backdrop behind the chat. Terminal themes recolor the CLI and are picked with{' '}
          <code className="font-mono text-sm">/theme</code>.
        </p>

        <FilterBar>
          <FilterSearch>
            <Input
              type="text"
              placeholder="Search themes..."
              aria-label="Search themes"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="bg-card border-border"
            />
          </FilterSearch>
          <div role="group" aria-label="Filter by where the theme runs" className="flex gap-1">
            {KINDS.map(k => (
              <Button
                key={k.value}
                size="sm"
                variant={kind === k.value ? 'default' : 'outline'}
                aria-pressed={kind === k.value}
                onClick={() => setKind(k.value)}
                className={cn(kind !== k.value && 'text-muted-foreground')}
              >
                {k.label} <span className="ml-1.5 opacity-70">{counts[k.value]}</span>
              </Button>
            ))}
          </div>
        </FilterBar>

        {filtered.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filtered.map(t => <ThemeCard key={t.slug} theme={t} />)}
          </div>
        ) : (
          <div className="text-center py-16">
            <p className="text-muted-foreground">No themes found</p>
          </div>
        )}

        <section className="mt-16">
          <h2 className="text-xl font-medium mb-1">Make your own</h2>
          <p className="text-sm text-muted-foreground mb-4 max-w-2xl">
            For a desktop theme, describe the look you want to Claude in the desktop app, or start from the
            official Theme Examples plugin. For a terminal theme, choose New custom theme in{' '}
            <code className="font-mono">/theme</code> or use one of these builders.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            {BUILDERS.map(b => (
              <a
                key={b.repo}
                href={`https://github.com/${b.repo}`}
                target="_blank"
                rel="noopener noreferrer"
                className="p-4 rounded-lg border border-border hover:border-primary/40 transition-colors bg-card"
              >
                <h3 className="font-medium text-sm flex items-center gap-1.5">
                  {b.name} <ExternalLink className="h-3 w-3 text-muted-foreground" />
                </h3>
                <p className="text-sm text-muted-foreground mt-1">{b.description}</p>
              </a>
            ))}
          </div>
          <p className="text-sm text-muted-foreground">
            Made a theme?{' '}
            <Link href="/contribute#themes" className="text-primary hover:underline">Add it to this page</Link>
            {' '}with a pull request to <code className="font-mono">web-ui/lib/themes.json</code>.
          </p>
        </section>
      </div>
    </div>
  )
}
