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
  if command_name_is "sed"; then
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
        validate_command_path write "sed -i" "$stok"
        si=$((si + 1))
      done
    fi
  fi

  # --- truncate: always rewrites the target file(s) ---
  # Heredoc-blanked view as above — body bytes mentioning "truncate" are
  # not a real call.
  if command_name_is "truncate"; then
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
      validate_command_path write truncate "$trtok"
      tri=$((tri + 1))
    done
  fi

  # --- perl/ruby in-place edit (-i / -pi / -i.bak) ---
  # perl `-i`, `-pi`, `-i.bak`, ruby `-i`, `-i.bak` rewrite each FILE
  # operand in place with the same write semantics as `sed -i`. The
  # generic interpreter-with-inline-code walker (guard.sh:626) blocks
  # bare `perl -e` / `ruby -e`, but mis-classifies `-pi` / `-i` (which
  # don't end in c/e/E) as "not inline code" and lets the call through.
  # File operands then escape boundary validation entirely. Pentest
  # reported this as a real bypass for /etc/<file> targets.
  #
  # Walker engages only when an `-i*` / `-pi*` / `--in-place*` token
  # is present, then walks every positional after consuming flag/value
  # pairs (`-e CODE`, `-E CODE`, `-M MOD`, `--`). Mirrors the sed -i
  # walker's POSIX `--` handling.
  if command_name_matches "perl|ruby"; then
    local pr_has_inplace=0
    local pr_tok
    for pr_tok in "${CMD_TOKENS_SCAN[@]}"; do
      local pr_t
      pr_t=$(strip_quotes "$pr_tok")
      case "$pr_t" in
        -i|-i.*|-pi|-pi.*|--in-place|--in-place=*)
          pr_has_inplace=1; break ;;
      esac
    done
    if [ "$pr_has_inplace" -eq 1 ]; then
      local pri=1 prn=${#CMD_TOKENS_SCAN[@]}
      local pr_seen_dashdash=0
      while [ $pri -lt $prn ]; do
        local prtok
        prtok=$(strip_quotes "${CMD_TOKENS_SCAN[$pri]}")
        if [ $pr_seen_dashdash -eq 0 ]; then
          case "$prtok" in
            --)
              pr_seen_dashdash=1; pri=$((pri + 1)); continue ;;
            -e|-E|-M|-I|-x)
              pri=$((pri + 2)); continue ;;
            -*|'')
              pri=$((pri + 1)); continue ;;
          esac
        fi
        validate_command_path write "perl -i / ruby -i" "$prtok"
        pri=$((pri + 1))
      done
    fi
  fi

  # --- awk -i inplace: gawk in-place edit (round-4 pentest) ---
  # gawk's `-i inplace` (or `--include=inplace`) loads the inplace
  # extension library and rewrites every FILE positional in place via
  # temp-file + rename — same write semantics as `sed -i` / `perl -i`.
  # Walker engages only when the inplace library is actually loaded;
  # plain `awk PROG file` is read-only and stays ALLOWED.
  #
  # awk grammar:
  #   awk [opts] 'PROG' file1 file2 ...        (positional PROG)
  #   awk [opts] -f script.awk file1 ...       (no positional PROG)
  #   awk [opts] -E script.awk file1 ...       (no positional PROG)
  #   awk [opts] --source='PROG' file1 ...     (no positional PROG)
  if command_name_matches "awk|gawk|mawk|nawk"; then
    local awk_inplace=0
    local awk_explicit_prog=0
    local awk_t=1 awk_n=${#CMD_TOKENS_SCAN[@]}
    while [ $awk_t -lt $awk_n ]; do
      local atok
      atok=$(strip_quotes "${CMD_TOKENS_SCAN[$awk_t]}")
      case "$atok" in
        -i|--include)
          if [ $((awk_t + 1)) -lt $awk_n ]; then
            local libtok
            libtok=$(strip_quotes "${CMD_TOKENS_SCAN[$((awk_t + 1))]}")
            [ "$libtok" = "inplace" ] && awk_inplace=1
          fi
          ;;
        -iinplace|--include=inplace|--inplace|--inplace=*)
          awk_inplace=1 ;;
        -f|-E|--file|--exec|--source)
          awk_explicit_prog=1 ;;
        --file=*|--exec=*|--source=*)
          awk_explicit_prog=1 ;;
      esac
      awk_t=$((awk_t + 1))
    done
    if [ "$awk_inplace" -eq 1 ]; then
      local awk_prog_skipped=0
      local awk_seen_dashdash=0
      local wi=1 wn=${#CMD_TOKENS_SCAN[@]}
      while [ $wi -lt $wn ]; do
        local wtok
        wtok=$(strip_quotes "${CMD_TOKENS_SCAN[$wi]}")
        if [ $awk_seen_dashdash -eq 0 ]; then
          case "$wtok" in
            --)
              awk_seen_dashdash=1; wi=$((wi + 1)); continue ;;
            -F|-v|-f|-i|-l|-E|--field-separator|--assign|--file|--include|--load|--exec|--source)
              wi=$((wi + 2)); continue ;;
            -*|'')
              wi=$((wi + 1)); continue ;;
          esac
        fi
        if [ "$awk_explicit_prog" -eq 0 ] && [ "$awk_prog_skipped" -eq 0 ]; then
          awk_prog_skipped=1
          wi=$((wi + 1)); continue
        fi
        validate_command_path write "awk -i inplace" "$wtok"
        wi=$((wi + 1))
      done
    fi
  fi
}
