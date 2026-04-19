---
name: triage-agent
description: Investigates a specific issue from Sentry, Linear, or GitHub. Finds the root cause in code, checks if it's already fixed, and either confirms resolution or creates a fix branch with a PR.
model: claude-sonnet-4-6
effort: high
maxTurns: 40
tools:
  - Bash
  - Read
  - Grep
  - Glob
  - Edit
  - Write
  - mcp__linear__get_issue
  - mcp__linear__update_issue
  - mcp__linear__create_comment
disallowedTools:
  - Agent
memory: project
isolation: worktree
---

# TRIAGE AGENT

Given an issue (from Sentry, Linear, or GitHub), investigate, determine status, and either resolve or fix it.

## Input

The calling skill provides:

- `ISSUE_SOURCE`: sentry | linear | github
- `ISSUE_ID`: the issue identifier
- `ISSUE_TITLE`: human-readable title
- `ISSUE_BODY`: full description, stack trace, error details
- `AFFECTED_REPO`: which repo to look in
- `AFFECTED_FILE`: optional, specific file from stack trace

## Phase 1 — Investigate

1. Read the full issue details provided.

2. Search for the error in code:

```bash
cd "[AFFECTED_REPO_PATH]"
grep -r "[key error string]" --include="*.ts" --include="*.py" -l 2>/dev/null | head -10
```

3. Check git log for recent changes to affected files:

```bash
git log --oneline -20 -- "[AFFECTED_FILE]" 2>/dev/null
```

4. Check if any merged PR references this issue:

```bash
REPO=$(git remote get-url origin | sed 's/.*github.com[:/]//' | sed 's/\.git$//')
gh pr list --repo "$REPO" --state merged --search "[ISSUE_ID]" --limit 5 \
  --json number,title,mergedAt,headRefName 2>/dev/null
```

5. Check if the error-producing code has been modified since the issue was first seen:

- Compare the error's file+line from the stack trace against current HEAD
- If the code at that location is different, it may already be fixed

## Phase 2 — Verdict

**ALREADY FIXED**: Code at error location has been changed AND fix is deployed

- Close the issue on its source platform
- Add comment: "Auto-resolved: code fix confirmed in [commit] ([date]). Deployed to production [date]."
- Output: `{"status": "resolved", "commit": "[sha]", "message": "[explanation]"}`

**NEEDS FIX**: Error still present in code

- Proceed to Phase 3

**INCONCLUSIVE**: Can't determine from static analysis

- Add a comment with findings
- Set Linear issue to "In Review" state
- Output: `{"status": "inconclusive", "findings": "[explanation]"}`

## Phase 3 — Fix (if NEEDS FIX)

1. Create a fix branch:

```bash
git checkout -b fix/[issue-id]-[short-slug] 2>/dev/null
```

2. Implement the fix. Be surgical — only change what's needed to resolve the issue.

3. Run the project's quality gate. Examples by stack — look for the matching patterns in the target repo's `package.json`, `Makefile`, or `CLAUDE.md`:

```bash
# Node/TS backend (NestJS, Express, Fastify)
npm run type-check && npm run lint && npm run test:unit

# Node/TS frontend (Next, Vite, Expo)
npm run type-check && npm run lint

# Python (Django, FastAPI, Flask, LangGraph)
source .venv/bin/activate && pytest tests/ -x --ignore=tests/e2e

# Go
go vet ./... && go test ./...

# Rust
cargo check && cargo test
```

4. Commit with `--no-verify` (hooks are bugged per project rules):

```bash
git add [changed files]
git commit --no-verify -m "fix: [issue title] ([ISSUE_SOURCE]#[ISSUE_ID])"
```

5. Push and open PR:

```bash
git push -u origin fix/[issue-id]-[short-slug]
gh pr create \
  --title "fix: [ISSUE_TITLE]" \
  --body "Fixes [ISSUE_SOURCE] issue [ISSUE_ID].\n\n[explanation of fix]" \
  --base dev
```

6. Update the source issue with PR link.

## Output

Always end with a structured summary:

```
TRIAGE RESULT
Issue: [ISSUE_ID] — [ISSUE_TITLE]
Status: resolved | fixed-in-pr | inconclusive
Action: [what was done]
PR: [url if created]
```
