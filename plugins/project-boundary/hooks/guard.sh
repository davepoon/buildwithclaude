#!/bin/bash
set -euo pipefail

# Load sibling library modules. Resolve this script's directory so the
# source path works whether guard.sh is invoked directly, through a
# symlink to the script itself, or through a CLAUDE_PLUGIN_ROOT that
# differs from $PWD. A plain `dirname "${BASH_SOURCE[0]}"` would
# return the SYMLINK's directory when guard.sh itself is symlinked
# (e.g. installed as `/some/path/link/guard.sh -> /real/hooks/guard.sh`),
# so the sourced `lib/` siblings would be looked up in the wrong
# directory. Chase the symlink chain to the real file before taking
# its directory. Portable across Linux and macOS (no `readlink -f`
# dependency).
_guard_source="${BASH_SOURCE[0]}"
while [ -L "$_guard_source" ]; do
  _guard_target="$(readlink "$_guard_source")"
  case "$_guard_target" in
    /*) _guard_source="$_guard_target" ;;
    *)  _guard_source="$(dirname "$_guard_source")/$_guard_target" ;;
  esac
done
_GUARD_DIR="$(cd "$(dirname "$_guard_source")" && pwd)"
unset _guard_source _guard_target
# shellcheck source=lib/tokenize.sh
source "$_GUARD_DIR/lib/tokenize.sh"
# shellcheck source=lib/wrapper_opts.sh
source "$_GUARD_DIR/lib/wrapper_opts.sh"
# shellcheck source=lib/command_name.sh
source "$_GUARD_DIR/lib/command_name.sh"
# shellcheck source=lib/git_walkers.sh
source "$_GUARD_DIR/lib/git_walkers.sh"
# shellcheck source=lib/shell_exec_walkers.sh
source "$_GUARD_DIR/lib/shell_exec_walkers.sh"
# shellcheck source=lib/cd_destructive_walker.sh
source "$_GUARD_DIR/lib/cd_destructive_walker.sh"
# shellcheck source=lib/expansion_blocks.sh
source "$_GUARD_DIR/lib/expansion_blocks.sh"
# shellcheck source=lib/paths.sh
source "$_GUARD_DIR/lib/paths.sh"
# shellcheck source=lib/heredoc.sh
source "$_GUARD_DIR/lib/heredoc.sh"
# shellcheck source=lib/detectors/inplace.sh
source "$_GUARD_DIR/lib/detectors/inplace.sh"
# shellcheck source=lib/detectors/destructive.sh
source "$_GUARD_DIR/lib/detectors/destructive.sh"
# shellcheck source=lib/detectors/permissions.sh
source "$_GUARD_DIR/lib/detectors/permissions.sh"
# shellcheck source=lib/detectors/write_targets.sh
source "$_GUARD_DIR/lib/detectors/write_targets.sh"
# write_targets_b.sh was split by domain (Codex r5 finding #4).
# shellcheck source=lib/detectors/download.sh
source "$_GUARD_DIR/lib/detectors/download.sh"
# shellcheck source=lib/detectors/redirects.sh
source "$_GUARD_DIR/lib/detectors/redirects.sh"
# shellcheck source=lib/detectors/db_dump.sh
source "$_GUARD_DIR/lib/detectors/db_dump.sh"
# shellcheck source=lib/detectors/filesystem_create.sh
source "$_GUARD_DIR/lib/detectors/filesystem_create.sh"
# shellcheck source=lib/options.sh
source "$_GUARD_DIR/lib/options.sh"
# shellcheck source=lib/remote_dispatch.sh
source "$_GUARD_DIR/lib/remote_dispatch.sh"
# shellcheck source=lib/subcmd_flags.sh
source "$_GUARD_DIR/lib/subcmd_flags.sh"

INPUT=$(cat)

# jq is a hard dependency for parsing the hook input JSON. Without it
# the parsing below silently produces empty values, which then makes
# the guard exit 0 — indistinguishable from "boundary working but
# command happened to be allowed". Fail loud (issue #32).
if ! command -v jq >/dev/null 2>&1; then
  echo "BLOCKED: 'jq' is required by the project-boundary hook shell but was not found on PATH. Install jq (brew install jq / apt install jq / scoop install jq / winget install jqlang.jq) and retry." >&2
  exit 2
fi
# Defense in depth (Codex sweep 4 #2): the `command -v jq` check
# above only confirms a binary named `jq` exists on PATH. A hostile
# shim that returns empty output for every query would slip past it
# and silently produce COMMAND="" / FILE_PATH="" below, making the
# guard `exit 0` for every Bash/Edit/Write call.
#
# Randomised canary: build a JSON object whose key and value are
# both bash $RANDOM at hook entry; require jq to echo the value
# back through `.<key>`. A trivial pattern-match shim that just
# prints "1" for an _pb_canary key cannot reproduce a per-invocation
# random value. This is NOT bullet-proof — a shim that bundles real
# jq still passes — but it raises the bar from "10-line shell shim"
# to "ship a working jq parser", which is on par with the
# user-controls-PATH attacker model the plugin operates under.
_pb_canary_k="pbk${RANDOM}_${RANDOM}"
_pb_canary_v="${RANDOM}-${RANDOM}-${RANDOM}"
if [ "$(printf '{"%s":"%s"}' "$_pb_canary_k" "$_pb_canary_v" | jq -r ".$_pb_canary_k" 2>/dev/null)" != "$_pb_canary_v" ]; then
  echo "BLOCKED: 'jq' on PATH does not behave like real jq (randomised canary check failed). Cannot safely parse hook input — check PATH for a shim or reinstall jq." >&2
  exit 2
fi
unset _pb_canary_k _pb_canary_v

COMMAND=$(echo "$INPUT" | jq -r '.tool_input.command // empty')
FILE_PATH=$(echo "$INPUT" | jq -r '.tool_input.file_path // empty')
EVENT_CWD=$(echo "$INPUT" | jq -r '.cwd // empty')

if [ -z "$COMMAND" ] && [ -z "$FILE_PATH" ]; then
  exit 0
fi

# --- Normalize Windows-native paths from hook input (issue #28) ---
# On Windows + MSYS2 bash, the Bash hook benefits from MSYS path
# rewriting on command-line arguments (`C:\Users\x` → `/c/Users/x`),
# but Edit/Write/MultiEdit deliver `tool_input.file_path` and `cwd`
# as raw JSON strings — `C:\Users\x` arrives unchanged. The downstream
# code's `[[ "$path" != /* ]]` relative-path branch then prepends
# `$PROJECT_DIR/`, masking outside-project writes as in-project.
#
# Detect Windows-native shapes:
#   ^[A-Za-z]:[\\/]   drive-letter (C:\, D:/, ...)
#   ^\\\\             UNC (\\server\share)
# When `cygpath -u` is available (MSYS2/Cygwin shell), convert to
# POSIX form and let the normal boundary check run. Without cygpath,
# fail-closed: refuse to interpret an absolute Windows path as if
# it were project-relative. On Linux/macOS shells these shapes are
# never legitimate POSIX paths, so the fail-closed branch is the
# correct default.
_pb_normalize_windows_path() {
  local label="$1"
  local val="$2"
  # file:// URIs are never a legitimate file_path or cwd value —
  # refuse them outright (Codex re-#28 Cat 1b). cygpath does not
  # parse URIs, so fail-closed regardless of its presence.
  if [[ "$val" =~ ^file:// ]]; then
    echo "BLOCKED: $label is a file:// URI '$val'; pass a POSIX path instead." >&2
    return 2
  fi
  # Windows-native path shapes:
  #   ^[A-Za-z]:[\\/]   drive-letter + slash (C:\, D:/)
  #   ^\\\\             UNC path (\\server\share, \\?\C:\)
  #   ^[A-Za-z]:        drive-relative (C:foo) — Codex re-#28 Cat 1a.
  #                     Accepted FP risk: a POSIX file literally named
  #                     `c:something` is fail-closed; rare in practice.
  if [[ "$val" =~ ^([A-Za-z]:|\\\\) ]]; then
    if command -v cygpath >/dev/null 2>&1; then
      cygpath -u "$val"
      return 0
    fi
    echo "BLOCKED: $label is a Windows-native path '$val' but cygpath is not available; cannot reliably enforce the project boundary. Pass POSIX paths or install cygpath (MSYS2/Cygwin)." >&2
    return 2
  fi
  printf '%s\n' "$val"
}

if [ -n "$FILE_PATH" ]; then
  FILE_PATH=$(_pb_normalize_windows_path "tool_input.file_path" "$FILE_PATH") || exit $?
fi
if [ -n "$EVENT_CWD" ]; then
  EVENT_CWD=$(_pb_normalize_windows_path "hook event cwd" "$EVENT_CWD") || exit $?
fi

# Bash hook COMMAND can also carry Windows-native path tokens
# (Codex re-review Cat 6): `echo x > C:/Users/foo`, `tee C:\path`,
# `curl -o C:/path URL`, etc. resolve_command_path treats those as
# relative and resolves them under EFFECTIVE_CWD, producing an
# in-project-looking path that passes is_inside_project.
#
# Detection scope is the whole COMMAND string with token-boundary
# anchors (start, whitespace, redirect/pipe/separator). We accept
# that this matches inside heredoc bodies too — a fail-closed
# false-positive on a path-shaped string in a heredoc is preferred
# over leaving the bypass open.
#
# Linux/macOS (cygpath absent): fail-closed via the detection
# branch — there is no legitimate Windows-shaped path token on
# these platforms.
# MSYS2/Cygwin (cygpath present): each detected token is rewritten
# in place via `cygpath -u` so downstream walkers see normalised
# POSIX paths and the boundary check rejects outside-project values
# (sec 108 + per-token rewrite landed in 1ac00ae).
if [ -n "$COMMAND" ]; then
  # Skip Windows-path detection for tools whose operands include
  # `host:path` / `container:path` shapes that visually collide with
  # Windows drive letters (`c:/tmp`). These tools route the path-side
  # to a remote filesystem the project boundary doesn't apply to:
  #   ssh REMOTE_HOST [command]    — remote command on remote host
  #   scp src host:path            — remote copy
  #   rsync src host:path          — remote sync
  #   docker cp src container:/p   — container copy
  #   kubectl cp pod:src local     — k8s copy
  #   oc cp / podman cp            — same shape
  _pb_cmd_trimmed="${COMMAND#"${COMMAND%%[![:space:]]*}"}"
  _pb_cmd_first="${_pb_cmd_trimmed%% *}"
  _pb_cmd_basename="${_pb_cmd_first##*/}"
  _pb_cmd_basename_quoteless="${_pb_cmd_basename%\"}"
  _pb_cmd_basename_quoteless="${_pb_cmd_basename_quoteless#\"}"
  case "$_pb_cmd_basename_quoteless" in
    ssh|scp|rsync|docker|kubectl|oc|podman)
      : ;;
    *)
      if echo "$COMMAND" | grep -qE "(^|[[:space:]>|<&;=(\"'])([A-Za-z]:[\\\\/]|\\\\\\\\)"; then
        if ! command -v cygpath >/dev/null 2>&1; then
          echo "BLOCKED: command contains a Windows-native path token but cygpath is not available; cannot reliably enforce the project boundary. Pass POSIX paths or install cygpath (MSYS2/Cygwin)." >&2
          exit 2
        fi
        # cygpath present (MSYS2/Cygwin shell): rewrite each
        # Windows-shaped token to POSIX form so downstream walkers
        # see normalized paths. Without this, on MSYS2 the
        # walkers treated `C:\Users\foo` as project-relative and
        # produced an in-project-looking path that passed the
        # boundary check (Codex sweep 4 #3 / issue #34).
        while IFS= read -r _pb_winpath; do
          [ -z "$_pb_winpath" ] && continue
          _pb_posix=$(cygpath -u "$_pb_winpath" 2>/dev/null)
          [ -z "$_pb_posix" ] && continue
          # Bash native replacement; quoting guards against glob
          # interpretation of literal `\` / `/` in winpath.
          COMMAND="${COMMAND//"$_pb_winpath"/"$_pb_posix"}"
        done < <(echo "$COMMAND" \
          | grep -oE "([A-Za-z]:[\\\\/][^[:space:]\"'<>|&;()=]*|\\\\\\\\[^[:space:]\"'<>|&;()=]+)" \
          | sort -u)
        unset _pb_winpath _pb_posix
      fi
      ;;
  esac
  unset _pb_cmd_trimmed _pb_cmd_first _pb_cmd_basename _pb_cmd_basename_quoteless
fi

# Use cwd from the hook event if provided, so relative paths resolve correctly.
# EFFECTIVE_CWD is used to resolve relative paths in commands.
if [ -n "$EVENT_CWD" ]; then
  EFFECTIVE_CWD="$EVENT_CWD"
else
  EFFECTIVE_CWD=""
fi

# If CLAUDE_PROJECT_DIR is not set, fall back to pwd with a warning.
# We warn rather than block because blocking would break usability in
# environments where the variable is simply not configured yet.
if [ -z "${CLAUDE_PROJECT_DIR:-}" ]; then
  echo "WARNING: CLAUDE_PROJECT_DIR is not set, falling back to pwd ($(pwd)). Set CLAUDE_PROJECT_DIR for reliable boundary enforcement." >&2
fi
PROJECT_DIR="${CLAUDE_PROJECT_DIR:-$(pwd)}"
# Ensure PROJECT_DIR has no trailing slash for consistent comparison
PROJECT_DIR="${PROJECT_DIR%/}"
# Normalize PROJECT_DIR if it arrived as a Windows-native path
# (issue #28). Same fail-closed semantics as FILE_PATH/EVENT_CWD.
if [ -n "$PROJECT_DIR" ]; then
  PROJECT_DIR=$(_pb_normalize_windows_path "CLAUDE_PROJECT_DIR" "$PROJECT_DIR") || exit $?
fi

# EFFECTIVE_CWD: where relative paths in commands resolve to.
# Uses cwd from hook event if provided, otherwise PROJECT_DIR.
if [ -z "$EFFECTIVE_CWD" ]; then
  EFFECTIVE_CWD="$PROJECT_DIR"
fi

# resolve_path moved to hooks/lib/paths.sh.

# Resolve PROJECT_DIR itself so symlinks (e.g. /var -> /private/var on macOS) match
PROJECT_DIR=$(resolve_path "$PROJECT_DIR")

# --- Load path allowlist from hooks/allowlist.conf ---
# Patterns listed there bypass the boundary check. Kept in a separate file
# so users can inspect/extend without editing the guard logic. See the
# warning at the top of allowlist.conf — broad entries create bypass risk.
declare -a ALLOWLIST_PATTERNS=()
ALLOWLIST_FILE="${CLAUDE_PLUGIN_ROOT:-$(cd "$_GUARD_DIR/.." && pwd)}/hooks/allowlist.conf"
# Resolve HOME so `~` in patterns matches the canonical form that
# resolve_path produces for checked paths (handles macOS /var ->
# /private/var symlink so `~/.claude/**` compares correctly).
_ALLOWLIST_HOME=$(resolve_path "$HOME")
if [ -f "$ALLOWLIST_FILE" ]; then
  while IFS= read -r raw_line || [ -n "$raw_line" ]; do
    line="${raw_line%%#*}"
    line="${line#"${line%%[![:space:]]*}"}"
    line="${line%"${line##*[![:space:]]}"}"
    [ -z "$line" ] && continue
    # Expand leading ~ to the resolved $HOME
    if [[ "$line" == "~/"* ]]; then
      line="$_ALLOWLIST_HOME/${line#\~/}"
    elif [[ "$line" == "~" ]]; then
      line="$_ALLOWLIST_HOME"
    fi
    ALLOWLIST_PATTERNS+=("$line")
  done < "$ALLOWLIST_FILE"
fi

# Precomputed parallel arrays filled after glob_to_regex is defined.
# See the precompute loop later in the file.
ALLOWLIST_REGEXES=()
ALLOWLIST_BASE_REGEXES=()

# glob_to_regex moved to hooks/lib/tokenize.sh (sourced at top of file).

# --- Precompute allowlist regexes once at load time ---
# is_allowlisted is invoked many times per command and many commands
# per session. Compiling glob_to_regex inside the hot loop wastes
# cycles on identical work across every invocation. Compile once
# here and reuse the cached regexes in is_allowlisted below.
_awl_i=0
while [ $_awl_i -lt ${#ALLOWLIST_PATTERNS[@]} ]; do
  _awl_p="${ALLOWLIST_PATTERNS[$_awl_i]}"
  ALLOWLIST_REGEXES+=("$(glob_to_regex "$_awl_p")")
  if [[ "$_awl_p" == *"/**" ]]; then
    ALLOWLIST_BASE_REGEXES+=("$(glob_to_regex "${_awl_p%/**}")")
  else
    ALLOWLIST_BASE_REGEXES+=("")
  fi
  _awl_i=$((_awl_i+1))
done
unset _awl_i _awl_p

# --- Check whether a resolved path is on the allowlist ---
# Fails closed: empty allowlist means nothing is exempt.
# A pattern ending in `/**` also matches the directory itself (gitignore-like
# semantics: `memory/**` allows both `memory` and its contents).
# strip_command_name_prefix moved to hooks/lib/command_name.sh.

# strip_command_name_quotes moved to hooks/lib/command_name.sh.

# command_name_is moved to hooks/lib/command_name.sh.

# is_discard_target moved to hooks/lib/paths.sh.

# is_shell_token / is_source_token moved to hooks/lib/command_name.sh.

# is_allowlisted moved to hooks/lib/paths.sh.

# Check if the effective working directory is outside the project
EFFECTIVE_CWD_RESOLVED=$(resolve_path "$EFFECTIVE_CWD")
CWD_OUTSIDE_PROJECT=0
CWD_IN_ALLOWLIST=0
if [[ "$EFFECTIVE_CWD_RESOLVED/" != "$PROJECT_DIR/"* ]]; then
  CWD_OUTSIDE_PROJECT=1
  if is_allowlisted "$EFFECTIVE_CWD_RESOLVED"; then
    CWD_IN_ALLOWLIST=1
  fi
fi

# strip_quotes moved to hooks/lib/tokenize.sh (sourced at top of file).

# expand_path moved to hooks/lib/paths.sh.

# tokenize_args moved to hooks/lib/tokenize.sh (sourced at top of file).

# extract_option_values moved to hooks/lib/options.sh.


# is_inside_project / is_write_permitted moved to hooks/lib/paths.sh.

# --- Edit/Write tool: check file_path boundary ---
if [ -n "$FILE_PATH" ]; then
  FILE_PATH=$(expand_path "$FILE_PATH")
  if [[ "$FILE_PATH" != /* ]]; then
    FILE_PATH="$PROJECT_DIR/$FILE_PATH"
  fi
  RESOLVED=$(resolve_path "$FILE_PATH")
  # Fully dereference symlinks so a symlink inside the project pointing
  # outside is caught (e.g. project/link -> /tmp/secret).
  # Loop handles chained symlinks (a -> b -> /outside).
  max_depth=20
  while [[ -L "$RESOLVED" && $max_depth -gt 0 ]]; do
    link_target=$(readlink "$RESOLVED")
    if [[ "$link_target" == /* ]]; then
      RESOLVED=$(resolve_path "$link_target")
    else
      RESOLVED=$(resolve_path "$(dirname "$RESOLVED")/$link_target")
    fi
    max_depth=$((max_depth - 1))
  done
  # Fail-closed: if symlink chain is too deep or circular, block
  if [[ -L "$RESOLVED" ]]; then
    echo "BLOCKED: Symlink chain too deep or circular at '$RESOLVED'. Ask user for explicit permission." >&2
    exit 2
  fi
  # Canonicalize the final path (resolve /var -> /private/var on macOS)
  if [[ -e "$RESOLVED" ]]; then
    RESOLVED="$(cd "$(dirname "$RESOLVED")" && pwd -P)/$(basename "$RESOLVED")"
  fi
  if ! is_write_permitted "$RESOLVED"; then
    echo "BLOCKED: File '$RESOLVED' is OUTSIDE project directory '$PROJECT_DIR'. Ask user for explicit permission." >&2
    exit 2
  fi
  exit 0
fi

# blank_quoted_heredoc_bodies moved to hooks/lib/heredoc.sh.

# --- Check a single (non-chained) command against all guards ---
check_single_command() {
  local CMD="$1"

  # Strip leading/trailing whitespace
  CMD="$(echo "$CMD" | sed 's/^[[:space:]]*//' | sed 's/[[:space:]]*$//')"

  # Skip empty commands
  if [ -z "$CMD" ]; then
    return 0
  fi

  # Snapshot CMD BEFORE sudo-strip and any other normalization, so
  # extract_subcmd_flag_payloads can see the wrapper + its option-with-
  # value flags (e.g. `sudo -u root tar --to-command='<payload>'`).
  # Sudo-strip below removes only the bare `sudo ` token; leftover
  # `-u root` would mis-identify the verb in the subcmd-flag scan.
  local _CMD_PRE_STRIP="$CMD"

  # --- Strip sudo prefix and its option-with-value pairs ---
  # Bare `${CMD#sudo }` left orphaned `-u root` in front of the verb,
  # which mis-led every command-name walker (`root` got treated as the
  # verb and install / /bin/<name> / "<name>" normalisations fell
  # through). The helper walks sudo's options-with-value (-u USER,
  # --user=USER, -g GROUP, …) so `sudo -u root install …` collapses to
  # `install …` before any downstream walker runs. env / nice / ionice
  # / timeout / chrt are NOT literal-stripped — _cn_find_verb_idx (and
  # its _sf_/_rd_ siblings) handle their opt-with-value pairs in place.
  CMD=$(strip_sudo_wrapper_with_opts "$CMD")
  CMD="$(echo "$CMD" | sed 's/^[[:space:]]*//')"

  # --- Block shell-opening sudo invocations ---
  # `sudo -i` / `sudo -s` / `sudo --login` / `sudo --shell` open a
  # privileged interactive shell whose subsequent commands cannot be
  # inspected — strictly more dangerous than bare `bash`, which the
  # shell-execute walker already blocks. _cn_is_sudo_shell_opener also
  # catches clustered (`sudo -ni`, `-in`, `-nis`), quoted (`sudo "-i"`),
  # and outer-wrapper-prefixed (`env -u FOO sudo -i`) forms. Runs on
  # _CMD_PRE_STRIP so the original wrapper + sudo + flag layout is still
  # visible; if CMD is empty after sudo-strip but the original was bare
  # `sudo` / `sudo -l` / `-V` / `-v`, this returns 1 and we fall through
  # to the harmless-empty ALLOW.
  if _cn_is_sudo_shell_opener "$_CMD_PRE_STRIP"; then
    echo "BLOCKED: 'sudo -i' / 'sudo -s' / 'sudo --login' / 'sudo --shell' (also clustered like -ni / -nis, quoted, or wrapper-prefixed) opens a privileged interactive shell whose subsequent commands cannot be inspected. Ask user for explicit permission." >&2
    exit 2
  fi
  if [ -z "$CMD" ]; then
    return 0
  fi

  # --- Snapshot raw CMD before alias-escape / paren normalization ---
  # Alias normalization below strips `\` that precedes `[a-zA-Z_]`. That
  # breaks detection of a backslash-escaped heredoc delimiter `<<\EOF`
  # (bash treats it as quoted → literal body), which would be rewritten
  # to `<<EOF` (unquoted → expandable body) and wrongly trip the
  # substitution detector on literal backticks / $(...) in the body.
  # blank_quoted_heredoc_bodies is computed from this raw copy.
  local CMD_RAW="$CMD"

  # --- Normalize command-name prefixes for detection regexes ---
  # All destructive-command detection uses `(^|[[:space:]])<name>($|[[:space:]])`
  # regexes on the raw CMD string. That pattern misses three trivial aliases:
  #   (rm …)           — subshell grouping puts `(` before the name
  #   \rm …            — backslash disables alias lookup but still runs `rm`
  #   /bin/rm …        — absolute path to the same binary
  # Normalize these into the bare command form before any detection runs.
  # This only touches the string used for matching — argument extraction below
  # operates on the normalized CMD too, so paths are not mangled.
  CMD=$(normalize_command_view "$CMD")

  # --- Cache the post-normalisation verb name ---
  # command_name_is is called ~64× per check_single_command (once per
  # detector that gates on a verb). Without a cache each call would
  # re-tokenise CMD and re-walk wrappers. CMD_VERB is read by
  # command_name_is via dynamic scope; refreshed after rewrite_remote_
  # dispatch below because that rewrite can change the visible verb
  # (e.g. by stripping the ssh wrapper). Codex round-5 finding #3.
  local CMD_VERB
  CMD_VERB=$(_cn_compute_verb_name "$CMD")

  # --- Build a heredoc-sanitized view for expansion-scans ---
  # $VAR and $(...)/backtick inside a *quoted* heredoc body are literal
  # bytes written to the heredoc's stdin target, not shell expansions.
  # Scanning them trips false positives on legitimate writes to an
  # allowlisted path (see blank_quoted_heredoc_bodies above). Any
  # command-name / path / redirect scan still uses the original CMD.
  local CMD_EXPAND_SCAN
  CMD_EXPAND_SCAN=$(blank_quoted_heredoc_bodies "$CMD_RAW")

  # Parallel command-name view: heredoc bodies blanked AND command-name
  # normalisations re-applied. Used by detectors that match on the live
  # command-line form (interpreter -c/-e flags, awk system(), etc.) and
  # would otherwise false-positive on those same patterns sitting inside
  # a quoted-heredoc body that bash never executes (e.g. a tee/cat
  # commit-message body that merely *mentions* `awk … system(…)` or
  # `python -c`). Source MUST be CMD_RAW for the same reason as
  # CMD_EXPAND_SCAN — the alias-escape pass that strips `\` before a
  # letter would otherwise downgrade `<<\EOF` to `<<EOF` and re-leak
  # body bytes into the blanker.
  local CMD_BLANKED
  CMD_BLANKED=$(blank_quoted_heredoc_bodies "$CMD_RAW")
  CMD_BLANKED=$(normalize_command_view "$CMD_BLANKED")

  # --- Fail closed on unexpanded $VAR outside single quotes ---
  block_unexpanded_var

  # --- Tokenize the command once (quote-aware) for option/redirect parsing ---
  # CMD_TOKENS_SCAN is the parallel token stream built from CMD_BLANKED.
  # Used by detectors that walk tokens looking for a marker word (sed,
  # truncate, `>`-redirect operator) and would otherwise pick up heredoc
  # body bytes as if they were live commands. See the comment on
  # CMD_BLANKED for why the source MUST be CMD_RAW (alias-escape would
  # silently downgrade `<<\EOF` to its unquoted twin and re-leak body
  # bytes).
  local -a CMD_TOKENS=()
  local -a CMD_TOKENS_SCAN=()
  fill_tokens_from CMD_TOKENS "$CMD"
  fill_tokens_from CMD_TOKENS_SCAN "$CMD_BLANKED"

  # --- Block command substitution outside single quotes ---
  block_command_substitution

  # --- cd-outside + destructive-cwd walkers (lib/cd_destructive_walker.sh) ---
  if handle_cd_and_track_outside_context; then
    return 0
  fi
  block_destructive_in_outside_context

  # --- git destructive walkers (extracted to hooks/lib/git_walkers.sh) ---
  block_git_C_destructive
  block_git_worktree_add_outside

  # --- Shell / interpreter execution walkers (lib/shell_exec_walkers.sh) ---
  block_nested_shell_and_eval
  block_trap_handler

  block_interpreter_inline_code
  block_pipe_to_shell

  block_shell_script_execution

  # --- Neutralise remote-dispatch commands before path walkers run ---
  # Issue #21. ssh / scp / docker exec / kubectl exec / etc. dispatch
  # their operands to a remote host or foreign (container/namespace)
  # filesystem. The boundary plugin protects the LOCAL filesystem, so
  # those operands must be removed before the cp/tee/rm/redirect/...
  # walkers run — otherwise a quoted remote command like
  # `ssh host "docker cp /tmp/x container:/y"` produces a false-positive
  # block on `/tmp/x` (the cp regex matches the literal ` cp ` inside
  # the quoted argument). Policy checks earlier in this function
  # (bash -c, $VAR, $(...), heredoc-fed-shell, script execution) MUST
  # remain on the original CMD because those events happen LOCALLY,
  # before ssh / docker ever see the argument string. The rewrite here
  # only narrows what the path walkers see; CMD_TOKENS / CMD_BLANKED /
  # CMD_TOKENS_SCAN are regenerated so every detector sees a consistent
  # view. Generic for the whole class — see hooks/lib/remote_dispatch.sh.
  CMD=$(rewrite_remote_dispatch "$CMD")
  CMD_BLANKED=$(rewrite_remote_dispatch "$CMD_BLANKED")
  fill_tokens_from CMD_TOKENS "$CMD"
  fill_tokens_from CMD_TOKENS_SCAN "$CMD_BLANKED"
  # Refresh the verb cache: rewrite_remote_dispatch can drop or rewrite
  # the wrapper (e.g. `ssh host "rm /etc/x"` becomes `ssh host`), which
  # changes what command_name_is sees.
  CMD_VERB=$(_cn_compute_verb_name "$CMD")

  # --- Validate argument-as-command flag values recursively ---
  # Tools like `tar --to-command=<cmd>` / `rsync -e <cmd>` /
  # `git -c <exec-key>=<cmd>` execute the flag value as a local shell
  # command. The walkers below only see flag NAMES — not VALUES — so a
  # destructive payload would slip past them. Extract every recognised
  # payload from this (post-split) subcommand and dispatch it through
  # check_single_command recursively, reusing the entire detector
  # pipeline. Generic for the whole class — see hooks/lib/subcmd_flags.sh.
  local _sf_payload
  while IFS= read -r _sf_payload; do
    [ -n "$_sf_payload" ] && check_single_command "$_sf_payload"
  done < <(extract_subcmd_flag_payloads "$_CMD_PRE_STRIP")

  # xargs, find-delete, rm, mv, cp, ln moved to hooks/lib/detectors/destructive.sh.
  run_destructive_detectors


  # install, rsync, tar, unzip, cpio, archive: write_targets.sh.
  # Domain splits of the former write_targets_b.sh:
  #   download.sh           — curl -o / wget -O
  #   redirects.sh          — tee, dd of=, `>` catch-all
  #   db_dump.sh            — pg_dump -f, psql -o/-L/-c, mysql --tee, mysqldump
  #   filesystem_create.sh  — mktemp -p, mkfifo, mknod
  run_write_target_detectors
  run_download_detectors
  run_redirect_detectors
  run_db_dump_detectors
  run_filesystem_create_detectors


  # sed -i / truncate detectors moved to hooks/lib/detectors/inplace.sh.
  run_inplace_detectors


  # chmod / chown moved to hooks/lib/detectors/destructive.sh.
  run_permissions_detectors
}

# --- Split command into sub-commands and check each ---
# Split on ;, &&, ||, and | (but not inside quoted strings)
# This is a basic splitter that handles common cases.
# split_and_check moved to hooks/lib/options.sh.


# --- Main entry point: split chained commands and check each ---
split_and_check "$COMMAND"

exit 0
