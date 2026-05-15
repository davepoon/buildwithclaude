#!/bin/bash
# project-boundary guard — permissions / metadata detectors
# =========================================================
# Split out of hooks/lib/detectors/destructive.sh for the 500-line
# file budget. This module groups every walker that mutates file
# metadata (mode, owner, group, xattrs, BSD flags, capabilities,
# Linux ext attrs). All STRICT — allowlist must not apply because
# an attacker who can flip metadata on an allowlisted dir's
# sibling path can still pivot.
#
# Same dynamic-scope contract as the rest of the detector cluster:
# reads CMD, CMD_BLANKED, CMD_TOKENS_SCAN, EFFECTIVE_CWD,
# PROJECT_DIR; helpers from hooks/lib/tokenize.sh + paths.sh +
# command_name.sh. Each detector calls `exit 2` on a violation.

# --- chmod / chown / chgrp boundary check ---
# Weaponizable permission changes on files outside the project are
# blocked. Separate function because chmod/chown originally run at
# a later position in check_single_command than the xargs..ln
# cluster; this lets us preserve the original evaluation order
# from the caller.
run_permissions_detectors() {
  local CMD_NAME TARGET RESOLVED
  for CMD_NAME in chmod chown chgrp; do
    if echo "$CMD" | grep -qE "(^|[[:space:]])${CMD_NAME}($|[[:space:]])"; then
      # Extract args after command name, skip flags, then skip the first
      # non-flag token (mode for chmod, owner[:group] for chown)
      local perm_raw
      perm_raw=$(echo "$CMD" | grep -oE "(^|[[:space:]])${CMD_NAME}[[:space:]]+.*" | sed "s/^[[:space:]]*${CMD_NAME}[[:space:]]*//" || true)
      local skipped_first=0
      local skip_next=0
      local has_reference=0
      # When `--reference` (any form) is present, the spec operand
      # is supplied via the referenced file — there is NO positional
      # spec. Skipping the first positional as spec would silently
      # let the actual TARGET escape the boundary check (Codex r5 P1).
      if echo "$perm_raw" | grep -qE '(^|[[:space:]])\-\-reference(=|[[:space:]]|$)'; then
        has_reference=1
      fi

      while IFS= read -r TARGET; do
        [[ -z "$TARGET" ]] && continue
        if [[ $skip_next -eq 1 ]]; then
          skip_next=0
          continue
        fi
        case "$TARGET" in
          --reference) skip_next=1; continue ;;
          --reference=*) continue ;;
          -*) continue ;;
        esac
        if [[ $skipped_first -eq 0 && $has_reference -eq 0 ]]; then
          skipped_first=1
          continue
        fi
        # STRICT: chmod/chown can weaponize permissions; allowlist must not apply.
        validate_command_path strict "$CMD_NAME" "$TARGET"
      done < <(tokenize_args "$perm_raw")
    fi
  done

  # --- setfattr: Linux extended attributes (round-5 pentest) ---
  # Modifies xattrs in user.* / system.* namespaces; an attacker
  # who can flip these on /etc/shadow can pivot. STRICT.
  # Grammar: setfattr -n NAME -v VALUE FILE | -x NAME FILE
  # Value-bearing flags: -n / --name, -v / --value, -x / --remove
  # (and the `--name=` / `--value=` / `--remove=` long-attached
  # forms). `--restore=DUMP` uses an embedded value — the FILE
  # operand list is then empty, so leave that case untouched.
  if command_name_is "setfattr"; then
    local sfi=1 sfn=${#CMD_TOKENS_SCAN[@]}
    local sf_seen_dashdash=0
    while [ $sfi -lt $sfn ]; do
      local sftok
      sftok=$(strip_quotes "${CMD_TOKENS_SCAN[$sfi]}")
      if [ $sf_seen_dashdash -eq 0 ]; then
        case "$sftok" in
          --) sf_seen_dashdash=1; sfi=$((sfi + 1)); continue ;;
          -n|--name|-v|--value|-x|--remove) sfi=$((sfi + 2)); continue ;;
          --name=*|--value=*|--remove=*|--restore=*) sfi=$((sfi + 1)); continue ;;
          -*|'') sfi=$((sfi + 1)); continue ;;
        esac
      fi
      validate_command_path strict setfattr "$sftok"
      sfi=$((sfi + 1))
    done
  fi

  # --- chflags: BSD/macOS file flags (round-5 pentest) ---
  # Modifies uchg/schg/uappnd/etc. flags. Same threat profile
  # as chmod. STRICT.
  # Grammar: chflags [-R|-H|-L|-P|-h] FLAGS FILE...
  # First non-flag positional is FLAGS spec (skip), rest are FILEs.
  if command_name_is "chflags"; then
    local cfi=1 cfn=${#CMD_TOKENS_SCAN[@]}
    local cf_seen_dashdash=0
    local cf_skipped_flags=0
    while [ $cfi -lt $cfn ]; do
      local cftok
      cftok=$(strip_quotes "${CMD_TOKENS_SCAN[$cfi]}")
      if [ $cf_seen_dashdash -eq 0 ]; then
        case "$cftok" in
          --) cf_seen_dashdash=1; cfi=$((cfi + 1)); continue ;;
          -*|'') cfi=$((cfi + 1)); continue ;;
        esac
      fi
      if [ $cf_skipped_flags -eq 0 ]; then
        cf_skipped_flags=1
        cfi=$((cfi + 1)); continue
      fi
      validate_command_path strict chflags "$cftok"
      cfi=$((cfi + 1))
    done
  fi

  # --- setcap: Linux capabilities (round-5 P3) ---
  # `setcap CAP_SPEC FILE` grants capabilities (cap_net_bind_service,
  # cap_sys_admin, ...) on FILE — privilege escalation primitive.
  # `setcap -r FILE` removes all caps. STRICT.
  # Bare flags: -q (quiet), -v (verify), -h (help), -n (no rootid),
  # -e (existing cap), -f (cap from file). `-r` is the remove
  # subcommand and changes positional shape (no spec operand).
  if command_name_is "setcap"; then
    local sci=1 scn=${#CMD_TOKENS_SCAN[@]}
    local sc_seen_dashdash=0
    local sc_remove=0
    local sc_skipped_spec=0
    # Pre-scan for -r (remove): no CAP_SPEC positional in that shape.
    local _i
    for ((_i=1; _i<scn; _i++)); do
      case "$(strip_quotes "${CMD_TOKENS_SCAN[$_i]}")" in
        -r|--remove) sc_remove=1; break ;;
      esac
    done
    while [ $sci -lt $scn ]; do
      local sctok
      sctok=$(strip_quotes "${CMD_TOKENS_SCAN[$sci]}")
      if [ $sc_seen_dashdash -eq 0 ]; then
        case "$sctok" in
          --) sc_seen_dashdash=1; sci=$((sci + 1)); continue ;;
          -*|'') sci=$((sci + 1)); continue ;;
        esac
      fi
      if [ $sc_remove -eq 0 ] && [ $sc_skipped_spec -eq 0 ]; then
        sc_skipped_spec=1; sci=$((sci + 1)); continue
      fi
      validate_command_path strict setcap "$sctok"
      sci=$((sci + 1))
    done
  fi

  # --- chattr: Linux ext file attributes (round-5 P3) ---
  # `chattr +i FILE` makes immutable; `+a` append-only; etc. Same
  # weaponize-permissions threat as chmod. STRICT.
  # Value-bearing pairs: -v VERSION (set version), -p PROJECT (project ID).
  # Bare flags: -R (recursive), -V (verbose), -f (no errors), -h (help).
  # First non-flag positional is MODE_SPEC (`+i`, `-a`, `=AS`); skip it.
  if command_name_is "chattr"; then
    local cai=1 can=${#CMD_TOKENS_SCAN[@]}
    local ca_seen_dashdash=0
    local ca_skipped_spec=0
    while [ $cai -lt $can ]; do
      local catok
      catok=$(strip_quotes "${CMD_TOKENS_SCAN[$cai]}")
      if [ $ca_seen_dashdash -eq 0 ]; then
        case "$catok" in
          --) ca_seen_dashdash=1; cai=$((cai + 1)); continue ;;
          -v|-p) cai=$((cai + 2)); continue ;;
          -R|-V|-f|-h) cai=$((cai + 1)); continue ;;
          [+=]*|-[a-zA-Z]*)
            # Mode spec — `+i`, `-i`, `=AS`, multi-letter combos.
            # Codex round-5b P1: previously these matched the `-*`
            # branch and were skipped as flags, leaving the FILE
            # to be eaten by the spec-skip and never validated.
            ca_skipped_spec=1
            cai=$((cai + 1)); continue ;;
          -*|'') cai=$((cai + 1)); continue ;;
        esac
      fi
      if [ $ca_skipped_spec -eq 0 ]; then
        ca_skipped_spec=1; cai=$((cai + 1)); continue
      fi
      validate_command_path strict chattr "$catok"
      cai=$((cai + 1))
    done
  fi

  # --- attr: alternative xattr setter (round-5 P3) ---
  # `attr -s NAME -V VALUE FILE` sets, `attr -r NAME FILE` removes.
  # Read actions (`-g`, `-l`) stay ALLOWED — gate the walker on
  # presence of `-s` / `-r` in the token list.
  if command_name_is "attr"; then
    local atr_write=0
    local _j
    for ((_j=1; _j<${#CMD_TOKENS_SCAN[@]}; _j++)); do
      case "$(strip_quotes "${CMD_TOKENS_SCAN[$_j]}")" in
        -s|-r|--set|--remove|--set=*|--remove=*|-s?*|-r?*) atr_write=1; break ;;
      esac
    done
    if [ $atr_write -eq 1 ]; then
      local atri=1 atrn=${#CMD_TOKENS_SCAN[@]}
      local atr_seen_dashdash=0
      while [ $atri -lt $atrn ]; do
        local atrtok
        atrtok=$(strip_quotes "${CMD_TOKENS_SCAN[$atri]}")
        if [ $atr_seen_dashdash -eq 0 ]; then
          case "$atrtok" in
            --) atr_seen_dashdash=1; atri=$((atri + 1)); continue ;;
            -s|-V|-r|-g|--set|--value|--remove|--get) atri=$((atri + 2)); continue ;;
            --set=*|--value=*|--remove=*|--get=*|-s?*|-r?*|-g?*|-V?*) atri=$((atri + 1)); continue ;;
            -*|'') atri=$((atri + 1)); continue ;;
          esac
        fi
        validate_command_path strict attr "$atrtok"
        atri=$((atri + 1))
      done
    fi
  fi
}
