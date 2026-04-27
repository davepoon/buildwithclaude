# Archcore

Make your AI agent code with your project's architecture, rules, and decisions. Git-native context (folder conventions, ADRs, team standards) lives in `.archcore/` next to your code, so every agent and every contributor reads from the same source of truth.

## Why

- **Right placement** — New code lands where your conventions say it should, not wherever the agent guesses.
- **Standards apply themselves** — Rules load into the agent's context automatically.
- **Decisions persist** — ADRs captured once stay enforced across sessions and agents.
- **Team-wide** — Context is in Git, shared by humans and agents alike.

## What's included

| Component   | Details                                                                                                                                                                                         |
| ----------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| MCP server  | `archcore` (init project, create/get/list/search/update/remove documents, manage relations)                                                                                                     |
| Agents      | `archcore-assistant`, `archcore-auditor`                                                                                                                                                        |
| Skills (18) | architecture-track, bootstrap, capture, context, decide, plan, review, verify, status, graph, help, actualize, feature-track, iso-track, product-track, sources-track, standard, standard-track |
| Hooks       | session-start, cursor sync                                                                                                                                                                      |
| Rules       | Cursor `.mdc` files (architecture-context, file ownership)                                                                                                                                      |

## Document types

`.archcore/` stores Markdown with YAML frontmatter. Categories are derived from the type in the filename (`slug.type.md`):

- **knowledge** — `adr` (decisions), `rfc` (proposals), `rule` (standards), `guide` (how-tos), `doc` (reference), `spec` (contracts)
- **vision** — `prd`, `idea`, `plan`, `mrd`, `brd`, `urd`, `srs`
- **experience** — `task-type`, `cpat` (code patterns)

Documents can be linked with directed relations stored in the sync manifest.

## Install

```bash
/plugin marketplace add archcore-ai/archcore-plugin
/plugin install archcore@archcore-plugin
```

The plugin ships a launcher in `bin/` that backs the MCP server, so install from the upstream marketplace above — this buildwithclaude listing is for discovery only.

## Links

- [GitHub](https://github.com/archcore-ai/archcore-plugin)
- License: Apache-2.0
