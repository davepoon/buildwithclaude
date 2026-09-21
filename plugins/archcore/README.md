# Archcore

**Spec-Driven Development & Context Engineering for AI Coding Agents**

Make your AI coding agent work like it already knows your repo.

Archcore brings spec-driven development and automatic project context to Claude Code, Cursor, Codex, and GitHub Copilot. Specs, architecture, decisions, rules, and plans live in Git and are applied as the agent works.

The plugin pairs with Archcore CLI: the CLI provides the git-native context layer and MCP tools; the plugin adds skills, slash commands, gated tracks, routing, and guardrails.

## Commands

Describe what you want in plain English; the commands below are shortcuts. Everyday context needs no command: hooks load the rules and specs that apply when the agent edits a file.

| Command              | Outcome                                              |
| -------------------- | ---------------------------------------------------- |
| `/archcore:init`     | Make your repo legible to AI agents. `/archcore:init import` converts `CLAUDE.md`, `AGENTS.md`, rule files, and ADR folders into typed documents |
| `/archcore:plan`     | Turn an idea into a scoped implementation plan       |
| `/archcore:document` | Record a decision or document what lives in code     |
| `/archcore:review`   | Check your changes and your docs against each other  |

## What's included

| Component | Details |
| --------- | ------- |
| Skills    | `init`, `plan`, `document`, `review` |
| Agents    | `archcore-assistant`, `archcore-auditor` |
| Hooks     | `SessionStart`, `PreToolUse`, `PostToolUse` |
| MCP tools | served by the Archcore CLI (`archcore mcp`) |

## Install

The plugin needs the **Archcore CLI** on `PATH`; the CLI serves the MCP tools the plugin uses.

```bash
# macOS / Linux / WSL
curl -fsSL https://archcore.ai/install.sh | bash

# Windows (PowerShell 5.1+)
irm https://archcore.ai/install.ps1 | iex
```

Then add the plugin, from this marketplace or from the upstream one:

```bash
/plugin marketplace add davepoon/buildwithclaude
/plugin install archcore@buildwithclaude

# or upstream
/plugin marketplace add archcore-ai/plugin
/plugin install archcore@archcore-plugins
```

## Links

- [GitHub](https://github.com/archcore-ai/plugin)
- [Docs](https://docs.archcore.ai)
- License: Apache-2.0
