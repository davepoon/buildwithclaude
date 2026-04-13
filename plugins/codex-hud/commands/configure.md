---
description: Configure codex-hud statusline display options (layout, visibility, language, etc.)
allowed-tools: Bash(node:*), AskUserQuestion
---

# Configure Codex HUD

Show the current display configuration:

```bash
node "${CLAUDE_PLUGIN_ROOT}/dist/index.js" configure --get --json
```

Parse the JSON output and present a readable summary of the current settings to the user. Then ask which option they want to change using `AskUserQuestion`. Options:

- **Layout**: `expanded` (multi-line with bars) or `compact` (single line with │ separators)
- **Show plan type** in header (`── Codex team ──` vs `── Codex ──`)
- **Show footer** (`N sessions | plan`)
- **Show Usage bar** (5-hour window)
- **Show Weekly bar** (7-day window)
- **Bar width** (1–40, default 10)
- **Fallback to week** when today has no sessions
- **Language** (`en` or `ko`)
- **Reset all to defaults**
- **Cancel**

Based on the user's choice, run:

```bash
node "${CLAUDE_PLUGIN_ROOT}/dist/index.js" configure --set <key>=<value>
```

Valid keys and values:
- `layout` = `expanded` | `compact`
- `showPlan` = `true` | `false`
- `showFooter` = `true` | `false`
- `showUsage` = `true` | `false`
- `showWeekly` = `true` | `false`
- `barWidth` = integer between 1 and 40
- `fallbackToWeek` = `true` | `false`
- `language` = `en` | `ko`

For reset:

```bash
node "${CLAUDE_PLUGIN_ROOT}/dist/index.js" configure --reset
```

After applying the change, tell the user to run `/reload-plugins` or restart Claude Code to see the new statusline.
