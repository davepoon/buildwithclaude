# claude-snapshot

Portable Claude Code setup snapshots. Export your config, plugins, hooks, and global instructions — apply on another machine in under 2 minutes.

## Why

- **Multiple machines** — Keep personal and work setups in sync. Export at home, drop the file on Drive, apply at work.
- **OS reinstall / Mac format** — Save a snapshot before wiping. Restore your entire Claude Code setup after a fresh install.
- **Safe rollback** — About to experiment with new plugins or risky config changes? Take a snapshot first.
- **Onboarding** — Share your team's snapshot and new members are up and running with the same plugins, hooks, and conventions.

## Commands

| Command | Description |
|---|---|
| `/snapshot:export` | Export your setup as a portable `.tar.gz` snapshot |
| `/snapshot:export --full` | Include plugin caches for offline restore |
| `/snapshot:export --output <path>` | Custom output path |
| `/snapshot:inspect <path>` | Preview snapshot contents without extracting |
| `/snapshot:diff <path>` | Compare a snapshot against your current setup |
| `/snapshot:apply <path>` | Apply a snapshot to this machine (with confirmation) |

## What migrates

| Artifact | Included |
|---|---|
| `settings.json` (plugins, hooks, permissions, env, statusLine) | Yes |
| `CLAUDE.md` + other global `.md` files | Yes |
| Plugin manifests + marketplace registrations | Yes |
| Hook scripts | Yes |
| MCP servers (`mcpServers` key only — OAuth tokens excluded) | Yes (report only on apply) |
| Plugin caches (with `--full`) | Yes |
| Sessions, history, telemetry | No |
| Project-scoped plugins | No |

## Install

```bash
/plugin marketplace add adhenawer/claude-snapshot
/plugin install snapshot@claude-snapshot
```

## Links

- [GitHub](https://github.com/adhenawer/claude-snapshot)
