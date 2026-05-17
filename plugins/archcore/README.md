# Archcore

**Make your AI code like it already knows your repo.**

Archcore gives coding agents the architecture, rules, and prior decisions of *this* repo — so new changes land where your project says they belong and follow the team's conventions, automatically. Git-native context (folder conventions, ADRs, team standards) lives in `.archcore/` next to your code, so every agent and every contributor reads from the same source of truth.

Works in **Claude Code**, **Cursor**, and **Codex CLI**. One source of truth, in Git.

## Why

- **Right placement** — New code lands where your conventions say it should, not wherever the agent guesses.
- **Standards apply themselves** — Rules load into the agent's context automatically.
- **Decisions persist** — ADRs captured once stay enforced across sessions and agents.
- **Team-wide** — Context is in Git, shared by humans and agents alike.

## Commands

| Command              | Outcome                                                | When to use                                                                 |
| -------------------- | ------------------------------------------------------ | --------------------------------------------------------------------------- |
| `/archcore:init`     | Make your repo legible to AI agents                    | First-time setup — seeds a stack rule, a run-the-app guide, and imports existing `CLAUDE.md` / `AGENTS.md` / `.cursorrules` |
| `/archcore:context`  | Load what's already decided before you change code     | Daily, before editing — pulls relevant rules, decisions, specs, and patterns |
| `/archcore:capture`  | Document what already lives in code                    | A module, API, pipeline, or integration has tribal knowledge but no doc yet |
| `/archcore:plan`     | Turn an idea into a scoped implementation plan         | New feature, refactor, or initiative                                        |
| `/archcore:decide`   | Record a decision and (optionally) make it a team rule | Capture rationale, consequences, and turn into an enforced standard         |
| `/archcore:audit`    | Find stale, missing, or drifting docs                  | Health check — `--deep` for full audit, `--drift` for code/doc staleness    |
| `/archcore:help`     | Navigate the skill catalog                             | When you forget which command fits                                          |

## What's included

| Component  | Details                                                                                       |
| ---------- | --------------------------------------------------------------------------------------------- |
| MCP server | `archcore` (init project, create/get/list/search/update/remove documents, manage relations)   |
| Agents     | `archcore-assistant`, `archcore-auditor`                                                      |
| Skills     | `init`, `context`, `capture`, `plan`, `decide`, `audit`, `help`                                |
| Hooks      | `SessionStart`, write/code-alignment guards, post-document validation, cascade & precision    |
| Rules      | Cursor `.mdc` files (architecture-context, file ownership)                                    |

## Document types

`.archcore/` stores Markdown with YAML frontmatter. Categories are derived from the type in the filename (`slug.type.md`):

- **knowledge** — `adr` (decisions), `rfc` (proposals), `rule` (standards), `guide` (how-tos), `doc` (reference), `spec` (contracts)
- **vision** — `prd`, `idea`, `plan`, `mrd`, `brd`, `urd`, `srs`
- **experience** — `task-type`, `cpat` (code patterns)

Documents can be linked with directed relations stored in the sync manifest.

## Install

Archcore plugins require the **Archcore CLI** on `PATH` — it serves the MCP server the plugin talks to. The CLI is **not bundled** with the plugin; install it separately:

```bash
# macOS / Linux / WSL
curl -fsSL https://archcore.ai/install.sh | bash

# Windows (PowerShell 5.1+)
irm https://archcore.ai/install.ps1 | iex
```

Verify: `archcore --version` · Update: `archcore update`

Then add the plugin from the upstream marketplace:

```bash
/plugin marketplace add archcore-ai/plugin
/plugin install archcore@archcore-plugins
```

This buildwithclaude listing is for discovery only — install from the upstream marketplace above so the plugin and CLI stay in sync.

## Links

- [GitHub](https://github.com/archcore-ai/plugin)
- [Docs](https://docs.archcore.ai)
- License: Apache-2.0
