---
name: ops-yolo
description: YOLO mode. Spawns 4 parallel C-suite agents (CEO, CTO, CFO, COO). Each analyzes the business from their perspective using ALL available data. Produces unfiltered Hard Truths report. After user types YOLO, autonomously runs the business for a day using /loop.
argument-hint: "[YOLO|analyze|report]"
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
  - EnterPlanMode
  - ExitPlanMode
  - CronCreate
  - CronList
  - CronDelete
  - Monitor
  - WebFetch
  - WebSearch
  - mcp__linear__list_issues
  - mcp__claude_ai_Vercel__list_deployments
  - mcp__claude_ai_Slack__slack_search_public_and_private
  - mcp__claude_ai_Gmail__search_threads
effort: high
model: claude-opus-4-6
maxTurns: 50
---

## Runtime Context

Before YOLO analysis, load:
1. **Preferences**: `cat ${CLAUDE_PLUGIN_DATA_DIR:-$HOME/.claude/plugins/data/ops-ops-marketplace}/preferences.json` — read `owner`, `timezone`, `yolo_enabled`, all channel configs
2. **Daemon health**: `cat ${CLAUDE_PLUGIN_DATA_DIR}/daemon-health.json` — all services must be healthy for comprehensive analysis
3. **Secrets**: Resolve ALL keys via env → Doppler → password manager: GITHUB_TOKEN, SENTRY_AUTH_TOKEN, LINEAR_API_KEY, AWS_ACCESS_KEY_ID
4. **Ops memories**: Load ALL files from `${CLAUDE_PLUGIN_DATA_DIR}/memories/` — contact profiles, preferences, topics, donts. YOLO agents need maximum context.


# OPS ► YOLO MODE

## CLI/API Reference

### aws CLI (Cost Explorer)

| Command | Usage | Output |
|---------|-------|--------|
| `aws ce get-cost-and-usage --time-period Start=<YYYY-MM-DD>,End=<YYYY-MM-DD> --granularity MONTHLY --metrics "UnblendedCost" --output json` | Current month spend | Cost JSON |

### gh CLI (GitHub)

| Command | Usage | Output |
|---------|-------|--------|
| `gh pr list --repo <owner/repo> --json number,title,statusCheckRollup,reviewDecision,mergeable,isDraft` | Open PRs with status | JSON array |
| `gh pr merge <n> --repo <repo> --squash --admin` | Squash merge PR | Merge result |
| `gh run list --limit 20 --json status,conclusion,name,headBranch,createdAt` | Recent CI runs | JSON array |

---

## Agent Teams support

If `CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1` is set, use **Agent Teams** instead of fire-and-forget subagents for the C-suite analysis (Phase 2). This enables:
- Agents can share findings mid-analysis (CEO discovers a revenue blocker → CFO factors it into ROI)
- You can steer agents if early findings change priorities
- Agents coordinate on the consensus recommendation

**Team setup** (only when flag is enabled):
```
TeamCreate("yolo-csuite")
Agent(team_name="yolo-csuite", name="ceo", subagent_type="ops:yolo-ceo", ...)
Agent(team_name="yolo-csuite", name="cto", subagent_type="ops:yolo-cto", ...)
Agent(team_name="yolo-csuite", name="cfo", subagent_type="ops:yolo-cfo", ...)
Agent(team_name="yolo-csuite", name="coo", subagent_type="ops:yolo-coo", ...)
```

After initial analysis, use `SendMessage(to="cto", content="CFO flagged $400/mo in waste — does this change your tech-debt ranking?")` or similar to cross-pollinate findings between peer agents. The **main `/ops:yolo` orchestrator** (this skill) then reads all four analysis files (ceo-analysis.md, cto-analysis.md, cfo-analysis.md, coo-analysis.md) and synthesizes them into the Hard Truths report. `yolo-ceo` is a parallel peer, not the synthesizer.

If the flag is NOT set, fall back to standard parallel subagents (fire-and-forget, no mid-task steering).

## Phase 1 — Pre-gather ALL data

Run all of these simultaneously:

```!
${CLAUDE_PLUGIN_ROOT}/bin/ops-infra 2>/dev/null || echo '{}'
```

```!
${CLAUDE_PLUGIN_ROOT}/bin/ops-git 2>/dev/null || echo '[]'
```

```!
${CLAUDE_PLUGIN_ROOT}/bin/ops-prs 2>/dev/null || echo '[]'
```

```!
${CLAUDE_PLUGIN_ROOT}/bin/ops-ci 2>/dev/null || echo '[]'
```

```!
${CLAUDE_PLUGIN_ROOT}/bin/ops-unread 2>/dev/null || echo '{}'
```

```!
aws ce get-cost-and-usage --time-period "Start=$(date +%Y-%m-01),End=$(date +%Y-%m-%d)" --granularity MONTHLY --metrics "UnblendedCost" --output json 2>/dev/null || echo '{}'
```

```!
cat "${CLAUDE_PLUGIN_ROOT}/scripts/registry.json" 2>/dev/null || echo '{}'
```

```!
${CLAUDE_PLUGIN_ROOT}/bin/ops-external 2>/dev/null || echo '[]'
```

```!
for d in $(jq -r '.projects[] | select(.gsd == true) | .paths[]' "${CLAUDE_PLUGIN_ROOT}/scripts/registry.json" 2>/dev/null); do
  expanded="${d/#\~/$HOME}"
  [ -f "$expanded/.planning/STATE.md" ] && echo "=== $(basename $expanded) ===" && cat "$expanded/.planning/STATE.md" && echo "---"
done
```

---

## Phase 2 — Spawn 4 C-suite agents in parallel

Spawn these 4 agents simultaneously using all pre-gathered data as context. Each writes their analysis to a file in `/tmp/yolo-[session]/`:

### Agent 1 — CEO (Strategic)

Uses `agents/yolo-ceo.md`. Writes `/tmp/yolo-[session]/ceo-analysis.md`.

- What's the #1 thing blocking growth right now?
- Are we building the right things?
- Where are we wasting time vs. creating value?
- What would you tell an investor today, unfiltered?

### Agent 2 — CTO (Technical)

Uses `agents/yolo-cto.md`. Writes `/tmp/yolo-[session]/cto-analysis.md`.

- What's the worst technical debt that will bite us?
- Which services are time-bombs?
- Is the team/architecture set up to scale?
- What corners were cut that need fixing now?

### Agent 3 — CFO (Financial)

Uses `agents/yolo-cfo.md`. Writes `/tmp/yolo-[session]/cfo-analysis.md`.

- Actual burn rate vs. runway
- Which AWS services are waste?
- When do we hit zero if nothing changes?
- What's the ROI on current work?

### Agent 4 — COO (Operations)

Uses `agents/yolo-coo.md`. Writes `/tmp/yolo-[session]/coo-analysis.md`.

- What's falling through the cracks right now?
- Which processes are broken?
- What's the top execution risk this week?
- What should be automated that isn't?

---

## Phase 3 — Hard Truths Report (orchestrator synthesis)

**This skill (the main orchestrator) is the synthesizer** — NOT `yolo-ceo`. After all 4 parallel agents complete and have written their analysis files to `/tmp/yolo-[session]/{ceo,cto,cfo,coo}-analysis.md`, read all four files here in the main context and synthesize them into a unified report:

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 YOLO ► HARD TRUTHS REPORT — [date]
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

 CEO: [1-2 brutal strategic truths]

 CTO: [1-2 brutal technical truths]

 CFO: [1-2 brutal financial truths]

 COO: [1-2 brutal operational truths]

──────────────────────────────────────────────────────
 CONSENSUS: The #1 thing that matters today is:
 [single most important action, no sugar-coating]
──────────────────────────────────────────────────────

 Full analysis files saved to:
 /tmp/yolo-[session]/ceo-analysis.md
 /tmp/yolo-[session]/cto-analysis.md
 /tmp/yolo-[session]/cfo-analysis.md
 /tmp/yolo-[session]/coo-analysis.md

──────────────────────────────────────────────────────
 Type YOLO to hand over the controls.
 I'll run your business autonomously for the next day.
 This means: closing inbox, merging ready PRs,
 fixing fires, advancing GSD phases, triaging issues.

 Or pick an analysis to read:
──────────────────────────────────────────────────────
```

Use **batched AskUserQuestion calls** (max 4 options each):

AskUserQuestion call 1:
```
  [Read CEO analysis]
  [Read CTO analysis]
  [Read CFO analysis]
  [More...]
```

AskUserQuestion call 2 (only if "More..."):
```
  [Read COO analysis]
  [Execute top recommendation now]
  [Type YOLO to go autonomous]
```

---

## Phase 4 — YOLO Autonomous Mode

If user types `YOLO` (all caps), enter autonomous mode via `/loop`.

**Before starting**, use `AskUserQuestion` to confirm scope:

```
YOLO mode will autonomously execute these steps:
  1. Inbox — reply to humans, archive automated
  2. Fires — fix CRITICAL/HIGH production issues
  3. PRs — merge ready PRs (CI green, approved)
  4. Triage — auto-resolve confirmed-fixed issues
  5. GSD — advance highest-priority phase
  6. Linear — sync sprint board
  7. Deploy — trigger pending deploys
  8. Report — summary

  [Run all 8 steps]  [Pick which steps to run]  [Cancel]
```

If user picks "Pick which steps", show steps as `multiSelect` via **batched AskUserQuestion calls** (max 4 options each):

Call 1: `[Inbox]`, `[Fires]`, `[PRs]`, `[More steps...]`
Call 2 (if "More steps..."): `[Triage]`, `[GSD]`, `[Linear]`, `[More steps...]`
Call 3 (if "More steps..."): `[Deploy]`, `[Report]`, `[Done selecting]`

Run the selected steps in sequence, reporting after each step.

**Per-step confirmations** (use `AskUserQuestion` before EACH destructive action):

- **Inbox**: Show drafted replies and ask `[Send all N replies]` / `[Review each one]` / `[Skip inbox]` before sending any messages
- **Fires**: Show proposed fix and ask `[Dispatch fix agent]` / `[Skip]` before each agent dispatch
- **PRs**: Show PR list and ask `[Merge all N ready PRs]` / `[Pick which ones]` / `[Skip]` before merging
- **Triage**: Show issues to close and ask `[Auto-resolve all N confirmed-fixed]` / `[Review each]` / `[Skip]` before closing
- **Deploy**: Show pending deploys and ask `[Deploy all]` / `[Pick which]` / `[Skip]` before triggering
- **Infrastructure changes**: For EVERY destructive infra action (delete ALB, stop RDS, disable Multi-AZ, purge images, etc.), present the specific action with context from the C-suite reports and ask `[Execute]` / `[Skip]` individually. NEVER batch destructive infra actions.

**Report-driven execution**: When the user approves executing recommendations from the Hard Truths report:
1. Read ALL C-suite analysis files (`/tmp/yolo-[session]/*.md`)
2. Extract specific actionable items marked with `⚠️ REQUIRES CONFIRMATION`
3. Present each action individually via `AskUserQuestion` with the exact command that will run, the expected outcome, and the source report (CTO/CFO/COO)
4. Only execute after explicit per-action approval
5. After each action, verify the result and report back before proceeding to the next

After each step, check if new fires have appeared before proceeding.
Report final summary when done.

If `$ARGUMENTS` is `analyze` or empty, go straight to Phase 1.
If `$ARGUMENTS` is `YOLO`, skip to Phase 4.
If `$ARGUMENTS` is `report`, skip to Phase 3 (reads existing analysis files if present).

---

## Native tool usage

### Tasks — progress tracking

Use `TaskCreate` at the start of Phase 4 to create a task for each YOLO step. Update with `TaskUpdate` as each completes. This gives the user a live progress view across the autonomous run.

### PlanMode — review before autonomous

Before Phase 4 execution, use `EnterPlanMode` to present the full execution plan. The user reviews what YOLO will do, approves or modifies, then `ExitPlanMode` to begin execution.

### Cron — schedule daily YOLO

After Phase 4 completes, offer to schedule recurring YOLO via `AskUserQuestion`:
```
  [Schedule daily YOLO at 9am]  [Schedule weekly Monday briefing]  [No schedule]
```
Use `CronCreate` if selected. Use `CronList`/`CronDelete` to manage existing schedules.

### Monitor — live CI/deploy watching

When YOLO dispatches fix agents or triggers deploys, use `Monitor` to stream CI output in real-time instead of polling with sleep loops.

### WebFetch/WebSearch — enrichment

Use `WebFetch` to pull Grafana dashboards, Sentry event details, or AWS status pages when MCPs are unavailable. Use `WebSearch` to find context on production errors (e.g., known AWS outages).
