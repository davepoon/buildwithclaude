#!/bin/bash
# project-boundary guard — redirect/output write-target detectors
# ===============================================================
# tee, dd of=, and the catch-all unquoted-`>` redirect walker.
# Split out of write_targets_b.sh by domain (Codex r5 finding #4).
#
# Same dynamic-scope contract as the rest of detectors/:
# reads CMD, CMD_BLANKED, CMD_TOKENS, CMD_TOKENS_SCAN,
# EFFECTIVE_CWD, PROJECT_DIR; helpers from
# hooks/lib/tokenize.sh + paths.sh + command_name.sh +
# options.sh. Calls `exit 2` on violation.

run_redirect_detectors() {
  local TARGET RESOLVED

  # --- tee command: extract file arguments, block if outside project ---
  # Substring regex (NOT command_name_is) by design for the wrapper-
  # carry case: `docker run --rm -v /tmp:/data alpine tee /data/x.md`
  # deliberately over-blocks because host-mount parsing is not in
  # scope. CMD_BLANKED so a quoted-heredoc body that mentions `tee`
  # is not tripped — Codex round-4 P3 (sec 99).
  #
  # VERB-GATE on a positive list — same reasoning as the rm walker in
  # destructive.sh. tee itself + remote-dispatch wrappers (docker /
  # podman / kubectl / oc / crictl / lxc / ssh / nsenter / chroot) +
  # xargs (tee-by-input). Other verbs (git / gh / echo / printf /
  # ...) skip — substring is text content.
  if [[ "${CMD_VERB-}" =~ ^(tee|docker|podman|kubectl|oc|crictl|lxc|ssh|nsenter|chroot|xargs)$ ]] && \
     echo "$CMD_BLANKED" | grep -qE '(^|[[:space:]])tee($|[[:space:]])'; then
    local tee_raw
    tee_raw=$(echo "$CMD" | grep -oE '(^|[[:space:]])tee[[:space:]]+.*' | sed 's/^[[:space:]]*tee[[:space:]]*//' || true)

    while IFS= read -r TARGET; do
      [[ -z "$TARGET" || "$TARGET" == -* ]] && continue
      RESOLVED=$(resolve_command_path "$TARGET")
      # /dev/null is a discard sink for tee (`echo x | tee /dev/null`).
      is_discard_target "$RESOLVED" && continue
      block_unless_path_allowed write tee "$RESOLVED"
    done < <(tokenize_args "$tee_raw")
  fi

  # --- dd of= outside project ---
  # dd accepts repeated key=value operands and the last one wins, so we must
  # validate every of= occurrence — not just the first.
  if command_name_is "dd"; then
    local raw_tok
    for raw_tok in "${CMD_TOKENS[@]}"; do
      local tok
      tok=$(strip_quotes "$raw_tok")
      if [[ "$tok" == of=* ]]; then
        local dd_output="${tok#of=}"
        if [ -n "$dd_output" ]; then
          local resolved_dd
          resolved_dd=$(resolve_command_path "$dd_output")
          # /dev/null is a discard sink (`dd if=x of=/dev/null`).
          is_discard_target "$resolved_dd" && continue
          block_unless_path_allowed write "dd output" "$resolved_dd"
        fi
      fi
    done
  fi

  # --- Writing to files outside project via redirection ---
  # Walk tokens and scan each one for an unquoted > operator anywhere
  # (not just at the start). This catches both separated forms (`> file`,
  # `2>> file`) and attached forms (`>file`, `x>file`, `"a">file`).
  # Skips fd-to-fd redirects like 2>&1 (target starts with &).
  #
  # Iterate the heredoc-blanked token stream so a quoted-heredoc body
  # mentioning "> /etc/foo" is not mistaken for a real redirect. Real
  # redirects sit OUTSIDE any heredoc body and survive the blanking
  # pass; an unquoted heredoc opener like `cat > /etc/x <<EOF ...EOF`
  # still has the `>` and `/etc/x` in the command-context portion that
  # is not blanked, so it stays caught.
  local ri=0 rn=${#CMD_TOKENS_SCAN[@]}
  while [ $ri -lt $rn ]; do
    local rtok="${CMD_TOKENS_SCAN[$ri]}"
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
        REDIR_TARGET="${CMD_TOKENS_SCAN[$((ri + 1))]}"
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
      local resolved_redir
      resolved_redir=$(resolve_command_path "$REDIR_TARGET")
      # Follow symlinks so that `echo x > project/link` where
      # `link -> /etc/passwd` is caught. resolve_path only canonicalizes
      # the dirname, not the basename — a symlink leaf slips through.
      #
      # Stop the chase at known discard sinks (kernel-managed fd
      # aliases). On Linux `/dev/stdout` -> `/proc/self/fd/1` -> the
      # real underlying fd target (a pipe, a log file, etc.); chasing
      # past `/proc/self/fd/1` would mis-classify a stdout redirect
      # as an outside-project write. macOS doesn't hit this because
      # `/dev/fd/N` there is a character device, not a symlink, so
      # the chase already stops naturally.
      local redir_depth=20
      local redir_hit_discard=0
      while [[ -L "$resolved_redir" && $redir_depth -gt 0 ]]; do
        if is_discard_target "$resolved_redir"; then
          redir_hit_discard=1
          break
        fi
        local redir_link
        redir_link=$(readlink "$resolved_redir")
        if [[ "$redir_link" == /* ]]; then
          resolved_redir=$(resolve_path "$redir_link")
        else
          resolved_redir=$(resolve_path "$(dirname "$resolved_redir")/$redir_link")
        fi
        redir_depth=$((redir_depth - 1))
      done
      # A residual symlink after the chase means we exhausted depth or
      # hit a cycle — fail closed. Discard sinks reach this point with
      # their symlink intact, so the explicit early-exit flag suppresses
      # the too-deep error.
      if [[ -L "$resolved_redir" && $redir_hit_discard -eq 0 ]]; then
        echo "BLOCKED: Redirect target symlink chain too deep or circular at '$resolved_redir'. Ask user for explicit permission." >&2
        exit 2
      fi
      # /dev/null is a discard sink for every redirect form
      # (`> /dev/null`, `2> /dev/null`, `&> /dev/null`, `2>&1 > /dev/null`).
      is_discard_target "$resolved_redir" || \
        block_unless_path_allowed write "Redirect target" "$resolved_redir"
    fi
  done
}
