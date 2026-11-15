'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog'
import { Command, CommandInput, CommandList } from '@/components/ui/command'
import { useContentSearch } from '@/hooks/use-content-search'
import { SearchResults, SEARCH_GROUP_HEADING_CLASS } from '@/components/search-results'

export function GlobalSearch({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const router = useRouter()
  const [query, setQuery] = useState('')
  const { hits, facets, loading, errored, trimmed } = useContentSearch(query, { enabled: open })

  // Clear the query when the palette closes so it opens fresh next time.
  useEffect(() => {
    if (!open) setQuery('')
  }, [open])

  const go = (url: string) => {
    onOpenChange(false)
    if (url.startsWith('http')) window.open(url, '_blank')
    else router.push(url)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="overflow-hidden p-0" style={{ maxWidth: '36rem' }}>
        <DialogTitle className="sr-only">Search Build with Claude</DialogTitle>
        <Command shouldFilter={false} className={SEARCH_GROUP_HEADING_CLASS}>
          <CommandInput
            value={query}
            onValueChange={setQuery}
            placeholder="Search plugins, skills, agents, commands, MCP servers, themes…"
          />
          <CommandList className="max-h-[60vh]">
            <SearchResults
              hits={hits}
              facets={facets}
              loading={loading}
              errored={errored}
              trimmed={trimmed}
              onSelect={go}
              showBrowseLinks
            />
          </CommandList>
        </Command>
      </DialogContent>
    </Dialog>
  )
}
