---
name: ops-dash
description: Interactive pixel-art command center dashboard. Visual business HQ with instant hotkey navigation to all ops commands, live status indicators, fire alerts, C-suite reports, settings, sharing, and FAQ.
argument-hint: "[back|settings|share|faq]"
allowed-tools:
  - Bash
  - Read
  - Grep
  - Glob
  - Skill
  - Agent
  - TeamCreate
  - SendMessage
  - AskUserQuestion
  - CronCreate
  - CronList
  - CronDelete
effort: low
maxTurns: 15
disallowedTools:
  - Edit
  - Write
  - NotebookEdit
---

# OPS > DASH — Interactive Command Center

## Runtime Context

Before rendering, load available context:

1. **Preferences**: Read `${CLAUDE_PLUGIN_DATA_DIR:-$HOME/.claude/plugins/data/ops-ops-marketplace}/preferences.json`
   - `owner` — personalize the dashboard header greeting
   - `timezone` — display timestamps correctly in status indicators

2. **Daemon health**: Read `${CLAUDE_PLUGIN_DATA_DIR}/daemon-health.json`
   - If `action_needed` is not null → show a warning banner at the top of the dashboard before the menu

## CLI/API Reference

### bin/ops-dash

| Command | Usage | Output |
|---------|-------|--------|
| `${CLAUDE_PLUGIN_ROOT}/bin/ops-dash` | Render full pixel-art dashboard | Formatted ASCII dashboard |
| `${CLAUDE_PLUGIN_ROOT}/bin/ops-dash 2>/dev/null \|\| echo "DASH_RENDER_FAILED"` | Render with failure detection | Dashboard or `DASH_RENDER_FAILED` sentinel |

The bin script reads `preferences.json` and `daemon-health.json` internally. The skill reads these files separately to check for warnings before invoking the script.

---

## Agent Teams support

If `CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1` is set, use **Agent Teams** when loading dashboard data in parallel. This enables:
- Agents share context and can coordinate mid-flight
- You can steer priorities in real-time
- Agents report progress as they complete

**Team setup** (only when flag is enabled):
```
TeamCreate("dash-team")
Agent(team_name="dash-team", name="infra-loader", prompt="Gather ECS health, Vercel status, and CI pipeline state")
Agent(team_name="dash-team", name="comms-loader", prompt="Gather unread counts across all configured channels")
Agent(team_name="dash-team", name="projects-loader", prompt="Gather GSD phase, git status, and PRs for all projects")
Agent(team_name="dash-team", name="business-loader", prompt="Gather revenue, Linear sprint, and fire alerts")
```

If the flag is NOT set, use standard fire-and-forget subagents.

## Render dashboard instantly

```!
${CLAUDE_PLUGIN_ROOT}/bin/ops-dash 2>/dev/null || echo "DASH_RENDER_FAILED"
```

## Your task

The dashboard has already rendered above via the shell script. Your job is to **route user input** to the right skill.

**Present the dashboard output as-is** (it's already formatted). Then immediately use AskUserQuestion:

```
  Type a number (1-9, 0), letter (a-j), or describe what you need
```

## Routing table

| Input | Route | Description |
|-------|-------|-------------|
| `1`, `go`, `morning`, `briefing` | `/ops:ops-go` | Morning briefing |
| `2`, `inbox`, `unread`, `messages` | `/ops:ops-inbox` | Inbox zero |
| `3`, `fires`, `incidents`, `down` | `/ops:ops-fires` | Fire check |
| `4`, `projects`, `portfolio` | `/ops:ops-projects` | Project dashboard |
| `5`, `next`, `priority`, `what` | `/ops:ops-next` | What's next |
| `6`, `revenue`, `costs`, `money` | `/ops:ops-revenue` | Revenue & costs |
| `7`, `linear`, `sprint`, `board` | `/ops:ops-linear` | Linear sprint |
| `8`, `deploy`, `ship` | `/ops:ops-deploy` | Deploy status |
| `9`, `triage`, `issues` | `/ops:ops-triage` | Triage issues |
| `0`, `speedup`, `clean`, `optimize` | `/ops:ops-speedup` | System speedup |
| `a`, `yolo` | `/ops:ops-yolo` | YOLO mode |
| `b`, `merge`, `prs` | `/ops:ops-merge` | Auto-merge PRs |
| `c`, `setup`, `configure` | `/ops:setup` | Setup wizard |
| `d`, `send`, `comms` | `/ops:ops-comms` | Send message |
| `e`, `report`, `csuite` | Read latest YOLO report | C-suite report |
| `f`, `settings`, `prefs`, `config` | Settings sub-menu | Interactive config |
| `g`, `share` | Share sub-menu | Share your setup |
| `h`, `faq`, `help`, `wiki`, `?` | FAQ sub-menu | Help & FAQ |
| `back`, `dash`, `home` | Re-render dashboard | Return to dash |

---

## C-suite report access (option e)

When user selects `e`:

1. Find latest YOLO session: `ls -td /tmp/yolo-*/ 2>/dev/null | head -1`
2. If found, show a sub-menu:

Display the C-suite header, then use **batched AskUserQuestion** (max 4 options per call):

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 OPS > C-SUITE REPORTS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

AskUserQuestion call 1:
```
  [CEO — Strategic analysis]
  [CTO — Technical health]
  [CFO — Financial analysis]
  [More...]
```

AskUserQuestion call 2 (only if "More..."):
```
  [COO — Operations review]
  [All — Full Hard Truths report]
  [Back to dashboard]
```

Read the selected file and display it. After display, offer `[Back to dashboard]`.

3. If no YOLO reports exist:

```
No C-suite reports yet. Run /ops:ops-yolo to generate one.

 b) Back to dashboard
```

---

## Settings sub-menu (option f)

When user selects `f`, read current preferences and present an interactive config editor.

```bash
PREFS="${CLAUDE_PLUGIN_DATA_DIR:-$HOME/.claude/plugins/data/ops-ops-marketplace}/preferences.json"
cat "$PREFS" 2>/dev/null || echo '{}'
```

```bash
cat "${CLAUDE_PLUGIN_ROOT}/scripts/registry.json" 2>/dev/null || echo '{}'
```

Display the full settings menu as text (for reference), then use **batched AskUserQuestion calls** (max 4 options each) to let the user pick a category:

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 OPS > SETTINGS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

 PROFILE:       Owner=[value] | TZ=[value] | Style=[value]
 CHANNELS:      Email=[✓/✗] | WA=[✓/✗] | Slack=[✓/✗] | Telegram=[✓/✗]
 INTEGRATIONS:  AWS=[value] | Sentry=[value] | Linear=[value]
 PROJECTS:      [N] registered
 PLUGIN:        v[version]
──────────────────────────────────────────────────────
```

Use AskUserQuestion (max 4 options):
```
What would you like to configure?
  [Profile (name/timezone/style)]
  [Channels (email/WA/slack/telegram)]
  [Integrations & Projects]
  [Back to dashboard]
```

On "Profile": use AskUserQuestion with `[Owner name]`, `[Timezone]`, `[Briefing style]`, `[Back]`.
On "Channels": use AskUserQuestion with the 4 channel names (fits in one call).
On "Integrations & Projects": use AskUserQuestion with `[AWS/Sentry/Linear]`, `[View registry]`, `[Add/remove project]`, `[Update plugin / Re-run setup]`.

For each option, use AskUserQuestion to get the new value, then write to preferences.json or registry.json.

**Writing preferences:**
```bash
PREFS="${CLAUDE_PLUGIN_DATA_DIR:-$HOME/.claude/plugins/data/ops-ops-marketplace}/preferences.json"
# Read existing, merge update, write back
jq --arg key "owner" --arg val "$NEW_VALUE" '.[$key] = $val' "$PREFS" > "${PREFS}.tmp" && mv "${PREFS}.tmp" "$PREFS"
```

After each change, confirm success and return to the settings menu. User can keep making changes or press `b` to go back.

---

## Share sub-menu (option g)

When user selects `g`, generate a shareable summary of their ops setup:

Display the share header, then use **batched AskUserQuestion** (max 4 options per call):

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 OPS > SHARE YOUR SETUP
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

AskUserQuestion call 1:
```
  [Share on X (Twitter)]
  [Share via Slack]
  [Share via Email]
  [More...]
```

AskUserQuestion call 2 (only if "More..."):
```
  [Copy to clipboard]
  [Export setup guide (markdown)]
  [Back to dashboard]
```

### Share content generation

Generate a share-ready message. **Never include secrets, tokens, or private project names.** Only share:
- Plugin version
- Number of integrations configured
- Number of projects managed
- OS and system info
- Feature highlights used

**Template:**

```
I'm running my business from Claude Code with claude-ops v0.3.1

Setup: [N] projects | [N] channels | [OS]
Features: Morning briefing, inbox zero, fire alerts, C-suite AI analysis, system optimizer

Try it: /plugin marketplace add ops-marketplace

#ClaudeCode #DevOps #AI
```

### Share actions

| Option | Action |
|--------|--------|
| X/Twitter | Copy text to clipboard + open `https://twitter.com/intent/tweet?text=...` via `open` (macOS) or `xdg-open` (Linux) |
| Slack | Send via `/ops:ops-comms slack` with generated message |
| Email | Draft via `gog gmail send` or copy to clipboard |
| Clipboard | `pbcopy` (macOS) / `xclip -selection clipboard` (Linux) / `clip.exe` (WSL) |
| Export | Write a `~/.claude-ops-setup.md` file with full (sanitized) setup guide for sharing with teammates |

---

## FAQ sub-menu (option h)

When user selects `h`:

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 OPS > HELP & FAQ
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

 QUICK START
 1) What is claude-ops?
 2) How do I set up channels?
 3) How does YOLO mode work?
 4) What data does ops collect?

 COMMANDS
 5) Full command reference
 6) Keyboard shortcuts

 TROUBLESHOOTING
 7) MCP server disconnected
 8) WhatsApp not connecting
 9) Telegram auth issues
 10) Channel not showing unread

 LINKS
 w) Wiki — github.com/Lifecycle-Innovations-Limited/claude-ops/wiki
 r) README — github.com/Lifecycle-Innovations-Limited/claude-ops
 i) Issues — github.com/Lifecycle-Innovations-Limited/claude-ops/issues
 c) Changelog

──────────────────────────────────────────────────────
 b) Back to dashboard
──────────────────────────────────────────────────────
```

### FAQ answers

| # | Question | Answer |
|---|----------|--------|
| 1 | What is claude-ops? | Business operations OS for Claude Code. Manages inbox, fires, deploys, PRs, revenue, and can run your business autonomously via YOLO mode. |
| 2 | Channel setup | Run `/ops:setup` — interactive wizard detects installed CLIs and walks you through each channel. |
| 3 | YOLO mode | Spawns 4 AI agents (CEO, CTO, CFO, COO) to analyze your business. Type YOLO to hand over controls — it processes inbox, fixes fires, merges PRs, and advances GSD phases. |
| 4 | Data collection | All data stays local. No telemetry. Registry and preferences are gitignored. Tokens stored in macOS keychain or env vars. |
| 5 | Command reference | List all `/ops:*` commands with descriptions |
| 6 | Shortcuts | `1-9, 0` for actions, `a-h` for power/comms/settings, `b` always goes back, `q` exits |
| 7 | MCP disconnected | Wait 5s and retry (auto-reconnect hook). After 3 fails, falls back to CLI tools. |
| 8 | WhatsApp | First check `~/.wacli/.health` — if `status` is not `connected`, surface the auth warning before running `wacli doctor`. Check `wacli doctor`. If 405 error: rebuild from source. If store locked: `kill $(pgrep wacli)`. |
| 9 | Telegram | Needs user-auth (not bot). Run `/ops:setup` → Telegram section. API ID + hash from my.telegram.org. |
| 10 | Unread | Channel must be configured in `/ops:setup`. Check `ops-unread` script output for errors. |

For links (w, r, i): open in browser via `open` (macOS) or `xdg-open` (Linux).

For changelog (c): read and display `${CLAUDE_PLUGIN_ROOT}/CHANGELOG.md`.

After each FAQ answer, offer `b) Back to dashboard` or `h) Back to FAQ`.

---

## Return-to-dash loop

After ANY skill completes and returns control, **re-render the dashboard** by running the bin script again and re-entering the routing loop. This creates the "app within an app" experience — the user always comes back to the command center.

To re-render:
```bash
${CLAUDE_PLUGIN_ROOT}/bin/ops-dash 2>/dev/null
```

Then AskUserQuestion again for the next action.

**Exception**: If user types `q`, `quit`, or `exit`, end the session gracefully:

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 OPS > SESSION ENDED
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

## If `$ARGUMENTS` is `back`

Re-render the dashboard and enter routing loop.

## If `$ARGUMENTS` is `settings`

Jump directly to settings sub-menu (skip dashboard render).

## If `$ARGUMENTS` is `share`

Jump directly to share sub-menu.

## If `$ARGUMENTS` is `faq`

Jump directly to FAQ sub-menu.

## Setup gate

If the dashboard script outputs `DASH_RENDER_FAILED` or the preferences file doesn't exist, show:

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 OPS > SETUP REQUIRED
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

 Run /ops:setup to configure your integrations first.
```

Then invoke `/ops:setup` directly.
