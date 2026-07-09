# context-memory

Persistent memory for your coding agent. Claude Code is brilliant but amnesiac: every session starts cold, re-learns your codebase's quirks, re-litigates settled decisions, and re-walks ruled-out dead ends. context-memory captures those decisions, gotchas, and dead ends automatically as you work and surfaces the relevant ones at session start and on every prompt.

- **Auto-capture** — an end-of-turn hook nudges the agent to save what was genuinely learned (a decision, a gotcha, a dead end), so knowledge lands in the store instead of evaporating between sessions.
- **Auto-recall** — a `SessionStart` hook injects this repo's "where you left off" plus durable project facts, and a pre-fetch hook searches your store on every prompt and injects the top hits, scoped to your current repo.
- **Ranked by proven usefulness** — recall is re-ranked by what has actually been used, not just semantic similarity, so load-bearing knowledge rises.
- **Topics** — related contexts get compiled into durable, editable syntheses instead of staying scattered.
- **Auditable** — supersede and retract semantics keep a tombstoned history rather than silently overwriting.

Unlike a hand-maintained `CLAUDE.md`, it is auto-captured, auto-recalled, and ranked (no drift). Unlike RAG, it stores derived decisions and facts (recall), not document chunks (retrieval).

## Install

Requires a free API key. Sign up at <https://context-memory.slova.app/signup/>, then export the key and add the marketplace:

```bash
export CONTEXT_MEMORY_API_KEY="cm_..."
```

```
/plugin marketplace add SlovaApplications/claude-plugins
/plugin install context-memory@slova
```

Full setup guide: <https://context-memory.slova.app/get-started/>

## Privacy

The plugin is a client for a hosted backend. On each prompt it sends the first 500 bytes of your prompt to the search API; memories you save are stored under your account. Your Claude Code transcripts stay local. All requests use HTTPS. See the plugin repo's README for full details.

## Links

- Homepage: <https://context-memory.slova.app>
- Source and full docs: <https://github.com/SlovaApplications/claude-plugins>
- License: MIT
