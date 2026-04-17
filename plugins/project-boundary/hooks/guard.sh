#!/bin/bash
set -euo pipefail

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

# --- Portable realpath in pure bash ---
# macOS realpath does not support -m (non-existent path resolution).
# This pure-bash implementation handles .., . and works with non-existent paths.
# For non-existent paths, it resolves the nearest existing ancestor via pwd -P
# to handle symlinks (e.g. /var -> /private/var on macOS).
resolve_path() {
  local p="$1"
  # Make absolute
  if [[ "$p" != /* ]]; then
    p="$(pwd)/$p"
  fi
  # Normalize: resolve . and .. segments
  local -a parts=()
  local IFS='/'
  for segment in $p; do
    if [[ "$segment" == ".." ]]; then
      [[ ${#parts[@]} -gt 0 ]] && unset 'parts[${#parts[@]}-1]'
    elif [[ "$segment" != "." && -n "$segment" ]]; then
      parts+=("$segment")
    fi
  done
  local IFS='/'
  local normalized
  if [[ ${#parts[@]} -eq 0 ]]; then
    normalized="/"
  else
    normalized="/${parts[*]}"
  fi
  # Walk up to find the nearest existing ancestor directory and resolve symlinks
  local check="$normalized"
  local tail=""
  while [[ ! -e "$check" && "$check" != "/" ]]; do
    tail="/$(basename "$check")$tail"
    check="$(dirname "$check")"
  done
  if [[ -d "$check" ]]; then
    local real_ancestor
    real_ancestor=$(cd "$check" && pwd -P)
    echo "${real_ancestor}${tail}"
  else
    echo "$normalized"
  fi
}

# Resolve PROJECT_DIR itself so symlinks (e.g. /var -> /private/var on macOS) match
PROJECT_DIR=$(resolve_path "$PROJECT_DIR")

# Check if the effective working directory is outside the project
EFFECTIVE_CWD_RESOLVED=$(resolve_path "$EFFECTIVE_CWD")
CWD_OUTSIDE_PROJECT=0
if [[ "$EFFECTIVE_CWD_RESOLVED/" != "$PROJECT_DIR/"* ]]; then
  CWD_OUTSIDE_PROJECT=1
fi

# --- Strip one layer of surrounding quotes (single or double) ---
# Used before matching option flags like `-o` / `--output` against tokens,
# since tokenize_args preserves quotes: `curl "-o" file` → token `"-o"`.
strip_quotes() {
  local p="$1"
  if [[ "$p" == \"*\" ]]; then
    p="${p#\"}"
    p="${p%\"}"
  elif [[ "$p" == \'*\' ]]; then
    p="${p#\'}"
    p="${p%\'}"
  fi
  echo "$p"
}

# --- Expand ~ and $HOME in a command argument ---
expand_path() {
  local p="$1"
  # Remove surrounding quotes (single or double)
  p="${p%\"}"
  p="${p#\"}"
  p="${p%\'}"
  p="${p#\'}"
  # Expand ~ at start
  if [[ "$p" == "~/"* ]]; then
    p="$HOME/${p#\~/}"
  elif [[ "$p" == "~" ]]; then
    p="$HOME"
  fi
  # Expand $HOME
  p="${p/\$HOME/$HOME}"
  # Expand ${HOME}
  p="${p/\$\{HOME\}/$HOME}"
  echo "$p"
}

# --- Quote-aware argument tokenizer ---
# Splits a string into tokens respecting single and double quotes.
# Tokens are newline-separated on stdout with quotes preserved (expand_path strips them).
tokenize_args() {
  local input="$1"
  local -a tokens=()
  local current=""
  local in_sq=0 in_dq=0
  local i=0 len=${#input}

  while [ $i -lt $len ]; do
    local ch="${input:$i:1}"

    if [ "$ch" = "'" ] && [ $in_dq -eq 0 ]; then
      in_sq=$(( 1 - in_sq ))
      current="${current}${ch}"
    elif [ "$ch" = '"' ] && [ $in_sq -eq 0 ]; then
      in_dq=$(( 1 - in_dq ))
      current="${current}${ch}"
    elif { [ "$ch" = ' ' ] || [ "$ch" = $'\t' ]; } && [ $in_sq -eq 0 ] && [ $in_dq -eq 0 ]; then
      if [ -n "$current" ]; then
        tokens+=("$current")
        current=""
      fi
    else
      current="${current}${ch}"
    fi
    i=$((i + 1))
  done

  if [ -n "$current" ]; then
    tokens+=("$current")
  fi

  for t in "${tokens[@]}"; do
    echo "$t"
  done
}

# --- Extract all option values from CMD_TOKENS ---
# Usage: extract_option_values <short> <long>
#   short: e.g. "-o", or "" to skip
#   long:  e.g. "--output", or "" to skip
# Supports: "-o value", "--output value", "--output=value".
# Option flags are matched after stripping surrounding quotes so that
# `curl "-o" /etc/passwd` also matches.
# Returns EVERY occurrence (one per line) so callers can validate each one.
# This is fail-closed and handles both "last-wins" tools (tar, cp/mv)
# and positional tools (curl -o applies to each URL) — if any single
# occurrence is outside the project boundary, we block.
# Returns 0 if at least one found, 1 otherwise.
extract_option_values() {
  local short="$1"
  local long="$2"
  local i=0 n=${#CMD_TOKENS[@]}
  local found=1
  while [ $i -lt $n ]; do
    local raw_tok="${CMD_TOKENS[$i]}"
    local tok
    tok=$(strip_quotes "$raw_tok")
    if [ -n "$short" ] && [ "$tok" = "$short" ] && [ $((i + 1)) -lt $n ]; then
      printf '%s\n' "${CMD_TOKENS[$((i + 1))]}"
      found=0
    fi
    if [ -n "$long" ]; then
      if [ "$tok" = "$long" ] && [ $((i + 1)) -lt $n ]; then
        printf '%s\n' "${CMD_TOKENS[$((i + 1))]}"
        found=0
      fi
      if [[ "$tok" == "${long}="* ]]; then
        printf '%s\n' "${tok#${long}=}"
        found=0
      fi
    fi
    i=$((i + 1))
  done
  return $found
}

# --- Check if a resolved path is inside the project directory ---
is_inside_project() {
  local resolved="$1"
  # Add trailing slash to both sides so /tmp/project-other doesn't match /tmp/project
  if [[ "$resolved/" == "$PROJECT_DIR/"* ]]; then
    return 0
  fi
  return 1
}

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
  if ! is_inside_project "$RESOLVED"; then
    echo "BLOCKED: File '$RESOLVED' is OUTSIDE project directory '$PROJECT_DIR'. Ask user for explicit permission." >&2
    exit 2
  fi
  exit 0
fi

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

  # --- Tokenize the command once (quote-aware) for option/redirect parsing ---
  local -a CMD_TOKENS=()
  while IFS= read -r tok; do
    [[ -z "$tok" ]] && continue
    CMD_TOKENS+=("$tok")
  done < <(tokenize_args "$CMD")

  # --- Block command substitution outside single quotes ---
  # `$(...)` and backticks are expanded by bash (even inside double quotes),
  # so the guard cannot know the final target. Single quotes keep them literal,
  # so only block when they appear outside single quotes. Arithmetic expansion
  # `$((...))` is allowed — it's a numeric computation, not a command.
  # Similar rationale to blocking `bash -c` / `eval` — the inner command is
  # uninspectable.
  local ci=0 clen=${#CMD}
  local cin_sq=0 cin_dq=0 cin_esc=0
  while [ $ci -lt $clen ]; do
    local cc="${CMD:$ci:1}"
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
      if [ "$cc" = "\$" ] && [ $((ci + 1)) -lt $clen ] && [ "${CMD:$((ci + 1)):1}" = "(" ]; then
        # Skip arithmetic expansion $((...)): next-next char is also (
        if [ $((ci + 2)) -ge $clen ] || [ "${CMD:$((ci + 2)):1}" != "(" ]; then
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
    if ! is_inside_project "$resolved_cd"; then
      export _GUARD_CD_OUTSIDE=1
      CWD_OUTSIDE_PROJECT=1
    else
      export _GUARD_CD_OUTSIDE=0
      CWD_OUTSIDE_PROJECT=0
    fi
    return 0
  fi

  # Block destructive commands when running outside the project
  # (either via cd in a chained command, or via cwd from the hook event)
  local outside_context=0
  if [[ "${_GUARD_CD_OUTSIDE:-0}" == "1" || "$CWD_OUTSIDE_PROJECT" == "1" ]]; then
    outside_context=1
  fi

  if [[ "$outside_context" == "1" ]]; then
    local destructive_cmds="rm|mv|cp|ln|chmod|chown|tee|find|curl|wget"
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
    shell_args=$(echo "$CMD" | sed -E 's|^(/bin/)?(sh\|bash)[[:space:]]+||')
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

  # --- xargs with dangerous commands ---
  if echo "$CMD" | grep -qE '(^|[[:space:]])xargs($|[[:space:]])'; then
    # Check if xargs is followed by a dangerous command
    local xargs_cmd
    xargs_cmd=$(echo "$CMD" | sed -E 's/.*xargs[[:space:]]+((-[^ ]*[[:space:]]+)*)//' | awk '{print $1}')
    case "$xargs_cmd" in
      rm|mv|cp|chmod|chown|tee|ln)
        echo "BLOCKED: 'xargs $xargs_cmd' is blocked because xargs arguments cannot be validated. Ask user for explicit permission." >&2
        exit 2
        ;;
    esac
  fi

  # --- find with -delete or -exec rm/mv outside project ---
  if echo "$CMD" | grep -qE '(^|[[:space:]])find($|[[:space:]])'; then
    if echo "$CMD" | grep -qE '(-delete|-exec[[:space:]]+(rm|mv))'; then
      # Extract ALL find paths (non-option arguments after 'find')
      # Skip options like -L, -H, -P that come before the paths
      local -a find_paths=()
      local find_args
      find_args=$(echo "$CMD" | sed -E 's/.*find[[:space:]]+//')
      local past_options=0
      while IFS= read -r find_token; do
        [[ -z "$find_token" ]] && continue
        case "$find_token" in
          -L|-H|-P|-O*)
            [[ $past_options -eq 0 ]] && continue
            break ;;  # expression starts
          -*)  break ;;  # expression starts
          *)
            past_options=1
            find_paths+=("$find_token") ;;
        esac
      done < <(tokenize_args "$find_args")
      [[ ${#find_paths[@]} -eq 0 ]] && find_paths=(".")
      for find_path in "${find_paths[@]}"; do
        find_path=$(expand_path "$find_path")
        if [[ "$find_path" != /* ]]; then
          find_path="$EFFECTIVE_CWD/$find_path"
        fi
        local resolved_find
        resolved_find=$(resolve_path "$find_path")
        if ! is_inside_project "$resolved_find"; then
          echo "BLOCKED: 'find' with destructive action targets '$resolved_find' which is OUTSIDE project directory '$PROJECT_DIR'. Ask user for explicit permission." >&2
          exit 2
        fi
      done
    fi
  fi

  # --- File deletion: allowed inside project, blocked outside ---
  if echo "$CMD" | grep -qE '(^|[[:space:]])rm($|[[:space:]])'; then
    # Extract paths from rm command (skip flags)
    local rm_raw
    rm_raw=$(echo "$CMD" | grep -oE '(^|[[:space:]])rm[[:space:]]+.*' | sed 's/^[[:space:]]*rm[[:space:]]*//')

    while IFS= read -r TARGET; do
      [[ -z "$TARGET" || "$TARGET" == -* ]] && continue
      TARGET=$(expand_path "$TARGET")
      # Resolve to absolute path
      if [[ "$TARGET" != /* ]]; then
        TARGET="$EFFECTIVE_CWD/$TARGET"
      fi
      RESOLVED=$(resolve_path "$TARGET")

      if ! is_inside_project "$RESOLVED"; then
        echo "BLOCKED: 'rm' targets '$RESOLVED' which is OUTSIDE project directory '$PROJECT_DIR'. File deletion is only allowed within the project. Ask user for explicit permission." >&2
        exit 2
      fi

      # Block deleting the project root itself
      if [[ "$RESOLVED" == "$PROJECT_DIR" ]]; then
        echo "BLOCKED: Cannot delete the project root directory itself." >&2
        exit 2
      fi
    done < <(tokenize_args "$rm_raw")
  fi

  # --- Moving files outside project ---
  if echo "$CMD" | grep -qE '(^|[[:space:]])mv($|[[:space:]])'; then
    # Check -t / --target-directory
    while IFS= read -r mv_target_dir; do
      [ -z "$mv_target_dir" ] && continue
      mv_target_dir=$(expand_path "$mv_target_dir")
      [[ "$mv_target_dir" != /* ]] && mv_target_dir="$EFFECTIVE_CWD/$mv_target_dir"
      local resolved_mv_td
      resolved_mv_td=$(resolve_path "$mv_target_dir")
      if ! is_inside_project "$resolved_mv_td"; then
        echo "BLOCKED: 'mv --target-directory' targets '$resolved_mv_td' which is OUTSIDE project directory '$PROJECT_DIR'. Ask user for explicit permission." >&2
        exit 2
      fi
    done < <(extract_option_values "-t" "--target-directory" || true)
    local mv_raw
    mv_raw=$(echo "$CMD" | grep -oE '(^|[[:space:]])mv[[:space:]]+.*' | sed 's/^[[:space:]]*mv[[:space:]]*//')

    while IFS= read -r TARGET; do
      [[ -z "$TARGET" || "$TARGET" == -* ]] && continue
      TARGET=$(expand_path "$TARGET")
      if [[ "$TARGET" != /* ]]; then
        TARGET="$EFFECTIVE_CWD/$TARGET"
      fi
      RESOLVED=$(resolve_path "$TARGET")

      if ! is_inside_project "$RESOLVED"; then
        echo "BLOCKED: 'mv' argument '$RESOLVED' is OUTSIDE project directory '$PROJECT_DIR'. Ask user for explicit permission." >&2
        exit 2
      fi
    done < <(tokenize_args "$mv_raw")
  fi

  # --- cp command: check all non-flag arguments ---
  if echo "$CMD" | grep -qE '(^|[[:space:]])cp($|[[:space:]])'; then
    # Check -t / --target-directory
    while IFS= read -r cp_target_dir; do
      [ -z "$cp_target_dir" ] && continue
      cp_target_dir=$(expand_path "$cp_target_dir")
      [[ "$cp_target_dir" != /* ]] && cp_target_dir="$EFFECTIVE_CWD/$cp_target_dir"
      local resolved_cp_td
      resolved_cp_td=$(resolve_path "$cp_target_dir")
      if ! is_inside_project "$resolved_cp_td"; then
        echo "BLOCKED: 'cp --target-directory' targets '$resolved_cp_td' which is OUTSIDE project directory '$PROJECT_DIR'. Ask user for explicit permission." >&2
        exit 2
      fi
    done < <(extract_option_values "-t" "--target-directory" || true)
    local cp_raw
    cp_raw=$(echo "$CMD" | grep -oE '(^|[[:space:]])cp[[:space:]]+.*' | sed 's/^[[:space:]]*cp[[:space:]]*//')

    while IFS= read -r TARGET; do
      [[ -z "$TARGET" || "$TARGET" == -* ]] && continue
      TARGET=$(expand_path "$TARGET")
      if [[ "$TARGET" != /* ]]; then
        TARGET="$EFFECTIVE_CWD/$TARGET"
      fi
      RESOLVED=$(resolve_path "$TARGET")

      if ! is_inside_project "$RESOLVED"; then
        echo "BLOCKED: 'cp' argument '$RESOLVED' is OUTSIDE project directory '$PROJECT_DIR'. Ask user for explicit permission." >&2
        exit 2
      fi
    done < <(tokenize_args "$cp_raw")
  fi

  # --- ln command: check all non-flag arguments ---
  if echo "$CMD" | grep -qE '(^|[[:space:]])ln($|[[:space:]])'; then
    local ln_raw
    ln_raw=$(echo "$CMD" | grep -oE '(^|[[:space:]])ln[[:space:]]+.*' | sed 's/^[[:space:]]*ln[[:space:]]*//')

    while IFS= read -r TARGET; do
      [[ -z "$TARGET" || "$TARGET" == -* ]] && continue
      TARGET=$(expand_path "$TARGET")
      if [[ "$TARGET" != /* ]]; then
        TARGET="$EFFECTIVE_CWD/$TARGET"
      fi
      RESOLVED=$(resolve_path "$TARGET")

      if ! is_inside_project "$RESOLVED"; then
        echo "BLOCKED: 'ln' argument '$RESOLVED' is OUTSIDE project directory '$PROJECT_DIR'. Ask user for explicit permission." >&2
        exit 2
      fi
    done < <(tokenize_args "$ln_raw")
  fi

  # --- install command: like cp, check all non-flag path arguments ---
  if echo "$CMD" | grep -qE '(^|[[:space:]])install($|[[:space:]])'; then
    local install_raw
    install_raw=$(echo "$CMD" | grep -oE '(^|[[:space:]])install[[:space:]]+.*' | sed 's/^[[:space:]]*install[[:space:]]*//')
    # Skip mode arg (numeric, after -m/--mode), owner arg (after -o), group (after -g)
    while IFS= read -r TARGET; do
      [[ -z "$TARGET" || "$TARGET" == -* ]] && continue
      # Skip pure numeric (mode) or user:group patterns
      if [[ "$TARGET" =~ ^[0-9]+$ ]] || [[ "$TARGET" =~ ^[a-zA-Z_][a-zA-Z0-9_]*(:[a-zA-Z_][a-zA-Z0-9_]*)?$ ]]; then
        continue
      fi
      TARGET=$(expand_path "$TARGET")
      if [[ "$TARGET" != /* ]]; then
        TARGET="$EFFECTIVE_CWD/$TARGET"
      fi
      RESOLVED=$(resolve_path "$TARGET")
      if ! is_inside_project "$RESOLVED"; then
        echo "BLOCKED: 'install' argument '$RESOLVED' is OUTSIDE project directory '$PROJECT_DIR'. Ask user for explicit permission." >&2
        exit 2
      fi
    done < <(tokenize_args "$install_raw")
  fi

  # --- rsync command: check all non-flag path arguments ---
  if echo "$CMD" | grep -qE '(^|[[:space:]])rsync($|[[:space:]])'; then
    local rsync_raw
    rsync_raw=$(echo "$CMD" | grep -oE '(^|[[:space:]])rsync[[:space:]]+.*' | sed 's/^[[:space:]]*rsync[[:space:]]*//')
    while IFS= read -r TARGET; do
      [[ -z "$TARGET" || "$TARGET" == -* ]] && continue
      # Skip remote paths (user@host:/path or host:/path)
      if [[ "$TARGET" =~ : ]]; then
        continue
      fi
      TARGET=$(expand_path "$TARGET")
      if [[ "$TARGET" != /* ]]; then
        TARGET="$EFFECTIVE_CWD/$TARGET"
      fi
      RESOLVED=$(resolve_path "$TARGET")
      if ! is_inside_project "$RESOLVED"; then
        echo "BLOCKED: 'rsync' argument '$RESOLVED' is OUTSIDE project directory '$PROJECT_DIR'. Ask user for explicit permission." >&2
        exit 2
      fi
    done < <(tokenize_args "$rsync_raw")
  fi

  # --- tar: check every -C / --directory=PATH for extraction ---
  # tar allows multiple -C switches and the *last* one wins, so we must
  # validate every occurrence — not just the first.
  if echo "$CMD" | grep -qE '(^|[[:space:]])tar($|[[:space:]])'; then
    local ti=0 tn=${#CMD_TOKENS[@]}
    while [ $ti -lt $tn ]; do
      local ttok
      ttok=$(strip_quotes "${CMD_TOKENS[$ti]}")
      local tar_dir=""
      if [ "$ttok" = "-C" ] || [ "$ttok" = "--directory" ]; then
        if [ $((ti + 1)) -lt $tn ]; then
          tar_dir="${CMD_TOKENS[$((ti + 1))]}"
          ti=$((ti + 2))
        else
          ti=$((ti + 1))
        fi
      elif [[ "$ttok" == "--directory="* ]]; then
        tar_dir="${ttok#--directory=}"
        ti=$((ti + 1))
      else
        ti=$((ti + 1))
        continue
      fi
      if [ -n "$tar_dir" ]; then
        tar_dir=$(expand_path "$tar_dir")
        if [[ "$tar_dir" != /* ]]; then
          tar_dir="$EFFECTIVE_CWD/$tar_dir"
        fi
        local resolved_tar
        resolved_tar=$(resolve_path "$tar_dir")
        if ! is_inside_project "$resolved_tar"; then
          echo "BLOCKED: 'tar -C' targets '$resolved_tar' which is OUTSIDE project directory '$PROJECT_DIR'. Ask user for explicit permission." >&2
          exit 2
        fi
      fi
    done
  fi

  # --- unzip -d PATH ---
  if echo "$CMD" | grep -qE '(^|[[:space:]])unzip($|[[:space:]])'; then
    while IFS= read -r unzip_dir; do
      [ -z "$unzip_dir" ] && continue
      unzip_dir=$(expand_path "$unzip_dir")
      if [[ "$unzip_dir" != /* ]]; then
        unzip_dir="$EFFECTIVE_CWD/$unzip_dir"
      fi
      local resolved_unzip
      resolved_unzip=$(resolve_path "$unzip_dir")
      if ! is_inside_project "$resolved_unzip"; then
        echo "BLOCKED: 'unzip -d' targets '$resolved_unzip' which is OUTSIDE project directory '$PROJECT_DIR'. Ask user for explicit permission." >&2
        exit 2
      fi
    done < <(extract_option_values "-d" "" || true)
  fi

  # --- cpio -D PATH ---
  if echo "$CMD" | grep -qE '(^|[[:space:]])cpio($|[[:space:]])'; then
    while IFS= read -r cpio_dir; do
      [ -z "$cpio_dir" ] && continue
      cpio_dir=$(expand_path "$cpio_dir")
      if [[ "$cpio_dir" != /* ]]; then
        cpio_dir="$EFFECTIVE_CWD/$cpio_dir"
      fi
      local resolved_cpio
      resolved_cpio=$(resolve_path "$cpio_dir")
      if ! is_inside_project "$resolved_cpio"; then
        echo "BLOCKED: 'cpio -D' targets '$resolved_cpio' which is OUTSIDE project directory '$PROJECT_DIR'. Ask user for explicit permission." >&2
        exit 2
      fi
    done < <(extract_option_values "-D" "" || true)
  fi

  # --- tee command: extract file arguments, block if outside project ---
  if echo "$CMD" | grep -qE '(^|[[:space:]])tee($|[[:space:]])'; then
    local tee_raw
    tee_raw=$(echo "$CMD" | grep -oE '(^|[[:space:]])tee[[:space:]]+.*' | sed 's/^[[:space:]]*tee[[:space:]]*//')

    while IFS= read -r TARGET; do
      [[ -z "$TARGET" || "$TARGET" == -* ]] && continue
      TARGET=$(expand_path "$TARGET")
      if [[ "$TARGET" != /* ]]; then
        TARGET="$EFFECTIVE_CWD/$TARGET"
      fi
      RESOLVED=$(resolve_path "$TARGET")

      if ! is_inside_project "$RESOLVED"; then
        echo "BLOCKED: 'tee' targets '$RESOLVED' which is OUTSIDE project directory '$PROJECT_DIR'. Ask user for explicit permission." >&2
        exit 2
      fi
    done < <(tokenize_args "$tee_raw")
  fi

  # --- curl -o / curl --output outside project ---
  # curl -o is positional: `curl -o out1 URL1 -o out2 URL2` writes each URL
  # to its corresponding output. Validate EVERY occurrence.
  if echo "$CMD" | grep -qE '(^|[[:space:]])curl($|[[:space:]])'; then
    while IFS= read -r curl_output; do
      [ -z "$curl_output" ] && continue
      curl_output=$(expand_path "$curl_output")
      if [[ "$curl_output" != /* ]]; then
        curl_output="$EFFECTIVE_CWD/$curl_output"
      fi
      local resolved_curl
      resolved_curl=$(resolve_path "$curl_output")
      if ! is_inside_project "$resolved_curl"; then
        echo "BLOCKED: 'curl' output file '$resolved_curl' is OUTSIDE project directory '$PROJECT_DIR'. Ask user for explicit permission." >&2
        exit 2
      fi
    done < <(extract_option_values "-o" "--output" || true)
  fi

  # --- wget -O / wget --output-document outside project ---
  if echo "$CMD" | grep -qE '(^|[[:space:]])wget($|[[:space:]])'; then
    while IFS= read -r wget_output; do
      [ -z "$wget_output" ] && continue
      wget_output=$(expand_path "$wget_output")
      if [[ "$wget_output" != /* ]]; then
        wget_output="$EFFECTIVE_CWD/$wget_output"
      fi
      local resolved_wget
      resolved_wget=$(resolve_path "$wget_output")
      if ! is_inside_project "$resolved_wget"; then
        echo "BLOCKED: 'wget' output file '$resolved_wget' is OUTSIDE project directory '$PROJECT_DIR'. Ask user for explicit permission." >&2
        exit 2
      fi
    done < <(extract_option_values "-O" "--output-document" || true)
  fi

  # --- dd of= outside project ---
  # dd accepts repeated key=value operands and the last one wins, so we must
  # validate every of= occurrence — not just the first.
  if echo "$CMD" | grep -qE '(^|[[:space:]])dd($|[[:space:]])'; then
    for raw_tok in "${CMD_TOKENS[@]}"; do
      local tok
      tok=$(strip_quotes "$raw_tok")
      if [[ "$tok" == of=* ]]; then
        local dd_output="${tok#of=}"
        if [ -n "$dd_output" ]; then
          dd_output=$(expand_path "$dd_output")
          if [[ "$dd_output" != /* ]]; then
            dd_output="$EFFECTIVE_CWD/$dd_output"
          fi
          local resolved_dd
          resolved_dd=$(resolve_path "$dd_output")
          if ! is_inside_project "$resolved_dd"; then
            echo "BLOCKED: 'dd' output '$resolved_dd' is OUTSIDE project directory '$PROJECT_DIR'. Ask user for explicit permission." >&2
            exit 2
          fi
        fi
      fi
    done
  fi

  # --- Writing to files outside project via redirection ---
  # Walk tokens and scan each one for an unquoted > operator anywhere
  # (not just at the start). This catches both separated forms (`> file`,
  # `2>> file`) and attached forms (`>file`, `x>file`, `"a">file`).
  # Skips fd-to-fd redirects like 2>&1 (target starts with &).
  local ri=0 rn=${#CMD_TOKENS[@]}
  while [ $ri -lt $rn ]; do
    local rtok="${CMD_TOKENS[$ri]}"
    local REDIR_TARGET=""

    # Scan the token for an unquoted > (respecting ' and " quotes and
    # backslash escapes). `\>` outside single quotes is a literal >, not
    # a redirect operator.
    local j=0 tlen=${#rtok}
    local tin_sq=0 tin_dq=0
    local tin_esc=0
    local redir_pos=-1
    while [ $j -lt $tlen ]; do
      local tc="${rtok:$j:1}"
      if [ $tin_esc -eq 1 ]; then
        tin_esc=0
        j=$((j + 1))
        continue
      fi
      if [ "$tc" = "\\" ] && [ $tin_sq -eq 0 ]; then
        tin_esc=1
        j=$((j + 1))
        continue
      fi
      if [ "$tc" = "'" ] && [ $tin_dq -eq 0 ]; then
        tin_sq=$(( 1 - tin_sq ))
      elif [ "$tc" = '"' ] && [ $tin_sq -eq 0 ]; then
        tin_dq=$(( 1 - tin_dq ))
      elif [ "$tc" = ">" ] && [ $tin_sq -eq 0 ] && [ $tin_dq -eq 0 ]; then
        redir_pos=$j
        break
      fi
      j=$((j + 1))
    done

    if [ $redir_pos -lt 0 ]; then
      ri=$((ri + 1))
      continue
    fi

    # Found > at redir_pos. Extend past a second > if present (>>).
    local op_end=$((redir_pos + 1))
    if [ $op_end -lt $tlen ] && [ "${rtok:$op_end:1}" = ">" ]; then
      op_end=$((op_end + 1))
    fi
    # Also consume a trailing | (Bash clobber operator: >| or >>|).
    if [ $op_end -lt $tlen ] && [ "${rtok:$op_end:1}" = "|" ]; then
      op_end=$((op_end + 1))
    fi

    # Extract target: rest of token if any, otherwise next token
    local rest="${rtok:$op_end}"
    if [ -z "$rest" ]; then
      if [ $((ri + 1)) -lt $rn ]; then
        REDIR_TARGET="${CMD_TOKENS[$((ri + 1))]}"
        ri=$((ri + 2))
      else
        ri=$((ri + 1))
      fi
    elif [[ "$rest" == \&* ]]; then
      # fd-to-fd redirect like 2>&1, no file target
      ri=$((ri + 1))
    else
      REDIR_TARGET="$rest"
      ri=$((ri + 1))
    fi

    if [ -n "$REDIR_TARGET" ]; then
      # Block process substitution — `> >(cmd)` runs `cmd` which the guard
      # cannot safely inspect, similar to nested shells.
      if [[ "$REDIR_TARGET" == \(* ]] || [[ "$REDIR_TARGET" == \>\(* ]] || [[ "$REDIR_TARGET" == \<\(* ]]; then
        echo "BLOCKED: Process substitution redirect '$REDIR_TARGET' cannot be safely inspected. Ask user for explicit permission." >&2
        exit 2
      fi
      REDIR_TARGET=$(expand_path "$REDIR_TARGET")
      if [[ "$REDIR_TARGET" != /* ]]; then
        REDIR_TARGET="$EFFECTIVE_CWD/$REDIR_TARGET"
      fi
      local resolved_redir
      resolved_redir=$(resolve_path "$REDIR_TARGET")
      if ! is_inside_project "$resolved_redir"; then
        echo "BLOCKED: Redirect target '$resolved_redir' is OUTSIDE project directory '$PROJECT_DIR'. Ask user for explicit permission." >&2
        exit 2
      fi
    fi
  done

  # --- Chmod/chown outside project ---
  for CMD_NAME in chmod chown; do
    if echo "$CMD" | grep -qE "(^|[[:space:]])${CMD_NAME}($|[[:space:]])"; then
      # Extract args after command name, skip flags, then skip the first
      # non-flag token (mode for chmod, owner[:group] for chown)
      local perm_raw
      perm_raw=$(echo "$CMD" | grep -oE "(^|[[:space:]])${CMD_NAME}[[:space:]]+.*" | sed "s/^[[:space:]]*${CMD_NAME}[[:space:]]*//")
      local skipped_first=0

      while IFS= read -r TARGET; do
        [[ -z "$TARGET" || "$TARGET" == -* ]] && continue
        if [[ $skipped_first -eq 0 ]]; then
          skipped_first=1
          continue
        fi
        TARGET=$(expand_path "$TARGET")
        if [[ "$TARGET" != /* ]]; then
          TARGET="$EFFECTIVE_CWD/$TARGET"
        fi
        RESOLVED=$(resolve_path "$TARGET")

        if ! is_inside_project "$RESOLVED"; then
          echo "BLOCKED: '${CMD_NAME}' targets '$RESOLVED' which is OUTSIDE project directory. Ask user for explicit permission." >&2
          exit 2
        fi
      done < <(tokenize_args "$perm_raw")
    fi
  done
}

# --- Split command into sub-commands and check each ---
# Split on ;, &&, ||, and | (but not inside quoted strings)
# This is a basic splitter that handles common cases.
split_and_check() {
  local full_cmd="$1"
  export _GUARD_CD_OUTSIDE=0
  local -a subcmds=()
  local current=""
  local in_single_quote=0
  local in_double_quote=0
  local i=0
  local len=${#full_cmd}
  local ch prev_ch=""

  while [ $i -lt $len ]; do
    ch="${full_cmd:$i:1}"

    # Handle quotes
    if [ "$ch" = "'" ] && [ $in_double_quote -eq 0 ]; then
      if [ $in_single_quote -eq 0 ]; then
        in_single_quote=1
      else
        in_single_quote=0
      fi
      current="${current}${ch}"
      prev_ch="$ch"
      i=$((i + 1))
      continue
    fi

    if [ "$ch" = '"' ] && [ $in_single_quote -eq 0 ]; then
      if [ $in_double_quote -eq 0 ]; then
        in_double_quote=1
      else
        in_double_quote=0
      fi
      current="${current}${ch}"
      prev_ch="$ch"
      i=$((i + 1))
      continue
    fi

    # Only split when not inside quotes
    if [ $in_single_quote -eq 0 ] && [ $in_double_quote -eq 0 ]; then
      # Check for && or ||
      if [ $i -lt $((len - 1)) ]; then
        local two_char="${full_cmd:$i:2}"
        if [ "$two_char" = "&&" ] || [ "$two_char" = "||" ]; then
          subcmds+=("$current")
          current=""
          i=$((i + 2))
          prev_ch=""
          continue
        fi
      fi

      # Check for ;
      if [ "$ch" = ";" ]; then
        subcmds+=("$current")
        current=""
        prev_ch="$ch"
        i=$((i + 1))
        continue
      fi

      # Check for | — but not if it's part of the Bash clobber operator >| or >>|
      if [ "$ch" = "|" ]; then
        # Look at the trailing chars of current (trimmed) to detect > or >>
        local trimmed="${current%"${current##*[![:space:]]}"}"
        if [[ "$trimmed" == *\> ]]; then
          # Part of >| or >>| — keep it as a redirect operator, not a pipe
          current="${current}${ch}"
          prev_ch="$ch"
          i=$((i + 1))
          continue
        fi
        subcmds+=("$current")
        current=""
        prev_ch="$ch"
        i=$((i + 1))
        continue
      fi
    fi

    current="${current}${ch}"
    prev_ch="$ch"
    i=$((i + 1))
  done

  # Add the last sub-command
  if [ -n "$current" ]; then
    subcmds+=("$current")
  fi

  # Check each sub-command
  for subcmd in "${subcmds[@]}"; do
    check_single_command "$subcmd"
  done
}

# --- Main entry point: split chained commands and check each ---
split_and_check "$COMMAND"

exit 0
