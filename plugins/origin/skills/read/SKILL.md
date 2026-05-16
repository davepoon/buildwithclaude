---
name: read
description: >
  Preview a distilled wiki page from inside Claude Code. Prints title,
  summary, source count, and the local md path. Full body lives on disk —
  open with the user's editor. Invoked as `/read <title_or_id>`.
argument-hint: "<title_or_id>"
allowed-tools: ["mcp__plugin_origin_origin__get_page", "mcp__plugin_origin_origin__search_pages", "mcp__plugin_origin_origin__get_page_links", "Bash"]
---

# /read

Surface a page's identity so the user can decide whether to open it.
`/read` is **preview, not full text**. The body is on disk; preview
keeps chat scannable, dodges Bash output truncation, and respects the
"md is canonical, viewer is the user's editor" model.

## How to invoke

Two shapes accepted:

1. **Page id** (starts with `page_`; legacy `concept_` ids still work) → direct fetch.
2. **Title or freeform word** → search, pick best match, fetch.

Both end with the same preview block.

### 1. Direct id

Call the MCP tool to fetch the page:

```
get_page(page_id="<id>")
```

The response is a JSON object wrapping `{ "page": {...} }`. Read
`title`, `summary`, `space`, and `source_memory_ids` off the page,
then look up the md filename in `~/.origin/pages/.origin/state.json`:

```
Bash: python3 -c '
import json, os, sys
state_path = os.path.expanduser("~/.origin/pages/.origin/state.json")
pid = "<id>"
filename = None
try:
    with open(state_path) as f:
        filename = json.load(f).get("pages", {}).get(pid, {}).get("file")
except FileNotFoundError:
    pass
print(f"~/.origin/pages/{filename}" if filename else "(no md projection on disk)")
'
```

Combine the page fields with the resolved md path and emit the preview
block.

### 2. Title or freeform word

Search first, then fetch the top hit by id and run the same preview
block. Always resolve through the `search_pages` MCP tool — never
derive a slug client-side (skill heuristics drift from the canonical
`slugify()` on apostrophes and punctuation).

```
search_pages(query="<arg>", limit=1)
```

Parse the returned JSON — the response shape is `{ "pages": [...] }`.
Read the first hit's `id`. If `pages` is empty, tell the user "no page
found matching `<arg>` — try `/distill <arg>` to create one" and stop.
Otherwise call `get_page(page_id=<id>)` and emit the same preview
block from section 1.

## Output shape

Always print exactly these lines (no body):

```
Title:    <title>
Version:  v<N> — <last_edited_by> <relative_time> (<last_delta_summary>)
Summary:  <one sentence>
Sources:  <N> memories
Space:    <space or (none)>
Links:    <N inbound, M outbound (<K> broken)>
Open:     ~/.origin/pages/<slug>.md
⚠ Stale: <stale_reason> — run /distill to refresh
```

**Lock banner rule:**

When the page payload returned by `get_page` has `user_edited == true`,
prepend this line as the very first line of the rendered output, before
the title:

```
🔒 You've edited this page. Auto-refresh paused. `/distill rebuild <page-id>` to unlock.
```

Substitute `<page-id>` with the actual `page.id` value. When
`user_edited` is false or absent, omit this line entirely.

The lock means daemon distill cycles will not auto-rewrite this page's
prose from sources — edits stay until the user explicitly runs
`/distill rebuild` to wipe and regenerate.

**Version line rules:**

- Always show `v<N>`. When `version` is null or missing, omit the line.
- Append ` — <last_edited_by>` when populated (e.g. `re_distill`, `user`, `agent`).
- Append relative time when `last_edited_at` is set (e.g. `2h ago`, `3d ago`).
- Append `(<last_delta_summary>)` when the field is non-empty.
- Examples:
  - `v1 — synthesized 4h ago`
  - `v4 — re_distill 2h ago (+mem_xyz, +250 chars)`
  - `v3 — user 1d ago`

**Stale warning rule:**

- Emit the `⚠ Stale:` line only when `stale_reason` is non-null/non-empty.
- Render `stale_reason` verbatim (daemon sets it; values like
  `source_updated`, `new_memories` are human-readable enough).

**Links line rules** (unchanged): Call `get_page_links(page_id="<id>")` right after
`get_page` and count:

- inbound = `len(inbound)`
- outbound = `len(outbound)`
- broken = outbound entries where `target_page_id` is null

Omit the parenthetical when broken is zero. Drop the line entirely if
inbound + outbound is zero.

Don't paraphrase the title, don't trim the summary, don't decorate the
preview. The block is one screen, predictable, easy to skim.

If the user wants the full body, they open the md file in their editor
(Obsidian, VS Code, glow, bat, …). The plugin doesn't render markdown
better than their tools do.

## When to use

- User asks "show me the page on X", "what's in <title>", "preview that".
- After `/distill` finishes, follow up with `/read "<title>"` (titles
  survive any rendering surface; ids may visually truncate).

## When NOT to use

- Raw memory lookups → use `/recall`.
- Listing all pages → `list_pages_recent` MCP tool or
  `ls ~/.origin/pages/`.
- Reading the full body → open the md file in the user's editor.
