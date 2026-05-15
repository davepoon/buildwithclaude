# shellcheck shell=bash
# project-boundary guard — shell / interpreter execution walkers
# ===============================================================
# Extracted from hooks/guard.sh check_single_command. All five
# walkers fail-closed on un-inspectable code execution surfaces:
#
#   block_nested_shell_and_eval
#       `bash -c CMD`, `sh -c CMD`, `zsh -c CMD`, ..., `eval CMD`.
#
#   block_interpreter_inline_code
#       `python -c`, `perl -e`, `ruby -e`, `node -e`, `php -r`,
#       `awk 'BEGIN{system(...)}'`, etc.
#
#   block_pipe_to_shell
#       Bare `sh`/`bash`/... or shell with only flags (e.g. `bash -s`)
#       — typical `echo "rm -rf /" | sh` shape.
#
#   block_shell_script_execution
#       Path-form: `bash /tmp/x.sh`, `source ~/x.sh`, `. /tmp/x.sh`.
#       STRICT project-root (allowlist must NOT grant execute).
#       Uses tokenize-with-redirects + heredoc-blanked parallel
#       stream + symlink dereference.
#
# All read CMD / CMD_BLANKED / EFFECTIVE_CWD / PROJECT_DIR from
# caller's dynamic scope. Helpers (strip_quotes, expand_path,
# resolve_path, tokenize_args, blank_quoted_heredoc_bodies,
# is_shell_token, is_source_token) come from sibling modules.
# Each calls `exit 2` on a boundary violation.

block_nested_shell_and_eval() {
  # Match: bash -c, sh -c, bash -lc, bash -ec, /bin/bash -c, /bin/sh -c, /usr/bin/env bash -c
  # Also zsh / ksh / dash / fish / xonsh / tcsh / csh / nu / pwsh / osh
  # (macOS ships zsh by default; all accept -c CMD with un-inspectable semantics).
  #
  # VERB-GATE: substring matching alone false-positives on text-as-arg
  # cases (`echo "use bash -c here" > docs/fp.md`, `git commit -m
  # "explain eval risk"`). Gate every check on CMD_VERB so the
  # substring walker only fires when the verb itself is a shell
  # opener, an interpreter wrapper that resolves to one (env / sudo /
  # nice / ... already collapsed by _cn_find_verb_idx — CMD_VERB is
  # the post-wrapper name), or a remote-dispatch verb where the
  # asymmetry pin (294b64d / 7b65a45) intentionally over-blocks
  # inline-shell payloads.
  #
  # INTENTIONAL ORDERING: this walker still runs BEFORE
  # rewrite_remote_dispatch. That is what keeps `docker exec ctr sh
  # -c '...'`, `kubectl exec pod -- bash -c '...'`, `ssh host bash -c
  # '...'` blocked: CMD_VERB at this point is still `docker` /
  # `kubectl` / `ssh`, not yet rewritten away. Deferring the check to
  # AFTER remote-dispatch neutralisation would make the boundary
  # easier to abuse via payloads hidden in pseudo-remote arguments
  # (e.g. an alias that resolves `docker` to a local script but still
  # parses as `docker exec ...`). Path-operand forms (`docker exec
  # ctr rm /etc/x`) remain ALLOWED via rewrite_remote_dispatch —
  # CMD_VERB falls in the `*` branch and the walker returns. See the
  # asymmetry tests in test_true_negatives_b.sh near the docker exec
  # block.
  case "${CMD_VERB-}" in
    bash|sh|zsh|ksh|dash|fish|xonsh|tcsh|csh|nu|pwsh|osh)
      ;;  # real shell opener — fall through to the substring check
    docker|podman|kubectl|oc|crictl|lxc|ssh)
      ;;  # remote-dispatch verb — asymmetry pin: inline shell payload BLOCK
    eval)
      echo "BLOCKED: 'eval' cannot be safely inspected. Ask user for explicit permission." >&2
      exit 2 ;;
    *)
      return ;;  # text-as-arg / unrelated verb — substring is content, not exec
  esac
  if echo "$CMD" | grep -qE '(^|[[:space:]])(/usr/bin/env[[:space:]]+)?(/bin/)?(bash|sh|zsh|ksh|dash|fish|xonsh|tcsh|csh|nu|pwsh|osh)[[:space:]]+-[a-zA-Z]*c[[:space:]]'; then
    echo "BLOCKED: Nested shell execution ('bash -c' / 'sh -c' / 'zsh -c' / ...) cannot be safely inspected. Ask user for explicit permission." >&2
    exit 2
  fi
  if echo "$CMD" | grep -qE '(^|[[:space:]])eval[[:space:]]'; then
    echo "BLOCKED: 'eval' cannot be safely inspected. Ask user for explicit permission." >&2
    exit 2
  fi

}

# --- trap CMD SIG: deferred shell handler (round-4 pentest) ---
# `trap CMD SIG` registers CMD as a shell handler that fires on the
# named signal (EXIT, INT, TERM, ...). CMD is arbitrary shell code
# stored on argv and executed later — same un-inspectable semantics
# as `bash -c CMD` and `eval`. Read-only forms have no deferred CMD
# and stay ALLOWED:
#   trap            (list current traps)
#   trap -l         (list signal names)
#   trap -p         (print traps in re-input form)
#   trap - SIG      (reset SIG to default — first positional `-`)
#   trap '' SIG     (ignore SIG — first positional empty)
# Lifted out of block_nested_shell_and_eval so the verb-gate on the
# bash -c / eval substring checks does not also bypass this walker —
# `trap` is its own verb and command_name_is gates correctly.
block_trap_handler() {
  if ! command_name_is "trap"; then
    return
  fi
  local trap_i=1 trap_n=${#CMD_TOKENS_SCAN[@]}
  local trap_seen_dashdash=0
  local trap_readonly=0
  local trap_first_pos=""
  local trap_first_pos_set=0
  while [ $trap_i -lt $trap_n ]; do
    local trap_tok
    trap_tok=$(strip_quotes "${CMD_TOKENS_SCAN[$trap_i]}")
    if [ $trap_seen_dashdash -eq 0 ]; then
      case "$trap_tok" in
        --)
          trap_seen_dashdash=1; trap_i=$((trap_i + 1)); continue ;;
        -l|-p)
          # `-l` / `-p` make the entire call read-only regardless
          # of any signal-name args that may follow.
          trap_readonly=1; break ;;
      esac
    fi
    trap_first_pos="$trap_tok"
    trap_first_pos_set=1
    break
  done
  if [ "$trap_readonly" -eq 0 ] \
     && [ "$trap_first_pos_set" -eq 1 ] \
     && [ -n "$trap_first_pos" ] \
     && [ "$trap_first_pos" != "-" ]; then
    echo "BLOCKED: 'trap CMD SIG' deferred shell handler cannot be safely inspected. Ask user for explicit permission." >&2
    exit 2
  fi
}

block_interpreter_inline_code() {
  # python/perl/ruby/node/php/osascript all accept code on argv. The inner
  # string cannot be inspected, so the same fail-closed rule as `bash -c`
  # applies. Flags covered: -c (python), -e (perl/ruby/node), --eval,
  # --execute, -E (perl alias). A dedicated rule catches `awk 'BEGIN{system(
  # "…")}'` and similar because awk programs are the first non-option arg,
  # not behind a flag — so we detect the `system(` marker in the CMD_BLANKED
  # view (heredoc bodies stripped) so a tee/cat heredoc whose body merely
  # mentions `python -c`, `awk … system(…)`, etc. is not false-positively
  # rejected.
  #
  # VERB-GATE: same reasoning as block_nested_shell_and_eval. Substring
  # walkers without a verb gate false-positive on text-as-arg cases
  # like `echo "avoid node -e examples" > docs/fp.md` and `git commit
  # -m "docs: avoid python -c examples"`. Each branch below now gates
  # on CMD_VERB so the substring check only fires when the verb itself
  # is the matching interpreter (post-wrapper, post-path-prefix). For
  # the awk family, `awk` / `gawk` / `mawk` / `nawk` all collapse to a
  # bare verb name via _cn_strip_path_prefix.
  case "${CMD_VERB-}" in
    python|python2|python3|perl|ruby|node|nodejs|deno|bun|osascript|Rscript)
      if echo "$CMD_BLANKED" | grep -qE '(^|[[:space:]])(python|python2|python3|perl|ruby|node|nodejs|deno|bun|osascript|Rscript)[[:space:]]+(-[a-zA-Z]*[ceE]|--eval|--execute)([[:space:]]|=|$)'; then
        echo "BLOCKED: Non-shell interpreter with inline code flag cannot be safely inspected. Ask user for explicit permission." >&2
        exit 2
      fi ;;
    php)
      # Dedicated PHP rule — `-r`, `-R`, `--run` execute inline code.
      # Cannot be folded into the python/etc. regex because `-r` is a
      # module-preload flag in ruby/node (no code execution), so a
      # generic `r` letter would false-positive on `ruby -r json` /
      # `node -r dotenv`. The matcher accepts attached forms
      # (`-rcode`, `-Rcode`), quoted-attached (`-r'code'`), clustered-
      # ending (`-ar`, `-aR`), and the long alias `--run`.
      if echo "$CMD_BLANKED" | grep -qE '(^|[[:space:]])php[[:space:]]+(-[rR][^[:space:]=]*|-[a-zA-Z]*[rR]|--run)([[:space:]]|=|$|'\''|")'; then
        echo "BLOCKED: 'php -r/-R/--run' inline code cannot be safely inspected. Ask user for explicit permission." >&2
        exit 2
      fi
      # php also accepts -c/--eval inline forms — same regex as the
      # python branch covers them.
      if echo "$CMD_BLANKED" | grep -qE '(^|[[:space:]])php[[:space:]]+(-[a-zA-Z]*[ceE]|--eval|--execute)([[:space:]]|=|$)'; then
        echo "BLOCKED: Non-shell interpreter with inline code flag cannot be safely inspected. Ask user for explicit permission." >&2
        exit 2
      fi ;;
    awk|gawk|mawk|nawk)
      if echo "$CMD_BLANKED" | grep -qE 'system[[:space:]]*\(|\|[[:space:]]*&?[[:space:]]*"?(sh|bash)'; then
        echo "BLOCKED: awk program with 'system()' / shell pipe cannot be safely inspected. Ask user for explicit permission." >&2
        exit 2
      fi ;;
  esac
}

block_pipe_to_shell() {
  # Match bare shell invocations: sh, bash, zsh, ksh, dash, fish,
  # /bin/sh, /bin/bash, ..., and with flags: sh -s, bash --login, etc.
  # But NOT: bash script.sh, bash -x script.sh (running a script file).
  if echo "$CMD" | grep -qE '^(/bin/)?(sh|bash|zsh|ksh|dash|fish)$'; then
    echo "BLOCKED: Piping to 'sh'/'bash'/'zsh'/'ksh'/'dash'/'fish' cannot be safely inspected. Ask user for explicit permission." >&2
    exit 2
  fi
  # Match shell with only flags (no script file): sh -s, bash --login, sh -s -- args
  if echo "$CMD" | grep -qE '^(/bin/)?(sh|bash|zsh|ksh|dash|fish)[[:space:]]+-'; then
    local shell_args
    shell_args=$(echo "$CMD" | sed -E 's/^(\/bin\/)?(sh|bash|zsh|ksh|dash|fish)[[:space:]]+//')
    local has_script=0
    local shell_token
    for shell_token in $shell_args; do
      case "$shell_token" in
        --) break ;;  # everything after -- is args to the script/stdin
        # Informational-only flags exit before reading stdin or
        # executing user code — `bash --version` / `sh --help` are
        # not pipe-to-shell targets even when they appear as a
        # standalone subcommand (issue #33).
        #
        # Codex sweep 4: `-V` is NOT safe across all shells —
        # zsh and dash treat `-V` as the version flag but still
        # read and execute stdin, so `curl URL | zsh -V` was a
        # real pipe-to-shell bypass. bash and ksh reject `-V`
        # as an unknown option (no stdin read), but the walker
        # can't distinguish per-shell here. Drop `-V` from the
        # whitelist entirely — only the long forms `--version`
        # and `--help` are safe across the guarded shell set.
        --version|--help)
          has_script=1; break ;;
        -*) continue ;;
        *) has_script=1; break ;;
      esac
    done
    if [[ $has_script -eq 0 ]]; then
      echo "BLOCKED: Piping to 'sh'/'bash' cannot be safely inspected. Ask user for explicit permission." >&2
      exit 2
    fi
  fi
}

block_shell_script_execution() {
  # Catches: `bash /tmp/x.sh`, `sh ~/x.sh`, `zsh|ksh|dash|fish /tmp/x.sh`,
  # `source /tmp/x.sh`, `. /tmp/x.sh`. Inline-code forms (`bash -c ...`)
  # are caught by block_nested_shell_and_eval; this covers the
  # complementary case where the script is a path argument.
  #
  # STRICT project-root check (no allowlist). Allowlist grants WRITE to
  # specific paths (e.g. memory/); if execute inherited that, a write-
  # allowlisted dir would become an RCE escape hatch:
  #   `echo 'rm -rf $HOME' > memory/x.sh && bash memory/x.sh`.
  # Walk CMD_TOKENS to locate the shell/source invocation, possibly buried
  # behind an `env [flags] [VAR=val]*` wrapper. Once found, scan for the
  # script-path operand — honoring flags that consume the next token
  # (-O / -o for bash set options). Finally, dereference symlinks on the
  # script path so a `project/link.sh -> /tmp/evil.sh` bait is caught.
  # Re-tokenize the command with redirect operators (< << <<< <<-) spaced
  # out so that attached forms like `bash</tmp/x.sh`, `bash<<EOF`, and
  # `bash<<<'rm -rf /'` don't slip past as single unsplit tokens.
  local _exec_cmd
  _exec_cmd=$(printf '%s' "$CMD" | sed -E 's/(<<-|<<<|<<|<)/ \1 /g')
  local -a CMD_TOKENS_EXEC=()
  local _etok
  while IFS= read -r _etok; do
    [[ -z "$_etok" ]] && continue
    CMD_TOKENS_EXEC+=("$_etok")
  done < <(tokenize_args "$_exec_cmd")

  # A parallel token stream built from a heredoc-blanked copy of CMD.
  # Used ONLY by the `_saw_redir`/`exec_kind` scans below, which otherwise
  # would treat a quoted-heredoc body byte like "bash" or "source" as a
  # shell token and false-positive with
  #   "Stdin redirection feeding shell cannot be safely inspected"
  # on perfectly innocuous text like a git-commit body mentioning `bash`.
  # Real shell-stdin attacks (`bash << /tmp/x`, `< /tmp/x bash`,
  # `bash <<'EOF' ... EOF`, `bash <<<'rm -rf /'`, attached `bash</tmp/x>`)
  # still appear in this stream because their shell token sits OUTSIDE
  # any heredoc body, so the fail-closed detectors keep firing.
  local _exec_cmd_scan
  _exec_cmd_scan=$(blank_quoted_heredoc_bodies "$CMD" \
                   | sed -E 's/(<<-|<<<|<<|<)/ \1 /g')
  local -a CMD_TOKENS_EXEC_SCAN=()
  while IFS= read -r _etok; do
    [[ -z "$_etok" ]] && continue
    CMD_TOKENS_EXEC_SCAN+=("$_etok")
  done < <(tokenize_args "$_exec_cmd_scan")

  local exec_kind="" exec_shell_idx=-1
  local _ti=0 _tn=${#CMD_TOKENS_EXEC[@]}

  # Fail-closed on ANY stdin redirect (< << <<< <<-) that appears before
  # a shell/source token — regardless of leading wrappers or VAR=val.
  # Bash allows redirections to sit anywhere in the command-prefix, so
  # `FOO=1 < /tmp/evil.sh bash`, `nice < /tmp/evil.sh bash`, and a bare
  # `< /tmp/evil.sh bash` all feed the shell from an uninspectable source.
  local _rk=0 _saw_redir=0
  local _tn_scan=${#CMD_TOKENS_EXEC_SCAN[@]}
  while [ $_rk -lt $_tn_scan ]; do
    local _rtok_chk
    _rtok_chk=$(strip_quotes "${CMD_TOKENS_EXEC_SCAN[$_rk]}")
    case "$_rtok_chk" in
      \<|\<\<|\<\<\<|\<\<-) _saw_redir=1 ;;
      *)
        if [ $_saw_redir -eq 1 ] && { is_shell_token "$_rtok_chk" || is_source_token "$_rtok_chk"; }; then
          echo "BLOCKED: Stdin redirection feeding shell cannot be safely inspected. Ask user for explicit permission." >&2
          exit 2
        fi
        ;;
    esac
    _rk=$((_rk + 1))
  done

  # Fail-closed on `env -S <str>`, `env --split-string=<str>`, `env -C <dir>`,
  # `env --chdir=<dir>`: all of these either hide the real command inside a
  # split string or change the cwd so relative script paths no longer match
  # what Bash actually executes.
  if [ $_tn -gt 0 ]; then
    local _env_first
    _env_first=$(strip_quotes "${CMD_TOKENS_EXEC[0]}")
    if [[ "$_env_first" == "env" || "$_env_first" == "/usr/bin/env" ]]; then
      local _envk=1
      while [ $_envk -lt $_tn ]; do
        local _envtok
        _envtok=$(strip_quotes "${CMD_TOKENS_EXEC[$_envk]}")
        case "$_envtok" in
          -S|-S*|--split-string|--split-string=*|-C|-C*|--chdir|--chdir=*)
            echo "BLOCKED: 'env -S/--split-string/-C/--chdir' cannot be safely inspected. Ask user for explicit permission." >&2
            exit 2 ;;
        esac
        _envk=$((_envk + 1))
      done
    fi
  fi

  # Walk past common runtime wrappers (env, command, nice, nohup, timeout,
  # time, stdbuf, ionice, chrt, taskset) and any leftover sudo flags
  # (sudo itself is already stripped at the top of check_single_command,
  # but its own short flags can remain in the token stream as `-E` etc.).
  # We only advance past token 0 when it is a recognized wrapper or looks
  # like a flag / VAR=val — this avoids false positives on invocations
  # like `echo bash`, where `bash` is an argument, not the command.
  # Greedy skip: walk past wrappers / flags / VAR=val / operands until
  # a shell or source token appears. Known tradeoff — this over-blocks
  # `time echo bash /tmp/x` (bash is an arg to echo, not a shell), but
  # precise per-wrapper operand grammars would miss real bypasses like
  # `timeout -s TERM 10 bash /tmp/x` and `stdbuf -o L bash /tmp/x` where
  # flag operands are non-numeric. Security over precision for this case.
  local _advance=0
  if [ $_tn -gt 0 ]; then
    local _t0
    _t0=$(strip_quotes "${CMD_TOKENS_EXEC[0]}")
    case "$_t0" in
      env|/usr/bin/env|command|builtin|exec|nice|nohup|timeout|time|stdbuf|ionice|chrt|taskset)
        _advance=1 ;;
      -*|+*) _advance=1 ;;
      *=*) _advance=1 ;;
    esac
  fi
  if [ $_advance -eq 1 ]; then
    _ti=1
    while [ $_ti -lt $_tn ]; do
      local _tok
      _tok=$(strip_quotes "${CMD_TOKENS_EXEC[$_ti]}")
      if is_shell_token "$_tok" || is_source_token "$_tok"; then
        break
      fi
      _ti=$((_ti + 1))
    done
  fi
  if [ $_ti -lt $_tn ]; then
    local _cmd_tok
    _cmd_tok=$(strip_quotes "${CMD_TOKENS_EXEC[$_ti]}")
    if is_shell_token "$_cmd_tok"; then
      exec_kind="shell"; exec_shell_idx=$_ti
    elif is_source_token "$_cmd_tok"; then
      exec_kind="source"; exec_shell_idx=$_ti
    fi
  fi
  [ -z "$exec_kind" ] && return 0

  local exec_target=""
  local ei=$((exec_shell_idx + 1)) en=${#CMD_TOKENS_EXEC[@]}
  local seen_ddash=0
  while [ $ei -lt $en ]; do
    local etok
    etok=$(strip_quotes "${CMD_TOKENS_EXEC[$ei]}")
    if [ $seen_ddash -eq 0 ]; then
      case "$etok" in
        --) seen_ddash=1; ei=$((ei + 1)); continue ;;
        # bash/sh -O/+O and -o/+o take the next token as operand
        -O|+O|-o|+o) ei=$((ei + 2)); continue ;;
        # Bash accepts both `-x` (enable) and `+x` (disable) forms
        -*|+*|'') ei=$((ei + 1)); continue ;;
        # fd prefix for a redirect operator (e.g. `bash 0<file`, `bash 2>&1`).
        # Skip — the operator itself is handled on the next iteration.
        [0-9]|[0-9][0-9])
          ei=$((ei + 1)); continue ;;
        # Stdin redirection variants: bash executes whatever is piped in.
        # `<< EOF` / `<<< "str"` content can't be inspected — fail closed.
        # `< file` — validate `file` as exec target (treat next token as script).
        \<\<|\<\<-|\<\<\<)
          echo "BLOCKED: Shell invoked with heredoc/here-string (<<, <<-, <<<) cannot be safely inspected. Ask user for explicit permission." >&2
          exit 2 ;;
        \<)
          ei=$((ei + 1))
          if [ $ei -lt $en ]; then
            local _next_tok
            _next_tok=$(strip_quotes "${CMD_TOKENS_EXEC[$ei]}")
            # `bash < <(cmd)` — process substitution on stdin is a hidden
            # command source. Fail closed.
            case "$_next_tok" in
              \<|\<\(*|\(*|\&*)
                echo "BLOCKED: Shell stdin from process substitution / fd duplicate cannot be safely inspected. Ask user for explicit permission." >&2
                exit 2 ;;
              *)
                exec_target="$_next_tok" ;;
            esac
          fi
          break ;;
      esac
    fi
    exec_target="$etok"
    break
  done
  [ -z "$exec_target" ] && return 0

  exec_target=$(expand_path "$exec_target")
  if [[ "$exec_target" != /* ]]; then
    exec_target="$EFFECTIVE_CWD/$exec_target"
  fi
  local exec_resolved
  exec_resolved=$(resolve_path "$exec_target")
  # Dereference symlinks on the leaf — bash follows them at exec time,
  # so a project-local symlink pointing outside must be caught.
  local _exec_depth=20
  while [[ -L "$exec_resolved" && $_exec_depth -gt 0 ]]; do
    local _exec_link
    _exec_link=$(readlink "$exec_resolved")
    if [[ "$_exec_link" == /* ]]; then
      exec_resolved=$(resolve_path "$_exec_link")
    else
      exec_resolved=$(resolve_path "$(dirname "$exec_resolved")/$_exec_link")
    fi
    _exec_depth=$((_exec_depth - 1))
  done
  if [[ -L "$exec_resolved" ]]; then
    echo "BLOCKED: Script symlink chain too deep or circular at '$exec_resolved'. Ask user for explicit permission." >&2
    exit 2
  fi
  if [[ "$exec_resolved/" != "$PROJECT_DIR/"* ]]; then
    echo "BLOCKED: Executing script '$exec_resolved' is OUTSIDE project directory '$PROJECT_DIR'. Allowlist does not cover execute. Ask user for explicit permission." >&2
    exit 2
  fi
}
