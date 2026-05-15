# shellcheck shell=bash
# project-boundary guard — cd-outside + destructive-cwd walkers
# ==============================================================
# Two functions extracted from hooks/guard.sh check_single_command:
#
#   handle_cd_and_track_outside_context
#       Recognises `cd <path>` invocations, normalises the path, and
#       updates EFFECTIVE_CWD + the _GUARD_CD_OUTSIDE / _GUARD_CD_IN_
#       ALLOWLIST cross-call flags so that the next command in a
#       chain (`cd memory && tee note.md`) can pick up the new cwd.
#       Returns 0 when this was a `cd` invocation (caller should
#       return), 1 otherwise.
#
#   block_destructive_in_outside_context
#       Fires when EFFECTIVE_CWD is outside the project (either via
#       cd in a chained command or via cwd from the hook event).
#       Blocks the bare-name destructive verbs (rm, mv, cp, ln,
#       chmod, chown, find, curl, wget; tee outside allowlisted cwd)
#       and the destructive git subcommands (clean -f / reset --hard
#       / checkout . / push --force / restore . / stash drop /
#       branch -D / reflog expire) plus rails/rake db:drop|reset.
#       No return signal needed — `exit 2` on any violation.
#
# Both read CMD / EFFECTIVE_CWD / PROJECT_DIR / CWD_OUTSIDE_PROJECT /
# CWD_IN_ALLOWLIST from caller's dynamic scope and may set/export
# _GUARD_CD_OUTSIDE / _GUARD_CD_IN_ALLOWLIST. Helpers (expand_path,
# resolve_path, is_inside_project, is_allowlisted) come from sibling
# modules.

handle_cd_and_track_outside_context() {
  if ! [[ "$CMD" =~ ^cd($|[[:space:]]) ]]; then
    return 1
  fi

  local cd_target
  # cd takes a single argument, so grab everything after 'cd ' as the
  # target (including spaces if quoted). Not using tokenize_args because
  # cd doesn't take multiple path arguments.
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
}

block_destructive_in_outside_context() {
  # Block destructive commands when running outside the project
  # (either via cd in a chained command, or via cwd from the hook event).
  local outside_context=0
  if [[ "${_GUARD_CD_OUTSIDE:-0}" == "1" || "$CWD_OUTSIDE_PROJECT" == "1" ]]; then
    outside_context=1
  fi
  local cwd_in_allowlist=0
  if [[ "${_GUARD_CD_IN_ALLOWLIST:-0}" == "1" || "${CWD_IN_ALLOWLIST:-0}" == "1" ]]; then
    cwd_in_allowlist=1
  fi

  [[ "$outside_context" != "1" ]] && return 0

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

  # Destructive git subcommands.
  # git clean only destructive with -f/--force AND without -n/--dry-run.
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
  # Destructive rails/rake subcommands.
  if echo "$CMD" | grep -qE '(^|[[:space:]])(rails|rake)[[:space:]]+db:(drop|reset)'; then
    echo "BLOCKED: Destructive rails/rake command outside project directory. Ask user for explicit permission." >&2
    exit 2
  fi
}
