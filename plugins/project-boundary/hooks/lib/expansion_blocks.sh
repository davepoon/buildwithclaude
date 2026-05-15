# shellcheck shell=bash
# project-boundary guard — variable / command-substitution blocks
# ===============================================================
# Two fail-closed scanners extracted from hooks/guard.sh:
#
#   block_unexpanded_var
#       Scans CMD_EXPAND_SCAN for `$VAR`, `${VAR}`, `$1`..`$9`, `$@`,
#       `$*`, `$#`, `$?`, `$$`, `$!`, `$-` outside single quotes.
#       expand_path only resolves ~ / $HOME / ${HOME}; any other
#       expansion would be evaluated by bash at exec time without
#       guard inspection, so refuse.
#
#   block_command_substitution
#       Scans CMD_EXPAND_SCAN for backticks and `$(...)` outside
#       single quotes. Arithmetic `$((...))` is allowed (numeric,
#       no command).
#
# Both read CMD_EXPAND_SCAN from caller's dynamic scope and call
# `exit 2` on a violation. Helpers come from sibling modules.

block_unexpanded_var() {
  # `expand_path` only handles ~, $HOME, ${HOME}. Any other $VAR is kept
  # verbatim and then joined under $EFFECTIVE_CWD, so it looks "inside the
  # project" to the guard while Bash expands it at exec time. Treat it like
  # `$(…)`: if the value cannot be inspected, refuse.
  local vi=0 vlen=${#CMD_EXPAND_SCAN}
  local vin_sq=0 vin_dq=0 vin_esc=0
  while [ $vi -lt $vlen ]; do
    local vc="${CMD_EXPAND_SCAN:$vi:1}"
    if [ $vin_esc -eq 1 ]; then vin_esc=0; vi=$((vi+1)); continue; fi
    if [ "$vc" = "\\" ] && [ $vin_sq -eq 0 ]; then vin_esc=1; vi=$((vi+1)); continue; fi
    if [ "$vc" = "'" ] && [ $vin_dq -eq 0 ]; then vin_sq=$((1-vin_sq)); vi=$((vi+1)); continue; fi
    if [ "$vc" = '"' ] && [ $vin_sq -eq 0 ]; then vin_dq=$((1-vin_dq)); vi=$((vi+1)); continue; fi
    if [ $vin_sq -eq 0 ] && [ "$vc" = "\$" ] && [ $((vi+1)) -lt $vlen ]; then
      local vnext="${CMD_EXPAND_SCAN:$((vi+1)):1}"
      # Explicit passthroughs — NOT parameter expansions:
      #   $(...)   — command substitution, caught by the substitution detector
      #   $'...'   — ANSI-C quoted literal (escape decoding, no expansion)
      #   $"..."   — i18n string literal (no parameter expansion)
      # Arithmetic `$((...))` is handled by the substitution detector.
      if [ "$vnext" = "(" ] || [ "$vnext" = "'" ] || [ "$vnext" = '"' ]; then
        :
      # Allow $HOME / ${HOME} — expand_path handles them.
      elif [[ "$vnext" =~ [A-Za-z_] ]]; then
        local rest="${CMD_EXPAND_SCAN:$((vi+1))}"
        local vname="${rest%%[^A-Za-z0-9_]*}"
        if [ "$vname" != "HOME" ]; then
          echo "BLOCKED: Variable expansion '\$${vname}' cannot be safely inspected. Ask user for explicit permission." >&2
          exit 2
        fi
      elif [ "$vnext" = "{" ]; then
        local rest="${CMD_EXPAND_SCAN:$((vi+2))}"
        local vname="${rest%%\}*}"
        if [ "$vname" != "HOME" ]; then
          echo "BLOCKED: Variable expansion '\${${vname}}' cannot be safely inspected. Ask user for explicit permission." >&2
          exit 2
        fi
      # Positional ($0..$9) and special ($@ $* $# $? $$ $! $-) parameters.
      # These expand at exec time to values the guard cannot inspect —
      # e.g. `set -- /etc/passwd; rm $1` looks like `rm $1` (treated as a
      # relative filename inside cwd) to the regex checks, but bash
      # expands $1 to /etc/passwd at execution. Same fail-closed rule as
      # $FOO applies — every non-HOME expansion is refused.
      elif [[ "$vnext" =~ [0-9@*#?!\$\-] ]]; then
        echo "BLOCKED: Shell parameter expansion '\$${vnext}' cannot be safely inspected. Ask user for explicit permission." >&2
        exit 2
      fi
    fi
    vi=$((vi+1))
  done
}

block_command_substitution() {
  # `$(...)` and backticks are expanded by bash (even inside double quotes),
  # so the guard cannot know the final target. Single quotes keep them literal,
  # so only block when they appear outside single quotes. Arithmetic expansion
  # `$((...))` is allowed — it's a numeric computation, not a command.
  # Similar rationale to blocking `bash -c` / `eval` — the inner command is
  # uninspectable.
  local ci=0 clen=${#CMD_EXPAND_SCAN}
  local cin_sq=0 cin_dq=0 cin_esc=0
  while [ $ci -lt $clen ]; do
    local cc="${CMD_EXPAND_SCAN:$ci:1}"
    if [ $cin_esc -eq 1 ]; then
      cin_esc=0
      ci=$((ci + 1))
      continue
    fi
    if [ "$cc" = "\\" ] && [ $cin_sq -eq 0 ]; then
      cin_esc=1
      ci=$((ci + 1))
      continue
    fi
    # Single quotes are only delimiters when NOT inside double quotes
    if [ "$cc" = "'" ] && [ $cin_dq -eq 0 ]; then
      cin_sq=$(( 1 - cin_sq ))
      ci=$((ci + 1))
      continue
    fi
    # Double quotes are only delimiters when NOT inside single quotes
    if [ "$cc" = '"' ] && [ $cin_sq -eq 0 ]; then
      cin_dq=$(( 1 - cin_dq ))
      ci=$((ci + 1))
      continue
    fi
    if [ $cin_sq -eq 0 ]; then
      if [ "$cc" = "\`" ]; then
        echo "BLOCKED: Command substitution with backticks cannot be safely inspected. Ask user for explicit permission." >&2
        exit 2
      fi
      if [ "$cc" = "\$" ] && [ $((ci + 1)) -lt $clen ] && [ "${CMD_EXPAND_SCAN:$((ci + 1)):1}" = "(" ]; then
        # Skip arithmetic expansion $((...)): next-next char is also (
        if [ $((ci + 2)) -ge $clen ] || [ "${CMD_EXPAND_SCAN:$((ci + 2)):1}" != "(" ]; then
          echo "BLOCKED: Command substitution '\$(...)' cannot be safely inspected. Ask user for explicit permission." >&2
          exit 2
        fi
      fi
    fi
    ci=$((ci + 1))
  done
}
