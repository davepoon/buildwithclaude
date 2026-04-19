---
name: ops-merge
description: Autonomous PR merge pipeline. Scans all repos for open PRs, dispatches subagents to fix CI, resolve conflicts, address review comments, then merges. Use --main to also sync dev↔main branches.
argument-hint: "[--main] [--repo org/repo] [--dry-run]"
allowed-tools:
  - Bash
  - Read
  - Write
  - Edit
  - Grep
  - Glob
  - Agent
  - TaskCreate
  - TaskUpdate
  - TaskList
  - AskUserQuestion
  - TeamCreate
  - SendMessage
  - Monitor
  - WebSearch
effort: medium
maxTurns: 50
---

## Runtime Context

Before executing, load:
1. **Preferences**: `cat ${CLAUDE_PLUGIN_DATA_DIR:-$HOME/.claude/plugins/data/ops-ops-marketplace}/preferences.json` — read `owner`, `timezone`, project registry
2. **Daemon health**: `cat ${CLAUDE_PLUGIN_DATA_DIR}/daemon-health.json` — if `action_needed` set, surface to user
3. **Secrets**: GitHub token: env `$GITHUB_TOKEN` → Doppler MCP (`mcp__doppler__*`) → `doppler secrets get GITHUB_TOKEN --plain` → password manager


# OPS ► MERGE

## CLI/API Reference

### gh CLI (GitHub)

| Command | Usage | Output |
|---------|-------|--------|
| `gh pr list --repo <owner/repo> --json number,title,state,headRefName,statusCheckRollup,reviewDecision,mergeable,isDraft` | List PRs with status | JSON array |
| `gh pr view <n> --repo <repo> --json title,body,state,mergeable,reviews` | PR details | JSON |
| `gh pr checks <n> --repo <repo>` | CI check status | Check list |
| `gh pr merge <n> --repo <repo> --squash --admin` | Squash merge PR | Merge result |
| `gh pr create --repo <repo> --title "<t>" --body "<b>" --base dev` | Create PR | PR URL |
| `gh run list --repo <repo> --limit 5 --json conclusion,name,headBranch` | CI runs | JSON array |
| `gh run view <id> --repo <repo> --log-failed` | Failed CI logs | Log output |
| `gh run watch <run-id> --repo <repo>` | Stream CI run | Live output (use with Monitor) |
| `gh api repos/<repo>/pulls/<n>/comments --jq '.[].body'` | PR review comments | Comment text |

---

## Agent Teams support

If `CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1` is set, use **Agent Teams** for fixer agents (Phase 3). This enables:
- Steering fixers mid-flight if priorities change (e.g., a critical PR should be merged first)
- Fixers can report blockers and you can redirect them without waiting for completion
- Shared context: if fixer-A discovers a breaking change that affects fixer-B's PR, you can notify B

**Team setup** (only when flag is enabled, Phase 3):
```
TeamCreate("merge-fixers")
Agent(team_name="merge-fixers", name="fixer-[repo]", ...)
```

Use `SendMessage(to="fixer-my-api", content="PR #2958 was just merged — rebase your branch")` to coordinate.

If the flag is NOT set, fall back to standard parallel subagents with `isolation: "worktree"`.

## Pre-gathered PR data

```!
${CLAUDE_PLUGIN_ROOT}/bin/ops-merge-scan 2>/dev/null || echo '{"prs":[],"error":"merge-scan failed"}'
```

## Your task

You are the **merge orchestrator**. Your job is to get every open PR across the owner's repos merged — fixing whatever blocks them first.

### Parse arguments

From `$ARGUMENTS`:

- `--main` → after all PRs merge to dev, also sync dev↔main for repos that have both branches
- `--repo <slug>` → scope to one repo only (e.g., `--repo Lifecycle-Innovations-Limited/my-api`)
- `--dry-run` → report what would happen, don't dispatch agents or merge anything
- `--force` → skip the confirmation prompt before merging
- (empty) → process all repos, merge to dev only

### Phase 1 — Classify the PR queue

Parse the pre-gathered JSON. For each PR, it's already classified as one of:

| Classification          | Meaning                                                           | Action                                      |
| ----------------------- | ----------------------------------------------------------------- | ------------------------------------------- |
| `ready`                 | CI green, approved, no conflicts                                  | Merge immediately                           |
| `needs-rebase`          | `mergeable: CONFLICTING`                                          | Dispatch fixer: rebase on base branch       |
| `needs-ci-fix`          | CI failures in `statusCheckRollup`                                | Dispatch fixer: investigate logs, fix, push |
| `needs-review-response` | `reviewDecision: CHANGES_REQUESTED`                               | Dispatch fixer: resolve comments            |
| `blocked`               | `mergeStateStatus: BLOCKED` (branch protection, required reviews) | Note why, skip                              |
| `draft`                 | `isDraft: true`                                                   | Skip — not ready for merge                  |

Print the queue:

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 OPS ► MERGE — PR Queue
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

| Repo | PR | Title | Status | Action |
|------|----|-------|--------|--------|
| my-api | #2958 | fix(migration) | ready | merge |
| my-app | #4456 | feat(apple-04) | needs-ci-fix | dispatch fixer |
| ... | ... | ... | ... | ... |

Ready: N  |  Fix needed: N  |  Blocked: N  |  Draft: N
──────────────────────────────────────────────────────
```

If `--dry-run`, stop here. Print the queue and exit.

### Phase 2 — Confirm and merge ready PRs

Unless `--force` was passed, use `AskUserQuestion` to confirm before merging:

```
Ready to merge N PRs:
  [repo]#[number] — [title] → [base]
  [repo]#[number] — [title] → [base]

  [Merge all N now]  [Let me pick which ones]  [Dry run — don't merge]
```

If user picks "Let me pick", show each PR with `[Merge]` / `[Skip]` options via `AskUserQuestion`.

For each confirmed PR:

1. Verify CI is still green: `gh pr checks <number> --repo <repo>`
2. If green: `gh pr merge <number> --repo <repo> --squash --admin`
3. Report: `✓ Merged <repo>#<number> to <base>`

### Phase 3 — Dispatch fixers for PRs that need work

For PRs classified as `needs-rebase`, `needs-ci-fix`, or `needs-review-response`:

**Dispatch subagents in parallel** (max 5 concurrent, one repo per agent):

Each fixer agent gets a worktree and this brief:

```
Task: Fix PR #<number> in <repo> (<classification>)
Repo path: <path from registry>
Branch: <headRefName>

<classification-specific instructions>

For needs-rebase:
  1. Create worktree: `git worktree add /tmp/ops-rebase-<pr-number> <headRefName>`
  2. cd into worktree: `cd /tmp/ops-rebase-<pr-number>`
  3. Fetch latest: `git fetch origin`
  4. Attempt rebase: `git rebase origin/<baseBranchRef> 2>&1`
  5. If rebase SUCCEEDS (exit 0):
     - Push force-with-lease: `git push --force-with-lease origin <headRefName>`
     - Clean up worktree: `git worktree remove /tmp/ops-rebase-<pr-number> --force`
     - Report: `✓ Rebased <repo>#<number> — conflict resolved`
  6. If rebase FAILS (exit non-zero):
     - Capture the conflicting files: `git diff --name-only --diff-filter=U`
     - Show the diff: `git diff HEAD`
     - Abort the rebase: `git rebase --abort`
     - Clean up worktree: `git worktree remove /tmp/ops-rebase-<pr-number> --force`
     - Surface to orchestrator with the diff output and a structured conflict report:
       ```json
       {
         "pr": <number>,
         "repo": "<repo>",
         "status": "conflict",
         "conflicting_files": ["<file1>", "<file2>"],
         "diff_summary": "<first 500 chars of diff>"
       }
       ```

For needs-ci-fix:
  1. Get failed check logs: `gh run view <id> --repo <repo> --log-failed | tail -80`
  2. Diagnose the failure
  3. Fix the code in a worktree
  4. Commit + push --no-verify
  5. Wait for CI to re-run (or report what was fixed)

For needs-review-response:
  1. Read review comments: `gh api repos/<repo>/pulls/<number>/comments --jq '.[].body'`
  2. Address each comment in code
  3. Reply to each comment via gh api
  4. Push fixes
  5. Re-request review if needed

After fixing:
  - Report back: what was wrong, what was fixed, is CI green now?
  - Do NOT auto-merge after fixing. Report the fix and let Phase 4 handle confirmation.
```

Use `model: "sonnet"` for all fixer agents.

### Phase 4 — Resolve surfaced conflicts

For each PR returned with `status: "conflict"` from a fixer agent:

1. Display the conflict summary:
```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 OPS ► MERGE — Conflict in <repo>#<number>
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 Branch: <headRefName> → <baseBranchRef>
 Conflicting files:
   - <file1>
   - <file2>

<diff_summary>
──────────────────────────────────────────────────────
```

2. Use AskUserQuestion (max 4 options — CLAUDE.md Rule 1):

```
[Accept incoming (theirs)]  [Keep current branch (ours)]  [Open manual resolution]  [Skip this PR]
```

3. Based on response:
   - **Accept incoming (theirs)**: Create worktree, rebase with `git checkout --theirs .` on each conflicting file, `git add .`, `git rebase --continue`, push force-with-lease
   - **Keep current branch (ours)**: Create worktree, rebase with `git checkout --ours .` on each conflicting file, `git add .`, `git rebase --continue`, push force-with-lease
   - **Open manual resolution**: Print step-by-step instructions for the operator to resolve manually, then check in with `git push` confirmation before continuing the merge pipeline
   - **Skip this PR**: Note as `unresolved-conflict`, include in final report

### Phase 5 — Collect results and confirm merges

As fixers complete:

1. Verify the PR is now green: `gh pr checks <number> --repo <repo>`
2. If green, use `AskUserQuestion` to confirm (unless `--force`):
   ```
   Fixer resolved [repo]#[number] — [what was fixed]. CI is now green.
     [Merge now]  [Skip — I'll review manually]
   ```
3. If still red: report what's still broken, do not merge

### Phase 6 — `--main` sync (only if flag is set)

For each repo that has separate `dev` and `main` branches:

1. Check if dev is ahead of main: `git -C <path> log main..dev --oneline | head -5`
2. If ahead, show the commits and use `AskUserQuestion`:
   ```
   [repo]: dev is N commits ahead of main:
     [commit list]

     [Create sync PR and merge]  [Create PR only — I'll review]  [Skip this repo]
   ```
3. If confirmed: create sync PR: `gh pr create --repo <repo> --base main --head dev --title "chore: sync dev → main"`
4. Wait for CI: `gh pr checks <sync-pr-number> --repo <repo> --watch` (background, max 10 min)
5. If CI green: `gh pr merge <sync-pr-number> --repo <repo> --merge --admin` (merge commit, not squash)
6. Pull main back into dev: `git -C <path> fetch origin && git -C <path> checkout dev && git -C <path> merge origin/main --no-edit`

### Phase 7 — Final report

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 OPS ► MERGE COMPLETE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

| Repo | PR | Result |
|------|----|--------|
| my-api | #2958 | ✓ merged to dev |
| my-app | #4456 | ✓ fixed CI + merged |
| mise | #10 | ✗ 3 critical bugs — skipped |

Merged: N PRs across M repos
Skipped: N (blocked/draft)
Failed: N (still need manual attention)

Main sync: N repos synced (dev → main → dev)
──────────────────────────────────────────────────────
```

---

## Safety Rails (NEVER violate)

- **NEVER force-push to main/master**
- **NEVER merge with red CI** — fix root cause first
- **NEVER bypass review on PRs touching auth, payments, PII, or secrets** — these require `security-reviewer` subagent audit before merge
- **NEVER run `git reset --hard` on shared branches**
- **ALWAYS use worktrees** for fixes (multiple agents may be active)
- **ALWAYS use `--admin` only for squash merges to dev** (not main, unless `--main` flag)
- **Max 10 PRs per invocation** to avoid GitHub API throttling
- **If a PR has > 50 files changed**, flag it for manual review instead of auto-merging

---

## Native tool usage

### Monitor — live CI watching

When waiting for CI after a fixer pushes (Phase 3-4), use `Monitor` to stream the GitHub Actions run output instead of polling:
```
Monitor(command: "gh run watch <run-id> --repo <repo>")
```
This avoids sleep loops and gives real-time feedback on CI progress.

### Tasks — progress tracking

Create a `TaskCreate` for the overall merge pipeline and individual tasks per PR. Update with `TaskUpdate` as each PR is fixed/merged/skipped. This gives the user a live checklist view.

### WebSearch — CI failure context

When a fixer agent encounters an obscure CI failure, use `WebSearch` to find known issues (e.g., npm registry outages, GitHub Actions incidents, flaky test patterns).
