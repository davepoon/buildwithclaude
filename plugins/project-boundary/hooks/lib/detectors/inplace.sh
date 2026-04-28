#!/bin/bash
# project-boundary guard — detectors: in-place editors
# =====================================================
# Boundary checks for commands that rewrite their target files in
# place via temp-file + rename (sed -i, truncate). Both need full
# positional tracking because their file operands may appear after
# flag/value pairs and after a POSIX `--` terminator.
#
# Dispatched from hooks/guard.sh check_single_command; dynamic scope
# provides: CMD, CMD_BLANKED, CMD_TOKENS_SCAN, EFFECTIVE_CWD,
# PROJECT_DIR, plus helpers from hooks/lib/tokenize.sh +
# hooks/lib/paths.sh.
#
# Each detector calls `exit 2` on a boundary violation — same
# fail-closed semantics as the inline form it replaced.

run_inplace_detectors() {
  # --- sed -i: in-place edits on file arguments ---
  # GNU `sed -i`, BSD `sed -i ''`, and `sed -iSUFFIX` all rewrite the file(s)
  # passed as positional args. The non-in-place form is read-only and is left
  # alone. We only engage when -i / --in-place is actually present.
  # Use the heredoc-blanked view here: a commit-message body that
  # mentions "sed -i" must not be parsed as a real sed call.
  if echo "$CMD_BLANKED" | grep -qE '(^|[[:space:]])sed($|[[:space:]])'; then
    local sed_has_i=0
    local raw_tok
    for raw_tok in "${CMD_TOKENS_SCAN[@]}"; do
      local tok
      tok=$(strip_quotes "$raw_tok")
      if [[ "$tok" == -i* ]] || [[ "$tok" == --in-place* ]]; then
        sed_has_i=1
        break
      fi
    done
    if [ "$sed_has_i" -eq 1 ]; then
      # Positional tracking (replaces the old regex-based script heuristic,
      # which blocked legitimate programs like `/pat/d`, `/pat/p`, `y/…/…/`
      # because they start with `/` or other path-like bytes and looked
      # like absolute paths to the validator).
      #
      # sed grammar with -i:
      #   sed [options] [-e script]... [-f script-file]... [SCRIPT] FILE...
      # The positional SCRIPT exists only when NO -e/-f was supplied. When
      # -e/-f is present, every positional is a FILE. Pre-scan the token
      # stream to learn which regime applies, then walk positionals:
      #   - if no -e/-f seen: skip the first positional (it's SCRIPT)
      #   - every remaining positional is a FILE → is_write_permitted
      local has_explicit_script=0
      local pi=1 pn=${#CMD_TOKENS_SCAN[@]}
      while [ $pi -lt $pn ]; do
        local ptok
        ptok=$(strip_quotes "${CMD_TOKENS_SCAN[$pi]}")
        case "$ptok" in
          -e|-f|--expression|--file)
            has_explicit_script=1; pi=$((pi + 2)); continue ;;
          --expression=*|--file=*)
            has_explicit_script=1; pi=$((pi + 1)); continue ;;
        esac
        pi=$((pi + 1))
      done

      local script_skipped=0
      local sed_seen_dashdash=0
      local si=1 sn=${#CMD_TOKENS_SCAN[@]}
      while [ $si -lt $sn ]; do
        local stok
        stok=$(strip_quotes "${CMD_TOKENS_SCAN[$si]}")
        # POSIX `--` ends option parsing — every token after this is a
        # positional operand even if it starts with `-`. Without this, a
        # file operand named `-owned` was silently skipped as an
        # unknown flag (Copilot review on PR #12).
        if [ $sed_seen_dashdash -eq 0 ]; then
          # Consume flag+value pairs and bare flags (incl. BSD's empty `''`
          # backup-extension argument that follows a bare `-i`).
          case "$stok" in
            --)
              sed_seen_dashdash=1; si=$((si + 1)); continue ;;
            -e|-f|--expression|--file)
              si=$((si + 2)); continue ;;
            -*|'') si=$((si + 1)); continue ;;
          esac
        fi
        # First positional is SCRIPT only when no -e/-f was supplied.
        if [ "$has_explicit_script" -eq 0 ] && [ "$script_skipped" -eq 0 ]; then
          script_skipped=1
          si=$((si + 1)); continue
        fi
        local sexp
        sexp=$(expand_path "$stok")
        if [[ "$sexp" != /* ]]; then
          sexp="$EFFECTIVE_CWD/$sexp"
        fi
        local sresolved
        sresolved=$(resolve_path "$sexp")
        if ! is_write_permitted "$sresolved"; then
          echo "BLOCKED: 'sed -i' targets '$sresolved' which is OUTSIDE project directory '$PROJECT_DIR'. Ask user for explicit permission." >&2
          exit 2
        fi
        si=$((si + 1))
      done
    fi
  fi

  # --- truncate: always rewrites the target file(s) ---
  # Heredoc-blanked view as above — body bytes mentioning "truncate" are
  # not a real call.
  if echo "$CMD_BLANKED" | grep -qE '(^|[[:space:]])truncate($|[[:space:]])'; then
    local tri=1 trn=${#CMD_TOKENS_SCAN[@]}
    local trunc_seen_dashdash=0
    while [ $tri -lt $trn ]; do
      local trtok
      trtok=$(strip_quotes "${CMD_TOKENS_SCAN[$tri]}")
      # POSIX `--` ends option parsing — every token after this is a
      # positional file operand even if it starts with `-`. Same fix as
      # the sed -i walker above (Copilot review on PR #12).
      if [ $trunc_seen_dashdash -eq 0 ]; then
        case "$trtok" in
          --)
            trunc_seen_dashdash=1; tri=$((tri + 1)); continue ;;
          -s|--size|-r|--reference|-o|--io-blocks)
            tri=$((tri + 2)); continue ;;
          -*|'') tri=$((tri + 1)); continue ;;
        esac
      fi
      # No bare size-literal skip here: GNU truncate requires size to
      # travel with -s/--size — either separately (consumed by the flag
      # case above, +2) or attached as `-sN` / `--size=N` (caught by the
      # `-*` case). Any remaining non-option token is a FILE operand.
      # The previous `^[+=<>%]?[0-9]` skip wrongly dropped digit-leading
      # filenames like `123.log` or `2024-04-22.log`, letting the target
      # escape the boundary check (Codex round — P2 bypass).
      local trexp
      trexp=$(expand_path "$trtok")
      if [[ "$trexp" != /* ]]; then
        trexp="$EFFECTIVE_CWD/$trexp"
      fi
      local trresolved
      trresolved=$(resolve_path "$trexp")
      if ! is_write_permitted "$trresolved"; then
        echo "BLOCKED: 'truncate' targets '$trresolved' which is OUTSIDE project directory '$PROJECT_DIR'. Ask user for explicit permission." >&2
        exit 2
      fi
      tri=$((tri + 1))
    done
  fi
}
