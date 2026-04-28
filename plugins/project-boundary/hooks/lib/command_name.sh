#!/bin/bash
# project-boundary guard — command_name module
# =============================================
# Classification and rewriting of the command-name token: finding it
# past wrappers (sudo/env/nice/...), env-var prefixes and flag
# arguments; stripping common binary-path prefixes; stripping
# surrounding quotes; recognising shell and source invocations.
#
# Depends on: hooks/lib/tokenize.sh (tokenize_args, strip_quotes).
# command_name_is reads a CMD variable from its caller's dynamic
# scope; other functions are pure.

# --- Strip a binary path prefix from the command-name token ---
# Strip a binary path prefix (/bin/, /sbin/, /usr/bin/, /usr/sbin/,
# /usr/local/bin/) from the command-name token of CMD only — not from
# any argument or operand. Walks past common runtime wrappers
# (sudo/env/nice/...), VAR=val assignments, and flags to find the real
# command-name position. The strip is a single in-place replacement of
# the prefixed token, leaving the rest of CMD (including operands
# that legitimately reference `/bin/<name>` as paths) untouched.
#
# Required because the previous "match whitespace before /bin/"
# normalisation also matched the whitespace BEFORE every operand,
# rewriting `rm /bin/sh` to `rm sh`, `tee /bin/owned` to `tee owned`,
# etc., which then resolved into the project and bypassed the
# boundary (Codex review on commit e01df86 — bypass A).
strip_command_name_prefix() {
  local cmd="$1"
  local -a toks=()
  while IFS= read -r t; do
    [[ -z "$t" ]] && continue
    toks+=("$t")
  done < <(tokenize_args "$cmd")

  local idx=-1 i
  local prev_was_timeout=0
  for i in "${!toks[@]}"; do
    local raw="${toks[$i]}"
    local t
    t=$(strip_quotes "$raw")
    # `timeout` takes a duration operand (e.g. `timeout 5 cmd`,
    # `timeout 1.5s cmd`); skip one extra token after it.
    if [ $prev_was_timeout -eq 1 ]; then
      prev_was_timeout=0
      case "$t" in
        [0-9]*) continue ;;
      esac
    fi
    case "$t" in
      timeout)
        prev_was_timeout=1; continue ;;
      sudo|env|/bin/env|/usr/bin/env|nice|nohup|time|stdbuf|ionice|chrt|taskset|command|builtin|exec)
        continue ;;
    esac
    case "$t" in
      [A-Za-z_]*=*) continue ;;
      -*) continue ;;
    esac
    idx=$i
    break
  done

  [[ $idx -lt 0 ]] && { printf '%s' "$cmd"; return; }

  local first
  first=$(strip_quotes "${toks[$idx]}")
  case "$first" in
    /bin/*|/sbin/*|/usr/bin/*|/usr/sbin/*|/usr/local/bin/*) ;;
    *) printf '%s' "$cmd"; return ;;
  esac

  local cmdname="${first##*/}"

  # Replace first occurrence of $first in $cmd with $cmdname.
  # Pattern matching here treats $first verbatim (it cannot contain
  # bash glob metacharacters in any realistic command-name position).
  local prefix="${cmd%%${first}*}"
  if [ "$prefix" = "$cmd" ]; then
    printf '%s' "$cmd"; return
  fi
  local rest="${cmd:$((${#prefix} + ${#first}))}"
  printf '%s%s%s' "$prefix" "$cmdname" "$rest"
}

strip_command_name_quotes() {
  # If the command-name token of $1 is wrapped in matching single or
  # double quotes (e.g. "rm", 'rm', "/bin/rm"), replace that token
  # with its unquoted form so downstream detectors that match on bare
  # names recognise it. bash strips surrounding quotes from a command
  # word at exec time, so the quoted form invokes the same binary —
  # failing to recognise it here would leak every bare-name detector
  # (rm, mv, cp, ln, chmod, chown, tee, curl, wget, find, sed,
  # truncate, rsync) past the guard. Walks tokens using the same
  # wrapper / env-var / flag skipping rules as strip_command_name_prefix.
  # Reported by Copilot review on commit 22112ba (guard.sh:1078, 1503).
  local cmd="$1"
  local -a toks=()
  while IFS= read -r t; do
    [[ -z "$t" ]] && continue
    toks+=("$t")
  done < <(tokenize_args "$cmd")

  local idx=-1 i prev_was_timeout=0
  for i in "${!toks[@]}"; do
    local raw="${toks[$i]}"
    local t
    t=$(strip_quotes "$raw")
    if [ $prev_was_timeout -eq 1 ]; then
      prev_was_timeout=0
      case "$t" in
        [0-9]*) continue ;;
      esac
    fi
    case "$t" in
      timeout)
        prev_was_timeout=1; continue ;;
      sudo|env|/bin/env|/usr/bin/env|nice|nohup|time|stdbuf|ionice|chrt|taskset|command|builtin|exec)
        continue ;;
    esac
    case "$t" in
      [A-Za-z_]*=*) continue ;;
      -*) continue ;;
    esac
    idx=$i
    break
  done

  [[ $idx -lt 0 ]] && { printf '%s' "$cmd"; return; }

  local raw="${toks[$idx]}"
  # Only rewrite when the raw token is itself surrounded by matching
  # single or double quotes — tokenize_args preserves the wrapping
  # quote bytes on the token, so `"rm"` / `'rm'` / `"/bin/rm"` all
  # match. Tokens without surrounding quotes (bare `rm` or
  # partially-quoted like `"rm"abc`) are left alone.
  case "$raw" in
    \"?*\") ;;
    \'?*\') ;;
    *) printf '%s' "$cmd"; return ;;
  esac

  local bare="${raw:1:${#raw}-2}"

  # Replace first occurrence of $raw in $cmd with $bare.
  local prefix="${cmd%%${raw}*}"
  if [ "$prefix" = "$cmd" ]; then
    printf '%s' "$cmd"; return
  fi
  local rest="${cmd:$((${#prefix} + ${#raw}))}"
  printf '%s%s%s' "$prefix" "$bare" "$rest"
}

command_name_is() {
  # Return 0 iff the post-wrapper command-name token of $CMD equals $1.
  # Walks $CMD tokens using the same rules as strip_command_name_prefix:
  # skip `timeout <dur>`, sudo/env/nice/nohup/time/stdbuf/ionice/chrt/
  # taskset/command/builtin/exec wrappers, VAR=val environment prefixes
  # and -flag tokens. Any /bin/, /sbin/, /usr/bin/, /usr/sbin/,
  # /usr/local/bin/ prefix on the command-name token is stripped before
  # comparison, so `/usr/bin/install` is recognised as `install`.
  #
  # Why: several detectors (install, rsync, ...) use a bare
  # `(^|[[:space:]])CMDNAME($|[[:space:]])` regex that matches the
  # word anywhere in the command. For common names that are also
  # package-manager subcommands (npm install / bundle install /
  # poetry install / etc.) this produces false positives. Use this
  # helper to require the actual command-name position.
  #
  # IMPORTANT: reads $CMD from the caller's dynamic scope (bash
  # `local` semantics). Callers MUST run inside check_single_command
  # (or any other context that has a local CMD in scope).
  local target=$1
  local -a toks=()
  while IFS= read -r t; do
    [[ -z "$t" ]] && continue
    toks+=("$t")
  done < <(tokenize_args "$CMD")
  local i prev_was_timeout=0
  for i in "${!toks[@]}"; do
    local raw="${toks[$i]}" t
    t=$(strip_quotes "$raw")
    if [ $prev_was_timeout -eq 1 ]; then
      prev_was_timeout=0
      case "$t" in
        [0-9]*) continue ;;
      esac
    fi
    case "$t" in
      timeout)
        prev_was_timeout=1; continue ;;
      sudo|env|/bin/env|/usr/bin/env|nice|nohup|time|stdbuf|ionice|chrt|taskset|command|builtin|exec)
        continue ;;
    esac
    case "$t" in
      [A-Za-z_]*=*) continue ;;
      -*) continue ;;
    esac
    case "$t" in
      /bin/*|/sbin/*|/usr/bin/*|/usr/sbin/*|/usr/local/bin/*) t="${t##*/}" ;;
    esac
    [ "$t" = "$target" ]
    return
  done
  return 1
}

# --- Detect shell/source tokens by basename (handles any absolute path) ---
# `/opt/homebrew/bin/bash`, `/nix/store/.../bin/bash`, `/bin/bash` all
# count as the shell `bash`. Without basename matching, the exec guard
# only fires for paths in the hard-coded normalization list.
is_shell_token() {
  local _t="$1"
  local _base="${_t##*/}"
  case "$_base" in
    bash|sh|zsh|ksh|dash|fish) return 0 ;;
  esac
  return 1
}

is_source_token() {
  case "$1" in
    source|.) return 0 ;;
  esac
  return 1
}
