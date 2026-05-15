#!/bin/bash
# project-boundary guard — options module
# ========================================
# Two orchestration helpers kept together because they wrap the
# tokenizer for higher-level consumers:
#
#   extract_option_values  -  pull out EVERY value attached to a
#                             short / long option flag, including
#                             the `--long=value` attached form.
#                             Consumed by write-target detectors
#                             (curl -o, wget -O, tar -C, unzip -d,
#                             cpio -D, cp/mv -t) and by the
#                             destructive walker for mv/cp -t.
#
#   split_and_check        -  split the original COMMAND on bash
#                             operators (;, &&, ||, |, newline)
#                             outside of quoted regions and
#                             heredoc bodies, then dispatch each
#                             sub-command through
#                             check_single_command. Quoted heredoc
#                             bodies are blanked first via
#                             blank_quoted_heredoc_bodies so
#                             operators inside them are NOT
#                             treated as separators.
#
# Dependencies from dynamic scope at call time:
#   extract_option_values - CMD_TOKENS array (local to
#                           check_single_command)
#   split_and_check       - exports _GUARD_CD_OUTSIDE +
#                           _GUARD_CD_IN_ALLOWLIST; calls
#                           blank_quoted_heredoc_bodies and
#                           check_single_command
#
# Both are pure data-shape helpers: they call `exit 2` only via
# their dispatched detectors, not directly.

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
    if [ -n "$short" ]; then
      if [ "$tok" = "$short" ] && [ $((i + 1)) -lt $n ]; then
        printf '%s\n' "${CMD_TOKENS[$((i + 1))]}"
        found=0
      # Attached short form (sec 112): `-o<val>` / `-O<val>` /
      # `-t<dir>` / `-D<dir>`. Previously missed — same shape gap
      # that custom walkers fixed individually for unzip -d
      # (sec 102) and wget -P (sec 104); closing it here covers
      # every caller. `${short}?*` requires at least one char
      # after the flag so bare `-o` doesn't accidentally match.
      elif [[ "$tok" == "${short}"?* ]]; then
        printf '%s\n' "${tok#$short}"
        found=0
      fi
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

# --- Extract option values from a NAMED array ---
# Like extract_option_values, but operates on any array name (most
# detectors walk CMD_TOKENS_SCAN, not CMD_TOKENS — the heredoc-blanked
# token stream — so they cannot reuse extract_option_values).
#
# Usage: extract_attached_or_split_from <array_name> <short> <long>
#   short: e.g. "-f", "" to skip
#   long:  e.g. "--file", "" to skip
# Recognises:
#   -f VAL          (split short)
#   -fVAL           (attached short — `?*` glob)
#   --file VAL      (split long)
#   --file=VAL      (attached long with `=`)
# Quotes are stripped from each emitted value.
# Bash 3.2 compatible — uses `eval` for indirect array access (macOS
# /bin/bash 3.2 has no `local -n` namerefs). Array name is a literal
# identifier from the caller, never user-controlled.
extract_attached_or_split_from() {
  local _arr_name="$1"
  local _short="$2"
  local _long="$3"
  local _n
  eval "_n=\${#${_arr_name}[@]}"
  local _i=0
  while [ $_i -lt $_n ]; do
    local _raw
    eval "_raw=\"\${${_arr_name}[\$_i]}\""
    local _tok
    _tok=$(strip_quotes "$_raw")
    if [ -n "$_short" ]; then
      if [ "$_tok" = "$_short" ] && [ $((_i + 1)) -lt $_n ]; then
        local _nxt
        eval "_nxt=\"\${${_arr_name}[\$((_i + 1))]}\""
        printf '%s\n' "$(strip_quotes "$_nxt")"
        _i=$((_i + 2)); continue
      fi
      if [[ "$_tok" == "${_short}"?* ]]; then
        printf '%s\n' "${_tok#$_short}"
      fi
    fi
    if [ -n "$_long" ]; then
      if [ "$_tok" = "$_long" ] && [ $((_i + 1)) -lt $_n ]; then
        local _nxt
        eval "_nxt=\"\${${_arr_name}[\$((_i + 1))]}\""
        printf '%s\n' "$(strip_quotes "$_nxt")"
        _i=$((_i + 2)); continue
      fi
      if [[ "$_tok" == "${_long}="* ]]; then
        printf '%s\n' "${_tok#${_long}=}"
      fi
    fi
    _i=$((_i + 1))
  done
}

# --- Walk path operands of a positional verb ---
# For tools whose payload is a list of positional PATHs guarded by a
# fixed set of skip-the-next-token flags (mkfifo, mknod, mkdir, ...).
# Flag-stripping respects the POSIX `--` separator.
#
# Usage: walk_path_operands_from <array_name> <skip_value_flags> <attached_value_flags>
#   skip_value_flags:     space-separated flag names that consume the
#                         NEXT token as a value (e.g. "-m --mode -Z").
#   attached_value_flags: space-separated long flag names whose `=VAL`
#                         attached form should be skipped (e.g.
#                         "--mode --context").
# Walks from index 1 (assumes verb at index 0 — true for CMD_TOKENS /
# CMD_TOKENS_SCAN after wrapper-stripping). Prints each non-flag
# positional on its own line, with quotes stripped.
walk_path_operands_from() {
  local _arr_name="$1"
  local _skip_value="$2"
  local _attached_value="$3"
  local _n
  eval "_n=\${#${_arr_name}[@]}"
  local _i=1
  local _seen_dd=0
  while [ $_i -lt $_n ]; do
    local _raw
    eval "_raw=\"\${${_arr_name}[\$_i]}\""
    local _tok
    _tok=$(strip_quotes "$_raw")
    if [ $_seen_dd -eq 0 ]; then
      if [ "$_tok" = "--" ]; then
        _seen_dd=1; _i=$((_i + 1)); continue
      fi
      if [ -z "$_tok" ]; then
        _i=$((_i + 1)); continue
      fi
      local _sf _matched=0
      for _sf in $_skip_value; do
        if [ "$_tok" = "$_sf" ]; then _matched=1; break; fi
      done
      if [ $_matched -eq 1 ]; then
        _i=$((_i + 2)); continue
      fi
      local _af
      for _af in $_attached_value; do
        if [[ "$_tok" == "${_af}="* ]]; then _matched=1; break; fi
      done
      if [ $_matched -eq 1 ]; then
        _i=$((_i + 1)); continue
      fi
      if [[ "$_tok" == -* ]]; then
        _i=$((_i + 1)); continue
      fi
    fi
    printf '%s\n' "$_tok"
    _i=$((_i + 1))
  done
}

# --- Split command into sub-commands and check each ---
# Split on ;, &&, ||, and | (but not inside quoted strings)
# This is a basic splitter that handles common cases.
split_and_check() {
  local full_cmd="$1"
  export _GUARD_CD_OUTSIDE=0
  export _GUARD_CD_IN_ALLOWLIST=0
  local -a subcmds=()
  local current=""
  local in_single_quote=0
  local in_double_quote=0
  local i=0
  local len=${#full_cmd}
  local ch

  # Use a heredoc-blanked copy to detect operator positions. Quoted
  # heredoc bodies (`<<'EOF'` / `<<"EOF"` / `<<\EOF`) get spaces in
  # `scan_cmd` (byte offsets preserved), so `&&` / `||` / `;` / `|`
  # inside such bodies are NOT treated as command separators. Without
  # this, a body line like `X=/etc/x && rm $X` would split into two
  # pseudo-commands; the second (`rm $X\nEOF`) loses heredoc context
  # and the $VAR detector false-positives.
  local scan_cmd
  scan_cmd=$(blank_quoted_heredoc_bodies "$full_cmd" blank_newlines)
  # Defensive: if helper returned a different length (it should not),
  # fall back to scanning full_cmd directly to preserve original
  # semantics.
  if [ ${#scan_cmd} -ne $len ]; then
    scan_cmd="$full_cmd"
  fi

  while [ $i -lt $len ]; do
    ch="${scan_cmd:$i:1}"
    local raw_ch="${full_cmd:$i:1}"

    # Handle quotes
    if [ "$ch" = "'" ] && [ $in_double_quote -eq 0 ]; then
      if [ $in_single_quote -eq 0 ]; then
        in_single_quote=1
      else
        in_single_quote=0
      fi
      current="${current}${raw_ch}"
      i=$((i + 1))
      continue
    fi

    if [ "$ch" = '"' ] && [ $in_single_quote -eq 0 ]; then
      if [ $in_double_quote -eq 0 ]; then
        in_double_quote=1
      else
        in_double_quote=0
      fi
      current="${current}${raw_ch}"
      i=$((i + 1))
      continue
    fi

    # Only split when not inside quotes
    if [ $in_single_quote -eq 0 ] && [ $in_double_quote -eq 0 ]; then
      # Check for && or ||
      if [ $i -lt $((len - 1)) ]; then
        local two_char="${scan_cmd:$i:2}"
        if [ "$two_char" = "&&" ] || [ "$two_char" = "||" ]; then
          subcmds+=("$current")
          current=""
          i=$((i + 2))
          continue
        fi
      fi

      # Check for ; or literal newline — bash treats both as command
      # terminators. Without splitting on newline, a multi-line command
      # like `echo ok\nbash /tmp/evil.sh` reaches every "first-token"
      # detector as a single subcommand whose name is `echo`, hiding
      # the script-execute on the second line. scan_cmd was built with
      # the blank_newlines flag, so newlines inside a quoted heredoc
      # body have already been replaced with spaces (the flag also
      # subsumes the newline immediately before each body). Any
      # newline still visible in scan_cmd at this point is therefore
      # outside every heredoc body, and bash would treat it as a
      # command separator — we do the same.
      if [ "$ch" = ";" ] || [ "$ch" = $'\n' ]; then
        subcmds+=("$current")
        current=""
        i=$((i + 1))
        continue
      fi

      # Check for | — but not if it's part of the Bash clobber operator >| or >>|
      if [ "$ch" = "|" ]; then
        # Look at the trailing chars of current (trimmed) to detect > or >>
        local trimmed="${current%"${current##*[![:space:]]}"}"
        if [[ "$trimmed" == *\> ]]; then
          # Part of >| or >>| — keep it as a redirect operator, not a pipe
          current="${current}${raw_ch}"
          i=$((i + 1))
          continue
        fi
        subcmds+=("$current")
        current=""
        i=$((i + 1))
        continue
      fi
    fi

    current="${current}${raw_ch}"
    i=$((i + 1))
  done

  # Add the last sub-command
  if [ -n "$current" ]; then
    subcmds+=("$current")
  fi

  # Check each sub-command
  local subcmd
  for subcmd in "${subcmds[@]}"; do
    check_single_command "$subcmd"
  done
}
