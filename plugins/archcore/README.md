# Archcore Plugin

**Make your AI code like it already knows your repo.**

Archcore gives coding agents the architecture, rules, and past decisions of this repo — so new changes land in the right place and follow team conventions.

It works across sessions, across agents, and across host tools. When your team makes a new decision, Archcore can turn it into a rule the next code change respects.

## Install

No prerequisites. The plugin bundles a launcher that downloads the Archcore CLI on first use (cached between sessions).

**Claude Code** — inside `claude`:

```bash
/plugin marketplace add archcore-ai/plugin
/plugin install archcore@archcore-plugins
```

or from terminal:

```bash
claude plugin marketplace add archcore-ai/plugin
claude plugin install archcore@archcore-plugins
```

**Cursor** — requires Cursor 2.5+. Archcore is not yet on the official [Cursor Marketplace](https://cursor.com/marketplace), so install from GitHub via the Plugins panel:

1. Open Cursor → **Plugins**
2. Paste `https://github.com/archcore-ai/plugin` into the **Search or paste link** field
3. Click **Add Plugin**

Cursor reads the repo's `marketplace.json`, shows the plugin, and installs it.

**Codex CLI** — requires Codex CLI v0.117.0+ (March 2026 plugin system):

```bash
codex plugin marketplace add archcore-ai/plugin
codex
# then run /plugins, open Archcore, and select Install plugin
```

The Codex plugin browser groups plugins by marketplace. After install, start a new Codex thread and use `/archcore:*` slash commands, ask Codex to use Archcore in natural language, or type `@` and choose one of the bundled Archcore skills. MCP is plugin-managed (no manual `codex mcp add`). Codex hooks currently depend on Codex's `codex_hooks` feature/runtime support; enable `[features] codex_hooks = true` if you want Codex to execute the bundled hook guardrails. The launcher caches under `$CODEX_PLUGIN_DATA/archcore/cli/` when Codex provides that data directory, with XDG/local fallbacks for local development.

<details>
<summary>Local development, offline, enterprise, team rollouts</summary>

**Claude Code** — load the plugin for the current session:

```bash
claude --plugin-dir /path/to/plugin
```

**Cursor** — no `--plugin-dir` flag. Symlink the repo into Cursor's local plugins directory and reload the window:

```bash
ln -s /path/to/plugin ~/.cursor/plugins/local/archcore
# then in Cursor: Cmd/Ctrl+Shift+P → "Developer: Reload Window"
```

Both manifests (`.claude-plugin/plugin.json` and `.cursor-plugin/plugin.json`) live at the repo root.

**Cursor team rollouts** — add the GitHub URL under Dashboard → Settings → Plugins → Team Marketplaces → Import.

**Offline / BYO CLI** — if you already have the Archcore CLI installed (via `curl -fsSL https://archcore.ai/install.sh | bash`, `go install`, etc.), the launcher respects it — a global install on `PATH` wins over the plugin-managed cache.

For fully offline environments: install the CLI manually and set `ARCHCORE_SKIP_DOWNLOAD=1` to disable the launcher's auto-download. Alternatively, set `ARCHCORE_BIN=/abs/path/to/archcore` to pin an explicit binary.

</details>

## Try these first

Install, open your project, and try these three prompts. Each shows a different side of what your agent can now do.

_Empty repo? Run `/archcore:bootstrap` first to seed a stack rule, a run-the-app guide, and (optionally) imports from your existing CLAUDE.md / AGENTS.md / .cursorrules._

**1. "Before I change anything in `src/auth/`, what rules and prior decisions apply here?"**
Archcore loads the rules, ADRs, specs, and patterns tied to that path — grouped by type, ranked by specificity — before the agent edits code. Works the same way for a file, a directory, or a topic.

**2. "Add a new API handler and follow this repo's conventions."**
Archcore surfaces the relevant rule (e.g., "handlers live in `src/api/handlers/`") and injects it into context before the write. The agent places code where your architecture says it belongs, instead of guessing.

**3. "We picked PostgreSQL — record it as a team standard so future database changes respect it."**
Archcore records the decision as an ADR, codifies the constraint as a rule, and drafts a guide. Next time an agent edits database code, that rule is auto-injected — decision becomes an enforced constraint, not history buried in docs.

If any of these feels valuable, the rest of Archcore is more of the same, just structured.

## What changes after install

Without Archcore, the agent:

- guesses your folder structure
- re-litigates decisions your team already made
- needs the same conventions repeated in every chat
- loses project truth the moment the session ends

With Archcore, the same asks produce code that:

- lands where your architecture says it belongs
- respects ADRs, specs, and rules already in Git
- follows team conventions loaded automatically on session start
- reflects new decisions as future guardrails, not markdown graveyards

## Use Archcore when

- Your agent writes code, but not in the way this repo expects
- Your `CLAUDE.md` / `.cursorrules` / `AGENTS.md` keeps growing and drifting
- You work with 2+ agents or 2+ host tools (Claude Code + Cursor + Copilot)
- You want decisions, rules, and specs in Git — not in chat scrollback

**Not for** — chat memory, a prompt library, or a one-shot spec-to-code generator. Archcore is a repo truth layer for coding agents, not a methodology kit.

## Supported hosts

| Host            | Status      | Install            |
| --------------- | ----------- | ------------------ |
| **Claude Code** | Production  | Plugin marketplace |
| **Cursor**      | Implemented | Plugin marketplace |
| **Codex CLI**   | Implemented | Plugin marketplace |
| GitHub Copilot  | Planned     | —                  |

The plugin uses open standards (Agent Skills, MCP) — skills, agents, and MCP tools are shared across hosts. Only hooks and manifests are host-specific.

---

## How it works

1. **Session starts** — the session hook loads your project's document index and relations into context
2. **You ask for something** — "create a PRD for the auth redesign", "what ADRs relate to payments?", "audit the docs"
3. **Skills activate** — the agent matches your request to the right skill, which provides document-type knowledge, required sections, and relation guidance
4. **MCP tools execute** — all reads and writes go through `archcore mcp`, ensuring validation, template generation, and sync manifest updates
5. **Hooks guard quality** — direct `.archcore/` writes are blocked (MCP-only), and every change is validated automatically

### Mental model

Two pieces work together:

- **Archcore CLI — the compiler.** Reads `.archcore/`, builds the context graph, exposes it over MCP.
- **Archcore Plugin — the runtime.** Applies that context inside your AI agent — skills, guardrails, workflows.

## What ships in the box

- **16 Skills** — 9 intent workflows, 6 multi-step tracks, 1 utility
- **16 Codex slash commands** — thin command wrappers over the same skill workflows
- **2 Agents** — a universal assistant and a read-only auditor
- **Hooks** — session-start context loading, MCP-only write enforcement, post-mutation validation, cascade staleness detection

The plugin ships a launcher that resolves the [Archcore CLI](https://archcore.ai) (`archcore mcp`) and registers the MCP server automatically through host-specific bundled MCP configs: `.mcp.json` for Claude Code and `.codex.mcp.json` for Codex CLI. If the CLI isn't on `PATH`, the launcher downloads it on first use and caches it under `$CODEX_PLUGIN_DATA/archcore/cli/`, `$CLAUDE_PLUGIN_DATA/archcore/cli/`, or the local XDG cache. An existing global `archcore` install on `PATH` always wins — no duplicate-server conflicts.

## What you ask Archcore to do

Describe what you want in plain English — Archcore routes it to the right skill and document flow. The command is a shortcut, not the interface.

- **Understand what applies before a change** — `/archcore:context`
- **Document a module, component, or API** — `/archcore:capture`
- **Record a finalized decision** — `/archcore:decide`
- **Establish a team standard** — `/archcore:standard`
- **Plan a feature end-to-end** — `/archcore:plan`
- **Review documentation health (dashboard or `--deep` audit)** — `/archcore:review`
- **Detect stale docs after code drift** — `/archcore:actualize`
- **First-time onboarding** — `/archcore:bootstrap`
- **Navigate the system** — `/archcore:help`

### Document types (18)

Archcore supports 18 document types. There are no standalone per-type skills; intent and track commands inline the creation recipes for the document types they produce.

| Type        | Category   | What it captures                                     |
| ----------- | ---------- | ---------------------------------------------------- |
| `prd`       | vision     | Product requirements — goals, scope, success metrics |
| `idea`      | vision     | Low-commitment concepts and explorations             |
| `plan`      | vision     | Action plans — phased steps, milestones, ownership   |
| `mrd`       | vision     | Market landscape, TAM/SAM/SOM, competition           |
| `brd`       | vision     | Business objectives, stakeholders, ROI               |
| `urd`       | vision     | User personas, journeys, usability requirements      |
| `brs`       | vision     | Formal business requirements spec (ISO 29148)        |
| `strs`      | vision     | Formal stakeholder requirements spec (ISO 29148)     |
| `syrs`      | vision     | System boundary and interface spec (ISO 29148)       |
| `srs`       | vision     | Software functional/non-functional spec (ISO 29148)  |
| `adr`       | knowledge  | Architecture decisions with context and consequences |
| `rfc`       | knowledge  | Proposals open for review and feedback               |
| `rule`      | knowledge  | Mandatory team standards with rationale              |
| `guide`     | knowledge  | Step-by-step how-to instructions                     |
| `doc`       | knowledge  | Reference material — registries, glossaries, lookups |
| `spec`      | knowledge  | Technical contracts for systems and components       |
| `task-type` | experience | Recurring task patterns with proven workflows        |
| `cpat`      | experience | Before/after code pattern changes with scope         |

Create documents through intent commands such as `/archcore:decide`, `/archcore:capture`, and `/archcore:plan`; use `/archcore:sources-track` or `/archcore:iso-track` for niche requirements cascades. For exact type-level control, call `mcp__archcore__create_document` directly with the matching `type` parameter.

### Tracks (6)

Tracks orchestrate multi-document flows. Each step builds on the previous one, with proper relations created automatically.

| Track                | Flow                                         | Use when                                               |
| -------------------- | -------------------------------------------- | ------------------------------------------------------ |
| `product-track`      | idea &rarr; prd &rarr; plan                  | Lightweight product flow — simple and fast             |
| `sources-track`      | mrd &rarr; brd &rarr; urd                    | Discovery-focused — market, business, then user inputs |
| `iso-track`          | brs &rarr; strs &rarr; syrs &rarr; srs       | Formal ISO 29148 cascade with traceability             |
| `architecture-track` | adr &rarr; spec &rarr; plan                  | Design decisions flowing into implementation           |
| `standard-track`     | adr &rarr; rule &rarr; guide                 | Decision &rarr; codified standard &rarr; instructions  |
| `feature-track`      | prd &rarr; spec &rarr; plan &rarr; task-type | Full feature lifecycle                                 |

Invoke: `/archcore:product-track`, `/archcore:architecture-track`, etc.

## Agents

**archcore-assistant** — Universal read/write agent for complex multi-document tasks. Creates and updates documents, manages relations, handles requirement cascades. Uses the 8 document and relation MCP tools (full read/write surface).

**archcore-auditor** — Read-only background agent for documentation health. Detects coverage gaps, orphaned documents, stale statuses, broken relation chains, and naming inconsistencies. Safe by design — no write tools.

## Guardrails

The plugin enforces the **MCP-only principle**: all `.archcore/` operations must go through Archcore's MCP tools, never through direct file writes. This ensures every change is validated, templated, and synced.

- **Session start** — loads document index and relations into context, detects code-document drift
- **Write blocking** — intercepts and blocks direct Write/Edit calls targeting `.archcore/`
- **Validation** — runs `archcore doctor` after every document mutation
- **Cascade detection** — warns when an updated document has dependents that may need review

## Is Archcore like BMAD / Spec Kit / claude-mem / Memory Bank?

No — these solve different problems. Quick map:

| Tool                       | Category    | What it is                                                                       | How Archcore differs                                                                                                                        |
| -------------------------- | ----------- | -------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| **BMAD**                   | Methodology | Agentic SDLC methodology — 12+ roles, 34+ workflows, installer                   | Archcore stores _artifacts_; BMAD prescribes _process_. Durable knowledge in BMAD lives in generated skills, not relation-aware repo memory |
| **Superpowers**            | Methodology | Skills framework + dev methodology (TDD, plan writing, subagent-driven dev)      | Shapes _agent behavior_ during coding; Archcore provides _canonical project knowledge_ any agent can read                                   |
| **Spec Kit**               | Methodology | Spec-driven workflow: `specify → plan → tasks → implement`, one-shot             | Spec Kit is a one-shot handoff; Archcore maintains a living graph that evolves with the codebase                                            |
| **Agent OS**               | Methodology | Codebase standards extraction + spec-driven development, alongside IDE tools     | Closest positioning. Archcore adds typed documents, validated relations, and an optional ISO 29148 cascade for regulated teams              |
| **claude-mem**             | Memory      | Auto-captures session memory (SQLite + Chroma, MCP search, web viewer)           | claude-mem remembers _what you did_; Archcore stores _how the system is built and what was decided_                                         |
| **agentmemory**            | Memory      | Cross-agent memory server (hooks, BM25 + vector + graph, 4-tier consolidation)   | Infrastructure for recall over observations; Archcore is repo-native canonical knowledge                                                    |
| **OpenMemory / Mem0**      | Memory      | Memory infrastructure — SDK, MCP, self-hosted or managed                         | General-purpose agent memory; Archcore is project truth for coding agents                                                                   |
| **claude-brain**           | Memory      | One-file local memory (`.claude/mind.mv2`), searchable, portable                 | Solo session continuity; Archcore is a team-grade, relation-aware layer                                                                     |
| **Cline Memory Bank**      | Docs        | Fixed-schema markdown files (`projectbrief`, `activeContext`, `systemPatterns`…) | Same spirit, lower ceremony. Archcore adds typed relations, MCP validation, and multi-step cascades                                         |
| **codeplow / obsidian-kb** | Docs        | Per-project Obsidian vault with explicit handoff and file:line doc-audit         | Knowledge vault + auditing; Archcore is a typed context _compiler_ — less "notes", more "artifacts"                                         |

**Choose by what you need.** Pick a methodology tool (BMAD, Superpowers, Spec Kit, Agent OS) for an opinionated dev flow. Pick a memory tool (claude-mem, Mem0, agentmemory, claude-brain) for session continuity in general-purpose agents. Pick Archcore when you want typed, queryable _project truth_ — the decisions, rules, and architecture of _this_ repo — that your coding agent respects on every request.

## Philosophy

- **Context is a first-class artifact** — typed, validated, relation-aware Markdown in Git. Not a hidden prompt, not tribal knowledge.
- **Opinionated workflows over raw tool access** — skills route intent to the right document type and the right multi-step flow.
- **Minimal effort at the boundary** — the agent already knows the structure, so you describe intent, not schema.

## Roadmap

- Deeper IDE integrations (VS Code, JetBrains)
- Additional hosts (GitHub Copilot)
- Multi-agent coordination for long cascades
- Richer staleness and drift analytics

## Uninstallation

Claude Code:

```bash
/plugin uninstall archcore@archcore-plugins
```

Cursor: remove from plugin settings.

## License

[Apache-2.0](LICENSE)

## Contributing

Issues and ideas: [GitHub Issues](https://github.com/archcore-ai/plugin/issues)
