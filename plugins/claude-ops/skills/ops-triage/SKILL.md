---
name: ops-triage
description: Cross-platform issue triage. Pulls from Sentry (MCP), Linear (MCP), GitHub Issues (gh). Cross-references against code to find already-fixed issues. Auto-resolves fixed ones. Dispatches agents for active issues.
argument-hint: "[project-alias|sentry|linear|github|all]"
allowed-tools:
  - Bash
  - Read
  - Grep
  - Glob
  - Skill
  - Agent
  - AskUserQuestion
  - TeamCreate
  - SendMessage
  - TaskCreate
  - TaskUpdate
  - TaskList
  - WebFetch
  - WebSearch
  - LSP
  - mcp__sentry__search_issues
  - mcp__sentry__get_issue_details
  - mcp__linear__list_issues
  - mcp__linear__update_issue
  - mcp__linear__get_issue
  - mcp__linear__list_teams
effort: high
model: claude-opus-4-6
maxTurns: 40
---

## Runtime Context

Before triaging, load:
1. **Preferences**: `cat ${CLAUDE_PLUGIN_DATA_DIR:-$HOME/.claude/plugins/data/ops-ops-marketplace}/preferences.json` — read project registry for repo paths
2. **Daemon health**: `cat ${CLAUDE_PLUGIN_DATA_DIR}/daemon-health.json` — ensure services healthy
3. **Secrets**: Resolve via Doppler MCP (`mcp__doppler__*`) → env → Doppler CLI fallback → password manager: `SENTRY_AUTH_TOKEN`, `LINEAR_API_KEY`, `GITHUB_TOKEN`
4. **Ops memories**: Check `${CLAUDE_PLUGIN_DATA_DIR}/memories/topics_active.md` for issue context


# OPS ► CROSS-PLATFORM TRIAGE

## CLI/API Reference

### gh CLI (GitHub)

| Command | Usage | Output |
|---------|-------|--------|
| `gh issue list --state open --json number,title,body,labels,assignees,createdAt,url --limit 50` | Open issues | JSON array |
| `gh issue list --repo <owner/repo> --state open --json number,title,labels,createdAt --limit 20` | Repo issues | JSON array |
| `gh pr list --state merged --search "#<N>"` | PRs referencing issue | JSON array |
| `gh issue close <N> --comment "<msg>"` | Close issue | Confirmation |

### sentry-cli / Sentry API

| Command | Usage | Output |
|---------|-------|--------|
| `sentry-cli issues list --project <slug> --status unresolved` | Unresolved issues | Issue list |
| `curl -H "Authorization: Bearer $SENTRY_AUTH_TOKEN" "https://sentry.io/api/0/projects/<org>/<proj>/issues/?query=is:unresolved"` | API fallback when MCP unavailable | JSON array |

### Linear GraphQL (fallback when MCP unavailable)

| Command | Usage | Output |
|---------|-------|--------|
| `curl -X POST https://api.linear.app/graphql -H "Authorization: $LINEAR_API_KEY" -H "Content-Type: application/json" -d '{"query":"{ issues(filter: {state: {type: {in: [\"started\",\"unstarted\"]}}}) { nodes { id title state { name } priority assignee { name } } } }"}'` | Active issues | JSON |

---

## Agent Teams support

If `CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1` is set, use **Agent Teams** when dispatching fix agents for multiple issues. This enables:
- Fix agents can share findings (e.g., agent fixing Sentry error discovers the same root cause as a Linear issue)
- You can redirect agents if cross-referencing reveals duplicate issues
- Agents report progress and you can prioritize which fix to merge first

**Team setup** (only when flag is enabled, Phase 4 dispatch):
```
TeamCreate("triage-fixers")
Agent(team_name="triage-fixers", name="fix-[issue-id]", subagent_type="ops:triage-agent", ...)
```

Use `broadcast(content="Root cause found: missing index on users.email — check if your issue is related")` to share discoveries.

If the flag is NOT set, fall back to standard parallel subagents.

## Phase 1 — Gather issues in parallel

Run all of these simultaneously:

### GitHub Issues

```bash
gh issue list --state open --json number,title,body,labels,assignees,createdAt,url --limit 50 2>/dev/null
```

### GitHub Issues (registry-driven)

```bash
REGISTRY="${CLAUDE_PLUGIN_ROOT}/scripts/registry.json"
[ -f "$REGISTRY" ] || REGISTRY="${CLAUDE_PLUGIN_ROOT}/scripts/registry.example.json"
for repo in $(jq -r '.projects[] | select(.gsd == true) | .repos[]' "$REGISTRY" 2>/dev/null); do
  echo "=== $repo ==="
  gh issue list --repo "$repo" --state open --json number,title,labels,createdAt --limit 20 2>/dev/null
done
```

### Sentry

If Sentry MCP is connected, fetch unresolved issues for all projects.
Otherwise run: `echo "Sentry MCP not available"`

### Linear

Use `mcp__linear__list_teams` to get team IDs, then `mcp__linear__list_issues` with `filter: {state: {type: {in: ["unstarted", "started"]}}}` for each team.

---

## Phase 2 — Cross-reference against code

For each Sentry issue, check if it's already fixed:

1. Extract the error message, file path, and line number from the Sentry event.
2. `grep` for the relevant code in the affected repo.
3. Check git log: `git log --oneline --all -- [file] 2>/dev/null | head -20`
4. If the fix is merged and deployed (check ECS deploy timestamps), mark as resolved.

For each GitHub Issue:

- Check if any merged PR references the issue number (`gh pr list --state merged --search "#[N]"`)
- If referenced and merged, mark as potentially resolved

---

## Phase 3 — Confirm and resolve fixed issues

For issues confirmed fixed in code AND deployed, show the full list and use `AskUserQuestion`:

```
Found N issues confirmed fixed and deployed:

  [Sentry] [title] — fix in [commit], deployed [time ago]
  [Linear] [title] — fix in [commit], deployed [time ago]
  [GitHub] #[N] [title] — referenced in merged PR #[M]

  [Resolve all N]  [Review each one]  [Skip — don't auto-resolve]
```

If user picks "Review each one", show each issue individually with `[Resolve]` / `[Skip]` via `AskUserQuestion`.

For confirmed issues:

- **Sentry**: use Sentry MCP to resolve the issue
- **Linear**: use `mcp__linear__update_issue` with `state: "Done"`
- **GitHub**: `gh issue close [N] --comment "Auto-closed: fix confirmed deployed"`

Log all resolutions.

---

## Phase 4 — Present triage board

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 OPS ► TRIAGE — [date]
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

AUTO-RESOLVED (already fixed)
 ✓ [Sentry] [title] — fix in [commit]
 ✓ [Linear] [title] — closed
 ✓ [GitHub] #[N] [title] — closed

ACTIVE ISSUES (needs work)
 CRITICAL  [source] [title] [age] [assigned?]
 HIGH      [source] [title] [age] [assigned?]
 MEDIUM    [source] [title] [age] [assigned?]

──────────────────────────────────────────────────────
```

Use **batched AskUserQuestion calls** (max 4 options each):

AskUserQuestion call 1:
```
  [Dispatch agent for [top critical issue]]
  [Dispatch agent for [second issue]]
  [Assign issue to sprint (Linear)]
  [More...]
```

AskUserQuestion call 2 (only if "More..."):
```
  [Bulk-assign all HIGH to current sprint]
  [Done]
```

---

## Dispatch fix agent

When dispatching for an issue, spawn an Agent using `agents/triage-agent.md` with:

- Full issue context (error, stack trace, affected code)
- Instruction to create feature branch, fix, and open PR
- Report back on completion or if blocked

Filter to `$ARGUMENTS` project/source if specified.

---

## Native tool usage

### Tasks — triage progress

Use `TaskCreate` for each issue being investigated. Update with `TaskUpdate` as issues are resolved/dispatched/skipped. Gives the user a live triage checklist.

### WebFetch — Sentry/GitHub enrichment

When Sentry MCP hits quota limits, fall back to `WebFetch` with `https://sentry.io/api/0/projects/<org>/<project>/issues/?query=is:unresolved` (using `SENTRY_AUTH_TOKEN` header). Same for GitHub issue details when `gh` is slow.

### WebSearch — error context

Use `WebSearch` to find known solutions for recurring errors (e.g., "AWS RDS connection reset", "ECS task stopped reason"). Include findings in the triage board as context.

### LSP — code navigation for fix agents

When dispatching fix agents, use `LSP` to find symbol definitions, references, and call hierarchies. This helps agents navigate unfamiliar codebases faster than grep.
