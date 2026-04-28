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
# dependency). Reported by Copilot review on PR #15.
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
# shellcheck source=lib/command_name.sh
source "$_GUARD_DIR/lib/command_name.sh"
# shellcheck source=lib/paths.sh
source "$_GUARD_DIR/lib/paths.sh"
# shellcheck source=lib/heredoc.sh
source "$_GUARD_DIR/lib/heredoc.sh"
# shellcheck source=lib/detectors/inplace.sh
source "$_GUARD_DIR/lib/detectors/inplace.sh"
# shellcheck source=lib/detectors/destructive.sh
source "$_GUARD_DIR/lib/detectors/destructive.sh"
# shellcheck source=lib/detectors/write_targets.sh
source "$_GUARD_DIR/lib/detectors/write_targets.sh"
# shellcheck source=lib/options.sh
source "$_GUARD_DIR/lib/options.sh"

INPUT=$(cat)
COMMAND=$(echo "$INPUT" | jq -r '.tool_input.command // empty')
FILE_PATH=$(echo "$INPUT" | jq -r '.tool_input.file_path // empty')
EVENT_CWD=$(echo "$INPUT" | jq -r '.cwd // empty')

if [ -z "$COMMAND" ] && [ -z "$FILE_PATH" ]; then
  exit 0
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
# Reported by Copilot review on commit aa6409b (guard.sh:298).
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

  # --- Strip sudo prefix ---
  if [[ "$CMD" =~ ^sudo[[:space:]]+ ]]; then
    CMD="${CMD#sudo }"
    CMD="$(echo "$CMD" | sed 's/^[[:space:]]*//')"
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
  # Strip subshell grouping parens only when they sit at a token boundary so
  # that `$(…)` (command substitution) is NOT mangled — that form is caught
  # by a dedicated check below. `(rm …)` → `rm …`, `( rm … )` → `rm …`,
  # `$(foo)` stays as is because the `(` is preceded by `$`, not space/start.
  CMD="$(printf '%s' "$CMD" | sed -E 's/(^|[[:space:]])\(+/\1/g; s/\)+($|[[:space:]])/\1/g')"
  # Strip a backslash that precedes a shell-word character (alias escape).
  CMD="$(printf '%s' "$CMD" | sed -E 's/\\([a-zA-Z_])/\1/g')"
  # Strip the common binary path prefix from the command-name token so
  # that `/bin/rm` is recognised as `rm` by every command-name regex.
  # MUST NOT touch operand or redirect-target tokens — see the helper
  # docstring for the bypass shape this guards against (Codex review
  # on commit e01df86, bypass A). The previous sed-based fallback for
  # the start-of-CMD case is preserved so that a CMD whose tokenizer
  # output is empty (defensively impossible but cheap) still gets the
  # leading prefix stripped.
  # Strip surrounding quotes from the command-name token so that
  # `"rm" /etc/x` / `'rm' /etc/x` / `"/bin/rm" /etc/x` are still
  # recognised by bare-name detectors. bash strips these quotes at
  # exec time, invoking the bare binary either way. Must run before
  # the /bin/-prefix passes so those see the bare path.
  CMD="$(strip_command_name_quotes "$CMD")"
  CMD="$(printf '%s' "$CMD" | sed -E 's#^/(usr/local/bin|usr/bin|bin|sbin|usr/sbin)/##')"
  CMD="$(strip_command_name_prefix "$CMD")"
  # Trim duplicated whitespace introduced by the substitutions.
  CMD="$(printf '%s' "$CMD" | sed -E 's/[[:space:]]+/ /g; s/^ //; s/ $//')"

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
  CMD_BLANKED="$(printf '%s' "$CMD_BLANKED" | sed 's/^[[:space:]]*//' | sed 's/[[:space:]]*$//')"
  CMD_BLANKED="$(printf '%s' "$CMD_BLANKED" | sed -E 's/(^|[[:space:]])\(+/\1/g; s/\)+($|[[:space:]])/\1/g')"
  CMD_BLANKED="$(printf '%s' "$CMD_BLANKED" | sed -E 's/\\([a-zA-Z_])/\1/g')"
  CMD_BLANKED="$(strip_command_name_quotes "$CMD_BLANKED")"
  CMD_BLANKED="$(printf '%s' "$CMD_BLANKED" | sed -E 's#^/(usr/local/bin|usr/bin|bin|sbin|usr/sbin)/##')"
  CMD_BLANKED=$(strip_command_name_prefix "$CMD_BLANKED")
  CMD_BLANKED="$(printf '%s' "$CMD_BLANKED" | sed -E 's/[[:space:]]+/ /g; s/^ //; s/ $//')"

  # --- Fail closed on unexpanded $VAR outside single quotes ---
  # `expand_path` only handles ~, $HOME, ${HOME}. Any other $VAR is kept
  # verbatim and then joined under $EFFECTIVE_CWD, so it looks "inside the
  # project" to the guard while Bash expands it at exec time. Treat it like
  # `$(…)`: if the value cannot be inspected, refuse.
  local vi=0 vlen=${#CMD_EXPAND_SCAN}
  local vin_sq=0 vin_dq=0 vin_esc=0
  while [ $vi -lt $vlen ]; do
    local vc="${CMD_EXPAND_SCAN:$vi:1}"
    if [ $vin_esc -eq 1 ]; then vin_esc=0; vi=$((vi+1)); continue; fi
    if [ "$vc" = "\\" ] && [ $vin_sq -eq 0 ]; then vin_esc=1; vi=$((vi+1)); continue; fi
    if [ "$vc" = "'" ] && [ $vin_dq -eq 0 ]; then vin_sq=$((1-vin_sq)); vi=$((vi+1)); continue; fi
    if [ "$vc" = '"' ] && [ $vin_sq -eq 0 ]; then vin_dq=$((1-vin_dq)); vi=$((vi+1)); continue; fi
    if [ $vin_sq -eq 0 ] && [ "$vc" = "\$" ] && [ $((vi+1)) -lt $vlen ]; then
      local vnext="${CMD_EXPAND_SCAN:$((vi+1)):1}"
      # Explicit passthroughs — NOT parameter expansions:
      #   $(...)   — command substitution, caught by the substitution detector
      #   $'...'   — ANSI-C quoted literal (escape decoding, no expansion)
      #   $"..."   — i18n string literal (no parameter expansion)
      # Arithmetic `$((...))` is handled by the substitution detector.
      if [ "$vnext" = "(" ] || [ "$vnext" = "'" ] || [ "$vnext" = '"' ]; then
        :
      # Allow $HOME / ${HOME} — expand_path handles them.
      elif [[ "$vnext" =~ [A-Za-z_] ]]; then
        local rest="${CMD_EXPAND_SCAN:$((vi+1))}"
        local vname="${rest%%[^A-Za-z0-9_]*}"
        if [ "$vname" != "HOME" ]; then
          echo "BLOCKED: Variable expansion '\$${vname}' cannot be safely inspected. Ask user for explicit permission." >&2
          exit 2
        fi
      elif [ "$vnext" = "{" ]; then
        local rest="${CMD_EXPAND_SCAN:$((vi+2))}"
        local vname="${rest%%\}*}"
        if [ "$vname" != "HOME" ]; then
          echo "BLOCKED: Variable expansion '\${${vname}}' cannot be safely inspected. Ask user for explicit permission." >&2
          exit 2
        fi
      # Positional ($0..$9) and special ($@ $* $# $? $$ $! $-) parameters.
      # These expand at exec time to values the guard cannot inspect —
      # e.g. `set -- /etc/passwd; rm $1` looks like `rm $1` (treated as a
      # relative filename inside cwd) to the regex checks, but bash
      # expands $1 to /etc/passwd at execution. Same fail-closed rule as
      # $FOO applies — every non-HOME expansion is refused.
      elif [[ "$vnext" =~ [0-9@*#?!\$\-] ]]; then
        echo "BLOCKED: Shell parameter expansion '\$${vnext}' cannot be safely inspected. Ask user for explicit permission." >&2
        exit 2
      fi
    fi
    vi=$((vi+1))
  done

  # --- Tokenize the command once (quote-aware) for option/redirect parsing ---
  local -a CMD_TOKENS=()
  while IFS= read -r tok; do
    [[ -z "$tok" ]] && continue
    CMD_TOKENS+=("$tok")
  done < <(tokenize_args "$CMD")

  # CMD_TOKENS_SCAN is the parallel token stream built from CMD_BLANKED
  # (computed above near the top of check_single_command, alongside
  # CMD_EXPAND_SCAN). Used by detectors that walk tokens looking for a
  # marker word (sed, truncate, `>`-redirect operator) and would
  # otherwise pick up heredoc body bytes as if they were live commands.
  # See the comment on CMD_BLANKED for why the source MUST be CMD_RAW
  # (alias-escape would silently downgrade `<<\EOF` to its unquoted
  # twin and re-leak body bytes).
  local -a CMD_TOKENS_SCAN=()
  while IFS= read -r tok; do
    [[ -z "$tok" ]] && continue
    CMD_TOKENS_SCAN+=("$tok")
  done < <(tokenize_args "$CMD_BLANKED")

  # --- Block command substitution outside single quotes ---
  # `$(...)` and backticks are expanded by bash (even inside double quotes),
  # so the guard cannot know the final target. Single quotes keep them literal,
  # so only block when they appear outside single quotes. Arithmetic expansion
  # `$((...))` is allowed — it's a numeric computation, not a command.
  # Similar rationale to blocking `bash -c` / `eval` — the inner command is
  # uninspectable.
  local ci=0 clen=${#CMD_EXPAND_SCAN}
  local cin_sq=0 cin_dq=0 cin_esc=0
  while [ $ci -lt $clen ]; do
    local cc="${CMD_EXPAND_SCAN:$ci:1}"
    if [ $cin_esc -eq 1 ]; then
      cin_esc=0
      ci=$((ci + 1))
      continue
    fi
    if [ "$cc" = "\\" ] && [ $cin_sq -eq 0 ]; then
      cin_esc=1
      ci=$((ci + 1))
      continue
    fi
    # Single quotes are only delimiters when NOT inside double quotes
    if [ "$cc" = "'" ] && [ $cin_dq -eq 0 ]; then
      cin_sq=$(( 1 - cin_sq ))
      ci=$((ci + 1))
      continue
    fi
    # Double quotes are only delimiters when NOT inside single quotes
    if [ "$cc" = '"' ] && [ $cin_sq -eq 0 ]; then
      cin_dq=$(( 1 - cin_dq ))
      ci=$((ci + 1))
      continue
    fi
    if [ $cin_sq -eq 0 ]; then
      if [ "$cc" = "\`" ]; then
        echo "BLOCKED: Command substitution with backticks cannot be safely inspected. Ask user for explicit permission." >&2
        exit 2
      fi
      if [ "$cc" = "\$" ] && [ $((ci + 1)) -lt $clen ] && [ "${CMD_EXPAND_SCAN:$((ci + 1)):1}" = "(" ]; then
        # Skip arithmetic expansion $((...)): next-next char is also (
        if [ $((ci + 2)) -ge $clen ] || [ "${CMD_EXPAND_SCAN:$((ci + 2)):1}" != "(" ]; then
          echo "BLOCKED: Command substitution '\$(...)' cannot be safely inspected. Ask user for explicit permission." >&2
          exit 2
        fi
      fi
    fi
    ci=$((ci + 1))
  done

  # --- Block cd outside project followed by destructive commands ---
  if [[ "$CMD" =~ ^cd($|[[:space:]]) ]]; then
    local cd_target
    # cd takes a single argument, so grab everything after 'cd ' as the target
    # (including spaces if quoted). Not using tokenize_args because cd doesn't
    # take multiple path arguments.
    cd_target=$(echo "$CMD" | sed 's/^cd[[:space:]]*//')
    # cd with no args or cd ~ goes to $HOME
    if [[ -z "$cd_target" || "$cd_target" == "~" ]]; then
      cd_target="$HOME"
    else
      cd_target=$(expand_path "$cd_target")
    fi
    if [[ "$cd_target" != /* ]]; then
      cd_target="$EFFECTIVE_CWD/$cd_target"
    fi
    local resolved_cd
    resolved_cd=$(resolve_path "$cd_target")
    EFFECTIVE_CWD="$resolved_cd"
    # STRICT: cd-outside triggers the destructive-subcommand guard.
    # Allowlist must not weaken this — `cd memory && git clean -fd` should
    # still block. But write-style commands (`cd memory && tee note.md`)
    # should reach their per-command is_write_permitted check, so we track
    # allowlist-context in a separate flag.
    if ! is_inside_project "$resolved_cd"; then
      export _GUARD_CD_OUTSIDE=1
      CWD_OUTSIDE_PROJECT=1
      if is_allowlisted "$resolved_cd"; then
        export _GUARD_CD_IN_ALLOWLIST=1
        CWD_IN_ALLOWLIST=1
      else
        export _GUARD_CD_IN_ALLOWLIST=0
        CWD_IN_ALLOWLIST=0
      fi
    else
      export _GUARD_CD_OUTSIDE=0
      CWD_OUTSIDE_PROJECT=0
      export _GUARD_CD_IN_ALLOWLIST=0
      CWD_IN_ALLOWLIST=0
    fi
    return 0
  fi

  # Block destructive commands when running outside the project
  # (either via cd in a chained command, or via cwd from the hook event)
  local outside_context=0
  if [[ "${_GUARD_CD_OUTSIDE:-0}" == "1" || "$CWD_OUTSIDE_PROJECT" == "1" ]]; then
    outside_context=1
  fi
  local cwd_in_allowlist=0
  if [[ "${_GUARD_CD_IN_ALLOWLIST:-0}" == "1" || "${CWD_IN_ALLOWLIST:-0}" == "1" ]]; then
    cwd_in_allowlist=1
  fi

  if [[ "$outside_context" == "1" ]]; then
    # When cwd is in an allowlisted dir, only block TRULY destructive ops
    # (rm/mv/chmod/chown/find+delete). Write-style commands (tee, curl -o,
    # wget -O, cp, ln, redirects) must reach their per-command path check
    # which uses is_write_permitted. Without this split, `cd memory && tee
    # note.md` would be blocked even though note.md is inside an allowlisted
    # path. `cp` and `ln` fall into the strict bucket because their own
    # per-command checks are strict anyway, and bundling them here preserves
    # earlier behavior.
    local destructive_cmds
    if [[ "$cwd_in_allowlist" == "1" ]]; then
      # In allowlisted cwd, relax only `tee` (per-command check already
      # validates all non-flag args via is_write_permitted). curl/wget
      # STAY strict because their validators only cover a subset of
      # output options (-o/--output and -O/--output-document); the
      # directory-prefix forms `wget -P` and `curl --output-dir` are
      # not independently checked, so leaving them open in allowlisted
      # cwd would allow writes to /etc etc.
      destructive_cmds="rm|mv|cp|ln|chmod|chown|find|curl|wget"
    else
      destructive_cmds="rm|mv|cp|ln|chmod|chown|tee|find|curl|wget"
    fi
    if echo "$CMD" | grep -qE "(^|[[:space:]])($destructive_cmds)($|[[:space:]])"; then
      echo "BLOCKED: Destructive command outside project directory. Ask user for explicit permission." >&2
      exit 2
    fi
    # Destructive git subcommands
    # git clean only destructive with -f/--force AND without -n/--dry-run
    if echo "$CMD" | grep -qE '(^|[[:space:]])git[[:space:]]+clean([[:space:]]|$)'; then
      local has_force=0
      local is_dry_run=0
      if echo "$CMD" | grep -qE '(^|[[:space:]])--force([[:space:]]|$)' || \
         echo "$CMD" | grep -qE '(^|[[:space:]])-[a-zA-Z]*f[a-zA-Z]*([[:space:]]|$)'; then
        has_force=1
      fi
      if echo "$CMD" | grep -qE '(^|[[:space:]])--dry-run([[:space:]]|$)' || \
         echo "$CMD" | grep -qE '(^|[[:space:]])-[a-zA-Z]*n[a-zA-Z]*([[:space:]]|$)'; then
        is_dry_run=1
      fi
      if [[ "$has_force" == "1" && "$is_dry_run" == "0" ]]; then
        echo "BLOCKED: Destructive 'git clean' outside project directory. Ask user for explicit permission." >&2
        exit 2
      fi
    fi
    # git checkout . and git checkout -- .
    if echo "$CMD" | grep -qE '(^|[[:space:]])git[[:space:]]+checkout([[:space:]]+--)?[[:space:]]+\.([[:space:]]|$)'; then
      echo "BLOCKED: Destructive 'git checkout .' outside project directory. Ask user for explicit permission." >&2
      exit 2
    fi
    # git reset --hard
    if echo "$CMD" | grep -qE '(^|[[:space:]])git[[:space:]]+reset[[:space:]]+--hard'; then
      echo "BLOCKED: Destructive 'git reset --hard' outside project directory. Ask user for explicit permission." >&2
      exit 2
    fi
    # git push --force / -f
    if echo "$CMD" | grep -qE '(^|[[:space:]])git[[:space:]]+push[[:space:]]+.*(--force|-f)([[:space:]]|$)'; then
      echo "BLOCKED: Destructive 'git push --force' outside project directory. Ask user for explicit permission." >&2
      exit 2
    fi
    # git restore . / git restore -- . / git restore --worktree .
    if echo "$CMD" | grep -qE '(^|[[:space:]])git[[:space:]]+restore([[:space:]]+(--worktree|--staged|--))*[[:space:]]+\.([[:space:]]|$)'; then
      echo "BLOCKED: Destructive 'git restore .' outside project directory. Ask user for explicit permission." >&2
      exit 2
    fi
    # git stash drop / clear
    if echo "$CMD" | grep -qE '(^|[[:space:]])git[[:space:]]+stash[[:space:]]+(drop|clear)'; then
      echo "BLOCKED: Destructive 'git stash drop/clear' outside project directory. Ask user for explicit permission." >&2
      exit 2
    fi
    # git branch -D / --delete --force
    if echo "$CMD" | grep -qE '(^|[[:space:]])git[[:space:]]+branch[[:space:]]+(-D|--delete[[:space:]]+--force)'; then
      echo "BLOCKED: Destructive 'git branch -D' outside project directory. Ask user for explicit permission." >&2
      exit 2
    fi
    # git reflog expire --all or --expire=now
    if echo "$CMD" | grep -qE '(^|[[:space:]])git[[:space:]]+reflog[[:space:]]+expire'; then
      echo "BLOCKED: Destructive 'git reflog expire' outside project directory. Ask user for explicit permission." >&2
      exit 2
    fi
    # Destructive rails/rake subcommands
    if echo "$CMD" | grep -qE '(^|[[:space:]])(rails|rake)[[:space:]]+db:(drop|reset)'; then
      echo "BLOCKED: Destructive rails/rake command outside project directory. Ask user for explicit permission." >&2
      exit 2
    fi
  fi

  # --- Block nested shell execution (bash -c, sh -c, eval) ---
  # Match: bash -c, sh -c, bash -lc, bash -ec, /bin/bash -c, /bin/sh -c, /usr/bin/env bash -c
  if echo "$CMD" | grep -qE '(^|[[:space:]])(/usr/bin/env[[:space:]]+)?(/bin/)?(bash|sh)[[:space:]]+-[a-zA-Z]*c[[:space:]]'; then
    echo "BLOCKED: Nested shell execution ('bash -c' / 'sh -c') cannot be safely inspected. Ask user for explicit permission." >&2
    exit 2
  fi
  if echo "$CMD" | grep -qE '(^|[[:space:]])eval[[:space:]]'; then
    echo "BLOCKED: 'eval' cannot be safely inspected. Ask user for explicit permission." >&2
    exit 2
  fi

  # --- Block non-shell interpreters with inline code flags ---
  # python/perl/ruby/node/php/osascript all accept code on argv. The inner
  # string cannot be inspected, so the same fail-closed rule as `bash -c`
  # applies. Flags covered: -c (python), -e (perl/ruby/node), --eval,
  # --execute, -E (perl alias). A dedicated rule catches `awk 'BEGIN{system(
  # "…")}'` and similar because awk programs are the first non-option arg,
  # not behind a flag — so we detect the `system(` marker in the CMD_BLANKED
  # view (heredoc bodies stripped) so a tee/cat heredoc whose body merely
  # mentions `python -c`, `awk … system(…)`, etc. is not false-positively
  # rejected.
  if echo "$CMD_BLANKED" | grep -qE '(^|[[:space:]])(python|python2|python3|perl|ruby|node|nodejs|deno|bun|php|osascript|Rscript)[[:space:]]+(-[a-zA-Z]*[ceE]|--eval|--execute)([[:space:]]|=|$)'; then
    echo "BLOCKED: Non-shell interpreter with inline code flag cannot be safely inspected. Ask user for explicit permission." >&2
    exit 2
  fi
  # Dedicated PHP rule — `-r`, `-R`, `--run` execute inline code. Cannot
  # be added to the shared regex above because `-r` is a module-preload
  # flag in ruby/node (no code execution), so a generic `r` letter would
  # false-positive on `ruby -r json` / `node -r dotenv`. The matcher
  # accepts attached forms (`-rcode`, `-Rcode`), quoted-attached
  # (`-r'code'`), clustered-ending (`-ar`, `-aR`), and the long alias
  # `--run`. Attached form was originally missed (guard.sh:1087 regex
  # required a boundary char immediately after the `[rR]`, so
  # `-rsystem('x')` slipped past). Re-reported by Copilot review on
  # commit aa6409b (guard.sh:1068).
  if echo "$CMD_BLANKED" | grep -qE '(^|[[:space:]])php[[:space:]]+(-[rR][^[:space:]=]*|-[a-zA-Z]*[rR]|--run)([[:space:]]|=|$|'\''|")'; then
    echo "BLOCKED: 'php -r/-R/--run' inline code cannot be safely inspected. Ask user for explicit permission." >&2
    exit 2
  fi
  if echo "$CMD_BLANKED" | grep -qE '(^|[[:space:]])(g?awk|mawk|nawk)([[:space:]]|$)'; then
    if echo "$CMD_BLANKED" | grep -qE 'system[[:space:]]*\(|\|[[:space:]]*&?[[:space:]]*"?(sh|bash)'; then
      echo "BLOCKED: awk program with 'system()' / shell pipe cannot be safely inspected. Ask user for explicit permission." >&2
      exit 2
    fi
  fi

  # --- Block piping to sh/bash (e.g. echo "rm -rf /" | sh) ---
  # Match bare shell invocations: sh, bash, /bin/sh, /bin/bash,
  # and with flags: sh -s, bash --login, etc.
  # But NOT: bash script.sh, bash -x script.sh (running a script file)
  if echo "$CMD" | grep -qE '^(/bin/)?(sh|bash)$'; then
    echo "BLOCKED: Piping to 'sh'/'bash' cannot be safely inspected. Ask user for explicit permission." >&2
    exit 2
  fi
  # Match shell with only flags (no script file): sh -s, bash --login, sh -s -- args
  if echo "$CMD" | grep -qE '^(/bin/)?(sh|bash)[[:space:]]+-'; then
    # Check if all args are flags (start with -), not a script path
    local shell_args
    shell_args=$(echo "$CMD" | sed -E 's/^(\/bin\/)?(sh|bash)[[:space:]]+//')
    local has_script=0
    for shell_token in $shell_args; do
      case "$shell_token" in
        --) break ;;  # everything after -- is args to the script/stdin
        -*) continue ;;
        *) has_script=1; break ;;
      esac
    done
    if [[ $has_script -eq 0 ]]; then
      echo "BLOCKED: Piping to 'sh'/'bash' cannot be safely inspected. Ask user for explicit permission." >&2
      exit 2
    fi
  fi

  # --- Block executing script files outside the project ---
  # Catches: `bash /tmp/x.sh`, `sh ~/x.sh`, `zsh|ksh|dash|fish /tmp/x.sh`,
  # `source /tmp/x.sh`, `. /tmp/x.sh`. Inline-code forms (`bash -c ...`)
  # are caught by the nested-shell block above; this covers the
  # complementary case where the script is a path argument.
  #
  # STRICT project-root check (no allowlist). Allowlist grants WRITE to
  # specific paths (e.g. memory/); if execute inherited that, a write-
  # allowlisted dir would become an RCE escape hatch:
  #   `echo 'rm -rf $HOME' > memory/x.sh && bash memory/x.sh`.
  # Walk CMD_TOKENS to locate the shell/source invocation, possibly buried
  # behind an `env [flags] [VAR=val]*` wrapper. Once found, scan for the
  # script-path operand — honoring flags that consume the next token
  # (-O / -o for bash set options). Finally, dereference symlinks on the
  # script path so a `project/link.sh -> /tmp/evil.sh` bait is caught.
  # Re-tokenize the command with redirect operators (< << <<< <<-) spaced
  # out so that attached forms like `bash</tmp/x.sh`, `bash<<EOF`, and
  # `bash<<<'rm -rf /'` don't slip past as single unsplit tokens.
  local _exec_cmd
  _exec_cmd=$(printf '%s' "$CMD" | sed -E 's/(<<-|<<<|<<|<)/ \1 /g')
  local -a CMD_TOKENS_EXEC=()
  while IFS= read -r _etok; do
    [[ -z "$_etok" ]] && continue
    CMD_TOKENS_EXEC+=("$_etok")
  done < <(tokenize_args "$_exec_cmd")

  # A parallel token stream built from a heredoc-blanked copy of CMD.
  # Used ONLY by the `_saw_redir`/`exec_kind` scans below, which otherwise
  # would treat a quoted-heredoc body byte like "bash" or "source" as a
  # shell token and false-positive with
  #   "Stdin redirection feeding shell cannot be safely inspected"
  # on perfectly innocuous text like a git-commit body mentioning `bash`.
  # Real shell-stdin attacks (`bash << /tmp/x`, `< /tmp/x bash`,
  # `bash <<'EOF' ... EOF`, `bash <<<'rm -rf /'`, attached `bash</tmp/x>`)
  # still appear in this stream because their shell token sits OUTSIDE
  # any heredoc body, so the fail-closed detectors keep firing.
  local _exec_cmd_scan
  _exec_cmd_scan=$(blank_quoted_heredoc_bodies "$CMD" \
                   | sed -E 's/(<<-|<<<|<<|<)/ \1 /g')
  local -a CMD_TOKENS_EXEC_SCAN=()
  while IFS= read -r _etok; do
    [[ -z "$_etok" ]] && continue
    CMD_TOKENS_EXEC_SCAN+=("$_etok")
  done < <(tokenize_args "$_exec_cmd_scan")

  local exec_kind="" exec_shell_idx=-1
  local _ti=0 _tn=${#CMD_TOKENS_EXEC[@]}

  # Fail-closed on ANY stdin redirect (< << <<< <<-) that appears before
  # a shell/source token — regardless of leading wrappers or VAR=val.
  # Bash allows redirections to sit anywhere in the command-prefix, so
  # `FOO=1 < /tmp/evil.sh bash`, `nice < /tmp/evil.sh bash`, and a bare
  # `< /tmp/evil.sh bash` all feed the shell from an uninspectable source.
  local _rk=0 _saw_redir=0
  local _tn_scan=${#CMD_TOKENS_EXEC_SCAN[@]}
  while [ $_rk -lt $_tn_scan ]; do
    local _rtok_chk
    _rtok_chk=$(strip_quotes "${CMD_TOKENS_EXEC_SCAN[$_rk]}")
    case "$_rtok_chk" in
      \<|\<\<|\<\<\<|\<\<-) _saw_redir=1 ;;
      *)
        if [ $_saw_redir -eq 1 ] && { is_shell_token "$_rtok_chk" || is_source_token "$_rtok_chk"; }; then
          echo "BLOCKED: Stdin redirection feeding shell cannot be safely inspected. Ask user for explicit permission." >&2
          exit 2
        fi
        ;;
    esac
    _rk=$((_rk + 1))
  done

  # Fail-closed on `env -S <str>`, `env --split-string=<str>`, `env -C <dir>`,
  # `env --chdir=<dir>`: all of these either hide the real command inside a
  # split string or change the cwd so relative script paths no longer match
  # what Bash actually executes.
  if [ $_tn -gt 0 ]; then
    local _env_first
    _env_first=$(strip_quotes "${CMD_TOKENS_EXEC[0]}")
    if [[ "$_env_first" == "env" || "$_env_first" == "/usr/bin/env" ]]; then
      local _envk=1
      while [ $_envk -lt $_tn ]; do
        local _envtok
        _envtok=$(strip_quotes "${CMD_TOKENS_EXEC[$_envk]}")
        case "$_envtok" in
          -S|-S*|--split-string|--split-string=*|-C|-C*|--chdir|--chdir=*)
            echo "BLOCKED: 'env -S/--split-string/-C/--chdir' cannot be safely inspected. Ask user for explicit permission." >&2
            exit 2 ;;
        esac
        _envk=$((_envk + 1))
      done
    fi
  fi

  # Walk past common runtime wrappers (env, command, nice, nohup, timeout,
  # time, stdbuf, ionice, chrt, taskset) and any leftover sudo flags
  # (sudo itself is already stripped at the top of check_single_command,
  # but its own short flags can remain in the token stream as `-E` etc.).
  # We only advance past token 0 when it is a recognized wrapper or looks
  # like a flag / VAR=val — this avoids false positives on invocations
  # like `echo bash`, where `bash` is an argument, not the command.
  # Categorize the leading token so we know how aggressively to skip.
  # "env_like" — env / leading flags / leading VAR=val. env has many flag
  #   and operand forms (-i, -u NAME, FOO=bar), so we skip greedily until
  #   a shell token appears.
  # "wrapper" — nice/nohup/timeout/time/command/stdbuf/ionice/chrt/taskset.
  #   These take at most a few flags + 0–1 positional (e.g. timeout's
  #   duration). First non-flag non-numeric token is the wrapper's command
  #   operand — stop there. Avoids false positives like
  #   `time echo bash /tmp/x` where `bash` is echo's arg, not a shell.
  # Greedy skip: walk past wrappers / flags / VAR=val / operands until
  # a shell or source token appears. Known tradeoff — this over-blocks
  # `time echo bash /tmp/x` (bash is an arg to echo, not a shell), but
  # precise per-wrapper operand grammars would miss real bypasses like
  # `timeout -s TERM 10 bash /tmp/x` and `stdbuf -o L bash /tmp/x` where
  # flag operands are non-numeric. Security over precision for this case.
  local _advance=0
  if [ $_tn -gt 0 ]; then
    local _t0
    _t0=$(strip_quotes "${CMD_TOKENS_EXEC[0]}")
    case "$_t0" in
      env|/usr/bin/env|command|builtin|exec|nice|nohup|timeout|time|stdbuf|ionice|chrt|taskset)
        _advance=1 ;;
      -*|+*) _advance=1 ;;
      *=*) _advance=1 ;;
    esac
  fi
  if [ $_advance -eq 1 ]; then
    _ti=1
    while [ $_ti -lt $_tn ]; do
      local _tok
      _tok=$(strip_quotes "${CMD_TOKENS_EXEC[$_ti]}")
      if is_shell_token "$_tok" || is_source_token "$_tok"; then
        break
      fi
      _ti=$((_ti + 1))
    done
  fi
  if [ $_ti -lt $_tn ]; then
    local _cmd_tok
    _cmd_tok=$(strip_quotes "${CMD_TOKENS_EXEC[$_ti]}")
    if is_shell_token "$_cmd_tok"; then
      exec_kind="shell"; exec_shell_idx=$_ti
    elif is_source_token "$_cmd_tok"; then
      exec_kind="source"; exec_shell_idx=$_ti
    fi
  fi
  if [ -n "$exec_kind" ]; then
    local exec_target=""
    local ei=$((exec_shell_idx + 1)) en=${#CMD_TOKENS_EXEC[@]}
    local seen_ddash=0
    while [ $ei -lt $en ]; do
      local etok
      etok=$(strip_quotes "${CMD_TOKENS_EXEC[$ei]}")
      if [ $seen_ddash -eq 0 ]; then
        case "$etok" in
          --) seen_ddash=1; ei=$((ei + 1)); continue ;;
          # bash/sh -O/+O and -o/+o take the next token as operand
          -O|+O|-o|+o) ei=$((ei + 2)); continue ;;
          # Bash accepts both `-x` (enable) and `+x` (disable) forms
          -*|+*|'') ei=$((ei + 1)); continue ;;
          # fd prefix for a redirect operator (e.g. `bash 0<file`, `bash 2>&1`).
          # Skip — the operator itself is handled on the next iteration.
          [0-9]|[0-9][0-9])
            ei=$((ei + 1)); continue ;;
          # Stdin redirection variants: bash executes whatever is piped in.
          # `<< EOF` / `<<< "str"` content can't be inspected — fail closed.
          # `< file` — validate `file` as exec target (treat next token as script).
          \<\<|\<\<-|\<\<\<)
            echo "BLOCKED: Shell invoked with heredoc/here-string (<<, <<-, <<<) cannot be safely inspected. Ask user for explicit permission." >&2
            exit 2 ;;
          \<)
            ei=$((ei + 1))
            if [ $ei -lt $en ]; then
              local _next_tok
              _next_tok=$(strip_quotes "${CMD_TOKENS_EXEC[$ei]}")
              # `bash < <(cmd)` — process substitution on stdin is a hidden
              # command source. Fail closed.
              case "$_next_tok" in
                \<|\<\(*|\(*|\&*)
                  # `< <(cmd)` process substitution, `<(...)` direct, or
                  # `<&N` fd duplicate — all uninspectable sources.
                  echo "BLOCKED: Shell stdin from process substitution / fd duplicate cannot be safely inspected. Ask user for explicit permission." >&2
                  exit 2 ;;
                *)
                  exec_target="$_next_tok" ;;
              esac
            fi
            break ;;
        esac
      fi
      exec_target="$etok"
      break
    done
    if [ -n "$exec_target" ]; then
      exec_target=$(expand_path "$exec_target")
      if [[ "$exec_target" != /* ]]; then
        exec_target="$EFFECTIVE_CWD/$exec_target"
      fi
      local exec_resolved
      exec_resolved=$(resolve_path "$exec_target")
      # Dereference symlinks on the leaf — bash follows them at exec time,
      # so a project-local symlink pointing outside must be caught.
      local _exec_depth=20
      while [[ -L "$exec_resolved" && $_exec_depth -gt 0 ]]; do
        local _exec_link
        _exec_link=$(readlink "$exec_resolved")
        if [[ "$_exec_link" == /* ]]; then
          exec_resolved=$(resolve_path "$_exec_link")
        else
          exec_resolved=$(resolve_path "$(dirname "$exec_resolved")/$_exec_link")
        fi
        _exec_depth=$((_exec_depth - 1))
      done
      if [[ -L "$exec_resolved" ]]; then
        echo "BLOCKED: Script symlink chain too deep or circular at '$exec_resolved'. Ask user for explicit permission." >&2
        exit 2
      fi
      if [[ "$exec_resolved/" != "$PROJECT_DIR/"* ]]; then
        echo "BLOCKED: Executing script '$exec_resolved' is OUTSIDE project directory '$PROJECT_DIR'. Allowlist does not cover execute. Ask user for explicit permission." >&2
        exit 2
      fi
    fi
  fi

  # xargs, find-delete, rm, mv, cp, ln moved to hooks/lib/detectors/destructive.sh.
  run_destructive_detectors


  # install, rsync, tar, unzip, cpio, tee, curl, wget, dd, redirect
  # moved to hooks/lib/detectors/write_targets.sh.
  run_write_target_detectors


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
