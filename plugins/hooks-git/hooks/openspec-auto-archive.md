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

Keep your [OpenSpec](https://github.com/Fission-AI/OpenSpec) workspace tidy automatically. This `PreToolUse(Bash)` hook inspects every `git commit` command **before it runs**. It scans `openspec/changes/` for changes whose `tasks.md` is fully complete (all checkboxes `- [x]`, none `- [ ]`), runs `openspec archive <name> -y` for each, and stages the archived paths (`openspec/changes` and `openspec/specs`) so the archive lands in the **same commit**.

If `openspec archive` fails for any change, the hook **blocks the commit** (permission deny) and returns guidance to Claude: invoke the `opsx:archive` skill for each failed change, then retry the commit.

The `git commit` detection tokenizes the command with `xargs -n1` (no execution) and matches a real `git` command followed by the `commit` subcommand, so strings like `git log --grep=commit`, `git show commit`, or `echo git commit` do **not** trigger it. Change names are allowlisted (`^[A-Za-z0-9][A-Za-z0-9._-]*$`) before use, so a leading `-` (option injection) or odd characters are skipped. Changes without checkboxes in `tasks.md`, changes with unfinished tasks, and the `archive/` directory itself are skipped. If `jq`/`openspec` are not in `PATH` or the repo has no `openspec/changes/` directory, the hook silently passes through and never blocks.

## Event Configuration

- **Event Type**: `PreToolUse`
- **Tool Matcher**: `Bash`
- **Category**: git

## Environment Variables

- None

## Requirements

- `jq` (parse the hook payload)
- `git` and `xargs` (standard on macOS and Linux)
- `openspec` CLI in `PATH` (if missing, the hook silently skips — it does not block commits)
- An OpenSpec-initialized repository (`openspec/changes/` directory)

### Script

```bash
#!/usr/bin/env bash
# openspec-auto-archive — PreToolUse(Bash) hook.
# Before `git commit`, archives completed OpenSpec changes (all tasks [x],
# none [ ]) and stages them so the archive goes into the same commit. If
# `openspec archive` fails, blocks the commit and asks Claude to invoke
# opsx:archive, then retry the commit.
set -uo pipefail

input=$(cat)
command -v jq >/dev/null 2>&1 || exit 0
cmd=$(printf '%s' "$input" | jq -r '.tool_input.command // empty' 2>/dev/null || true)
[ -n "$cmd" ] || exit 0

# --- Match a real `git commit`, not a substring -----------------------------
# Tokenize respecting shell quoting WITHOUT executing (xargs does not exec),
# then require `git` in command position followed by the `commit` subcommand.
# This ignores `git log --grep=commit`, `git show commit`, `echo git commit`.
toks=(); while IFS= read -r _t; do toks+=("$_t"); done < <(printf '%s' "$cmd" | xargs -n1 2>/dev/null)
[ "${#toks[@]}" -gt 0 ] || exit 0

is_commit=0; cmd_pos=1; n=${#toks[@]}; i=0
while [ $i -lt $n ]; do
  # A command starts at the first token and after a shell separator.
  case "${toks[$i]}" in
    ';'|'&&'|'||'|'|'|'&') cmd_pos=1; i=$((i+1)); continue;;
  esac
  if [ "$cmd_pos" = 1 ] && [ "${toks[$i]}" = "git" ]; then
    j=$((i+1))
    while [ $j -lt $n ]; do  # skip git global options, find the subcommand
      case "${toks[$j]}" in
        -C|-c|--git-dir|--work-tree|--namespace) j=$((j+2));;  # option + value
        -*) j=$((j+1));;                                        # other global flag
        commit) is_commit=1; break;;
        *) break;;                                             # subcommand is not commit
      esac
    done
    [ "$is_commit" = 1 ] && break
  fi
  cmd_pos=0; i=$((i+1))
done
[ "$is_commit" -eq 1 ] || exit 0

# --- Archive completed changes ----------------------------------------------
root=$(git rev-parse --show-toplevel 2>/dev/null) || exit 0
cd "$root" || exit 0
command -v openspec >/dev/null 2>&1 || exit 0
changes_dir="openspec/changes"
[ -d "$changes_dir" ] || exit 0

failed=""  # comma-joined list of allowlisted change names that failed to archive
for dir in "$changes_dir"/*/; do
  name=$(basename "$dir")
  [ "$name" = "archive" ] && continue
  # Allowlist change names: ^[A-Za-z0-9][A-Za-z0-9._-]*$ — first char alnum, so
  # a leading `-` (option injection) and any odd characters are skipped.
  case "$name" in
    [!A-Za-z0-9]* | *[!A-Za-z0-9._-]*) continue;;
  esac

  tasks="$dir/tasks.md"
  [ -f "$tasks" ] || continue
  unchecked=$(grep -cE '^[[:space:]]*- \[ \]' "$tasks" || true)
  checked=$(grep -cE '^[[:space:]]*- \[[xX]\]' "$tasks" || true)
  [ "$((unchecked + checked))" -gt 0 ] || continue  # no checkboxes — not that kind of change
  [ "$unchecked" -eq 0 ] || continue                # unfinished tasks — skip

  # Archive with validation (no --no-validate); -y — no interactive prompts.
  # Name is allowlisted above, so it cannot be read as an option.
  if openspec archive "$name" -y >/dev/null 2>&1; then
    # Stage only what archiving touches — the changes/ subtree (moved change +
    # archive/ destination) and updated specs — not a blanket `git add -A
    # openspec`, which could also grab unrelated files at the openspec root.
    git add -- "$changes_dir" "openspec/specs" >/dev/null 2>&1 || true
  else
    failed="${failed:+$failed, }$name"
  fi
done

# Success (or nothing to archive) → allow the commit; the archive is staged.
[ -z "$failed" ] && exit 0

# Failure → block. Fixed message + allowlisted change names only; no raw CLI
# output is passed into Claude's context (avoids indirect prompt injection).
reason="OpenSpec: 'openspec archive' failed for completed change(s): $failed. \
Run the opsx:archive skill for each, then retry git commit — the archive must \
go into this same commit (git add the archived openspec paths)."

jq -n --arg r "$reason" '{
  hookSpecificOutput: {
    hookEventName: "PreToolUse",
    permissionDecision: "deny",
    permissionDecisionReason: $r
  }
}'
exit 0
```
