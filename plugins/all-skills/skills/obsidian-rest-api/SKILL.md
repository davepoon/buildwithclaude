---
name: obsidian-rest-api
category: development-code
license: MIT
description: Call the Obsidian Local REST API directly (over HTTP) for vault operations the mcp__obsidian__* tools do NOT expose — move/rename a note, overwrite a whole file atomically (PUT), act on the currently-open active file, run an Obsidian command, open a note in the UI, list all tags, or do date-specific periodic-note CRUD. Prefer the mcp__obsidian__* tools for plain read/append/patch/delete/search; fall back to this skill only when the required method is missing from MCP.
---

# Obsidian Local REST API

The connected `obsidian` MCP server exposes only a subset of the Obsidian
[Local REST API](https://coddingtonbear.github.io/obsidian-local-rest-api/)
(plugin `obsidian-local-rest-api`). This skill provides the full API surface plus
an authenticated request wrapper, so a missing MCP method is called over HTTP
instead of being worked around with hacks (e.g. delete+recreate to rename a note).

## When to Use This Skill

Use the `mcp__obsidian__*` tools first for read, append, patch, delete, and search.
Fall back to this skill only for operations that have **no MCP tool**:

- Move / rename a note (preserves history, updates internal links)
- Overwrite a whole file atomically (PUT) instead of delete+recreate
- Act on the currently-open "active" file in the Obsidian UI
- Run an Obsidian command from the command palette
- Open / focus a note in the UI
- List all vault tags with counts
- Create/update/delete date-specific periodic notes

## What This Skill Does

1. Resolves the API host, port, and key from the connected obsidian MCP server
   config (`~/.claude.json`) or `OBSIDIAN_*` env vars — no hardcoded secrets.
2. Handles the plugin's self-signed TLS certificate.
3. Exposes every endpoint of the Local REST API (see `references/api_reference.md`),
   with the header enums (Operation, Target-Type, Target-Scope), the custom
   `MOVE` contract, and the search (JsonLogic/Dataview) formats.

## How to Use

Call the wrapper `scripts/olrapi.sh <METHOD> <path> [curl args...]`:

```bash
S=scripts/olrapi.sh   # adjust to the skill's install path

# rename/move a note (the most common reason to reach for this skill)
"$S" MOVE "/vault/Path/To/Old Name.md" -H 'Destination: Path/To/New Name.md'

# move into a folder, keeping the filename (trailing slash on Destination)
"$S" MOVE "/vault/Inbox/todo.md" -H 'Destination: Archive/'

# atomically overwrite a whole note
"$S" PUT "/vault/Path/Note.md" -H 'Content-Type: text/markdown' --data-binary @/tmp/body.md

# read a note as structured JSON (frontmatter + tags + stat)
"$S" GET "/vault/Path/Note.md" -H 'Accept: application/vnd.olrapi.note+json'

# list tags, run a command, open a note in the UI
"$S" GET /tags/
"$S" POST "/commands/editor:toggle-bold/"
"$S" POST "/open/Path/Note.md?newLeaf=true"
```

The wrapper prints `<<HTTP nnn>>` after the body. Success: `200`/`204`.
On `MOVE`, `409` means the destination exists — add `-H 'Allow-Overwrite: true'` to force.
For non-trivial calls, load `references/api_reference.md`.

### Path & encoding rules

- `{filename}` is vault-relative (no leading slash on the vault path).
- Percent-encode non-ASCII in URL paths and in the `MOVE` `Destination` header
  (e.g. `r%C3%A9sum%C3%A9.md`). `Destination` rejects absolute (`/…`) paths.
- Target a sub-part of a note with `Target-Type` (`heading`|`block`|`frontmatter`)
  + `Target` headers on GET/PATCH/POST.

## Example

**User**: "Rename `3-Resources/Draft.md` to `3-Resources/Final.md` in my vault."

**Output**:
```bash
scripts/olrapi.sh MOVE "/vault/3-Resources/Draft.md" \
  -H 'Destination: 3-Resources/Final.md'
# <<HTTP 204>>  — moved, history preserved, internal links updated
```

## Tips

- Regenerate the reference against the live plugin if it was updated:
  `scripts/olrapi.sh GET /openapi.yaml`. `GET /` shows the plugin version.
- Prefer `PUT` over delete+recreate for whole-file overwrites — it is atomic and
  keeps the file's identity.
- The API serves HTTPS on port 27124 (self-signed → `curl -k`) and HTTP on 27123.
