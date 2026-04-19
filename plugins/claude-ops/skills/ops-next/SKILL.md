---
name: ops-next
description: Business-level "what should I do next". Priority stack — fires > unread comms > ready-to-merge PRs > Linear sprint > revenue-generating GSD work. Uses pre-gathered data and routes to the right skill.
argument-hint: "[context]"
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
  - WebFetch
  - mcp__linear__list_issues
  - mcp__claude_ai_Slack__slack_search_public_and_private
effort: low
maxTurns: 15
---

## Runtime Context

Before advising, load:
1. **Preferences**: `cat ${CLAUDE_PLUGIN_DATA_DIR:-$HOME/.claude/plugins/data/ops-ops-marketplace}/preferences.json` — read `owner`, `primary_project`, `default_channels`
2. **Daemon health**: `cat ${CLAUDE_PLUGIN_DATA_DIR}/daemon-health.json` — flag any action_needed as priority
3. **Ops memories**: Check `${CLAUDE_PLUGIN_DATA_DIR}/memories/topics_active.md` for ongoing work context


# OPS ► NEXT ACTION

## CLI/API Reference

### gh CLI (GitHub)

| Command | Usage | Output |
|---------|-------|--------|
| `gh pr list --state open --json number,title,statusCheckRollup,reviewDecision` | Open PRs with CI/review status | JSON array |

---

## Agent Teams support

If `CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1` is set, use **Agent Teams** when gathering priority data in parallel. This enables:
- Agents share context and can coordinate mid-flight
- You can steer priorities in real-time
- Agents report progress as they complete

**Team setup** (only when flag is enabled):
```
TeamCreate("next-team")
Agent(team_name="next-team", name="fires-checker", prompt="Check infra health and CI for production fires")
Agent(team_name="next-team", name="comms-checker", prompt="Check unread messages across all channels")
Agent(team_name="next-team", name="prs-checker", prompt="Find PRs ready to merge — CI green, reviews approved")
Agent(team_name="next-team", name="sprint-checker", prompt="Check Linear sprint for highest-priority in-progress issues")
```

If the flag is NOT set, use standard fire-and-forget subagents.

## Pre-gathered data

### Infrastructure & fires

```!
${CLAUDE_PLUGIN_ROOT}/bin/ops-infra 2>/dev/null || echo '{"clusters":[]}'
```

### Git & PRs

```!
${CLAUDE_PLUGIN_ROOT}/bin/ops-prs 2>/dev/null || echo '[]'
```

### CI status

```!
${CLAUDE_PLUGIN_ROOT}/bin/ops-ci 2>/dev/null || echo '[]'
```

### Unread messages

```!
${CLAUDE_PLUGIN_ROOT}/bin/ops-unread 2>/dev/null || echo '{}'
```

### GSD active phases

```!
for d in $(jq -r '.projects[] | select(.gsd == true) | .paths[]' "${CLAUDE_PLUGIN_ROOT}/scripts/registry.json" 2>/dev/null); do
  expanded="${d/#\~/$HOME}"
  if [ -f "$expanded/.planning/STATE.md" ]; then
    alias=$(basename "$expanded")
    cat "$expanded/.planning/STATE.md" 2>/dev/null | head -30
    echo "---NEXT---"
  fi
done
```

---

## Your task

Apply the priority stack to all pre-gathered data:

### Priority 1 — FIRES

Check infra data for: unhealthy ECS tasks, stopped services, failed deployments.
Check CI for: broken `main` or `dev` branches.
If any fires exist → **recommend `/ops-fires` immediately**.

### Priority 2 — URGENT COMMS

Check unread counts. If WhatsApp or email has unread messages from humans (not automated):

- Estimate urgency from sender/preview if available
- If urgent comms → **recommend `/ops-inbox [channel]`**

### Priority 3 — READY-TO-MERGE PRs

Check PRs for: CI green + no unresolved review comments + not draft.
If any ready → **recommend reviewing that PR now**.
Check: `gh pr list --state open --json number,title,statusCheckRollup,reviewDecision 2>/dev/null`

### Priority 4 — LINEAR SPRINT

Fetch current sprint issues: use `mcp__linear__list_issues` filtered to current cycle (use Linear GraphQL fallback for cycle queries if needed).
Find highest-priority issue that is in progress or unstarted.

### Priority 5 — GSD WORK

From GSD state, find the highest revenue-impact active phase across all projects.
Revenue weighting: read `revenue.stage` and `priority` from `scripts/registry.json` — projects with lower priority numbers (higher priority) and revenue stage of `growth` or `active` outrank `pre-launch` or `development`. Within the same tier, prioritize closest-to-done phases.

---

## Output format

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 OPS ► NEXT ACTION
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

 TOP PRIORITY: [fires|comms|PR|sprint|gsd]
 ▶ [specific action in one sentence]

 WHY: [1-2 sentence rationale]

──────────────────────────────────────────────────────
 Full priority stack:
 1. [action] — [why] → [/skill or command]
 2. [action] — [why] → [/skill or command]
 3. [action] — [why] → [/skill or command]
 4. [action] — [why] → [/skill or command]
 5. [action] — [why] → [/skill or command]

──────────────────────────────────────────────────────
 a) Do #1 now
 b) Do #2 now
 c) Show me everything (/ops-go)
 d) I'll decide — just show the briefing

 → Pick or describe what you want
──────────────────────────────────────────────────────
```

Use AskUserQuestion. When user selects an option, invoke the corresponding skill directly — don't describe it, do it.

If `$ARGUMENTS` contains context (e.g., "focus on <project-alias>"), constrain the analysis to that context.

---

## Native tool usage

### Tasks — action tracking

After the user selects an action, use `TaskCreate` to track it. When routing to the corresponding skill, the task persists as a reminder of what the user chose to focus on.

### WebFetch — enrichment fallback

When pre-gathered data is stale or incomplete, use `WebFetch` to pull fresh data from APIs (Linear GraphQL, Sentry, GitHub) directly.
