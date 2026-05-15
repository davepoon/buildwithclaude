#!/bin/bash
# project-boundary guard — detectors: destructive path tools
# ===========================================================
# Boundary checks for commands that destructively touch filesystem
# paths: xargs-dispatched destructive commands, `find -delete` /
# `find -exec rm`, and the core path-argument walkers for rm, mv,
# cp, and ln. All use STRICT boundary semantics (is_inside_project);
# allowlist does NOT apply because these destroy or move data.
#
# Dispatched from hooks/guard.sh check_single_command; dynamic scope
# provides: CMD, EFFECTIVE_CWD, PROJECT_DIR, helpers from
# hooks/lib/tokenize.sh + hooks/lib/paths.sh +
# extract_option_values from hooks/lib/options.sh.
#
# Each detector calls `exit 2` on a boundary violation.

run_destructive_detectors() {
  # --- xargs with dangerous commands ---
  if command_name_is "xargs"; then
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
  if command_name_is "find"; then
    if echo "$CMD" | grep -qE '(-delete|-(exec|execdir|ok|okdir)[[:space:]]+['\''"]?([^[:space:]'\''"]+/)?(rm|mv)['\''"]?([[:space:]]|$))'; then
      # Extract ALL find paths (non-option arguments after 'find')
      # Skip options like -L, -H, -P that come before the paths
      local -a find_paths=()
      local find_args
      find_args=$(echo "$CMD" | sed -E 's/.*find[[:space:]]+//')
      local past_options=0
      local find_token
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
      local find_path
      # STRICT: find -delete/-exec rm are destructive; allowlist must not apply.
      for find_path in "${find_paths[@]}"; do
        validate_command_path strict "find with destructive action" "$find_path"
      done
    fi

    # --- find -fprint / -fls / -fprintf write target (round-5) ---
    # `find ... -fprint FILE` truncates FILE and writes matching
    # paths into it (find opens with O_WRONLY|O_CREAT|O_TRUNC).
    # `-fls` (long-listing) and `-fprintf FILE FORMAT` have the
    # same write semantics. The find walker above only handled
    # destructive-action verbs (-delete / -exec rm); the print-to-
    # file actions slipped through.
    if echo "$CMD" | grep -qE '(\-fprint|\-fls|\-fprintf)([[:space:]]|$)'; then
      local fpi=1 fpn=${#CMD_TOKENS_SCAN[@]}
      while [ $fpi -lt $fpn ]; do
        local fptok
        fptok=$(strip_quotes "${CMD_TOKENS_SCAN[$fpi]}")
        case "$fptok" in
          -fprint|-fls|-fprintf)
            if [ $((fpi + 1)) -lt $fpn ]; then
              local fpval
              fpval=$(strip_quotes "${CMD_TOKENS_SCAN[$((fpi + 1))]}")
              validate_command_path write "find ${fptok}" "$fpval"
            fi
            ;;
        esac
        fpi=$((fpi + 1))
      done
    fi
  fi

  # --- shred / wipe / srm / bcwipe: destructive overwrite (and ---
  # optional unlink with -u). Same destruction semantics as rm/dd,
  # so STRICT boundary (allowlist must not grant DESTROY-CONTENTS).
  # `wipe` (Berke Durak), `srm` (Sourceforge secure-delete) and
  # `bcwipe` (Jetico) are popular drop-in alternatives — round-5
  # pentest found the trigger missed all three.
  # Walker accepts -n N / -s N / --iterations / --size as flag+value
  # pairs and consumes bare flags otherwise; remaining positionals
  # are FILE operands. /usr/bin/, /bin/, /usr/local/bin/, and
  # /opt/homebrew/bin/ absolute-path forms also match.
  # Anchor on command_name_is so substrings ("echo wipe", "npm run
  # wipe", "printf 'srm: %s'") don't false-positive on the trigger
  # (Codex round-5 P2). _cn_strip_path_prefix already normalises
  # /opt/homebrew/bin/ etc. so absolute-path forms still match.
  local destr_cmd=""
  local _DC
  for _DC in shred wipe srm bcwipe; do
    if command_name_is "$_DC"; then
      destr_cmd="$_DC"
      break
    fi
  done
  if [ -n "$destr_cmd" ]; then
    local shi=1 shn=${#CMD_TOKENS_SCAN[@]}
    local shred_seen_dashdash=0
    while [ $shi -lt $shn ]; do
      local shtok
      shtok=$(strip_quotes "${CMD_TOKENS_SCAN[$shi]}")
      if [ $shred_seen_dashdash -eq 0 ]; then
        case "$shtok" in
          --)
            shred_seen_dashdash=1; shi=$((shi + 1)); continue ;;
          -n|-s|--iterations|--size|--random-source)
            shi=$((shi + 2)); continue ;;
          -*|'')
            shi=$((shi + 1)); continue ;;
        esac
      fi
      validate_command_path strict "$destr_cmd" "$shtok"
      shi=$((shi + 1))
    done
  fi

  # --- File deletion: allowed inside project, blocked outside ---
  # Substring regex (NOT command_name_is) by design for the wrapper-
  # carry case: `nsenter rm /etc/x`, `chroot rm /etc/x`, `docker run
  # alpine rm /` deliberately over-block because host-mount parsing
  # is not in scope. command_name_is would only fire on a post-wrapper
  # `rm` verb and miss those forms. CMD_BLANKED (heredoc bodies wiped)
  # so a quoted-heredoc body that merely mentions `rm` is not tripped —
  # Codex round-4 P3 (sec 99).
  #
  # VERB-GATE on a positive list of verbs that can legitimately host an
  # `rm` argument: rm itself + remote-dispatch wrappers (docker /
  # podman / kubectl / oc / crictl / lxc / ssh / nsenter / chroot) +
  # xargs (rm-by-input). Other verbs (git / gh / echo / printf / cat /
  # ...) skip: substring `rm` in their args is content of a commit
  # message / tag annotation / PR body / docs file, not a real exec.
  # The gate keeps the wrapper-carry over-block intact while removing
  # the false-positive on text-as-arg in metadata-bearing tooling.
  if [[ "${CMD_VERB-}" =~ ^(rm|docker|podman|kubectl|oc|crictl|lxc|ssh|nsenter|chroot|xargs)$ ]] && \
     echo "$CMD_BLANKED" | grep -qE '(^|[[:space:]])rm($|[[:space:]])'; then
    # Extract paths from rm command (skip flags)
    local rm_raw
    rm_raw=$(echo "$CMD" | grep -oE '(^|[[:space:]])rm[[:space:]]+.*' | sed 's/^[[:space:]]*rm[[:space:]]*//' || true)

    local TARGET RESOLVED
    while IFS= read -r TARGET; do
      [[ -z "$TARGET" || "$TARGET" == -* ]] && continue
      # STRICT: rm is destructive; allowlist grants WRITE, not DELETE.
      validate_command_path strict rm "$TARGET"
      RESOLVED=$(resolve_command_path "$TARGET")

      # Block deleting the project root itself
      if [[ "$RESOLVED" == "$PROJECT_DIR" ]]; then
        echo "BLOCKED: Cannot delete the project root directory itself." >&2
        exit 2
      fi
    done < <(tokenize_args "$rm_raw")
  fi

  # --- Moving files outside project ---
  if command_name_is "mv"; then
    # Check -t / --target-directory
    local mv_target_dir
    # STRICT: mv with -t still deletes sources from their original paths.
    # Allowing an allowlisted dir as dest could pair with an outside-project
    # source (caught by the per-arg strict loop below) — keep both ends tight.
    while IFS= read -r mv_target_dir; do
      [ -z "$mv_target_dir" ] && continue
      validate_command_path strict "mv --target-directory" "$mv_target_dir"
    done < <(extract_option_values "-t" "--target-directory" || true)
    local mv_raw
    mv_raw=$(echo "$CMD" | grep -oE '(^|[[:space:]])mv[[:space:]]+.*' | sed 's/^[[:space:]]*mv[[:space:]]*//' || true)

    # STRICT: mv deletes the source; allowlist must not apply, otherwise
    # `mv memory/foo project/foo` would destructively empty the memory dir
    # (allowlist grants WRITE, not move/delete).
    local TARGET
    while IFS= read -r TARGET; do
      [[ -z "$TARGET" || "$TARGET" == -* ]] && continue
      validate_command_path strict mv "$TARGET"
    done < <(tokenize_args "$mv_raw")
  fi

  # --- cp command: check all non-flag arguments ---
  if command_name_is "cp"; then
    # Check -t / --target-directory
    local cp_target_dir
    while IFS= read -r cp_target_dir; do
      [ -z "$cp_target_dir" ] && continue
      validate_command_path strict "cp --target-directory" "$cp_target_dir"
    done < <(extract_option_values "-t" "--target-directory" || true)
    local cp_raw
    cp_raw=$(echo "$CMD" | grep -oE '(^|[[:space:]])cp[[:space:]]+.*' | sed 's/^[[:space:]]*cp[[:space:]]*//' || true)

    local TARGET
    while IFS= read -r TARGET; do
      [[ -z "$TARGET" || "$TARGET" == -* ]] && continue
      validate_command_path strict cp "$TARGET"
    done < <(tokenize_args "$cp_raw")
  fi

  # --- ln command: check all non-flag arguments ---
  if command_name_is "ln"; then
    local ln_raw
    ln_raw=$(echo "$CMD" | grep -oE '(^|[[:space:]])ln[[:space:]]+.*' | sed 's/^[[:space:]]*ln[[:space:]]*//' || true)

    local TARGET
    while IFS= read -r TARGET; do
      [[ -z "$TARGET" || "$TARGET" == -* ]] && continue
      validate_command_path strict ln "$TARGET"
    done < <(tokenize_args "$ln_raw")
  fi
}

