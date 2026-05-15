# shellcheck shell=bash
# project-boundary guard — git destructive walkers
# =================================================
# Two walkers extracted from hooks/guard.sh:
#
#   block_git_C_destructive
#       Handles `git -C <path>`, `--git-dir=<path>`, `--work-tree=<path>`
#       — when the path resolves outside the project AND the
#       subcommand is destructive (clean -f / reset --hard /
#       checkout . / restore . / push --force[-with-lease|-if-includes]
#       / stash drop|clear / branch -D / reflog expire / rm -f /
#       worktree remove / submodule deinit -f / filter-branch /
#       replace -d). Subcommand-aware so `commit -m '...submodule
#       deinit -f...'` doesn't false-positive (Codex round-2, sec 60).
#
#   block_git_worktree_add_outside
#       Handles `git worktree add <path>` — independent of -C. Creates
#       a working tree at the destination path, same boundary-violation
#       pattern as `mkdir <outside>`. Codex round-3, sec 65.
#
# Both functions read from caller's dynamic scope: $CMD, $CMD_BLANKED,
# $CMD_TOKENS_SCAN[], $EFFECTIVE_CWD, $PROJECT_DIR. Helpers
# (strip_quotes, expand_path, resolve_path, is_inside_project) come
# from sibling modules. Each calls `exit 2` on a boundary violation.

block_git_C_destructive() {
  if ! echo "$CMD" | grep -qE '(^|[[:space:]])(/usr/bin/|/bin/)?git([[:space:]]|$)'; then
    return 0
  fi

  local git_C_path=""
  local _gi=0 _gn=${#CMD_TOKENS_SCAN[@]}
  local _git_seen=0
  local _git_C_anchor=-1
  while [ $_gi -lt $_gn ]; do
    local _gtok
    _gtok=$(strip_quotes "${CMD_TOKENS_SCAN[$_gi]}")
    if [ $_git_seen -eq 0 ]; then
      case "$_gtok" in
        git|/usr/bin/git|/bin/git) _git_seen=1 ;;
      esac
      _gi=$((_gi + 1)); continue
    fi
    case "$_gtok" in
      -C|--git-dir|--work-tree)
        _gi=$((_gi + 1))
        if [ $_gi -lt $_gn ]; then
          git_C_path=$(strip_quotes "${CMD_TOKENS_SCAN[$_gi]}")
          _git_C_anchor=$((_gi + 1))
        fi
        break ;;
      --git-dir=*|--work-tree=*)
        git_C_path="${_gtok#*=}"
        _git_C_anchor=$((_gi + 1))
        break ;;
      -c|-C*)
        # `-c key=val` (config override) — skip pair; clustered `-C`
        # can't happen in git's grammar so treat -C* as the boundary.
        _gi=$((_gi + 2)); continue ;;
      -*) _gi=$((_gi + 1)); continue ;;
      *)  break ;;
    esac
  done

  [ -z "$git_C_path" ] && return 0

  local _git_C_exp _git_C_resolved
  _git_C_exp=$(expand_path "$git_C_path")
  if [[ "$_git_C_exp" != /* ]]; then
    _git_C_exp="$EFFECTIVE_CWD/$_git_C_exp"
  fi
  _git_C_resolved=$(resolve_path "$_git_C_exp")
  is_inside_project "$_git_C_resolved" && return 0

  # Subcommand-aware destructive check. Walking tokens after the
  # -C anchor and identifying the verb avoids false-positives on
  # `git -C /tmp commit -m 'fix: avoid submodule deinit -f'` —
  # the `-m` message body would otherwise trigger the destructive
  # regex even though `commit` is benign. Codex round-2 (sec 60).
  local _gj=$_git_C_anchor _git_verb=""
  while [ $_gj -lt $_gn ]; do
    local _gjtok
    _gjtok=$(strip_quotes "${CMD_TOKENS_SCAN[$_gj]}")
    case "$_gjtok" in
      -*) _gj=$((_gj + 1)); continue ;;
      *)  _git_verb="$_gjtok"; break ;;
    esac
  done

  # Reconstruct args-after-verb (verb's own flags only, never
  # commit msgs from a different subcommand).
  local _git_args=""
  local _gk=$((_gj + 1))
  while [ $_gk -lt $_gn ]; do
    if [ -z "$_git_args" ]; then
      _git_args="${CMD_TOKENS_SCAN[$_gk]}"
    else
      _git_args="$_git_args ${CMD_TOKENS_SCAN[$_gk]}"
    fi
    _gk=$((_gk + 1))
  done

  local _git_destructive=0
  case "$_git_verb" in
    clean)
      # Dry-run regex parallel-bumped to match `n` anywhere in
      # the cluster (`-ndf`, `-fnd`, `-dnf` all dry-run forms).
      # Codex round-3 (sec 62).
      if echo "$_git_args" | grep -qE '(^|[[:space:]])(-[a-zA-Z]*f[a-zA-Z]*|--force)([[:space:]]|$)' && \
         ! echo "$_git_args" | grep -qE '(^|[[:space:]])(-[a-zA-Z]*n[a-zA-Z]*|--dry-run)([[:space:]]|$)'; then
        _git_destructive=1
      fi ;;
    reset)
      echo "$_git_args" | grep -qE '(^|[[:space:]])--hard([[:space:]]|$)' && _git_destructive=1 ;;
    checkout|restore)
      echo "$_git_args" | grep -qE '(^|[[:space:]])\.([[:space:]]|$)' && _git_destructive=1 ;;
    push)
      echo "$_git_args" | grep -qE '(^|[[:space:]])(--force|--force-with-lease|--force-if-includes|-f)([[:space:]]|$)' && _git_destructive=1 ;;
    stash)
      echo "$_git_args" | grep -qE '(^|[[:space:]])(drop|clear)([[:space:]]|$)' && _git_destructive=1 ;;
    branch)
      echo "$_git_args" | grep -qE '(^|[[:space:]])(-D|--delete[[:space:]]+--force)([[:space:]]|$)' && _git_destructive=1 ;;
    reflog)
      echo "$_git_args" | grep -qE '(^|[[:space:]])expire([[:space:]]|$)' && _git_destructive=1 ;;
    rm)
      echo "$_git_args" | grep -qE '(^|[[:space:]])(-[a-zA-Z]*f[a-zA-Z]*|--force)([[:space:]]|$)' && _git_destructive=1 ;;
    worktree)
      echo "$_git_args" | grep -qE '(^|[[:space:]])remove([[:space:]]|$)' && _git_destructive=1 ;;
    submodule)
      echo "$_git_args" | grep -qE '(^|[[:space:]])deinit([[:space:]]|$)' && \
        echo "$_git_args" | grep -qE '(^|[[:space:]])(-[a-zA-Z]*f[a-zA-Z]*|--force)([[:space:]]|$)' && _git_destructive=1 ;;
    filter-branch)
      _git_destructive=1 ;;
    replace)
      echo "$_git_args" | grep -qE '(^|[[:space:]])(-d|--delete)([[:space:]]|$)' && _git_destructive=1 ;;
  esac

  if [ "$_git_destructive" -eq 1 ]; then
    echo "BLOCKED: Destructive git operation '$_git_verb' with '-C' / '--git-dir' pointing OUTSIDE project directory '$PROJECT_DIR' (target: '$_git_C_resolved'). Ask user for explicit permission." >&2
    exit 2
  fi
}

block_git_worktree_add_outside() {
  # `git worktree add <path>` creates a worktree directory at <path>
  # — same boundary-violation pattern as `mkdir <outside>` (sec 52).
  # Sec 53/60 only fired on `git -C` invocations + `worktree remove`,
  # not on the `add` destination path argument. Codex round-3 (sec 65).
  if ! echo "$CMD_BLANKED" | grep -qE '(^|[[:space:]])git[[:space:]]+worktree[[:space:]]+add([[:space:]]|$)'; then
    return 0
  fi

  local _wi=0 _wn=${#CMD_TOKENS_SCAN[@]}
  local _wt_seen=0
  local _wt_skip_next=0
  while [ $_wi -lt $_wn ]; do
    local _wtok
    _wtok=$(strip_quotes "${CMD_TOKENS_SCAN[$_wi]}")
    if [ "$_wt_skip_next" -eq 1 ]; then
      _wt_skip_next=0; _wi=$((_wi + 1)); continue
    fi
    if [ $_wt_seen -eq 0 ]; then
      case "$_wtok" in
        add) _wt_seen=1 ;;
      esac
      _wi=$((_wi + 1)); continue
    fi
    case "$_wtok" in
      -b|-B|--reason)
        _wt_skip_next=1; _wi=$((_wi + 1)); continue ;;
      --*=*|-*)
        _wi=$((_wi + 1)); continue ;;
    esac
    # First positional after `add` (and after consumed flags) = destination.
    local _wt_exp _wt_resolved
    _wt_exp=$(expand_path "$_wtok")
    if [[ "$_wt_exp" != /* ]]; then
      _wt_exp="$EFFECTIVE_CWD/$_wt_exp"
    fi
    _wt_resolved=$(resolve_path "$_wt_exp")
    if ! is_inside_project "$_wt_resolved"; then
      echo "BLOCKED: 'git worktree add' targets '$_wt_resolved' which is OUTSIDE project directory '$PROJECT_DIR'. Ask user for explicit permission." >&2
      exit 2
    fi
    break
  done
}
