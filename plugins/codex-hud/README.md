# codex-hud

[![GitHub stars](https://img.shields.io/github/stars/haenara-shin/codex-hud?style=social)](https://github.com/haenara-shin/codex-hud/stargazers)
[![GitHub forks](https://img.shields.io/github/forks/haenara-shin/codex-hud?style=social)](https://github.com/haenara-shin/codex-hud/network/members)
[![GitHub watchers](https://img.shields.io/github/watchers/haenara-shin/codex-hud?style=social)](https://github.com/haenara-shin/codex-hud/watchers)
[![GitHub license](https://img.shields.io/github/license/haenara-shin/codex-hud)](https://github.com/haenara-shin/codex-hud/blob/main/LICENSE)

**[Korean / 한국어](README_KR.md)**

A [Claude Code](https://claude.ai/code) plugin that displays OpenAI Codex usage and rate limits — right inside your Claude Code session.

## Why?

If you use [codex-plugin-cc](https://github.com/openai/codex-plugin-cc) to delegate tasks to Codex from Claude Code, you have no way to check your Codex rate limits without leaving your terminal. **codex-hud** fills that gap.

| Existing Tool | What It Does | What It Doesn't Do |
|---|---|---|
| [claude-hud](https://github.com/jarrodwatts/claude-hud) | Shows Claude Code context, tools, costs | No Codex/OpenAI data |
| [codex-plugin-cc](https://github.com/openai/codex-plugin-cc) | Runs Codex tasks from Claude Code | No usage/rate limit tracking |
| [ccusage](https://github.com/ryoppippi/ccusage) | CLI tool for local log analysis | Not a Claude Code plugin |
| **codex-hud** | **Codex usage + rate limits inside Claude Code** | -- |

## Features

- **Real-time statusline**: Integrates with [claude-hud](https://github.com/jarrodwatts/claude-hud) to show Codex Usage/Weekly rate limits alongside Claude Code's own statusline
- **Slash commands**: Dedicated commands for usage, costs, and summary
- **Dual data sources**: Local Codex CLI session logs (no API key needed) + OpenAI Usage API (optional, for dollar costs)
- **Zero npm runtime dependencies**: Only uses Node.js built-in modules (statusline wrapper requires Bash and Perl)
- **Graceful degradation**: Works with just local logs if no API key is configured

## Statusline Integration

When paired with [claude-hud](https://github.com/jarrodwatts/claude-hud), codex-hud adds Codex rate limits below the Claude Code statusline:

```
[Opus 4.6 (1M context)]              <- claude-hud
my-project
Context ██░░░░░░░░ 19%
Usage   █░░░░░░░░░ 14% (resets in 4h 37m)
Weekly  ██░░░░░░░░ 22% (resets in 5d 18h)
── Codex team ──                      <- codex-hud
Usage   █░░░░░░░░░ 1% (resets in 5h)
Weekly  ░░░░░░░░░░ 0% (resets in 7d)
1 session | team
```

## Installation

### Option A: via buildwithclaude marketplace

```
/plugin marketplace add davepoon/buildwithclaude
/plugin install codex-hud@buildwithclaude
```

### Option B: via this repo directly

```
/plugin marketplace add haenara-shin/codex-hud
/plugin install codex-hud@codex-hud
```

### Option C: from source

```bash
git clone https://github.com/haenara-shin/codex-hud.git
cd codex-hud
npm install && npm run build
```

Then in Claude Code:

```
/plugin marketplace add /path/to/codex-hud
/plugin install codex-hud@codex-hud
```

### Statusline setup

After installing the plugin, run:

```
/codex-hud:setup
```

This command is idempotent and only touches the statusline integration:
- Creates the symlink at `~/.claude/codex-hud-statusline.sh`
- Updates `~/.claude/settings.json` so the Codex rate limits appear below claude-hud's statusline

Restart Claude Code or run `/reload-plugins` to see the Codex statusline.

To enable dollar cost tracking (optional, requires OpenAI Admin API key):

```
/codex-hud:setup-key
```

To remove the statusline integration: `node "${CLAUDE_PLUGIN_ROOT}/dist/index.js" uninstall-statusline`

## Setup

### 1. Local logs (automatic)

If you use the [Codex CLI](https://github.com/openai/codex) or [codex-plugin-cc](https://github.com/openai/codex-plugin-cc), session logs at `~/.codex/sessions/` are parsed automatically. No configuration needed.

### 2. OpenAI Usage API (optional, for dollar costs)

To see dollar costs, you need an **OpenAI Admin API key**:

1. Go to [platform.openai.com/settings/organization/admin-keys](https://platform.openai.com/settings/organization/admin-keys)
2. Create an Admin key (starts with `sk-admin-...`)
3. Run `/codex-hud:setup` in Claude Code and enter the key

Or set the `OPENAI_ADMIN_KEY` environment variable.

> **Note**: If you're on a Teams/Enterprise subscription, dollar costs may not be relevant since usage is included in your plan. The local log-based rate limit tracking works without any API key.

## Commands

### `/codex-hud:setup`

Configure and verify your OpenAI Admin API key.

### `/codex-hud:usage-today` / `usage-week` / `usage-month`

Show token usage broken down by metrics.

```
## Codex Usage - Last 7 Days

### Local Sessions (10 sessions)

| Metric       | Tokens   |
|--------------|----------|
| Input        | 3.4M     |
| Cached Input | 2.7M     |
| Output       | 114.9k   |
| Reasoning    | 82.4k    |
| **Total**    | **3.5M** |

Rate limit: 6.0% (5h) / 14.0% (7d) | Plan: team
```

### `/codex-hud:costs-today` / `costs-week` / `costs-month` *(beta)*

Show cost breakdown by billing line item (requires Admin API key).

> **Beta**: This feature has not been tested with a live Admin API key. If you're on a pay-per-token plan and encounter incorrect data, please [open an issue](https://github.com/haenara-shin/codex-hud/issues).

### `/codex-hud:summary`

Quick one-line summary of today's Codex activity.

```
Codex today: $1.23 | 1.8M tokens (1.4M cached) | 3 sessions | Rate: 1%/0%
```

## Data Sources

| Source | Data | Auth Required |
|--------|------|---------------|
| Local Codex CLI logs (`~/.codex/sessions/`) | Token usage, rate limits, session count | None |
| OpenAI Usage API (`/v1/organization/costs`) | Dollar costs by billing line item | Admin API key |
| OpenAI Usage API (`/v1/organization/usage/completions`) | Org-wide token usage by model | Admin API key |

## Updating

To update to a newer version, **run both commands** (the plugin manager UI's "Update now" button alone does not refresh the marketplace cache):

```
/plugin marketplace update codex-hud
/plugin update codex-hud@codex-hud
/reload-plugins
```

Substitute `codex-hud` with your marketplace alias (e.g. `buildwithclaude`) if you installed via that marketplace.

## Requirements

- Node.js >= 18.0.0
- [Claude Code](https://claude.ai/code)
- [Codex CLI](https://github.com/openai/codex) or [codex-plugin-cc](https://github.com/openai/codex-plugin-cc)
- [claude-hud](https://github.com/jarrodwatts/claude-hud) (optional, for statusline integration)
- OpenAI Admin API key (optional, for cost data)

## License

MIT

## Star History

<a href="https://star-history.com/#haenara-shin/codex-hud&Date">
 <picture>
   <source media="(prefers-color-scheme: dark)" srcset="https://api.star-history.com/svg?repos=haenara-shin/codex-hud&type=Date&theme=dark" width="600" />
   <source media="(prefers-color-scheme: light)" srcset="https://api.star-history.com/svg?repos=haenara-shin/codex-hud&type=Date" width="600" />
   <img alt="Star History Chart" src="https://api.star-history.com/svg?repos=haenara-shin/codex-hud&type=Date" width="600" />
 </picture>
</a>
