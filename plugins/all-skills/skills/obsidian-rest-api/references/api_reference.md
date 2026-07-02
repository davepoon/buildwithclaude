# Obsidian Local REST API — full endpoint reference

Plugin: **Local REST API with MCP** (`obsidian-local-rest-api`), spec `openapi 3.2.0`, plugin v4.1.x.
16 paths. This file is the authoritative surface to fall back on when an MCP tool is missing.

## Connection & auth

- Transport: HTTPS on port **27124** (self-signed cert → `curl -k`). Plain HTTP is served on **27123**.
- Auth: `Authorization: Bearer <API_KEY>` on every request (except `/` and `/obsidian-local-rest-api.crt`).
- Credentials live in the connected MCP server env (`~/.claude.json` → obsidian server → `OBSIDIAN_API_KEY` / `OBSIDIAN_HOST` / `OBSIDIAN_PORT`). `scripts/olrapi.sh` resolves them automatically.
- Servers template: `https://{host}:{port}`.

## Common headers (content-targeting)

Many read/patch endpoints accept these headers to target a sub-part of a note instead of the whole file:

- `Target-Type`: `heading` | `block` | `frontmatter`
- `Target`: the section to target (heading text, block id, or frontmatter key). Required when `Target-Type` set.
- `Target-Delimiter`: nested-heading delimiter, default `::` (e.g. `Heading 1::Subheading`).
- `Target-Scope` (PATCH only): `content` | `marker` | `markerAndContent`.

PATCH-specific control headers:

- `Operation` (required): `append` | `prepend` | `replace`
- `Create-Target-If-Missing`: `true` | `false`
- `Reject-If-Content-Preexists`: `true` | `false`
- `Trim-Target-Whitespace`: `true` | `false`

Body content types: `text/markdown` for content; `application/json` for structured PATCH (e.g. frontmatter values); PUT accepts `*/*` (arbitrary file bytes) or `text/markdown`.

---

## Endpoints

### Server / meta
| Method | Path | Purpose | Auth |
|---|---|---|---|
| GET | `/` | Server status + plugin/obsidian versions + cert info | no |
| GET | `/openapi.yaml` | This OpenAPI spec | yes |
| GET | `/obsidian-local-rest-api.crt` | The API's TLS certificate (for pinning/trust) | no |

### Active file (the note currently open in the Obsidian UI)
| Method | Path | Purpose |
|---|---|---|
| GET | `/active/` | Read active file content (supports Target-* headers) |
| PUT | `/active/` | Replace active file content (body `*/*` or `text/markdown`) |
| POST | `/active/` | Append to active file (body `text/markdown`, supports targeting) |
| PATCH | `/active/` | Partial update (Operation + Target-* required) |
| DELETE | `/active/` | Delete the active file |

### Vault files
| Method | Path | Purpose |
|---|---|---|
| GET | `/vault/` | List files in vault root |
| GET | `/vault/{pathToDirectory}/` | List files in a directory (trailing slash) |
| GET | `/vault/{filename}` | Read a file. Default returns raw markdown; send `Accept: application/vnd.olrapi.note+json` for NoteJson (content+frontmatter+tags+stat+path). Target-* headers supported. |
| PUT | `/vault/{filename}` | **Create OR overwrite** a file (body `*/*` or `text/markdown`). The clean way to replace a whole note. |
| POST | `/vault/{filename}` | Append to a new/existing file (body `text/markdown`) |
| PATCH | `/vault/{filename}` | Partial update (Operation + Target-* required) — insert under a heading, set a frontmatter key, replace a block |
| DELETE | `/vault/{filename}` | Delete a file |
| **MOVE** | `/vault/{filename}` | **Rename/move** a file (see below). Custom HTTP method. |

#### MOVE (rename / move) — the headline REST-only capability
Custom HTTP method `MOVE` on `/vault/{filename}`. Preserves file history and updates internal links.

- `Destination` header (**required**): new vault-relative path. `..` allowed if result stays in vault; absolute `/`-paths rejected. Trailing slash keeps source filename (e.g. `archive/` moves `notes/todo.md` → `archive/todo.md`). Percent-encode non-ASCII (`r%C3%A9sum%C3%A9.md`).
- `Allow-Overwrite` header: `true` | `false` (default `false` → `409` if destination exists).
- Responses: `204` success (with `Content-Location` header = new path), `400` bad/missing Destination or path escapes vault, `404` source not found, `409` destination exists.

```bash
scripts/olrapi.sh MOVE "/vault/3-Resources/Investigate/Thread-Keeper/Old.md" \
  -H 'Destination: 3-Resources/Investigate/Thread-Keeper/New.md'
```

### Periodic notes (`{period}` = `daily` | `weekly` | `monthly` | `quarterly` | `yearly`)
| Method | Path | Purpose |
|---|---|---|
| GET/PUT/POST/PATCH/DELETE | `/periodic/{period}/` | CRUD on the CURRENT periodic note for that period |
| GET/PUT/POST/PATCH/DELETE | `/periodic/{period}/{year}/{month}/{day}/` | CRUD on the periodic note for a SPECIFIC date |

Same body/targeting semantics as vault endpoints.

### Search
| Method | Path | Purpose |
|---|---|---|
| POST | `/search/simple/` | Text search. Query params: `query` (required), `contextLength` (optional). |
| POST | `/search/` | Advanced search. Body content type selects the engine: `application/vnd.olrapi.jsonlogic+json` (JsonLogic, supports `glob`/`regexp` ops over `frontmatter.*`, `tags`, `content`) — also Dataview DQL via its own content type. Returns matching filenames + results. |

JsonLogic example (notes whose frontmatter.url matches):
```json
{ "or": [
  {"===": [{"var": "frontmatter.url"}, "https://x/"]},
  {"glob": [{"var": "frontmatter.url-glob"}, "https://x/*"]}
]}
```

### Tags
| Method | Path | Purpose |
|---|---|---|
| GET | `/tags/` | List all tags in the vault with counts. |

### Commands (Obsidian command palette)
| Method | Path | Purpose |
|---|---|---|
| GET | `/commands/` | List available command IDs + names. |
| POST | `/commands/{commandId}/` | Execute a command by id (e.g. `editor:toggle-bold`, plugin commands). |

### Open in UI
| Method | Path | Purpose |
|---|---|---|
| POST | `/open/{filename}` | Open a file in the Obsidian UI. Query `newLeaf=true` opens in a new pane. |

### MCP passthrough (usually ignore — we already have MCP tools)
| Method | Path | Purpose |
|---|---|---|
| POST | `/mcp/` | JSON-RPC 2.0 to the plugin's own MCP server. |
| GET | `/mcp/` | SSE stream for an MCP session (`Mcp-Session-Id` header). |

---

## MCP-tool ↔ REST coverage (when to fall back)

Already covered by `mcp__obsidian__*` tools (prefer these):
`list_files_in_vault` → GET /vault/ · `list_files_in_dir` → GET /vault/{dir}/ · `get_file_contents` → GET /vault/{file} · `batch_get_file_contents` → N× GET · `append_content` → POST /vault/{file} · `patch_content` → PATCH /vault/{file} · `delete_file` → DELETE /vault/{file} · `simple_search` → POST /search/simple/ · `complex_search` → POST /search/ · `get_periodic_note`/`get_recent_periodic_notes` → GET /periodic/... · `get_recent_changes` (plugin helper).

**REST-only (no MCP tool → use `olrapi.sh`):**
- **MOVE `/vault/{filename}`** — rename/move a note (history + link updates). No MCP equivalent.
- **PUT `/vault/{filename}`** — atomic whole-file create/overwrite. MCP only appends/patches; overwriting via MCP needs delete+recreate. Use PUT instead.
- **Active-file ops** (`/active/` GET/PUT/POST/PATCH/DELETE) — act on the note open in the UI.
- **`/commands/` + POST `/commands/{id}/`** — run Obsidian commands.
- **POST `/open/{filename}`** — open/focus a note in the UI.
- **GET `/tags/`** — vault-wide tag list with counts.
- **Periodic PUT/POST/PATCH/DELETE** and **specific-date periodic** endpoints.

## Response notes
- NoteJson (with `Accept: application/vnd.olrapi.note+json`): `{ path, content, frontmatter, tags, stat:{ctime,mtime,size} }`.
- Errors: `{ "errorCode": <int>, "message": <str> }` (schema `Error`).
- Success without body: `204`. Bad targeting/headers: `400`. Missing file: `404`. Method not allowed on target: `405`. MOVE destination exists: `409`.

## Source of truth
Regenerate against the live instance anytime: `scripts/olrapi.sh GET /openapi.yaml`. The plugin version and any `apiExtensions` show in `GET /`.
