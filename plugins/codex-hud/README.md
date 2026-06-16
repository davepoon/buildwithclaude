# codex-hud

[![GitHub stars](https://img.shields.io/github/stars/haenara-shin/codex-hud?style=social)](https://github.com/haenara-shin/codex-hud/stargazers)
[![GitHub forks](https://img.shields.io/github/forks/haenara-shin/codex-hud?style=social)](https://github.com/haenara-shin/codex-hud/network/members)
[![GitHub watchers](https://img.shields.io/github/watchers/haenara-shin/codex-hud?style=social)](https://github.com/haenara-shin/codex-hud/watchers)
[![GitHub license](https://img.shields.io/github/license/haenara-shin/codex-hud)](https://github.com/haenara-shin/codex-hud/blob/main/LICENSE)

**[Korean / 한국어](README_KR.md)**

A [Claude Code](https://claude.ai/code) plugin that displays OpenAI Codex usage and rate limits — right inside your Claude Code session.

> Listed in [Anthropic's community plugin marketplace](https://github.com/anthropics/claude-plugins-community) and [buildwithclaude](https://github.com/davepoon/buildwithclaude).

## Why?

If you use [codex-plugin-cc](https://github.com/openai/codex-plugin-cc) to delegate tasks to Codex from Claude Code, you have no way to check your Codex rate limits without leaving your terminal. **codex-hud** fills that gap.

| Existing Tool | What It Does | What It Doesn't Do |
|---|---|---|
| [claude-hud](https://github.com/jarrodwatts/claude-hud) | Shows Claude Code context, tools, costs | No Codex/OpenAI data |
| [codex-plugin-cc](https://github.com/openai/codex-plugin-cc) | Runs Codex tasks from Claude Code | No usage/rate limit tracking |
| [ccusage](https://github.com/ryoppippi/ccusage) | CLI tool for local log analysis | Not a Claude Code plugin |
| **codex-hud** | **Codex usage + rate limits inside Claude Code** | -- |

## Features

- **Real-time statusline**: Integrates with [claude-hud](https://github.com/jarrodwatts/claude-hud) to show Codex Usage/Weekly rate limits alongside Claude Code's own statusline, with a 60s refresh so reset countdowns stay current while the session is idle
- **Slash commands**: Dedicated commands for usage, costs, and summary
- **Dual data sources**: Local Codex CLI session logs (no API key needed) + OpenAI Usage API (optional, for dollar costs)
- **Plan-agnostic**: Renders correctly on any Codex plan (free, Plus, Pro, Team, Enterprise) — rate-limit windows that aren't reported are simply skipped, never crash the statusline
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
── Codex gpt-5.5·medium ──            <- codex-hud
Usage   █░░░░░░░░░ 1% (resets in 5h)
Weekly  ░░░░░░░░░░ 0% (resets in 7d)
Context ██░░░░░░░░ 18% (47k/258k)
1 session | team
```

The header shows the model and reasoning effort of your most recent Codex turn, and the Context bar tracks that session's context-window occupancy. When Codex reports a reached rate limit, a red `⚠ LIMIT` alert appears in the header (even when the percentage bars sit below 100%).

## Installation

### Option A: via Anthropic's community marketplace *(recommended)*

Anthropic-maintained directory, nightly-synced from the internal review pipeline.

```
/plugin marketplace add anthropics/claude-plugins-community
/plugin install codex-hud@claude-community
```

### Option B: via buildwithclaude marketplace

```
/plugin marketplace add davepoon/buildwithclaude
/plugin install codex-hud@buildwithclaude
```

### Option C: via this repo directly

```
/plugin marketplace add haenara-shin/codex-hud
/plugin install codex-hud@codex-hud
```

### Option D: from source

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
- Updates `~/.claude/settings.json` so the Codex rate limits appear below claude-hud's statusline (sets `statusLine.refreshInterval` to 60s to keep reset countdowns fresh while idle)

Restart Claude Code or run `/reload-plugins` to see the Codex statusline.

To enable dollar cost tracking (optional, requires OpenAI Admin API key):

```
/codex-hud:setup-key
```

To remove the statusline integration, run `/codex-hud:uninstall` (restores your previous statusline if one was saved).

## Setup

### 1. Local logs (automatic)

If you use the [Codex CLI](https://github.com/openai/codex) or [codex-plugin-cc](https://github.com/openai/codex-plugin-cc), session logs at `~/.codex/sessions/` are parsed automatically. No configuration needed.

### 2. OpenAI Usage API (optional, for dollar costs)

To see dollar costs, you need an **OpenAI Admin API key**:

1. Go to [platform.openai.com/settings/organization/admin-keys](https://platform.openai.com/settings/organization/admin-keys)
2. Create an Admin key (starts with `sk-admin-...`) and copy it to your clipboard
3. Run `/codex-hud:setup-key` in Claude Code — the key is read from the clipboard, never typed into the chat

Or set the `OPENAI_ADMIN_KEY` environment variable.

> **Note**: If you're on a Teams/Enterprise subscription, dollar costs may not be relevant since usage is included in your plan. The local log-based rate limit tracking works without any API key.

## Commands

### `/codex-hud:setup`

Install the statusline integration (idempotent — safe to re-run).

### `/codex-hud:setup-key`

Configure and verify your OpenAI Admin API key (clipboard-based; only needed for dollar costs).

### `/codex-hud:configure`

Guided flow for display options: layout, presets, language, bar width.

### `/codex-hud:uninstall`

Remove the statusline integration and restore your previous statusline.

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

Substitute `codex-hud` with your marketplace alias — `claude-community` for Anthropic's community marketplace, `buildwithclaude` for buildwithclaude, or `codex-hud` for the direct repo install.

## Requirements

- Node.js >= 18.0.0 — but **Node >= 22.5 (or the `sqlite3` CLI on PATH)** is needed to read rate limits from `~/.codex/logs_2.sqlite` (the source used when you drive Codex via the app-server / Claude Code codex plugin). Older Node still works for rollout-based usage.
- [Claude Code](https://claude.ai/code)
- [Codex CLI](https://github.com/openai/codex) or [codex-plugin-cc](https://github.com/openai/codex-plugin-cc)
- [claude-hud](https://github.com/jarrodwatts/claude-hud) (optional, for statusline integration)
- OpenAI Admin API key (optional, for cost data)

## Acknowledgments

codex-hud was inspired by [claude-hud](https://github.com/jarrodwatts/claude-hud) — which solved the same usage-visibility problem for Claude Code itself. codex-hud extends that idea to OpenAI Codex and integrates with claude-hud via the included wrapper script when both are installed.

## Changelog

### v0.9.0

- **Works with the app-server / Codex plugin path.** Codex 0.140+ run via the app-server (e.g. the Claude Code codex plugin) doesn't write rate limits to the rollout logs — it logs them to `~/.codex/logs_2.sqlite`. codex-hud now reads the newest snapshot from there (local, no network/auth), merged with rollout data by freshness. This fixes "No Codex sessions found" for users who only use Codex through the plugin.
- **Reasoning effort** in the model badge (e.g. `gpt-5.5·xhigh`), read from `~/.codex/config.toml`.
- **`5h Usage` label** for the primary window (derived from its duration), matching Codex's own `/status`.
- **Quota shown as "% left"** with bars that fill as remaining — e.g. `5h Usage ██████████ 99% left (resets 19:38 · 3h 58m)` — matching Codex `/status`. (The Context bar still shows used%.)
- Requires Node >= 22.5 or the `sqlite3` CLI for the new app-server source; degrades gracefully otherwise.

### v0.8.0

- **Absolute reset times** (like Codex's own `/status`). Reset hints now show the clock time a window resets — `resets 19:38`, or `resets 15:04 on 22 Jun` once it's past today — alongside the time remaining: `(resets 19:38 · 4h 37m)`. New `resetStyle` option (`both` (default) / `absolute` / `relative`), localized for ko (`리셋 19:38 · 4h 37m`). Configurable via `/codex-hud:configure` with live previews.

### v0.7.0

- **Live previews in `/codex-hud:configure`.** When choosing a layout, each option now shows a side-by-side preview of how your statusline will actually look — rendered by the real statusline code (sample data, with your current toggles applied), so the preview can never drift from the result. Adds a `preview` CLI subcommand (`node dist/index.js preview --set layout=compact`) that emits plain, color-free output for the question UI.

### v0.6.2

- **Horizontal layout restored** to its classic shape (header + side-by-side bars + footer). The v0.6.1 one-liner lives on as a separate **`inline`** layout — pick whichever you prefer via `/codex-hud:configure` (4 layouts now: expanded / horizontal / inline / compact).

### v0.6.1

- **Horizontal layout redesigned as a true one-liner** (claude-hud style): `Codex team gpt-5.5·medium │ Usage ████░░░░░░ 42% (2h) │ Weekly ████████░░ 81% (2d 7h) │ Context ██░░░░░░░░ 18% │ 2s`. Previously it still used separate header/footer lines; now everything — bars included — sits on one line, matching the look of claude-hud's metric row above it.

### v0.6.0

- **Model + effort badge**: the header now shows which model and reasoning effort your most recent Codex turn used (e.g. `── Codex gpt-5.5·medium ──`). Toggle with `showModel`.
- **Context bar**: context-window occupancy of the most recent session (`Context ██░░░░░░░░ 18% (47k/258k)`), mirroring claude-hud's context display for the Codex side. Toggle with `showContext`.
- **`⚠ LIMIT` alert**: when Codex reports `rate_limit_reached_type`, a red badge appears in the header — catching the case where requests are blocked while the percentage bars are still below 100%.
- All three render in every layout (expanded / horizontal / compact) and come from the same tail-read window — no extra I/O.

### v0.5.2

- Compact layout session-count suffix is now localized (`15s` / `15 세션`).
- `costs --daily` date column labeled `(UTC)` to match API bucket boundaries.
- Install output only claims the previous statusline was saved when it actually was.
- Investigated narrowing command `allowed-tools` beyond `Bash(node:*)`: `${CLAUDE_PLUGIN_ROOT}` substitution is documented for skill content/hooks/MCP configs but not frontmatter, so the narrowing is deferred rather than risk silently breaking command auto-approval.

### v0.5.1

Quality release driven by a full multi-dimension code review (33 findings, adversarially verified).

- **Fix (install):** the statusline entry point is now a small launcher script that resolves the current plugin install at runtime. Previously a symlink pointed into the version-numbered plugin cache, so the first `/plugin update` silently blanked the entire statusline.
- **Security (key handling):** `/codex-hud:setup-key` now reads the Admin key from the clipboard and pipes it via stdin (`setup --key-stdin`). The key no longer appears in chat transcripts or process arguments.
- **Fix (accuracy):** the freshest rate-limit snapshot is now chosen by event timestamp (was: file-path order, which could freeze the bars on a stale snapshot for hours); sessions spanning midnight are picked up for "today".
- **Perf:** large rollout files (>256KB) are tail-read instead of fully parsed on every render — a 20MB active session drops from ~200ms to ~1ms per render.
- **Robustness:** install now preserves unrelated `statusLine` fields and saves your previous statusline; `/codex-hud:uninstall` (new command) restores it. settings.json writes are atomic. The wrapper survives missing `node` on PATH with a visible message, and finds claude-hud through plugin metadata regardless of marketplace alias.
- **Fix (costs):** pagination guard against non-advancing API cursors; a visible warning when the API truncates results.
- Docs: corrected stale `/codex-hud:setup` → `/codex-hud:setup-key` references everywhere, completed CLI help, configure flow contradictions resolved.

### v0.5.0

- **Fix:** statusline no longer crashes on plans where a rate-limit window is absent (e.g. free / no-limit plans report `primary` or `secondary` as `null`). Missing windows are skipped and the rest still render.
- **Fix:** `costs-month` / `usage-month` now report the full range. The OpenAI Costs/Usage APIs cap daily buckets per page (default 7), so 30-day queries previously returned only ~7 days with no error. The plugin now sizes the request and follows `has_more`/`next_page` pagination.
- **Add:** statusline registration sets `refreshInterval: 60` so reset countdowns stay current while the session is idle.
- **Chore:** drop the explicit `commands[]` array from `plugin.json` (commands are auto-discovered), add `$schema` to both manifests, and verify against current Claude Code 2.1.x / Codex CLI 0.125+ contracts.

### v0.4.0

- Add horizontal layout (Usage + Weekly side-by-side); 3 layouts total (expanded / horizontal / compact).

## License

MIT
