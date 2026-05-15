#!/bin/bash
# project-boundary guard — tokenize module
# =========================================
# Pure string-handling helpers used across the guard: quote stripping,
# quote-aware argument tokenisation, and glob-to-regex translation.
#
# NO side effects on global state. NO dependencies on other guard
# modules. Safe to source before any other init.
#
# Sourced by hooks/guard.sh; sibling modules in hooks/lib/ can rely on
# these being defined at load time.

# --- Convert a glob pattern to an anchored regex ---
# We can't rely on bash `[[ == ]]` + globstar because in that form `*`
# matches `/` too (so `projects/*/memory` would also match
# `projects/a/b/memory`). Custom translator enforces path-segment semantics:
#   `**` matches any characters including `/`
#   `*`  matches any characters EXCEPT `/`
#   `?`  matches a single character except `/`
#   other regex metachars are escaped to literals
glob_to_regex() {
  local g="$1"
  local out=""
  local i=0 n=${#g}
  while [ $i -lt $n ]; do
    local c="${g:$i:1}"
    if [ "$c" = "*" ] && [ $((i + 1)) -lt $n ] && [ "${g:$((i + 1)):1}" = "*" ]; then
      out="${out}.*"
      i=$((i + 2))
    elif [ "$c" = "*" ]; then
      out="${out}[^/]*"
      i=$((i + 1))
    elif [ "$c" = "?" ]; then
      out="${out}[^/]"
      i=$((i + 1))
    else
      case "$c" in
        .|+|\(|\)|\{|\}|\||\^|\$|\\|\[|\])
          out="${out}\\${c}" ;;
        *)
          out="${out}${c}" ;;
      esac
      i=$((i + 1))
    fi
  done
  printf '^%s$' "$out"
}

# --- Strip one layer of surrounding quotes (single or double) ---
# Used before matching option flags like `-o` / `--output` against tokens,
# since tokenize_args preserves quotes: `curl "-o" file` → token `"-o"`.
strip_quotes() {
  local p="$1"
  if [[ "$p" == \"*\" ]]; then
    p="${p#\"}"
    p="${p%\"}"
  elif [[ "$p" == \'*\' ]]; then
    p="${p#\'}"
    p="${p%\'}"
  fi
  printf '%s\n' "$p"
}

# --- Quote-aware argument tokenizer ---
# Splits a string into tokens respecting single and double quotes.
# Tokens are newline-separated on stdout with quotes preserved (expand_path strips them).
tokenize_args() {
  local input="$1"
  local -a tokens=()
  local current=""
  local in_sq=0 in_dq=0
  local i=0 len=${#input}

  while [ $i -lt $len ]; do
    local ch="${input:$i:1}"

    if [ "$ch" = "'" ] && [ $in_dq -eq 0 ]; then
      in_sq=$(( 1 - in_sq ))
      current="${current}${ch}"
    elif [ "$ch" = '"' ] && [ $in_sq -eq 0 ]; then
      in_dq=$(( 1 - in_dq ))
      current="${current}${ch}"
    elif { [ "$ch" = ' ' ] || [ "$ch" = $'\t' ]; } && [ $in_sq -eq 0 ] && [ $in_dq -eq 0 ]; then
      if [ -n "$current" ]; then
        tokens+=("$current")
        current=""
      fi
    else
      current="${current}${ch}"
    fi
    i=$((i + 1))
  done

  if [ -n "$current" ]; then
    tokens+=("$current")
  fi

  for t in "${tokens[@]}"; do
    printf '%s\n' "$t"
  done
}

# --- Fill a named array with tokenize_args output ---
# Usage: fill_tokens_from <array_name> <cmd_string>
# Replaces the open-coded `arr=(); while read tok; arr+=(...); done <
# <(tokenize_args "$cmd")` boilerplate. guard.sh uses this twice for
# CMD_TOKENS and twice for CMD_TOKENS_SCAN (once at initial build, once
# after remote-dispatch rewrite); centralising removes a 4× repeat.
# Uses eval (not `local -n`) for bash 3.2 compatibility — macOS ships
# /bin/bash 3.2 and the whole project targets that.
fill_tokens_from() {
  local _arr_name="$1"
  local _src="$2"
  eval "$_arr_name=()"
  local _tok
  while IFS= read -r _tok; do
    [[ -z "$_tok" ]] && continue
    eval "$_arr_name+=(\"\$_tok\")"
  done < <(tokenize_args "$_src")
}
