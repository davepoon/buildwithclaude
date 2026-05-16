# Origin

AI work memory for Claude Code. Origin carries sessions, decisions, lessons, and project context forward, then turns them into searchable memory and wiki pages.

## 30-Second Setup

```text
0s   /plugin marketplace add davepoon/buildwithclaude
     /plugin install origin@buildwithclaude
5s   restart Claude Code
10s  /init   auto-installs daemon if missing, configures local memory,
            verifies daemon + MCP + round-trip, prints "Origin ready"
30s  /brief  (or /capture <something to remember>)
```

`/init` is self-healing — if the daemon isn't running and the `origin`
CLI isn't on PATH, it runs the install one-liner for you. No copy/paste,
no restart loop. The `SessionStart` hook only nudges you toward `/init`
if the daemon ever stops.

## Install

```text
/plugin marketplace add davepoon/buildwithclaude
/plugin install origin@buildwithclaude
```

Origin's upstream marketplace is also available from `7xuanlu/origin`.

The plugin metadata is defined in [`plugin.json`](plugin.json). MCP configuration is in [`../.mcp.json`](../.mcp.json), which delegates to [`../bin/origin-mcp-runner.sh`](../bin/origin-mcp-runner.sh).

The runner picks the MCP server binary in three paths, in order:

1. **Filesystem override** — if `plugin/bin/origin-mcp.local` exists (typically a symlink to a locally-built binary, gitignored), the runner exec's it. Most reliable: survives plugin reloads that don't re-read env.
2. **Env var override** — `ORIGIN_MCP_DEV_BIN=/abs/path/to/origin-mcp`. Convenient if you already export it; requires Claude Code to inherit the var at startup.
3. **Default** — `npx -y origin-mcp@^X.Y.Z`. What end users get after installing the plugin.

To set up the filesystem override during dev:

```
cargo build -p origin-mcp --release
ln -s $(pwd)/target/release/origin-mcp plugin/bin/origin-mcp.local
```

Reload the plugin (`/reload-plugins`) and the wrapper picks the local binary on the next MCP spawn.

## Daily Commands

```text
/init       set up + verify Origin works (run once, or to diagnose)
/help       one-screen reference
/brief      load identity + topic context (start of session)
/capture    save one durable memory in flow
/recall     search local memory
/distill    synthesize pages from clusters (scoped to current repo)
/read       preview a distilled page inline
/review     audit pending memories
/forget     delete a memory by ID
/handoff    end-of-session debrief
/debrief    alias for /handoff (brief/debrief symmetry)
```

A `SessionStart` hook (`hooks/check-daemon.sh`) probes the local daemon at `127.0.0.1:7878`. If down, it prints a single line: `daemon not running. Run /origin:init to set up.` The skill owns the install logic — the hook is just a nudge. Hook never blocks the session.

## Where your data lives

```text
~/.origin/pages/               wiki pages distilled from memories (md)
~/.origin/sessions/            session logs by date (md)
~/.origin/sessions/_status/    current per-project goals + last-handoff timestamp
~/.origin/db/                  symlink to the libSQL store
~/.origin/bin/                 installed binaries
```

Browse with `open ~/.origin/` (Finder), `code ~/.origin/` (VS Code), or symlink `~/.origin/pages/` into an Obsidian vault for the graph view. No Tauri app required.

## Local memory and agent-side model phases

By default `/init` configures **local memory**: no model download, no API
key, no prompts. The daemon stores, embeds, dedupes, and serves hybrid
search. Model-backed work like classification, entity extraction, page
synthesis, and reranking stays opt-in.

The skills compensate. Where the daemon would normally call a model, the
skill asks Claude itself to do the equivalent step and posts the result
back via HTTP:

| Phase | Model-equipped daemon | Local memory + skill |
|---|---|---|
| Pick `memory_type` | daemon classifier | `/capture` picks one of 6 types from content |
| Extract entities/relations | daemon `extract.rs` | `/capture` POSTs to `/api/memory/entities` and `/api/memory/relations` |
| Synthesize a page | daemon distill cycles + `/distill` | `/distill` reads the cluster, writes the page, POSTs to `/api/pages` |
| Expand a query / rerank hits | daemon expansion + rerank | `/recall` rewrites the query before search and reorders hits after |

The daemon stays the single writer and storage owner. Claude does the
thinking. This is why local memory works without an API key or
on-device model — and why the same skills also work when you later add
one. The skills detect the daemon's capabilities and fall through to
the agent path when needed.

## Skill Files

The actual skill instructions live in [`../skills`](../skills):

- `init`: end-to-end setup verifier (daemon + MCP + round-trip)
- `help`: one-screen quick reference
- `brief`: load session context
- `capture`: save one durable memory
- `recall`: targeted lookup
- `distill`: refresh wiki pages
- `read`: preview a distilled page inline
- `review`: audit pending memories
- `forget`: delete a memory by ID
- `handoff`: capture end-of-session decisions, lessons, gotchas, and open threads
- `debrief`: alias for `handoff` (brief/debrief symmetry)

## License

Apache-2.0.
