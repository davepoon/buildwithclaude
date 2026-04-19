---
name: ops-go
description: Token-efficient morning briefing. Pre-gathers all data via shell scripts, then presents a unified business dashboard with prioritized actions.
argument-hint: "[project-alias]"
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
  - TaskCreate
  - TaskUpdate
  - TaskList
  - CronCreate
  - CronList
  - WebFetch
effort: medium
maxTurns: 40
---

# OPS ► MORNING BRIEFING

## Runtime Context

Before executing, load available context:

1. **Preferences**: Read `${CLAUDE_PLUGIN_DATA_DIR:-$HOME/.claude/plugins/data/ops-ops-marketplace}/preferences.json`
   - `owner` — use in the greeting header ("Good morning, [owner]")
   - `timezone` — display all timestamps in this timezone
   - `default_channels` — which channels to include in unread summary

2. **Daemon health**: Read `${CLAUDE_PLUGIN_DATA_DIR}/daemon-health.json`
   - If `action_needed` is not null → surface it before the briefing
   - Check `wacli-sync` status before including WhatsApp unread counts
   - Also check `~/.wacli/.health` for live auth status

3. **WhatsApp pre-check**: Only include WhatsApp data if `~/.wacli/.health` shows `status=connected`.

## CLI/API Reference

### wacli (WhatsApp)

**Health file** — check `~/.wacli/.health` BEFORE any wacli command:
- `status=connected` → proceed
- `status=needs_auth` or `status=needs_reauth` → prompt user for QR scan

| Command | Usage | Output |
|---------|-------|--------|
| `wacli doctor --json` | Check auth/connected/lock/FTS | `{data: {authenticated, connected, lock_held, fts_enabled}}` |
| `wacli chats list --json` | All chats | `{data: [{JID, Name, Kind, LastMessageTS}]}` |

### gog CLI (Gmail/Calendar)

| Command | Usage | Output |
|---------|-------|--------|
| `gog calendar events primary --today --json` | Today's calendar events | Calendar events |
| `gog gmail search -j --results-only --no-input --max 30 "in:inbox"` | Search inbox | JSON array of threads |

---

## Agent Teams support

If `CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1` is set, use **Agent Teams** when gathering briefing data in parallel. This enables:
- Agents share context and can coordinate mid-flight
- You can steer priorities in real-time
- Agents report progress as they complete

**Team setup** (only when flag is enabled):
```
TeamCreate("go-team")
Agent(team_name="go-team", name="infra-scanner", prompt="Check ECS health, Vercel status, and CI failures across all clusters")
Agent(team_name="go-team", name="inbox-scanner", prompt="Scan unread messages across WhatsApp, Email, Slack, Telegram, Notion")
Agent(team_name="go-team", name="pr-scanner", prompt="Find open PRs needing action — reviews, CI fixes, merge-ready")
Agent(team_name="go-team", name="sprint-scanner", prompt="Check Linear sprint progress and GSD phase state across projects")
```

If the flag is NOT set, use standard fire-and-forget subagents.

## Pre-gathered data

All data below was collected by shell scripts in <10 seconds:

### Infrastructure

```!
${CLAUDE_PLUGIN_ROOT}/bin/ops-infra 2>/dev/null || echo '{"clusters":[],"error":"infra check failed"}'
```

### Git Status (all projects)

```!
${CLAUDE_PLUGIN_ROOT}/bin/ops-git 2>/dev/null || echo '[]'
```

### Open PRs

```!
${CLAUDE_PLUGIN_ROOT}/bin/ops-prs 2>/dev/null || echo '[]'
```

### CI Failures (last 24h)

```!
${CLAUDE_PLUGIN_ROOT}/bin/ops-ci 2>/dev/null || echo '[]'
```

### Unread Messages

```!
${CLAUDE_PLUGIN_ROOT}/bin/ops-unread 2>/dev/null || echo '{}'
```

### GSD State (active roadmaps)

```!
for d in $(jq -r '.projects[] | select(.gsd == true) | .paths[]' "${CLAUDE_PLUGIN_ROOT}/scripts/registry.json" 2>/dev/null); do
  expanded="${d/#\~/$HOME}"
  if [ -f "$expanded/.planning/STATE.md" ]; then
    alias=$(basename "$expanded")
    phase=$(grep -m1 'current_phase' "$expanded/.planning/STATE.md" 2>/dev/null | head -1 || echo "unknown")
    progress=$(grep -m1 'progress' "$expanded/.planning/STATE.md" 2>/dev/null | head -1 || echo "unknown")
    echo "$alias: $phase | $progress"
  fi
done
```

### External Projects (non-repo)

```!
${CLAUDE_PLUGIN_ROOT}/bin/ops-external 2>/dev/null || echo '[]'
```

### Calendar (today)

```!
gog calendar events primary --today --json 2>/dev/null | head -20 || echo "calendar unavailable"
```

## Your task

Analyze ALL the pre-gathered data above and present it as a morning briefing. Follow the ops-briefing output style.

**Format:**

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 OPS ► MORNING BRIEFING — [DATE]
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

FIRES (fix now)
[table of production issues, CI failures, broken deploys]

PRs NEEDING ACTION
[table: repo, PR#, title, status, action needed]

PORTFOLIO DASHBOARD
[table: project, phase, branch, uncommitted, CI, next action]

EXTERNAL PROJECTS
[table: alias, source, status, details — from ops-external data]

MARKETING
 Health: [N]/100 ([Healthy/Warning/Critical])  |  Blended ROAS: [X]x  |  Top channel: [channel]
 Meta: $[X] spent (7d) [X]x ROAS  |  Google: $[X] spent (7d) [X]x ROAS  |  Email: [N] subs
[If health < 70: "⚠ Run /ops:marketing optimize for recommendations"]
[If no marketing configured: "(marketing not configured — /ops:marketing setup)"]

UNREAD
[WhatsApp: N, Email: N, Slack: check MCP, Notion: N items, Calendar: N events today]

TODAY'S PRIORITIES (ranked by revenue impact + urgency)
1. [action] — [project] — [why]
2. ...
3. ...

──────────────────────────────────────────────────────
```

**Marketing section data source**: Read from `ops-marketing-dash` pre-gathered output (see Pre-gathered data section). If marketing data is present in the dash output, compute the health score inline (see ops-marketing SKILL.md health score formula). If ops-marketing-dash is not configured or returns empty marketing data, show `(marketing not configured — /ops:marketing setup)`.

**Priority ranking**: fires > degraded infra > CI failures > unread comms > ready-to-merge PRs > revenue-generating GSD work > stale projects.

If `$ARGUMENTS` contains a project alias, focus the briefing on that project only.

After the briefing, use **batched AskUserQuestion calls** (max 4 options each) for the "What's next?" prompt. Show the top 3 priority actions + `[More...]` in the first call, then remaining actions + `[/ops-yolo — let me run your business today]` in the second call. Route to the appropriate ops skill or project.

For Slack counts: if the pre-gathered data shows `"count": -1`, use `mcp__claude_ai_Slack__slack_search_public_and_private` with query `in:channel` (NOT `is:unread` — scan full recent activity) to get actual message counts. Do this as a parallel tool call while analyzing other data.

For Notion counts: if `NOTION_MCP_ENABLED=true` and pre-gathered data shows Notion as available, use `mcp__claude_ai_Notion__notion-search` with `query: ""` sorted by `last_edited_time` descending to surface recently active pages. Then call `mcp__claude_ai_Notion__notion-get-comments` on the top results to find comments needing response. Note: Notion search does not support date range filters — sort by recency and limit to the first 10-20 results instead.

---

## Native tool usage

### Tasks — briefing action tracking

After presenting the briefing, create a `TaskCreate` for each recommended priority action. As the user works through them (or delegates via skill routing), update with `TaskUpdate`. This gives continuity across the session.

### Cron — scheduled briefings

After the first briefing, offer to schedule recurring briefings via `AskUserQuestion`:
```
  [Schedule daily at 9am]  [Schedule weekday mornings]  [No schedule]
```
Use `CronCreate` to set up the schedule. Show existing schedules with `CronList`.

### WebFetch — calendar enrichment

When `gog calendar` fails, use `WebFetch` with the Google Calendar API as fallback:
```
WebFetch(url: "https://www.googleapis.com/calendar/v3/calendars/primary/events?timeMin=<today>T00:00:00Z&timeMax=<today>T23:59:59Z")
```
