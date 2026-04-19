---
name: ops-linear
description: Linear command center. Shows current sprint, creates/updates issues, manages priorities, syncs with GSD phases.
argument-hint: "[sprint|create|update|sync|backlog|issue-id]"
allowed-tools:
  - Bash
  - Read
  - Grep
  - Glob
  - Skill
  - AskUserQuestion
  - TaskCreate
  - TaskUpdate
  - WebFetch
  - mcp__linear__list_issues
  - mcp__linear__list_teams
  - mcp__linear__list_projects
  - mcp__linear__get_issue
  - mcp__linear__update_issue
  - mcp__linear__create_issue
  - mcp__linear__create_comment
  - mcp__linear__search_issues
effort: medium
maxTurns: 30
---

# OPS ► LINEAR COMMAND CENTER

## Runtime Context

Before executing, load available context:

1. **Secrets**: Linear API key required for MCP fallback queries.
   ### Secret Resolution
   - Check `$LINEAR_API_KEY` env var
   - Then: Doppler MCP tools (`mcp__doppler__*`) — if Doppler MCP server is configured
   - Then: `doppler secrets get LINEAR_API_KEY --plain` (if doppler CLI configured in prefs)
   - Then: use `password_manager_config.query_cmd` from `${CLAUDE_PLUGIN_DATA_DIR:-$HOME/.claude/plugins/data/ops-ops-marketplace}/preferences.json`
   - If unavailable, use Linear MCP tools exclusively (no curl fallback possible)

2. **Preferences**: Read `${CLAUDE_PLUGIN_DATA_DIR}/preferences.json` for `secrets_manager` / `doppler` config.

## CLI/API Reference

### Linear GraphQL (fallback when MCP unavailable)

| Command | Usage | Output |
|---------|-------|--------|
| `curl -X POST https://api.linear.app/graphql -H "Authorization: $LINEAR_API_KEY" -H "Content-Type: application/json" -d '{"query":"{ issues(filter: {state: {type: {in: [\"started\",\"unstarted\"]}}}) { nodes { id title state { name } priority assignee { name } } } }"}'` | Active issues | JSON |
| `curl -X POST https://api.linear.app/graphql -H "Authorization: $LINEAR_API_KEY" -H "Content-Type: application/json" -d '{"query":"{ cycles(filter: {isActive: {eq: true}}) { nodes { id number startsAt endsAt } } }"}'` | Current cycles | JSON |

---

## Phase 1 — Load data

Run in parallel:

1. `mcp__linear__list_teams` — get all team IDs
2. `mcp__linear__list_issues` — get issues with cycle filter (use GraphQL fallback for cycle queries if needed)

Then fetch issues for the current cycle: `mcp__linear__list_issues` filtered to current cycle ID.

---

## Route by `$ARGUMENTS`

| Argument        | Action                                  |
| --------------- | --------------------------------------- |
| (empty), sprint | Show current sprint board               |
| backlog         | Show unassigned/unscheduled issues      |
| create [title]  | Create a new issue (prompt for details) |
| update [id]     | Update issue by ID                      |
| sync            | Sync GSD phases to Linear issues        |
| [issue-id]      | Show and edit that specific issue       |

---

## Sprint board view

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 LINEAR ► SPRINT [N] — [start] → [end]
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

IN PROGRESS
 [id]  [priority]  [title]  [assignee]  [estimate]

TODO
 [id]  [priority]  [title]  [assignee]  [estimate]

DONE THIS SPRINT
 [id]  [title]  [completed date]

BLOCKED / CANCELLED
 [id]  [title]  [reason]

──────────────────────────────────────────────────────
 Sprint velocity: [done points] / [total points] ([%])
──────────────────────────────────────────────────────
```

Use **batched AskUserQuestion calls** (max 4 options each):

AskUserQuestion call 1:
```
  [Create new issue]
  [Update issue status]
  [Move issue to/from sprint]
  [More...]
```

AskUserQuestion call 2 (only if "More..."):
```
  [View backlog]
  [Sync with GSD phases]
```

---

## Create issue flow

Collect from user (or parse from `$ARGUMENTS`):

- Title
- Team (list choices if ambiguous)
- Priority (urgent/high/medium/low)
- Cycle (current sprint or backlog)
- Assignee (optional)
- Estimate (optional)

Use `mcp__linear__create_issue` to create. Confirm: `Created [id]: [title]`

---

## GSD sync flow

Read all active GSD STATE.md files across projects. For each active phase:

1. Check if a Linear issue exists with matching phase reference.
2. If not, offer to create one.
3. If status differs (GSD says done, Linear says in-progress), offer to sync.

Update Linear issues to match GSD phase completion status.

Use AskUserQuestion after displaying any view to get the next action.

---

## Native tool usage

### Tasks — sprint work tracking

When the user starts working on a Linear issue, use `TaskCreate` to track it locally. Update with `TaskUpdate` as the issue progresses. This bridges Linear state with local session state.

### WebFetch — Linear API fallback

When Linear MCP tools hit quota limits or fail, fall back to `WebFetch` with the Linear GraphQL API:
```
WebFetch(url: "https://api.linear.app/graphql", method: "POST", headers: {"Authorization": "$LINEAR_API_KEY"}, body: '{"query":"{ issues(filter: {cycle: {id: {eq: \"<id>\"}}}}) { nodes { id title state { name } } } }"}')
```
