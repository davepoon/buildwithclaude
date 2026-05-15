#!/bin/bash
# project-boundary guard — remote_dispatch module
# ================================================
# Generic neutralisation of "remote-dispatch" commands whose operands
# target a remote host or a foreign (container/namespace) filesystem
# rather than the local one this guard protects. Without this pass,
# tokens that are part of a remote command string get walked by the
# local-path detectors (cp, tee, rm, redirect, ...) and produce
# false-positive boundary blocks.
#
# Three universal shapes are recognised, all rewritten so downstream
# detectors only see the local-side surface (or nothing, when there
# is no local surface):
#
#   1. Network-copy tools — operate on a remote target but may also
#      take local operands and -flag values. The point of this class
#      is that the remote `host:/path` / `host::module` / `rsync://`
#      operands must NOT be walked as local filesystem paths;
#      legitimate local operands (`scp ./key host:/dst` etc.) are
#      reads from the plugin's perspective and the boundary doesn't
#      police those.
#        scp / rcp / sftp
#      Rewrite: collapse CMD to the bare verb name.
#
#   2. Remote-command dispatch — `<verb> [opts] <target> <opaque-cmd>`,
#      where the target is a host / container / pod and the trailing
#      tokens form a command executed on a foreign filesystem (NOT
#      the local one this guard protects):
#        ssh
#        docker exec | podman exec
#        kubectl exec | oc exec | crictl exec | lxc exec
#      Rewrite: collapse CMD to the verb prefix only.
#
#      `nsenter` and `chroot` are deliberately EXCLUDED — they
#      execute on the local host (just under a different namespace
#      or apparent root), so their command operands can still touch
#      host paths outside the project and must remain subject to the
#      destructive walkers (Copilot review on PR #22).
#
#      `docker run` / `podman run` / `buildah run` are also EXCLUDED
#      because the `-v src:dst` / `--volume` / `--mount type=bind,…`
#      flags can bind-mount host paths into the container, turning a
#      container-side write into a host-fs write that bypasses the
#      boundary. Until host-mount-source parsing is added, leaving
#      them subject to the existing walkers errs on the safe side
#      (Copilot review on PR #22).
#
#   3. Remote file copy with mixed local / remote operands —
#      `<verb> <subverb> <a> <b>` where one operand has the form
#      `<id>:<path>` and the other is local.
#        docker cp | podman cp | kubectl cp | oc cp
#      Rewrite: keep only the LOCAL DESTINATION operand (last
#      positional, when not remote-shaped) so the cp walker still
#      validates download targets like `… c:/x /etc/owned`. Source
#      operands are dropped — local source = read (not policed),
#      remote source = foreign filesystem.
#
# Depends on tokenize_args / strip_quotes from hooks/lib/tokenize.sh.
# Pure (no caller-scope dependencies); returns the rewritten command
# string on stdout.

# --- Generic remote-target detector ---
# Returns 0 iff the argument looks like a "remote address" of the
# universal `<id>:<path>` form used by ssh, scp, rsync, docker cp,
# kubectl cp, etc. The `:` must live in the FIRST path segment
# (before any `/`) — a local path may legitimately contain `:` after a
# slash (e.g. `../tmp/a:b`), and a URL like `http://...` keeps the
# scheme separator inside the first segment but is excluded by an
# explicit URL check first.
_rd_is_remote_target_operand() {
  local arg="$1"
  case "$arg" in
    *://*) return 1 ;;  # URL scheme
  esac
  local first="${arg%%/*}"
  case "$first" in
    *:*) return 0 ;;
  esac
  return 1
}

# --- Find command-name token index, skipping wrappers/flags/VAR=val ---
# Mirrors the wrapper-skip rules used by strip_command_name_prefix and
# command_name_is. Reads from the module-local _RD_TOKS array (set by
# rewrite_remote_dispatch before calling). Returns -1 if no command-name
# found. Uses a global rather than `local -n` because macOS ships
# bash 3.2 which lacks nameref support.
#
# Also skips a per-wrapper option-with-value pair (e.g. `-u USER` for
# sudo/env, `-k DUR` for timeout) when the value would otherwise be
# mis-identified as the verb. Without this, `env -u FOO docker exec
# ctr rm -rf /` mis-identified `FOO` as the verb (verb_pair="FOO
# docker"), `rewrite_remote_dispatch` returned the cmd unchanged, and
# the bare rm walker over-blocked the foreign-fs `rm -rf /` (which
# actually runs inside the container, not on host). Same root cause
# as section 40 (subcmd_flags.sh) and section 41 (command_name.sh);
# Codex round-4 follow-up on PR #23.
_rd_find_verb_idx() {
  local i=0 n=${#_RD_TOKS[@]}
  local prev_was_timeout=0 last_wrapper=""
  while [ $i -lt $n ]; do
    local raw="${_RD_TOKS[$i]}" t
    t=$(strip_quotes "$raw")

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
        last_wrapper=$(_rd_strip_path_prefix "$t")
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

# --- Strip /bin/, /sbin/, /usr/bin/, /usr/sbin/, /usr/local/bin/, ---
# /opt/homebrew/bin/ prefix. Mirrors _cn_strip_path_prefix in
# command_name.sh — kept in sync so a Homebrew-installed ssh /
# kubectl / etc. is recognised by the remote-dispatch walkers.
_rd_strip_path_prefix() {
  local n="$1"
  case "$n" in
    /bin/*|/sbin/*|/usr/bin/*|/usr/sbin/*|/usr/local/bin/*|/opt/homebrew/bin/*) printf '%s' "${n##*/}" ;;
    *) printf '%s' "$n" ;;
  esac
}

# --- Whitespace-list membership check ---
# $1 = needle, $2 = space-separated haystack. Used to decide whether a
# given short or long flag consumes the next token as its value.
_rd_flag_takes_value() {
  local needle="$1"
  local short_list="$2"
  local long_list="$3"
  case " $short_list " in *" $needle "*) return 0 ;; esac
  case " $long_list "  in *" $needle "*) return 0 ;; esac
  return 1
}

# --- Main entry: rewrite remote-dispatch commands ---
# In:  full CMD string
# Out: CMD string with remote portions removed; unchanged for non-dispatch verbs.
rewrite_remote_dispatch() {
  local cmd="$1"
  _RD_TOKS=()
  local t
  while IFS= read -r t; do
    [[ -z "$t" ]] && continue
    _RD_TOKS+=("$t")
  done < <(tokenize_args "$cmd")

  local verb_idx
  verb_idx=$(_rd_find_verb_idx)
  [ "$verb_idx" -lt 0 ] && { printf '%s' "$cmd"; return; }

  local verb subverb=""
  verb=$(strip_quotes "${_RD_TOKS[$verb_idx]}")
  verb=$(_rd_strip_path_prefix "$verb")
  if [ $((verb_idx + 1)) -lt ${#_RD_TOKS[@]} ]; then
    subverb=$(strip_quotes "${_RD_TOKS[$((verb_idx + 1))]}")
  fi

  # Class 1: pure remote-fs tools.
  case "$verb" in
    scp|rcp|sftp)
      printf '%s' "$verb"
      return ;;
  esac

  # Class 3: two-word remote copy verbs.
  case "$verb $subverb" in
    "docker cp"|"podman cp"|"kubectl cp"|"oc cp")
      _rd_rewrite_remote_copy "$verb_idx"
      return ;;
  esac

  # Class 2: two-word remote-command dispatch verbs. `docker run` /
  # `podman run` / `buildah run` are intentionally NOT in this list —
  # see the header comment for the bind-mount rationale.
  case "$verb $subverb" in
    "docker exec"|"podman exec"|"kubectl exec"|"oc exec"|"crictl exec"|"lxc exec")
      printf '%s %s' "$verb" "$subverb"
      return ;;
  esac

  # Class 2: one-word remote-command dispatch verbs. `nsenter` and
  # `chroot` are intentionally NOT in this list — see the header
  # comment for why they remain subject to the local walkers.
  case "$verb" in
    ssh)
      printf '%s' "$verb"
      return ;;
  esac

  printf '%s' "$cmd"
}

# --- Rewrite a `<verb> <subverb> <operand-a> <operand-b>` copy invocation ---
# Keep the verb pair plus operands that are NOT remote `<id>:<path>` form.
# Flags are dropped (they cannot be local file targets in any of the
# supported `cp` subcommands; -L, --follow-link, --archive etc. are
# value-less or take non-path values).
_rd_rewrite_remote_copy() {
  local v_idx="$1"
  local verb_pair="${_RD_TOKS[$v_idx]} ${_RD_TOKS[$((v_idx + 1))]}"
  local k=$((v_idx + 2)) n=${#_RD_TOKS[@]}

  # Per-verb flags-that-consume-the-next-token list. Necessary because
  # Copilot review on PR #22 flagged a download-mode bypass shape:
  #   `kubectl cp pod:/x /etc/owned --namespace default`
  # without this table, `default` (the value of `--namespace`) gets
  # added to the positionals list, becomes the LAST positional, and
  # the rewrite emits `cp default` — relative path resolved inside
  # the project → ALLOWED, missing the real download destination
  # `/etc/owned`. cobra/pflag (used by kubectl/oc) lets flags appear
  # before AND after positionals, so we can't just stop after the
  # first non-flag token.
  #
  # docker cp / podman cp share a small flag set with no value-taking
  # flags relevant to the path-walker bypass (`-a/--archive`,
  # `-L/--follow-link`, `--quiet`, `--pause`, `--extract` are all
  # value-less); their entries are deliberately empty. kubectl cp /
  # oc cp inherit the entire kubectl global flag set — only the ones
  # that take a value AND can credibly appear next to a path are
  # listed here (kubeconfig/cluster paths can be local files but the
  # plugin does not police reads, so we drop their values without
  # validation).
  local short_value_flags="" long_value_flags=""
  case "$verb_pair" in
    "kubectl cp"|"oc cp")
      short_value_flags="-c -n -s"
      long_value_flags="--container --namespace --kubeconfig --context --cluster --user --token --server --as --as-group --certificate-authority --client-certificate --client-key --cache-dir --request-timeout --tls-server-name --retries"
      ;;
  esac

  # Walk positional operands. cp-family semantics: the LAST positional
  # is the destination; every earlier positional is a source. The
  # plugin protects writes, not reads — so a local SOURCE is dropped
  # (uploading `docker cp /tmp/x container:/y` is read-only on /tmp/x
  # and must not false-positive). A local DESTINATION is preserved
  # below as the operand of a synthetic `cp <dst>` so the existing
  # cp walker validates it. This is a deliberate divergence from the
  # bare `cp` walker (which strict-checks both src and dst) — the
  # remote-dispatch case has a remote operand on the OTHER side, so
  # the boundary's "no copies from outside" semantics do not apply
  # symmetrically here. Operands of the universal `<id>:<path>` form
  # are dropped because they target a foreign filesystem.
  local -a positionals=()
  while [ $k -lt $n ]; do
    local raw="${_RD_TOKS[$k]}" tok
    tok=$(strip_quotes "$raw")
    case "$tok" in
      --)
        # POSIX end-of-options: every later token is a positional,
        # even if it begins with `-`. Used by kubectl exec but also
        # valid for cp invocations.
        k=$((k + 1))
        while [ $k -lt $n ]; do
          positionals+=("${_RD_TOKS[$k]}")
          k=$((k + 1))
        done
        continue ;;
      --*=*)
        k=$((k + 1)); continue ;;
      -*)
        if _rd_flag_takes_value "$tok" "$short_value_flags" "$long_value_flags"; then
          k=$((k + 2))
        else
          k=$((k + 1))
        fi
        continue ;;
    esac
    positionals+=("$raw")
    k=$((k + 1))
  done

  local last_idx=$(( ${#positionals[@]} - 1 ))
  if [ $last_idx -lt 0 ]; then
    printf '%s' "$verb_pair"
    return
  fi
  local last_raw="${positionals[$last_idx]}"
  local last_tok
  last_tok=$(strip_quotes "$last_raw")
  if _rd_is_remote_target_operand "$last_tok"; then
    # Destination is remote → no local write surface. Collapse to verb pair
    # so no walker fires on the local source(s).
    printf '%s %s' "${_RD_TOKS[$v_idx]}" "${_RD_TOKS[$((v_idx + 1))]}"
    return
  fi
  # Destination is local. Emit a synthetic `cp <dst>` so the cp walker
  # in destructive.sh validates that single path. Source operands are
  # dropped: remote ones are foreign, local ones are reads (not policed).
  printf 'cp %s' "$last_raw"
}
