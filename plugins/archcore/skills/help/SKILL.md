---
name: help
description: "Show available Archcore commands and how to use them. Use when onboarding, exploring what skills are available, or when you're not sure which command to run."
---

# /archcore:help

Guide to what you can do with the Archcore plugin.

## When to use

- "What can I do with Archcore?"
- "Help"
- "What commands are available?"

## Routing table

No routing needed. Single behavior: present the command guide.

## Execution

Present the following guide:

---

## Quick Start

Most users start here. Describe what you need — the system picks the right document types automatically.

| Command | What it does |
|---|---|
| `/archcore:capture [topic]` | Document a module, component, or topic |
| `/archcore:plan [feature]` | Plan a feature end-to-end (idea → PRD → plan) |
| `/archcore:decide [topic]` | Record a technical decision |
| `/archcore:standard [topic]` | Establish a team standard (decision → rule → guide) |
| `/archcore:review` | Dashboard of document counts and stats; `--deep` for a full health audit |
| `/archcore:actualize` | Detect stale docs and suggest updates |
| `/archcore:bootstrap` | Seed an empty repo with initial Archcore docs |
| `/archcore:context [path or topic]` | Surface rules and decisions for a code area |
| `/archcore:help` | Show this guide |

**Tip:** You can also just describe what you need in natural language. The agent will pick the right command automatically.

## Advanced — Multi-Document Flows

For users who know which documentation flow they need:

| Command | Flow |
|---|---|
| `/archcore:product-track [topic]` | idea → PRD → plan |
| `/archcore:sources-track [topic]` | MRD → BRD → URD |
| `/archcore:iso-track [topic]` | BRS → StRS → SyRS → SRS |
| `/archcore:architecture-track [topic]` | ADR → spec → plan |
| `/archcore:standard-track [topic]` | ADR → rule → guide |
| `/archcore:feature-track [topic]` | PRD → spec → plan → task-type |

## Direct Document Creation

There are no per-type slash commands. Create documents through the intent and track commands above, or call `mcp__archcore__create_document` directly when you need exact type-level control.

- **Market / business / user requirements (`mrd` / `brd` / `urd`):** use `/archcore:sources-track [topic]`
- **ISO 29148 cascade (`brs` → `strs` → `syrs` → `srs`):** use `/archcore:iso-track [topic]`
- **Direct creation for any type:** call the `mcp__archcore__create_document` tool with `type=<slug>`.

## Setup

If Archcore commands fail with MCP tool errors, the CLI needs to be installed:

1. **Install CLI:** `curl -fsSL https://archcore.ai/install.sh | bash`
2. **Initialize project:** `archcore init`
3. **Restart** the session

The plugin provides skills, agents, and hooks — but document operations (create, update, delete) require the Archcore CLI, which runs the MCP server.

---

## Result

The guide above, presented as-is. No additional commentary needed.
