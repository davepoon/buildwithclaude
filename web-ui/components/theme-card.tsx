'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Check, Copy, Download, ExternalLink, Monitor, Palette, SquareTerminal } from 'lucide-react'
import { themeRepoUrl, type Theme } from '@/lib/themes'

const APPEARANCE_LABEL = { dark: 'Dark', light: 'Light', both: 'Light + dark' } as const

function CommandRow({ command }: { command: string }) {
  const [copied, setCopied] = useState(false)
  const copy = async () => {
    await navigator.clipboard.writeText(command)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }
  return (
    <div className="flex items-start gap-2 rounded-md border border-border bg-muted/40 p-2">
      <code className="flex-1 font-mono text-xs break-all py-1">{command}</code>
      <Button size="sm" variant="ghost" className="h-7 px-2 shrink-0" onClick={copy} aria-label={`Copy command: ${command}`}>
        {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
      </Button>
    </div>
  )
}

export function ThemeCard({ theme }: { theme: Theme }) {
  const [imageFailed, setImageFailed] = useState(false)
  const repoUrl = themeRepoUrl(theme)
  const KindIcon = theme.kind === 'desktop' ? Monitor : SquareTerminal
  const pill = 'px-2 py-0.5 rounded-full bg-muted text-xs text-muted-foreground inline-flex items-center gap-1'

  return (
    <div className="rounded-lg border border-border hover:border-primary/40 transition-colors h-full flex flex-col bg-card overflow-hidden">
      <a href={repoUrl} target="_blank" rel="noopener noreferrer" className="relative block aspect-video overflow-hidden bg-muted" tabIndex={-1} aria-hidden>
        {theme.preview && !imageFailed ? (
          // Plain <img>: previews are GIFs and PNGs linked from the authors' repos, so the image optimizer adds nothing.
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={theme.preview}
            alt=""
            loading="lazy"
            decoding="async"
            onError={() => setImageFailed(true)}
            className="absolute inset-0 h-full w-full object-cover object-top"
          />
        ) : (
          <div className="h-full w-full flex flex-col items-center justify-center gap-2 text-muted-foreground/60">
            <Palette className="h-8 w-8" />
            <span className="text-xs">No preview yet</span>
          </div>
        )}
      </a>

      <div className="p-5 flex flex-col flex-1">
        <h3 className="font-medium">{theme.name}</h3>
        <p className="text-xs text-muted-foreground mb-2">by {theme.author}</p>
        <div className="flex flex-wrap gap-1.5 mb-3">
          <span className={pill}>
            <KindIcon className="h-3 w-3" />
            {theme.kind === 'desktop' ? 'Desktop app' : 'Terminal'}
          </span>
          {theme.appearance && <span className={pill}>{APPEARANCE_LABEL[theme.appearance]}</span>}
          {theme.official && <span className="px-2 py-0.5 rounded-full bg-primary/10 text-xs text-primary">Official</span>}
        </div>

        <p className="text-sm text-muted-foreground line-clamp-3 flex-1 mb-4">{theme.description}</p>

        <div className="flex gap-2">
          {theme.install && (
            <Dialog>
              <DialogTrigger asChild>
                <Button size="sm" variant="outline" className="h-7 px-2 text-xs">
                  <Download className="h-3 w-3 mr-1" />
                  Install
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Install {theme.name}</DialogTitle>
                  <DialogDescription>
                    {theme.install.some(c => c.startsWith('/'))
                      ? 'Run these at the prompt of a Claude Code terminal session, in order.'
                      : 'Run this in your shell.'}
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-2">
                  {theme.install.map(c => <CommandRow key={c} command={c} />)}
                </div>
                <p className="text-sm text-muted-foreground">
                  {theme.kind === 'desktop'
                    ? 'Desktop themes draw in the Code tab of the Claude desktop app, in local sessions. Start a new session there after installing. The terminal keeps its own colors.'
                    : 'Then run /theme and pick the theme. If it is not listed, run /reload-plugins.'}
                </p>
                <p className="text-xs text-muted-foreground">
                  This is community code that runs inside Claude Code. Read the{' '}
                  <a href={repoUrl} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">source</a>
                  {' '}before installing.
                </p>
              </DialogContent>
            </Dialog>
          )}
          <Button asChild size="sm" variant="ghost" className="h-7 px-2 text-xs text-muted-foreground hover:text-foreground">
            <a href={repoUrl} target="_blank" rel="noopener noreferrer">
              <ExternalLink className="h-3 w-3 mr-1" />
              GitHub
            </a>
          </Button>
        </div>
      </div>
    </div>
  )
}
