#!/bin/bash
# project-boundary guard — detectors: write targets
# ==================================================
# Boundary checks for commands whose write semantics this cluster
# evaluates. Two different checks are used depending on the command:
#
#   STRICT (is_inside_project, allowlist does NOT apply):
#     install, rsync — both perform real filesystem writes AND
#     can be pointed at outside-project destinations explicitly;
#     allowlist would let them write to ~/.claude/**/memory from
#     arbitrary sources, which is not the intended use.
#
#   WRITE-PERMITTED (is_write_permitted, allowlist applies):
#     tar -C, unzip -d, cpio -D, tee, curl -o / --output,
#     wget -O / --output-document, dd of=, Bash redirect walker
#
# The five write-permitted detectors that accept a single target
# path (redirect, tee, curl, wget, dd) short-circuit via
# is_discard_target when the resolved target is the POSIX
# bit-bucket (/dev/null).
#
# Dispatched from hooks/guard.sh check_single_command; dynamic
# scope provides: CMD, CMD_TOKENS, CMD_TOKENS_SCAN, EFFECTIVE_CWD,
# PROJECT_DIR, plus helpers from hooks/lib/tokenize.sh +
# hooks/lib/paths.sh + hooks/lib/command_name.sh +
# extract_option_values from hooks/lib/options.sh.
#
# Each detector calls `exit 2` on a boundary violation.

run_write_target_detectors() {
  local TARGET RESOLVED

  # --- install command: like cp, check all non-flag path arguments ---
  # Must be tokenize-aware: the word `install` appears as a subcommand
  # in package managers (npm install / bundle install / poetry install
  # / cargo install / composer install / etc.), which are NOT the GNU
  # install binary and must not be blocked. Only fire when `install`
  # is the actual command-name token.
  if command_name_is install; then
    local install_raw
    install_raw=$(echo "$CMD" | grep -oE '(^|[[:space:]])install[[:space:]]+.*' | sed 's/^[[:space:]]*install[[:space:]]*//' || true)
    # Track whether the previous token was a flag whose VALUE we must
    # skip on the next iteration. The previous walker also skipped any
    # token matching the mode regex ^[0-9]+$ or owner[:group] regex
    # ^[a-zA-Z_][a-zA-Z0-9_]*(:...)?$ unconditionally — that
    # discarded legitimate file operands whose bare name happened to
    # match (e.g. `install src 0755`, `install src root_wheel`),
    # and when EFFECTIVE_CWD sat outside the project the unvalidated
    # destination became a boundary bypass. install grammar puts
    # mode/owner/group ONLY as the value of -m/--mode / -o/--owner /
    # -g/--group, so positional skipping is safe to remove once the
    # flag-value pairs are tracked explicitly.
    # Reported by Copilot review on commit b6de687 (write_targets.sh:47).
    #
    # POSIX `--` end-of-options is also tracked: after the terminator,
    # every token is a positional operand even when its name begins
    # with `-`. Without this, a file operand like `-owned` slipped
    # past the flag-skip case and never reached is_inside_project.
    # Same shape as the rsync POSIX `--` fix in this branch.
    # Reported by Copilot review on commit c4a70e0 (write_targets.sh:67).
    local install_skip_next=0
    local install_seen_dashdash=0
    while IFS= read -r TARGET; do
      if [ "$install_skip_next" -eq 1 ]; then
        install_skip_next=0
        continue
      fi
      [[ -z "$TARGET" ]] && continue
      # Strip quotes for every flag test so `"--help"` and `--help`
      # behave identically (bash strips quotes at exec time). For
      # the attached form `--name=value` the walker only validates
      # the value when name is on the WHITE-LIST of options that
      # actually point at a write target — currently
      # `--target-directory=`. All other -* tokens (including
      # `--mode=`, `--owner=`, `--group=`, etc.) are skipped as
      # flags — their values aren't paths, and even when they
      # syntactically look like one (e.g. `--mode=/0644`), they
      # never become a write destination. The white-list approach
      # replaced an earlier
      # `=*/*` heuristic that both missed relative values and
      # over-matched benign options carrying `/` (Codex review on
      # commit f76ec34, write_targets.sh:100 + 161).
      if [ $install_seen_dashdash -eq 0 ]; then
        local install_tok
        install_tok=$(strip_quotes "$TARGET")
        if [ "$install_tok" = "--" ]; then
          install_seen_dashdash=1
          continue
        fi
        if [[ "$install_tok" == -* ]]; then
          if [[ "$install_tok" == --target-directory=* ]]; then
            local install_attached_val="${install_tok#*=}"
            install_attached_val=$(expand_path "$install_attached_val")
            if [[ "$install_attached_val" != /* ]]; then
              install_attached_val="$EFFECTIVE_CWD/$install_attached_val"
            fi
            local install_attached_resolved
            install_attached_resolved=$(resolve_path "$install_attached_val")
            if ! is_inside_project "$install_attached_resolved"; then
              echo "BLOCKED: 'install --target-directory' targets '$install_attached_resolved' which is OUTSIDE project directory '$PROJECT_DIR'. Ask user for explicit permission." >&2
              exit 2
            fi
            continue
          fi
          case "$install_tok" in
            -m|--mode|-o|--owner|-g|--group)
              install_skip_next=1 ;;
          esac
          continue
        fi
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
    rsync_raw=$(echo "$CMD" | grep -oE '(^|[[:space:]])rsync[[:space:]]+.*' | sed 's/^[[:space:]]*rsync[[:space:]]*//' || true)
    # Track POSIX `--` end-of-options. After it, every token is a
    # positional operand even when its name begins with `-`. Without
    # this, a file operand like `-owned` slipped past the
    # `[[ "$TARGET" == -* ]] && continue` flag-skip and never
    # reached is_inside_project. Same shape as the sed-i and
    # truncate POSIX `--` fix shipped in PR #12 for those two
    # walkers. Reported by Copilot review on commit b6de687
    # (write_targets.sh:66).
    local rsync_seen_dashdash=0
    while IFS= read -r TARGET; do
      [[ -z "$TARGET" ]] && continue
      if [ $rsync_seen_dashdash -eq 0 ]; then
        # Same white-list approach as the install walker. The
        # attached options that actually point at a filesystem
        # write target are:
        #   --log-file=         (writes the run log)
        #   --partial-dir=      (writes partial transfers)
        #   --backup-dir=       (writes backups before overwrite)
        #   --temp-dir=         (writes scratch during transfer)
        #   --write-batch=      (writes batch file)
        #   --only-write-batch= (writes batch file, no transfer)
        #
        # Other slash-bearing options like --exclude=PATTERN,
        # --rsync-path=REMOTE_BIN, --read-batch=PATH (read-only),
        # and the read-only --*-from= filter file flags are
        # skipped as ordinary flags so the detector does not
        # over-match (Codex review on commit f76ec34,
        # write_targets.sh:161, with --write-batch=/--only-write-
        # batch= added per Codex review on commit 00d7300).
        local rsync_tok
        rsync_tok=$(strip_quotes "$TARGET")
        if [ "$rsync_tok" = "--" ]; then
          rsync_seen_dashdash=1
          continue
        fi
        if [[ "$rsync_tok" == -* ]]; then
          case "$rsync_tok" in
            --log-file=*|--partial-dir=*|--backup-dir=*|--temp-dir=*|--write-batch=*|--only-write-batch=*)
              local rsync_attached_val="${rsync_tok#*=}"
              rsync_attached_val=$(expand_path "$rsync_attached_val")
              if [[ "$rsync_attached_val" != /* ]]; then
                rsync_attached_val="$EFFECTIVE_CWD/$rsync_attached_val"
              fi
              local rsync_attached_resolved
              rsync_attached_resolved=$(resolve_path "$rsync_attached_val")
              if ! is_inside_project "$rsync_attached_resolved"; then
                echo "BLOCKED: 'rsync ${rsync_tok%%=*}' targets '$rsync_attached_resolved' which is OUTSIDE project directory '$PROJECT_DIR'. Ask user for explicit permission." >&2
                exit 2
              fi
              ;;
          esac
          continue
        fi
      fi
      # Skip remote rsync paths. Remote syntax requires the `:` to live
      # in the FIRST path segment (before any `/`):
      #   host:path           user@host:path
      #   host::module/path   (daemon form)
      #   rsync://host/path   (URL form)
      # A local path may legitimately contain `:` AFTER a slash
      # (e.g. `../tmp/a:b`); a raw `=~ :` test would skip it and bypass
      # the boundary check. Reported by Copilot review on PR #137.
      case "$TARGET" in
        rsync://*) continue ;;
      esac
      _rsync_first_seg="${TARGET%%/*}"
      case "$_rsync_first_seg" in
        *:*) continue ;;
      esac
      unset _rsync_first_seg
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
        if ! is_write_permitted "$resolved_tar"; then
          echo "BLOCKED: 'tar -C' targets '$resolved_tar' which is OUTSIDE project directory '$PROJECT_DIR'. Ask user for explicit permission." >&2
          exit 2
        fi
      fi
    done
  fi

  # --- unzip -d PATH ---
  if echo "$CMD" | grep -qE '(^|[[:space:]])unzip($|[[:space:]])'; then
    local unzip_dir
    while IFS= read -r unzip_dir; do
      [ -z "$unzip_dir" ] && continue
      unzip_dir=$(expand_path "$unzip_dir")
      if [[ "$unzip_dir" != /* ]]; then
        unzip_dir="$EFFECTIVE_CWD/$unzip_dir"
      fi
      local resolved_unzip
      resolved_unzip=$(resolve_path "$unzip_dir")
      if ! is_write_permitted "$resolved_unzip"; then
        echo "BLOCKED: 'unzip -d' targets '$resolved_unzip' which is OUTSIDE project directory '$PROJECT_DIR'. Ask user for explicit permission." >&2
        exit 2
      fi
    done < <(extract_option_values "-d" "" || true)
  fi

  # --- cpio -D PATH ---
  if echo "$CMD" | grep -qE '(^|[[:space:]])cpio($|[[:space:]])'; then
    local cpio_dir
    while IFS= read -r cpio_dir; do
      [ -z "$cpio_dir" ] && continue
      cpio_dir=$(expand_path "$cpio_dir")
      if [[ "$cpio_dir" != /* ]]; then
        cpio_dir="$EFFECTIVE_CWD/$cpio_dir"
      fi
      local resolved_cpio
      resolved_cpio=$(resolve_path "$cpio_dir")
      if ! is_write_permitted "$resolved_cpio"; then
        echo "BLOCKED: 'cpio -D' targets '$resolved_cpio' which is OUTSIDE project directory '$PROJECT_DIR'. Ask user for explicit permission." >&2
        exit 2
      fi
    done < <(extract_option_values "-D" "" || true)
  fi

  # --- tee command: extract file arguments, block if outside project ---
  if echo "$CMD" | grep -qE '(^|[[:space:]])tee($|[[:space:]])'; then
    local tee_raw
    tee_raw=$(echo "$CMD" | grep -oE '(^|[[:space:]])tee[[:space:]]+.*' | sed 's/^[[:space:]]*tee[[:space:]]*//' || true)

    while IFS= read -r TARGET; do
      [[ -z "$TARGET" || "$TARGET" == -* ]] && continue
      TARGET=$(expand_path "$TARGET")
      if [[ "$TARGET" != /* ]]; then
        TARGET="$EFFECTIVE_CWD/$TARGET"
      fi
      RESOLVED=$(resolve_path "$TARGET")

      # /dev/null is a discard sink for tee (`echo x | tee /dev/null`).
      is_discard_target "$RESOLVED" && continue
      if ! is_write_permitted "$RESOLVED"; then
        echo "BLOCKED: 'tee' targets '$RESOLVED' which is OUTSIDE project directory '$PROJECT_DIR'. Ask user for explicit permission." >&2
        exit 2
      fi
    done < <(tokenize_args "$tee_raw")
  fi

  # --- curl -o / curl --output outside project ---
  # curl -o is positional: `curl -o out1 URL1 -o out2 URL2` writes each URL
  # to its corresponding output. Validate EVERY occurrence.
  if echo "$CMD" | grep -qE '(^|[[:space:]])curl($|[[:space:]])'; then
    local curl_output
    while IFS= read -r curl_output; do
      [ -z "$curl_output" ] && continue
      curl_output=$(expand_path "$curl_output")
      if [[ "$curl_output" != /* ]]; then
        curl_output="$EFFECTIVE_CWD/$curl_output"
      fi
      local resolved_curl
      resolved_curl=$(resolve_path "$curl_output")
      # /dev/null is a discard sink for HTTP probes (`curl -o /dev/null -w %{http_code}`).
      is_discard_target "$resolved_curl" && continue
      if ! is_write_permitted "$resolved_curl"; then
        echo "BLOCKED: 'curl' output file '$resolved_curl' is OUTSIDE project directory '$PROJECT_DIR'. Ask user for explicit permission." >&2
        exit 2
      fi
    done < <(extract_option_values "-o" "--output" || true)
  fi

  # --- wget -O / wget --output-document outside project ---
  if echo "$CMD" | grep -qE '(^|[[:space:]])wget($|[[:space:]])'; then
    local wget_output
    while IFS= read -r wget_output; do
      [ -z "$wget_output" ] && continue
      wget_output=$(expand_path "$wget_output")
      if [[ "$wget_output" != /* ]]; then
        wget_output="$EFFECTIVE_CWD/$wget_output"
      fi
      local resolved_wget
      resolved_wget=$(resolve_path "$wget_output")
      # /dev/null is a discard sink (`wget -O /dev/null URL`).
      is_discard_target "$resolved_wget" && continue
      if ! is_write_permitted "$resolved_wget"; then
        echo "BLOCKED: 'wget' output file '$resolved_wget' is OUTSIDE project directory '$PROJECT_DIR'. Ask user for explicit permission." >&2
        exit 2
      fi
    done < <(extract_option_values "-O" "--output-document" || true)
  fi

  # --- dd of= outside project ---
  # dd accepts repeated key=value operands and the last one wins, so we must
  # validate every of= occurrence — not just the first.
  if echo "$CMD" | grep -qE '(^|[[:space:]])dd($|[[:space:]])'; then
    local raw_tok
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
          # /dev/null is a discard sink (`dd if=x of=/dev/null`).
          if ! is_discard_target "$resolved_dd"; then
            if ! is_write_permitted "$resolved_dd"; then
              echo "BLOCKED: 'dd' output '$resolved_dd' is OUTSIDE project directory '$PROJECT_DIR'. Ask user for explicit permission." >&2
              exit 2
            fi
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
      REDIR_TARGET=$(expand_path "$REDIR_TARGET")
      if [[ "$REDIR_TARGET" != /* ]]; then
        REDIR_TARGET="$EFFECTIVE_CWD/$REDIR_TARGET"
      fi
      local resolved_redir
      resolved_redir=$(resolve_path "$REDIR_TARGET")
      # Follow symlinks so that `echo x > project/link` where
      # `link -> /etc/passwd` is caught. resolve_path only canonicalizes
      # the dirname, not the basename — a symlink leaf slips through.
      local redir_depth=20
      while [[ -L "$resolved_redir" && $redir_depth -gt 0 ]]; do
        local redir_link
        redir_link=$(readlink "$resolved_redir")
        if [[ "$redir_link" == /* ]]; then
          resolved_redir=$(resolve_path "$redir_link")
        else
          resolved_redir=$(resolve_path "$(dirname "$resolved_redir")/$redir_link")
        fi
        redir_depth=$((redir_depth - 1))
      done
      if [[ -L "$resolved_redir" ]]; then
        echo "BLOCKED: Redirect target symlink chain too deep or circular at '$resolved_redir'. Ask user for explicit permission." >&2
        exit 2
      fi
      # /dev/null is a discard sink for every redirect form
      # (`> /dev/null`, `2> /dev/null`, `&> /dev/null`, `2>&1 > /dev/null`).
      if ! is_discard_target "$resolved_redir"; then
        if ! is_write_permitted "$resolved_redir"; then
          echo "BLOCKED: Redirect target '$resolved_redir' is OUTSIDE project directory '$PROJECT_DIR'. Ask user for explicit permission." >&2
          exit 2
        fi
      fi
    fi
  done
}
