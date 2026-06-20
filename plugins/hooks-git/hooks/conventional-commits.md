---
name: conventional-commits
description: Enforce Conventional Commits — validates git commit messages before the command runs and blocks non-conforming ones
category: git
event: PreToolUse
matcher: Bash
language: bash
version: 0.1.0
---

# conventional-commits

Enforce [Conventional Commits](https://www.conventionalcommits.org/) at the agent layer. This `PreToolUse(Bash)` hook inspects every `git commit` command **before it runs**. If the subject line does not match `<type>[optional scope][!]: <description>`, the hook blocks the command (exit code 2) and returns guidance to Claude, which then rewrites the message and retries.

Because it intercepts the Bash tool call itself, it cannot be bypassed with `git commit --no-verify` (unlike a git `commit-msg` hook).

## Event Configuration

- **Event Type**: `PreToolUse`
- **Tool Matcher**: `Bash`
- **Category**: git

## Environment Variables

- `CC_TYPES` - Optional. Comma-separated list of allowed types, replacing the default set (e.g. `feat,fix,chore,wip`).
- `CC_SKIP` - Optional. Set to `1`/`true`/`yes` to disable enforcement.

## Requirements

- `jq` (parse the hook payload)
- `bash` 3.2+ and `xargs` (standard on macOS and Linux)

Conforming examples: `feat: add login`, `fix(api): handle null`, `feat!: drop Node 16`.
Not blocked: editor commits (no `-m`), `-F`/`--file` messages, and auto-generated `Merge`/`Revert`/`fixup!`/`squash!` subjects.

### Script

```bash
# Conventional Commits enforcement — PreToolUse(Bash) hook (bash 3.2+ compatible).
# Reads the hook JSON on stdin; exits 0 to allow, 2 to block with guidance on stderr.
case "${CC_SKIP:-}" in 1|[Tt]rue|[Yy]es) exit 0;; esac

input="$(cat)"
command -v jq >/dev/null 2>&1 || exit 0
tool="$(printf '%s' "$input" | jq -r '.tool_name // empty')"
[ "$tool" = "Bash" ] || exit 0
cmd="$(printf '%s' "$input" | jq -r '.tool_input.command // empty')"
[ -n "$cmd" ] || exit 0
case "$cmd" in *commit*) ;; *) exit 0;; esac

# Tokenize respecting shell quoting WITHOUT executing (xargs does not exec).
toks=(); while IFS= read -r _t; do toks+=("$_t"); done < <(printf '%s' "$cmd" | xargs -n1 2>/dev/null)
[ "${#toks[@]}" -gt 0 ] || exit 0

# Locate the `commit` subcommand preceded somewhere by `git`.
ci=-1; seen_git=0
for i in "${!toks[@]}"; do
  [ "${toks[$i]}" = "git" ] && seen_git=1
  if [ "${toks[$i]}" = "commit" ] && [ "$seen_git" = 1 ]; then ci=$i; break; fi
done
[ "$ci" -ge 0 ] || exit 0

# Extract the first -m/--message value; allow (cannot validate) on -F/--file or editor commits.
msg=""; have=0; n=${#toks[@]}; i=$((ci+1))
while [ $i -lt $n ]; do
  t="${toks[$i]}"
  case "$t" in
    --) break;;
    -m|--message) j=$((i+1)); if [ $j -lt $n ]; then msg="${toks[$j]}"; have=1; break; fi;;
    --message=*) msg="${t#--message=}"; have=1; break;;
    -F|--file|--file=*) exit 0;;
    -m?*) msg="${t#-m}"; have=1; break;;
    -[A-Za-z]*m) j=$((i+1)); if [ $j -lt $n ]; then msg="${toks[$j]}"; have=1; break; fi;;
  esac
  i=$((i+1))
done
[ "$have" = 1 ] || exit 0

subject="${msg%%$'\n'*}"
case "$subject" in "Merge "*|"Revert "*|"fixup! "*|"squash! "*|"amend! "*) exit 0;; esac

types="${CC_TYPES:-feat|fix|docs|style|refactor|perf|test|build|ci|chore|revert}"
types="${types//,/|}"
if [[ "$subject" =~ ^(${types})(\([^\)]+\))?(!)?:\ .+ ]]; then exit 0; fi

{
  echo "Commit message does not follow Conventional Commits."
  echo "  Got:      '$subject'"
  echo "  Expected: <type>[optional scope][!]: <description>"
  echo "  Example:  feat(parser): add ability to parse arrays"
  echo "  Allowed types: ${types//|/, }"
  echo "Rewrite the commit message to match, then retry. (Set CC_SKIP=1 to disable this check.)"
} >&2
exit 2
```
