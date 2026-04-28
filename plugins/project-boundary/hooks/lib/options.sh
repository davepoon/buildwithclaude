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
    if [ -n "$short" ] && [ "$tok" = "$short" ] && [ $((i + 1)) -lt $n ]; then
      printf '%s\n' "${CMD_TOKENS[$((i + 1))]}"
      found=0
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
