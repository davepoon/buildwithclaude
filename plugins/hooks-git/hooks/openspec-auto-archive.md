---
name: openspec-auto-archive
description: Before every git commit, archives completed OpenSpec changes (all tasks [x]) and stages them into the same commit; if openspec archive fails, blocks the commit and asks Claude to invoke opsx:archive, then retry
category: git
event: PreToolUse
matcher: Bash
language: bash
version: 1.0.0
---

# openspec-auto-archive

Keep your [OpenSpec](https://github.com/Fission-AI/OpenSpec) workspace tidy automatically. This `PreToolUse(Bash)` hook inspects every `git commit` command **before it runs**. It scans `openspec/changes/` for changes whose `tasks.md` is fully complete (all checkboxes `- [x]`, none `- [ ]`), runs `openspec archive <name> -y` for each, and stages the result (`git add -A openspec`) so the archive lands in the **same commit**.

If `openspec archive` fails for any change, the hook **blocks the commit** (permission deny) and returns guidance to Claude: invoke the `opsx:archive` skill for each failed change, then retry the commit.

Changes without checkboxes in `tasks.md`, changes with unfinished tasks, and the `archive/` directory itself are skipped. If `openspec` is not in `PATH` or the repo has no `openspec/changes/` directory, the hook silently passes through and never blocks.

## Event Configuration

- **Event Type**: `PreToolUse`
- **Tool Matcher**: `Bash`
- **Category**: git

## Environment Variables

- None

## Requirements

- `jq` (parse the hook payload)
- `git`
- `openspec` CLI in `PATH` (if missing, the hook silently skips — it does not block commits)
- An OpenSpec-initialized repository (`openspec/changes/` directory)

### Script

```bash
#!/usr/bin/env bash
# openspec-auto-archive — PreToolUse(Bash) hook.
# Before `git commit`, archives completed OpenSpec changes (all tasks [x],
# none [ ]) and stages them (git add -A openspec) so the archive goes into
# the same commit. If `openspec archive` fails, blocks the commit and asks
# Claude to invoke opsx:archive, then retry the commit.
set -uo pipefail

input=$(cat)
command -v jq >/dev/null 2>&1 || exit 0
cmd=$(printf '%s' "$input" | jq -r '.tool_input.command // empty' 2>/dev/null || true)

# React only to git commit; otherwise — silently pass through.
printf '%s' "$cmd" | grep -Eq 'git[[:space:]].*commit' || exit 0

root=$(git rev-parse --show-toplevel 2>/dev/null) || exit 0
cd "$root" || exit 0

command -v openspec >/dev/null 2>&1 || exit 0

changes_dir="openspec/changes"
[ -d "$changes_dir" ] || exit 0

failed="" # comma-separated names of changes that failed to archive
log=""    # accumulated openspec output for the error message
for dir in "$changes_dir"/*/; do
  name=$(basename "$dir")
  [ "$name" = "archive" ] && continue
  tasks="$dir/tasks.md"
  [ -f "$tasks" ] || continue

  unchecked=$(grep -cE '^[[:space:]]*- \[ \]' "$tasks" || true)
  checked=$(grep -cE '^[[:space:]]*- \[[xX]\]' "$tasks" || true)
  [ "$((unchecked + checked))" -gt 0 ] || continue  # no checkboxes — not that kind of change
  [ "$unchecked" -eq 0 ] || continue                # has unfinished tasks — skip

  # Archive with validation (no --no-validate); -y — no interactive prompts.
  if out=$(openspec archive "$name" -y 2>&1); then
    git add -A openspec >/dev/null 2>&1 || true
  else
    failed="${failed:+$failed, }$name"
    log="$log$out"$'\n'
  fi
done

# Success (or nothing to archive) → allow the commit; the archive is already staged.
[ -z "$failed" ] && exit 0

# openspec archive failed → block and escalate to the skill.
reason="OpenSpec: change(s) [$failed] are complete, but 'openspec archive' failed:

$log

Archive via the Claude Code skill: invoke opsx:archive for each one — $failed — \
then retry git commit. The archiving must go into this same commit \
(git add -A openspec)."

jq -n --arg r "$reason" '{
  hookSpecificOutput: {
    hookEventName: "PreToolUse",
    permissionDecision: "deny",
    permissionDecisionReason: $r
  }
}'
exit 0
```
