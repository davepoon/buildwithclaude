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

# --- command_name_matches PATTERN ---
# Like command_name_is but accepts a pipe-separated list of names so a
# detector that fires for any of several aliases (e.g. "perl|ruby" or
# "7z|7za|7zr|7zz|7zzs") gets one anchored gate instead of a raw
# `echo "$CMD" | grep -qE` substring match. Reads CMD from caller's
# dynamic scope (same contract as command_name_is).
#
# Returns 0 iff command_name_is matches any of the alternatives.
command_name_matches() {
  local pattern="$1"
  local IFS='|'
  local -a _cn_cmds=($pattern)
  unset IFS
  local _cn_c
  for _cn_c in "${_cn_cmds[@]}"; do
    command_name_is "$_cn_c" && return 0
  done
  return 1
}

# --- normalize_command_view INPUT ---
# Apply the full command-view normalization pipeline used by guard.sh
# for both the live CMD and the heredoc-blanked CMD_BLANKED:
#   1. trim leading/trailing whitespace
#   2. strip subshell grouping `(...)` parens at token boundaries
#      (preserve `$(...)` substitution form)
#   3. strip alias-escape backslash before [a-zA-Z_]
#   4. strip surrounding quotes from the command-name token
#   5. strip common binary-path prefixes from the leading `/usr/bin/...`
#      / `/opt/homebrew/bin/...` form (fallback for empty tokenizer)
#   6. apply strip_command_name_prefix (post-wrapper aware)
#   7. collapse duplicated whitespace
#
# Extracted from guard.sh in the round-5 refactor. Both CMD and
# CMD_BLANKED now go through the same pipeline so a fix to any
# normalization step (e.g. adding `/opt/homebrew/bin` to the prefix
# list) lands in both views simultaneously.
normalize_command_view() {
  local view="$1"
  view="$(printf '%s' "$view" | sed 's/^[[:space:]]*//' | sed 's/[[:space:]]*$//')"
  view="$(printf '%s' "$view" | sed -E 's/(^|[[:space:]])\(+/\1/g; s/\)+($|[[:space:]])/\1/g')"
  view="$(printf '%s' "$view" | sed -E 's/\\([a-zA-Z_])/\1/g')"
  view="$(strip_command_name_quotes "$view")"
  view="$(printf '%s' "$view" | sed -E 's#^/(usr/local/bin|usr/bin|bin|sbin|usr/sbin|opt/homebrew/bin)/##')"
  view="$(strip_command_name_prefix "$view")"
  printf '%s' "$view" | sed -E 's/[[:space:]]+/ /g; s/^ //; s/ $//'
}

# --- Strip /bin/, /sbin/, /usr/bin/, /usr/sbin/, /usr/local/bin/, ---
# /opt/homebrew/bin/ prefix from a command-name token. The Homebrew
# entry is required because Apple Silicon brews default to
# /opt/homebrew/bin and command_name_is checks would otherwise miss
# every Homebrew-installed binary (Codex round-5 P1).
_cn_strip_path_prefix() {
  local n="$1"
  case "$n" in
    /bin/*|/sbin/*|/usr/bin/*|/usr/sbin/*|/usr/local/bin/*|/opt/homebrew/bin/*) printf '%s' "${n##*/}" ;;
    *) printf '%s' "$n" ;;
  esac
}

# --- Find verb-token index in a tokens array, skipping wrappers / opts / VAR=val ---
# Caller fills the local-scope `toks` array before calling. Returns the
# 0-based index of the first non-wrapper / non-flag / non-VAR=val token,
# or -1 if no such token exists. Skip rules:
#
#   - Recognised wrappers (sudo / env / nice / nohup / time / stdbuf /
#     ionice / chrt / taskset / command / builtin / exec / timeout /
#     /bin/env / /usr/bin/env) advance one position; the next iteration
#     also skips a per-wrapper option-with-value pair (e.g. `-u USER`
#     for sudo / env, `-k DUR` for timeout) when the value would
#     otherwise be mis-identified as the verb.
#   - `timeout` additionally takes a duration operand (`5`, `5s`,
#     `1.5h`, `infinity`) which is consumed as a single positional.
#   - `[A-Za-z_]*=*` (env-var prefix) and bare `-*` flags are skipped
#     one at a time.
#
# Reads the caller's `toks` array via dynamic scoping (bash `local`
# semantics); CALLERS MUST declare `local -a toks=()` before invoking.
_cn_find_verb_idx() {
  local i=0 n=${#toks[@]}
  local prev_was_timeout=0 last_wrapper=""
  while [ $i -lt $n ]; do
    local raw="${toks[$i]}" t
    t=$(strip_quotes "$raw")

    # Wrapper opt-with-value: if the previous wrapper had options
    # that consume the next token, advance past both the flag and
    # its value. Without this, `sudo -u root install …` mis-
    # identifies `root` as the verb (Codex round-4 follow-up on
    # PR #23; same root cause as section 40's _sf_find_verb_idx fix).
    if [ -n "$last_wrapper" ]; then
      local opts; opts=$(_wrapper_opts_with_val "$last_wrapper")
      if [ -n "$opts" ]; then
        case " $opts " in
          *" $t "*) i=$((i + 2)); continue ;;
        esac
      fi
    fi

    if [ $prev_was_timeout -eq 1 ]; then
      prev_was_timeout=0
      case "$t" in
        [0-9]*|inf*) i=$((i + 1)); continue ;;
      esac
    fi
    case "$t" in
      timeout)
        prev_was_timeout=1; last_wrapper="timeout"; i=$((i + 1)); continue ;;
      sudo|env|/bin/env|/usr/bin/env|nice|nohup|time|stdbuf|ionice|chrt|taskset|command|builtin|exec)
        last_wrapper=$(_cn_strip_path_prefix "$t")
        i=$((i + 1)); continue ;;
    esac
    case "$t" in
      [A-Za-z_]*=*) i=$((i + 1)); continue ;;
      -*) i=$((i + 1)); continue ;;
    esac
    printf '%d' "$i"
    return
  done
  printf -- '-1'
}

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

  local idx
  idx=$(_cn_find_verb_idx)
  [ "$idx" -lt 0 ] && { printf '%s' "$cmd"; return; }

  local first
  first=$(strip_quotes "${toks[$idx]}")
  case "$first" in
    /bin/*|/sbin/*|/usr/bin/*|/usr/sbin/*|/usr/local/bin/*|/opt/homebrew/bin/*) ;;
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
  local cmd="$1"
  local -a toks=()
  while IFS= read -r t; do
    [[ -z "$t" ]] && continue
    toks+=("$t")
  done < <(tokenize_args "$cmd")

  local idx
  idx=$(_cn_find_verb_idx)
  [ "$idx" -lt 0 ] && { printf '%s' "$cmd"; return; }

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
  # Reads CMD_VERB from the caller's dynamic scope when available — set
  # by check_single_command after CMD normalisation and refreshed after
  # remote_dispatch rewrite, so every detector inside that pipeline gets
  # an O(1) string compare instead of a per-call tokenize-and-walk
  # (Codex round-5 finding #3; ~64 call sites per command).
  #
  # When CMD_VERB is unset (test harnesses or callers outside the main
  # check_single_command pipeline), falls back to the tokenize-and-walk
  # path — same logic as strip_command_name_prefix:
  #   skip `timeout <dur>`, sudo/env/nice/nohup/time/stdbuf/ionice/chrt/
  #   taskset/command/builtin/exec wrappers (and their option-with-value
  #   pairs like `-u USER`, `-k DUR`), VAR=val environment prefixes,
  #   and -flag tokens. Any /bin/, /sbin/, /usr/bin/, /usr/sbin/,
  #   /usr/local/bin/, /opt/homebrew/bin/ prefix is stripped before
  #   comparison.
  #
  # Why bare-name regex isn't enough: several detectors (install, rsync,
  # ...) match a verb anywhere in CMD; that false-positives on package-
  # manager subcommands like `npm install` / `bundle install`. This
  # helper requires the actual command-name position.
  local target=$1
  if [ -n "${CMD_VERB-}" ]; then
    [ "$CMD_VERB" = "$target" ]
    return
  fi
  local -a toks=()
  while IFS= read -r t; do
    [[ -z "$t" ]] && continue
    toks+=("$t")
  done < <(tokenize_args "$CMD")

  local idx
  idx=$(_cn_find_verb_idx)
  [ "$idx" -lt 0 ] && return 1

  local t
  t=$(strip_quotes "${toks[$idx]}")
  t=$(_cn_strip_path_prefix "$t")
  [ "$t" = "$target" ]
}

# --- Compute the post-normalisation verb name for a command string ---
# Tokenises once, walks _cn_find_verb_idx, strips any binary-path
# prefix. Returns empty when no verb is recognised. Used by
# check_single_command to fill the CMD_VERB cache that command_name_is
# reads on every call. Cheaper than calling command_name_is once per
# detector — collapses the per-detector tokenize work into a single
# pass per command (and one refresh after remote_dispatch rewrite).
_cn_compute_verb_name() {
  local cmd="$1"
  local -a toks=()
  local _t
  while IFS= read -r _t; do
    [[ -z "$_t" ]] && continue
    toks+=("$_t")
  done < <(tokenize_args "$cmd")
  local idx
  idx=$(_cn_find_verb_idx)
  [ "$idx" -lt 0 ] && return
  local verb
  verb=$(strip_quotes "${toks[$idx]}")
  verb=$(_cn_strip_path_prefix "$verb")
  printf '%s' "$verb"
}

# --- Strip leading `sudo` plus its option-with-value pairs from CMD ---
# Replaces the literal `${CMD#sudo }` strip in check_single_command.
# Without opt-stripping, `sudo -u root install …` collapsed to
# `-u root install …` — the orphaned `-u root` then mis-led the
# wrapper-walk in strip_command_name_prefix / strip_command_name_quotes /
# command_name_is (sudo is no longer in the token list to anchor to,
# so `root` was treated as the verb). env / nice / ionice / timeout
# are NOT literal-stripped, so the per-wrapper opt-skip in
# _cn_find_verb_idx handles those wrappers in place.
#
# Walks past sudo + its option-with-value pairs (-u USER, --user=USER,
# -g GROUP, etc.), value-less short and long flags (-n, --background,
# etc.), and emits the rest of CMD starting at the first positional.
# tokenize_args preserves quote bytes, so reconstruction with single-
# space joins keeps quoted operands intact (whitespace inside the
# command is normalised in the next pass anyway — guard.sh:280).
strip_sudo_wrapper_with_opts() {
  local cmd="$1"
  case "$cmd" in
    sudo|sudo[[:space:]]*) ;;
    *) printf '%s' "$cmd"; return ;;
  esac

  local -a toks=()
  while IFS= read -r t; do
    [[ -z "$t" ]] && continue
    toks+=("$t")
  done < <(tokenize_args "$cmd")

  # toks[0] is "sudo" (or absent if cmd was bare "sudo"). Walk past
  # sudo's option-with-value pairs and value-less flags. The value-
  # bearing list MUST exactly match sudo's "takes-an-argument" set;
  # mis-classifying a value-less flag (`-A`, `-K`, `-k`,
  # `--preserve-env`, `--login`, `--shell`, etc.) consumes the real
  # verb as the flag's value and reopens the bypass this PR closes.
  # Codex round-1 P1 on PR #24.
  local i=1 n=${#toks[@]}
  while [ $i -lt $n ]; do
    local raw="${toks[$i]}" t
    t=$(strip_quotes "$raw")
    case "$t" in
      -a|-c|-C|-D|-g|-h|-p|-R|-r|-t|-T|-U|-u)
        i=$((i + 2)); continue ;;
      --auth-type|--chdir|--chroot|--close-from|--command-timeout|--group|--host|--login-class|--other-user|--prompt|--role|--type|--user)
        i=$((i + 2)); continue ;;
      --*=*)
        i=$((i + 1)); continue ;;
      -*)
        i=$((i + 1)); continue ;;
      *) break ;;
    esac
  done

  local out=""
  while [ $i -lt $n ]; do
    if [ -z "$out" ]; then
      out="${toks[$i]}"
    else
      out="$out ${toks[$i]}"
    fi
    i=$((i + 1))
  done
  printf '%s' "$out"
}

# --- Detect a shell-opening sudo invocation ---
# Returns 0 (success) iff the input describes a sudo invocation that
# would open a privileged interactive shell with no command operand
# to inspect. Recognised shapes:
#
#   sudo -i / sudo -s / sudo --login / sudo --shell      (standalone)
#   sudo "-i" / sudo '-i' / sudo "--login"                (quoted —
#                                                          tokenize_args
#                                                          preserves quote
#                                                          bytes; strip_quotes
#                                                          unwraps them)
#   sudo -ni / sudo -in / sudo -nis / sudo -A -ni         (clustered short
#                                                          flags; sudo accepts
#                                                          a cluster like -nis
#                                                          for -n -i -s)
#   <wrapper> [opts] sudo <any of the above>              (env / nice /
#                                                          timeout / ionice /
#                                                          chrt / nohup / time
#                                                          / stdbuf / taskset /
#                                                          command / builtin /
#                                                          exec wrapping sudo)
#
# Returns 1 if no shell-opening sudo is detected — bare `sudo`,
# `sudo -l` / `-V` / `-v`, `sudo -i extra-cmd` (cmd is what runs,
# detectors walk it), and any non-sudo invocation.
#
# Called from check_single_command BEFORE the sudo strip so the
# original wrapper + sudo + flag layout is still visible in the
# token list. Reported by Codex review rounds 2–3 on PR #24.
_cn_is_sudo_shell_opener() {
  local cmd="$1"
  local -a toks=()
  while IFS= read -r t; do
    [[ -z "$t" ]] && continue
    toks+=("$t")
  done < <(tokenize_args "$cmd")

  local n=${#toks[@]}
  [ "$n" -eq 0 ] && return 1

  # Phase 1: walk past outer wrappers + their opt-with-value pairs.
  # Mirrors _cn_find_verb_idx but stops on `sudo` (we're hunting
  # specifically for sudo here, not for the verb in general). A non-
  # wrapper non-flag token before `sudo` means the cmd isn't a
  # sudo-shell-opener at all.
  local i=0
  local prev_was_timeout=0 last_wrapper=""
  while [ "$i" -lt "$n" ]; do
    local raw="${toks[$i]}" t
    t=$(strip_quotes "$raw")

    if [ -n "$last_wrapper" ]; then
      local opts; opts=$(_wrapper_opts_with_val "$last_wrapper")
      if [ -n "$opts" ]; then
        case " $opts " in
          *" $t "*) i=$((i + 2)); continue ;;
        esac
      fi
    fi

    if [ "$prev_was_timeout" -eq 1 ]; then
      prev_was_timeout=0
      case "$t" in
        [0-9]*|inf*) i=$((i + 1)); continue ;;
      esac
    fi
    case "$t" in
      timeout)
        prev_was_timeout=1; last_wrapper="timeout"; i=$((i + 1)); continue ;;
      env|/bin/env|/usr/bin/env|nice|nohup|time|stdbuf|ionice|chrt|taskset|command|builtin|exec)
        last_wrapper=$(_cn_strip_path_prefix "$t")
        i=$((i + 1)); continue ;;
      sudo)
        break ;;
    esac
    case "$t" in
      [A-Za-z_]*=*) i=$((i + 1)); continue ;;
      -*) i=$((i + 1)); continue ;;
    esac
    return 1
  done

  # No `sudo` token found in the wrapper-walk segment.
  [ "$i" -ge "$n" ] && return 1

  # Phase 2: walk sudo's flags. Track whether we saw a shell-opening
  # flag. A positional non-flag token after sudo means it has a real
  # command (cmd is what runs even with -i/-s; detectors walk it).
  i=$((i + 1))
  local found_shell_opener=0
  while [ "$i" -lt "$n" ]; do
    local raw="${toks[$i]}" t
    t=$(strip_quotes "$raw")
    case "$t" in
      -i|-s|--login|--shell)
        found_shell_opener=1
        i=$((i + 1)); continue ;;
      -a|-c|-C|-D|-g|-h|-p|-R|-r|-t|-T|-U|-u)
        i=$((i + 2)); continue ;;
      --auth-type|--chdir|--chroot|--close-from|--command-timeout|--group|--host|--login-class|--other-user|--prompt|--role|--type|--user)
        i=$((i + 2)); continue ;;
      --*=*)
        i=$((i + 1)); continue ;;
      -[A-Za-z]*)
        # Clustered short flags. Sudo accepts -nis as the cluster of
        # -n -i -s; if the cluster body contains `i` or `s`, the
        # invocation opens a shell. Long-form `--*=*` was already
        # handled above; this branch only fires for short clusters.
        local body="${t#-}"
        case "$body" in
          *i*|*s*) found_shell_opener=1 ;;
        esac
        i=$((i + 1)); continue ;;
      -*)
        # Long-form valueless flags (`--preserve-env`, `--background`,
        # `--non-interactive`, `--set-home`, `--remove-timestamp`, ...)
        # don't match `--*=*` (no `=`) nor `-[A-Za-z]*` (start with
        # `--`). Without this catch-all they fall through to `*` and
        # the helper bails before seeing the trailing `-i`/`-s` —
        # bypass: `sudo --preserve-env -i`. Mirrors strip_sudo_wrapper_with_opts.
        i=$((i + 1)); continue ;;
      *)
        # Positional verb after sudo — detectors walk it normally.
        return 1 ;;
    esac
  done

  [ "$found_shell_opener" -eq 1 ]
}

# --- Detect shell/source tokens by basename (handles any absolute path) ---
# `/opt/homebrew/bin/bash`, `/nix/store/.../bin/bash`, `/bin/bash` all
# count as the shell `bash`. Without basename matching, the exec guard
# only fires for paths in the hard-coded normalization list.
is_shell_token() {
  local _t="$1"
  local _base="${_t##*/}"
  case "$_base" in
    bash|sh|zsh|ksh|dash|fish|xonsh|tcsh|csh|nu|pwsh|osh) return 0 ;;
  esac
  return 1
}

is_source_token() {
  case "$1" in
    source|.) return 0 ;;
  esac
  return 1
}
