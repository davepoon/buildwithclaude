---
name: ops-orchestrate
description: "Autonomous multi-project orchestration engine. Audits all registered projects, structures work into dependency-wired tasks, dispatches parallel agents (subagents or Agent Teams), audits completions, and ships PRs. Registry-driven — works for any user with a configured project registry."
argument-hint: "[--teams|--subagents|--hybrid|--dry-run|--project alias|--fires-only|--max-waves N]"
allowed-tools:
  - Bash
  - Read
  - Write
  - Edit
  - Grep
  - Glob
  - Agent
  - AskUserQuestion
  - TeamCreate
  - SendMessage
  - TaskCreate
  - TaskUpdate
  - TaskGet
  - TaskList
  - TaskStop
  - TaskOutput
  - Monitor
  - WebFetch
  - WebSearch
  - EnterPlanMode
  - ExitPlanMode
  - CronCreate
  - CronList
  - LSP
  - mcp__sentry__search_issues
  - mcp__linear__list_issues
  - mcp__linear__update_issue
  - mcp__linear__create_issue
effort: high
model: claude-opus-4-6
maxTurns: 100
---

## Runtime Context

Before orchestrating, load:
1. **Preferences**: `cat ${CLAUDE_PLUGIN_DATA_DIR:-$HOME/.claude/plugins/data/ops-ops-marketplace}/preferences.json` — read `owner`, `timezone`, `yolo_enabled`, registry path
2. **Daemon health**: `cat ${CLAUDE_PLUGIN_DATA_DIR}/daemon-health.json` — ensure all services healthy before dispatching
3. **Secrets**: Resolve via env → Doppler → password manager: `GITHUB_TOKEN`, `SENTRY_AUTH_TOKEN`, `LINEAR_API_KEY`, `ANTHROPIC_API_KEY`
4. **Ops memories**: Check `${CLAUDE_PLUGIN_DATA_DIR}/memories/topics_active.md` for priority context


# OPS ► ORCHESTRATE — Autonomous Work Engine

## CLI/API Reference

### gh CLI (GitHub)

| Command | Usage | Output |
|---------|-------|--------|
| `gh pr list --state open --json number,title,statusCheckRollup,reviewDecision,mergeable,isDraft` | Open PRs with status | JSON array |
| `gh pr view <n> --repo <repo> --json files,additions,deletions` | PR file diff summary | JSON |
| `gh pr checks <n>` | CI check status | Check list |
| `gh pr merge <n> --squash --admin` | Squash merge PR | Merge result |
| `gh run list --repo <repo> --workflow "<workflow>" --limit 5 --json conclusion,headBranch` | CI runs for workflow | JSON array |
| `gh run view <id> --repo <repo> --log-failed` | Failed CI logs | Log output |
| `gh issue list --state open` | Open issues | JSON array |

### sentry-cli / Sentry API

| Command | Usage | Output |
|---------|-------|--------|
| `sentry-cli issues list --project <slug> --status unresolved` | Unresolved issues | Issue list |
| `curl -H "Authorization: Bearer $SENTRY_AUTH_TOKEN" "https://sentry.io/api/0/projects/<org>/<proj>/issues/?query=is:unresolved"` | API fallback | JSON array |

### Linear GraphQL (fallback when MCP unavailable)

| Command | Usage | Output |
|---------|-------|--------|
| `curl -X POST https://api.linear.app/graphql -H "Authorization: $LINEAR_API_KEY" -H "Content-Type: application/json" -d '{"query":"{ issues(filter: {state: {type: {in: [\"started\",\"unstarted\"]}}}) { nodes { id title state { name } priority assignee { name } } } }"}'` | Active issues | JSON |

---



You are the **master orchestrator**. Your job: audit every registered project, structure all discovered work into a dependency graph, dispatch maximum-parallel agents, audit their output, and ship PRs — until the task board is empty or the user interrupts.

**No preamble. No "would you like me to". Execute immediately.**

---

## Context Detection

Detect where this skill was invoked:

```bash
# If invoked from a specific project directory (not ~), scope to that project
CWD="$(pwd)"
if [ "$CWD" != "$HOME" ] && [ -d "$CWD/.git" ]; then
  echo "SCOPED:$CWD"
else
  echo "GLOBAL"
fi
```

- **SCOPED mode** (invoked inside a project dir): Limit work to that project only. Include all todos/tasks from the current conversation context. Skip the global registry scan.
- **GLOBAL mode** (invoked from ~ or with no git repo): Scan all registered projects.

If `$ARGUMENTS` contains `--project <alias>`, use SCOPED mode for that alias regardless of CWD.

---

## Orchestration Mode — How to Choose

### Decision matrix (shown to user if no flag passed)

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 ORCHESTRATION MODE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

 --subagents (default)     Fire-and-forget. Cheapest. Best for:
                           - Independent single-repo fixes
                           - Tasks that don't need mid-flight changes
                           - Cost: ~1.5-2x base token usage

 --teams                   Agent Teams with mid-flight steering. Best for:
                           - Cross-repo contract changes (API + consumer)
                           - Security/auth work touching 2+ repos
                           - When you need to redirect agents based on findings
                           - Cost: ~3-7x base token usage

 --hybrid (recommended)    Auto-selects per task. Teams for cross-repo
                           and security work, subagents for everything else.
                           Best balance of speed, cost, and coordination.
                           Cost: ~2-4x base token usage

 --dry-run                 Audit + plan only. Shows what would be dispatched
                           without executing. Good for reviewing before committing.
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

If no flag is passed, use `AskUserQuestion`:
```
  [Subagents — fast & cheap]  [Agent Teams — steerable]  [Hybrid — auto-select]  [Dry run — plan only]
```

### Auto-detection heuristic (for `--hybrid` mode)

Tag each task during Phase 2:

| Condition | Mode | Why |
|-----------|------|-----|
| Task touches 1 repo, no auth/payments/PII | `subagent` | Isolated, no coordination needed |
| Task touches 2+ repos (API schema + consumer) | `team` | Teammates coordinate schema handoff |
| Task touches auth, payments, PII, secrets | `team` | Security-reviewer teammate audits in real-time |
| Task is read-only (audit, report, analysis) | `subagent` | No risk, no coordination |
| Task depends on another in-flight task's output | `team` | SendMessage delivers output without re-dispatch |

### Feature flag requirement for Agent Teams

Agent Teams requires `CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1`. Check before using:

```bash
[ "${CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS:-0}" = "1" ] && echo "teams_available" || echo "teams_unavailable"
```

If `--teams` or `--hybrid` is requested but the flag is off, warn and fall back to `--subagents`.

---

## Phase 1 — Audit (parallel, read-only)

### 1a. Discover projects

**SCOPED mode**: Use only the current directory. Read `.planning/STATE.md` if it exists.

**GLOBAL mode**: Scan the project registry:

```bash
REGISTRY="${CLAUDE_PLUGIN_ROOT}/scripts/registry.json"
jq -r '.projects[] | "\(.alias)|\(.paths[0])|\(.repos[0] // "none")|\(.gsd // false)"' "$REGISTRY" 2>/dev/null
```

For each project path, verify it exists on disk. Skip missing paths.

### 1b. Parallel audit dispatch

Group projects into batches of ~8. Dispatch one audit subagent per batch (always subagents — audit is read-only, no steering needed):

Each audit agent checks:
- `git status --porcelain` — uncommitted changes
- `git log origin/dev..HEAD --oneline` — unpushed commits
- `gh pr list --state open --json number,title,statusCheckRollup,reviewDecision,mergeable,isDraft` — open PRs + CI
- `gh run list --limit 5 --json status,conclusion,name,headBranch,createdAt` — recent CI runs
- `.planning/STATE.md` — current GSD phase + progress
- `.planning/ROADMAP.md` — upcoming phases
- Unresolved review comments on open PRs

### 1c. Filter already-fixed failures

Before creating tasks for CI failures:
```bash
# If latest run on dev/main is success → skip (intermittent or already fixed)
gh run list --repo <repo> --workflow "<workflow>" --limit 5 --json conclusion,headBranch \
  --jq '[.[] | select(.headBranch == "dev" or .headBranch == "main")] | .[0].conclusion'
```

- Latest = `success` → **skip**
- Latest = `failure` AND 2+ prior also `failure` → **create task** (persistent)
- Latest = `failure` but prior = `success` → **create P2 task** (new regression)

### 1d. External issue sources (parallel with 1b)

Run these in parallel with the audit agents:

- **Sentry**: `mcp__sentry__search_issues` or `sentry-cli issues list` — P0/P1 unresolved errors
- **Linear**: `mcp__linear__list_issues` for current sprint — in-progress and unstarted
- **GitHub Issues**: `gh issue list --state open` per repo
- **Conversation context**: Scan current conversation for todos, requests, and incomplete work the user mentioned

### 1e. Cross-reference against existing tasks

`TaskList` — check current task board. Flag:
- Tasks already done → mark `completed`
- Tasks stale (root cause changed) → update description
- New work not yet in TaskList → queue for Phase 2

---

## Phase 2 — Structure (TaskCreate + dependency wiring)

### 2a. Decompose into atomic tasks

Each task should be:
- **One PR max** (~2-4 hour scope)
- **One repo only** (isolation for parallel execution)
- **Clear acceptance criteria** (what "done" looks like)

### 2b. TaskCreate with rich metadata

```
TaskCreate({
  title: "fix: resolve auth middleware race condition",
  description: "File: src/middleware/auth.ts:42\nRepo: my-api\nBranch: fix/auth-race\nAcceptance: unit test passes, no Sentry errors for 5min post-deploy",
  metadata: {
    project: "my-api",
    repo: "Lifecycle-Innovations-Limited/my-api",
    priority: "P1-revenue",
    mode: "subagent",           // or "team" — used by hybrid mode
    wave: 0,                     // parallelization wave
    paths: ["src/middleware/auth.ts", "tests/auth/"],
    quality_gate: "npm run type-check && npm run lint && npm run test:unit"
  }
})
```

### 2c. Wire dependencies (CRITICAL for max parallelism)

**Rules for dependency wiring:**

1. **If tasks are independent → NO dependency. They run in the SAME wave.**
2. **Only add `addBlockedBy` when the output of task A is genuinely required as input for task B.**
3. **Never serialize tasks that can run in parallel.** Three independent bug fixes in three repos = wave 0, all three, simultaneously.

Common dependency patterns:
- Deploy task → blocked by its implementation task
- Phase N task → blocked by Phase N-1 completion
- Consumer update → blocked by API schema change (cross-repo)
- PR merge → blocked by CI passing
- Main merge → blocked by dev merge

**Anti-patterns to AVOID:**
- ❌ Serializing independent single-repo fixes (they should be wave 0 parallel)
- ❌ Making task B depend on task A just because A was discovered first
- ❌ Waiting for all wave 0 to complete before starting ANY wave 1 (start wave 1 tasks as soon as their specific blockers clear)

### 2d. Assign waves

```
Wave 0: All tasks with ZERO dependencies → dispatch ALL simultaneously
Wave 1: Tasks blocked only by wave 0 items → dispatch as each blocker clears
Wave N: Cascade — but NEVER wait for the full wave to clear. 
        Start each task the MOMENT its specific blockers resolve.
```

### 2e. Tag orchestration mode (hybrid only)

Apply the decision matrix from above to tag each task as `subagent` or `team`.

---

## Phase 3 — Dispatch (maximum parallelism)

### Subagent dispatch

Rules:
- **Max concurrent: 5 agents** (avoid overload)
- **One repo per agent** (no concurrent edits to same path)
- **Each agent gets a worktree** via `isolation: "worktree"`
- **Use `model: "sonnet"`** on every `Agent()` call (saves quota)
- **Use `run_in_background: true`** — never block waiting
- Mark task `in_progress` via `TaskUpdate` before dispatching

```
Agent({
  description: "Fix auth race condition in my-api",
  model: "sonnet",
  isolation: "worktree",
  run_in_background: true,
  prompt: "<full task brief with repo path, file paths, branch strategy, acceptance criteria, quality gate>"
})
```

### Agent Teams dispatch

Only when mode is `--teams` or task is tagged `team` in hybrid:

```
TeamCreate("wave-0-cross-repo")

Agent(team_name="wave-0-cross-repo", name="api-worker", model="sonnet", isolation="worktree",
  prompt="<task brief with FILE OWNERSHIP boundaries>")

Agent(team_name="wave-0-cross-repo", name="mobile-worker", model="sonnet", isolation="worktree",
  prompt="<task brief with FILE OWNERSHIP boundaries>")
```

**File ownership (CRITICAL — prevents overwrites):**
Each teammate prompt MUST include:
```
Your files: src/api/auth.ts, src/middleware/*.ts, tests/auth/
Do NOT edit: src/api/users.ts (owned by api-worker), src/frontend/ (owned by mobile-worker)
```

**Mid-flight steering (the killer feature):**
```
SendMessage(to="api-worker", content="Schema changed — DTO is now UserResponseV2. Update imports.")
SendMessage(to="mobile-worker", content="API endpoint ready. New: POST /v2/users. Proceed with consumer.")
```

**Cross-repo coordination pattern:**
1. Spawn `api-worker` and `consumer-worker` on same team
2. Wire dependency: consumer blocked by api
3. When api-worker completes schema → `SendMessage` to consumer with the new types/endpoint
4. Consumer proceeds with full context — no re-dispatch needed

### Wave execution — NEVER idle

```
WHILE tasks remain:
  1. TaskList → find ALL unblocked tasks
  2. Dispatch up to 5 simultaneously (subagent or team per task tag)
  3. As EACH agent completes → immediately audit (Phase 4)
  4. As EACH audit passes → immediately ship (Phase 5)
  5. As EACH ship completes → TaskList again, dispatch newly-unblocked
  6. NEVER wait for full wave to clear before starting next items
```

Use `Monitor` to stream CI output from running checks instead of sleep-polling.

---

## Phase 4 — Audit (verify each completion)

When an agent reports back, **verify before marking complete**:

1. **Read the PR**: `gh pr view <n> --repo <repo> --json files,additions,deletions`
2. **Verify diff matches task**: does the change actually fix what was described?
3. **Run quality gate**:
   ```bash
   # From task metadata
   cd <worktree> && eval "<quality_gate command>"
   ```
4. **Check CI**: `gh pr checks <n>` — all green?
5. **Security scan**: if auth/payment/PII touched → dispatch `security-reviewer` subagent
6. **If audit fails**:
   - Subagent mode: reopen task, re-dispatch fresh agent with failure context
   - Teams mode: `SendMessage(to="<worker>", content="Audit failed: <issue>. Fix and re-submit.")`
7. **If audit passes**: proceed to Phase 5

---

## Phase 5 — Ship (merge + deploy)

For each PR that passed audit:

1. **Address review comments**: read via `gh api`, resolve each
2. **CI verification**: `gh pr checks <n>` — wait via `Monitor` if still running
3. **Merge conflict resolution**: check `mergeable` state, resolve if needed
4. **Merge to dev**: `gh pr merge <n> --squash --admin` (use `AskUserQuestion` to confirm unless `--force`)
5. **Merge dev → main** (if applicable and authorized): create sync PR, wait CI, merge
6. **Post-deploy verification**: health check, Sentry check for new errors

---

## Phase 5.5 — Liveness Monitor (between every wave)

```bash
# Check each in-flight agent's worktree for recent writes
for wt in .worktrees/*/; do
  last_write=$(find "$wt" -maxdepth 3 -type f -newer /tmp/ops-orchestrate-start 2>/dev/null | wc -l)
  echo "$(basename $wt): $last_write files changed since start"
done
```

**Stalled agent protocol (>15 min since last write):**

- **Subagents**: `TaskStop` → assess partial progress → re-dispatch with narrowed scope
- **Teams**: `SendMessage(to="<worker>", content="Status check — are you stuck?")` → wait 60s → if no response, `TaskStop` and replace

**Never re-dispatch the exact same prompt.** The agent stalled for a reason. Narrow scope, add file paths, or split the task.

---

## Phase 6 — Loop

```
WHILE true:
  TaskList → check board state
  IF all tasks completed/blocked → print final report, HALT
  IF pending unblocked tasks exist → go to Phase 3
  IF all pending are blocked → surface blockers to user, HALT
  Run Phase 5.5 liveness check on in-flight agents
```

### Completion criteria

Do NOT stop until:
- Every task is `completed`, `deleted`, or explicitly `blocked` on user input
- All PRs merged (at minimum to dev)
- All background processes terminated
- All teams cleaned up (Teams mode)
- Final report printed

---

## Reporting

Between waves:
```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 OPS ► ORCHESTRATE — Wave N | Mode: [subagents/teams/hybrid]
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

 TASK           OWNER          STATUS   PR      CI    DEPLOY
 ──────────────────────────────────────────────────────────
 fix auth       api-worker     ✓ done   #4417   ✓     dev merged
 update types   mobile-worker  ◉ wip    #488    …     —
 add tests      test-agent     ○ queue  —       —     —

 Completed: N/T | In-flight: N | Queued: N | Blocked: N
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

Final report:
```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 OPS ► ORCHESTRATION COMPLETE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 Mode:      [subagents/teams/hybrid]
 Completed: N tasks, M PRs shipped, K promoted to main
 Blocked:   [list with rationale]
 Follow-ups:[list with task IDs]
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

---

## Safety Rails (NEVER violate)

- **NEVER force-push to main/master**
- **NEVER merge with red CI** — fix root cause first
- **NEVER bypass review on PRs touching auth, payments, PII, secrets** — require `security-reviewer` audit
- **NEVER touch `.env`, credentials, or secrets files** — flag and skip
- **NEVER `git reset --hard` on shared branches**
- **ALWAYS use worktrees** — multiple agents may be active concurrently
- **ALWAYS define file ownership** when 2+ teammates touch same repo
- **NEVER spawn teammates after entering delegate mode** (known bug: teammates lose file tools)
- **Max 5 concurrent agents** — respect system limits

---

## Arguments

| Flag | Effect |
|------|--------|
| (empty) | Full audit + execution, ask for mode |
| `--subagents` | Force subagent mode (cheapest) |
| `--teams` | Force Agent Teams mode (steerable, 3-7x cost) |
| `--hybrid` | Auto-select per task (recommended) |
| `--dry-run` | Phase 1+2 only, print plan, don't dispatch |
| `--project <alias>` | Scope to one project |
| `--fires-only` | Only P0 production-broken tasks |
| `--no-main` | Stop at dev merge, never touch main |
| `--max-waves N` | Cap at N waves then halt |
| `--force` | Skip merge confirmations |

---

Begin with Phase 1 immediately. Do not ask for confirmation (except mode selection if no flag).
