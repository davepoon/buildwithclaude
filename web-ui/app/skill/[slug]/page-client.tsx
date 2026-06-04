'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { ArrowLeft, Copy, Download, Check, ExternalLink, Terminal, Star, GitBranch, ShieldCheck, ShieldAlert, Clock } from 'lucide-react'
import { type Skill } from '@/lib/skills-types'
import { generateSkillMarkdown } from '@/lib/utils'
import { generateCategoryDisplayName } from '@/lib/category-utils'

const getOpenClawCommand = (slug: string) =>
  `curl -sL https://buildwithclaude.com/api/skills/${slug}/download -o /tmp/${slug}.zip && unzip -o /tmp/${slug}.zip -d ~/.claude/skills/ && rm /tmp/${slug}.zip`

const LOCAL_GITHUB_BASE = 'https://github.com/davepoon/buildwithclaude/tree/main/plugins/all-skills/skills'

/** "https://github.com/owner/repo" -> "owner/repo" */
function repoShortName(repository: string): string {
  const match = repository.match(/github\.com\/([^/]+\/[^/?#]+)/)
  return match ? match[1].replace(/\.git$/, '') : repository
}

/** Deep link to the SKILL.md (or repo root) on GitHub for an imported skill. */
function importedGithubUrl(repository: string, sourcePath?: string): string {
  const short = repoShortName(repository)
  return sourcePath
    ? `https://github.com/${short}/blob/HEAD/${sourcePath.replace(/^\/+/, '')}`
    : `https://github.com/${short}`
}

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })
  } catch {
    return iso
  }
}

interface SkillPageClientProps {
  skill: Skill
}

export function SkillPageClient({ skill }: SkillPageClientProps) {
  const [copied, setCopied] = useState(false)
  const [copiedNpx, setCopiedNpx] = useState(false)
  const [copiedPath, setCopiedPath] = useState(false)
  const [copiedClawCmd, setCopiedClawCmd] = useState(false)
  const [copiedClawPath, setCopiedClawPath] = useState(false)
  const categoryName = generateCategoryDisplayName(skill.category)

  // Local file-skills keep the original BuildWithClaude install/download flow.
  // Imported (DB) skills are reference-only: install from their source repo and
  // link out to GitHub (the zip download API only serves local files).
  const isLocal = skill.isLocal !== false
  const installCommand = isLocal
    ? `npx skills add davepoon/buildwithclaude -s ${skill.slug}`
    : (skill.installCommand || (skill.repository ? `npx skills add ${repoShortName(skill.repository)}` : ''))
  const githubUrl = isLocal
    ? `${LOCAL_GITHUB_BASE}/${skill.slug}`
    : (skill.repository ? importedGithubUrl(skill.repository, skill.sourcePath) : null)

  const handleCopy = async () => {
    const markdown = generateSkillMarkdown(skill)
    await navigator.clipboard.writeText(markdown)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const handleDownload = () => {
    window.location.href = `/api/skills/${skill.slug}/download`
  }

  const lines = skill.content.split('\n')
  const formattedContent = lines.map((line, i) => {
    if (line.startsWith('## ')) {
      return <h2 key={i} className="text-xl font-medium mt-6 mb-3">{line.replace('## ', '')}</h2>
    }
    if (line.startsWith('### ')) {
      return <h3 key={i} className="text-lg font-medium mt-4 mb-2">{line.replace('### ', '')}</h3>
    }
    if (line.startsWith('- ')) {
      return <li key={i} className="ml-6 list-disc">{line.replace('- ', '')}</li>
    }
    if (/^\d+\. /.test(line)) {
      return <li key={i} className="ml-6 list-decimal">{line.replace(/^\d+\. /, '')}</li>
    }
    if (line.startsWith('```')) {
      return <div key={i} className="font-mono text-sm bg-muted p-2 rounded my-2">{line}</div>
    }
    if (line.trim()) {
      return <p key={i} className="mb-3">{line}</p>
    }
    return <br key={i} />
  })

  return (
    <div className="min-h-screen">
      <div className="container mx-auto px-4 py-12 max-w-3xl">
        {/* Back */}
        <Link href="/skills" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-8">
          <ArrowLeft className="h-4 w-4" />
          Back to Skills
        </Link>

        {/* Header */}
        <div className="mb-10">
          <div className="flex items-start justify-between gap-4 mb-4">
            <h1 className="text-display-2">{skill.name}</h1>
            <div className="flex gap-2">
              <Button size="sm" variant="ghost" onClick={handleCopy}>
                {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
              </Button>
              {isLocal && (
                <Button size="sm" variant="ghost" onClick={handleDownload}>
                  <Download className="h-4 w-4" />
                </Button>
              )}
            </div>
          </div>
          <p className="text-sm text-muted-foreground mb-3">{categoryName}</p>
          <p className="text-lg text-muted-foreground mb-4">{skill.description}</p>

          {/* Metadata strip */}
          <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-muted-foreground">
            {typeof skill.installs === 'number' && skill.installs > 0 && (
              <span className="inline-flex items-center gap-1.5">
                <Download className="h-4 w-4" />
                {skill.installs.toLocaleString()} installs
              </span>
            )}
            {typeof skill.stars === 'number' && skill.stars > 0 && (
              <span className="inline-flex items-center gap-1.5">
                <Star className="h-4 w-4" />
                {skill.stars.toLocaleString()}
              </span>
            )}
            {!isLocal && skill.repository && (
              <a
                href={skill.repository}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 hover:text-foreground underline-offset-4 hover:underline"
              >
                <GitBranch className="h-4 w-4" />
                {repoShortName(skill.repository)}
              </a>
            )}
            {skill.firstSeen && (
              <span className="inline-flex items-center gap-1.5">
                <Clock className="h-4 w-4" />
                Added {formatDate(skill.firstSeen)}
              </span>
            )}
            {!isLocal && skill.submissionStatus === 'approved' && (
              <span className="inline-flex items-center gap-1.5 text-green-600 dark:text-green-500">
                <ShieldCheck className="h-4 w-4" />
                Auto-scanned
              </span>
            )}
            {!isLocal && skill.submissionStatus === 'flagged' && (
              <span className="inline-flex items-center gap-1.5 text-amber-600 dark:text-amber-500">
                <ShieldAlert className="h-4 w-4" />
                Pending review
              </span>
            )}
          </div>

          {skill.allowedTools && (
            <p className="text-sm text-muted-foreground mt-3">
              <span className="font-medium">Tools:</span> {skill.allowedTools}
            </p>
          )}
        </div>

        {/* How Skills Work */}
        <div className="mb-10 p-4 bg-card rounded-lg border border-border">
          <h3 className="text-sm font-medium mb-2">How Skills Work</h3>
          <p className="text-sm text-muted-foreground">
            Skills are markdown files that extend Claude's knowledge.
            Place them in <code className="bg-muted px-1 rounded">~/.claude/skills/</code> to make them available.
            Claude reads relevant skills automatically based on context.
          </p>
        </div>

        {/* Quick Install */}
        {installCommand && (
          <div className="mb-10">
            <h2 className="text-lg font-medium mb-4 flex items-center gap-2">
              <Terminal className="h-5 w-5" />
              Quick Install
            </h2>
            <p className="text-sm text-muted-foreground mb-3">
              Install this skill with a single command using <a href="https://github.com/vercel-labs/skills" target="_blank" rel="noopener noreferrer" className="underline hover:text-foreground">npx skills</a>. Works with Claude Code, Cursor, Windsurf, and other agents.
            </p>
            <div className="bg-card rounded-lg p-4 font-mono text-sm flex items-center justify-between gap-2 border border-border">
              <span className="break-all">{installCommand}</span>
              <Button
                size="sm"
                variant="ghost"
                className="shrink-0"
                onClick={async () => {
                  await navigator.clipboard.writeText(installCommand)
                  setCopiedNpx(true)
                  setTimeout(() => setCopiedNpx(false), 2000)
                }}
              >
                {copiedNpx ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
              </Button>
            </div>
          </div>
        )}

        {/* Imported skill notice */}
        {!isLocal && (
          <div className="mb-10 p-4 bg-card rounded-lg border border-border">
            <p className="text-sm text-muted-foreground">
              This skill is maintained in its source repository
              {skill.repository && (
                <> (<a href={skill.repository} target="_blank" rel="noopener noreferrer" className="underline hover:text-foreground">{repoShortName(skill.repository)}</a>)</>
              )}. Install it with the command above, or view the source on GitHub for the latest version.
            </p>
          </div>
        )}

        {/* Manual + OpenClaw installation: local files only (zip download serves local files) */}
        {isLocal && (
          <>
            <div className="mb-10">
              <h2 className="text-lg font-medium mb-4">Manual Installation</h2>
              <div className="space-y-4">
                <div>
                  <p className="text-sm text-muted-foreground mb-2">
                    Step 1: Click Download to get <code className="bg-muted px-1 rounded">{skill.slug}.zip</code>
                  </p>
                  <Button size="sm" onClick={handleDownload} className="gap-2">
                    <Download className="h-4 w-4" />
                    Download {skill.slug}.zip
                  </Button>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground mb-2">
                    Step 2: Extract to <code className="bg-muted px-1 rounded">~/.claude/skills/</code>
                  </p>
                  <div className="bg-card rounded-lg p-4 font-mono text-sm flex items-center justify-between border border-border">
                    <span>unzip {skill.slug}.zip -d ~/.claude/skills/</span>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={async () => {
                        await navigator.clipboard.writeText(`unzip ${skill.slug}.zip -d ~/.claude/skills/`)
                        setCopiedPath(true)
                        setTimeout(() => setCopiedPath(false), 2000)
                      }}
                    >
                      {copiedPath ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                    </Button>
                  </div>
                </div>
              </div>
            </div>

            <div className="mb-10">
              <h2 className="text-lg font-medium mb-4">OpenClaw Installation</h2>
              <p className="text-sm text-muted-foreground mb-4">
                This skill is compatible with <span className="font-medium text-foreground">OpenClaw</span>. Install it with a single command:
              </p>
              <div className="space-y-4">
                <div>
                  <p className="text-sm text-muted-foreground mb-2">
                    One-line install
                  </p>
                  <div className="bg-card rounded-lg p-4 font-mono text-sm flex items-center justify-between gap-2 border border-border">
                    <span className="break-all">{getOpenClawCommand(skill.slug)}</span>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="shrink-0"
                      onClick={async () => {
                        await navigator.clipboard.writeText(getOpenClawCommand(skill.slug))
                        setCopiedClawCmd(true)
                        setTimeout(() => setCopiedClawCmd(false), 2000)
                      }}
                    >
                      {copiedClawCmd ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                    </Button>
                  </div>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground mb-2">
                    Or extract the zip to
                  </p>
                  <div className="bg-card rounded-lg p-4 font-mono text-sm flex items-center justify-between border border-border">
                    <span>~/.openclaw/skills/{skill.slug}/</span>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={async () => {
                        await navigator.clipboard.writeText(`~/.openclaw/skills/${skill.slug}/`)
                        setCopiedClawPath(true)
                        setTimeout(() => setCopiedClawPath(false), 2000)
                      }}
                    >
                      {copiedClawPath ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          </>
        )}

        {/* Content */}
        {skill.content.trim() && (
          <div className="mb-10">
            <h2 className="text-lg font-medium mb-4">Skill Instructions</h2>
            <div className="bg-card rounded-lg p-6 border border-border prose prose-sm max-w-none">
              {formattedContent}
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-3 flex-wrap">
          {githubUrl && (
            <a href={githubUrl} target="_blank" rel="noopener noreferrer">
              <Button className="gap-2">
                <ExternalLink className="h-4 w-4" />
                View on GitHub
              </Button>
            </a>
          )}
          <Link href="/skills">
            <Button variant="outline">Browse More</Button>
          </Link>
        </div>
      </div>
    </div>
  )
}
