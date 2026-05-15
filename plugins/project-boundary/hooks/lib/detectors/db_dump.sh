#!/bin/bash
# project-boundary guard — database tool write-target detectors
# =============================================================
# pg_dump -f, mysqldump --result-file, psql -o/-L/-c, mysql --tee
# write SQL output / session logs to FILE, bypassing the redirect
# walker. Split out of write_targets_b.sh by domain (Codex r5
# finding #4).
#
# Same dynamic-scope contract as the rest of detectors/:
# reads CMD, CMD_BLANKED, CMD_TOKENS, CMD_TOKENS_SCAN,
# EFFECTIVE_CWD, PROJECT_DIR; helpers from
# hooks/lib/tokenize.sh + paths.sh + command_name.sh +
# options.sh. Calls `exit 2` on violation.

run_db_dump_detectors() {
  # --- pg_dump -f / mysqldump --result-file: DB dump output (r5) ---
  # Database dump tools accept an explicit output-file flag that
  # bypasses the redirect walker. Both write a SQL dump to FILE;
  # outside-project FILE is a boundary violation.
  local PG_CMD pgfile
  for PG_CMD in pg_dump pg_dumpall; do
    if command_name_is "$PG_CMD"; then
      while IFS= read -r pgfile; do
        [ -n "$pgfile" ] && validate_command_path write "$PG_CMD -f" "$pgfile"
      done < <(extract_attached_or_split_from CMD_TOKENS_SCAN -f --file)
    fi
  done

  # --- psql -o / -L: query output + session log (round-5 follow) ---
  if command_name_is "psql"; then
    local pqi=1 pqn=${#CMD_TOKENS_SCAN[@]}
    while [ $pqi -lt $pqn ]; do
      local pqtok
      pqtok=$(strip_quotes "${CMD_TOKENS_SCAN[$pqi]}")
      local pqfile="" pqkind=""
      case "$pqtok" in
        -o|--output)
          pqkind="-o"
          if [ $((pqi + 1)) -lt $pqn ]; then
            pqfile=$(strip_quotes "${CMD_TOKENS_SCAN[$((pqi + 1))]}")
            pqi=$((pqi + 1))
          fi
          ;;
        -o?*)
          pqkind="-o"; pqfile=$(strip_quotes "${pqtok#-o}") ;;
        --output=*)
          pqkind="--output"; pqfile=$(strip_quotes "${pqtok#--output=}") ;;
        -L|--log-file)
          pqkind="-L"
          if [ $((pqi + 1)) -lt $pqn ]; then
            pqfile=$(strip_quotes "${CMD_TOKENS_SCAN[$((pqi + 1))]}")
            pqi=$((pqi + 1))
          fi
          ;;
        -L?*)
          pqkind="-L"; pqfile=$(strip_quotes "${pqtok#-L}") ;;
        --log-file=*)
          pqkind="--log-file"; pqfile=$(strip_quotes "${pqtok#--log-file=}") ;;
        -c|--command)
          # Codex r5 round-3 P2: the -c value can carry backslash
          # meta-commands (\o, \g, \gx, \w, \s, \copy, \!) that write
          # local files or execute shell commands without using -o.
          # Path payloads after the meta are too fragile to parse
          # safely from bash — fail-closed on any presence.
          if [ $((pqi + 1)) -lt $pqn ]; then
            local pqsql
            pqsql=$(strip_quotes "${CMD_TOKENS_SCAN[$((pqi + 1))]}")
            # Note: guard's alias-escape pass strips a backslash before
            # [a-zA-Z_], so `\o` / `\g` / `\w` / `\s` / `\copy` arrive
            # as bare `o` / `g` / `w` / `s` / `copy` at the start of the
            # value. `\!` keeps its backslash (! is non-alphanumeric).
            # Match either form anchored at the start of the value.
            # Codex r5 round-4 (Q1B): ANSI-C quoting `$'...'` is not
            # unwrapped by strip_quotes; fail-closed on the prefix.
            if [[ "$pqsql" == \$\'* ]]; then
              echo "BLOCKED: 'psql -c' value uses ANSI-C quoting (\$'...') which can encode arbitrary escape sequences. Cannot be safely inspected. Ask user for explicit permission." >&2
              exit 2
            fi
            # Codex r5 round-4 (Q1A): no-space meta args like
            # `\o/tmp/out` and `\o|cmd` — extend the separator class
            # to cover `/` (path attached) and `|` (pipe attached) and
            # `\\` (next meta attached) on top of whitespace.
            # \! always opens an interactive shell or executes attached
            # shell command — fail-closed regardless of arg shape.
            #
            # Codex#1 HIGH: psql executes meta-commands wherever they
            # appear in the -c value, so the same patterns must also
            # match after a `;` statement separator. Multi-statement
            # payloads that mix `\copy ... to stdout` with unsafe metas
            # require statement-aware parsing we don't do — fail-closed
            # on any post-separator meta (no safe exception).
            if echo "$pqsql" | grep -qE '(^|;)[[:space:]]*\\!'; then
              echo "BLOCKED: 'psql -c' contains the \\! meta-command which executes a shell. Cannot be safely inspected. Ask user for explicit permission." >&2
              exit 2
            fi
            # Post-separator meta with payload — block unconditionally
            # (no leading-position safe exception).
            if echo "$pqsql" | grep -qE ';[[:space:]]*(o|g|gx|w|s|copy)([[:space:]]+[^[:space:]]|/|\||\\)'; then
              echo "BLOCKED: 'psql -c' contains a backslash meta-command (\\o / \\g / \\gx / \\w / \\s / \\copy) after a statement separator with a file or pipe payload. Cannot be safely inspected. Ask user for explicit permission." >&2
              exit 2
            fi
            # \o / \g / \gx / \w / \s / \copy with an ATTACHED payload —
            # space + non-space (split file path), `/` (path attached),
            # `|` (pipe attached), or `\` (next meta attached) — write
            # or read a file we cannot validate. Bare meta with no
            # payload is read-only / send-and-go and stays ALLOWED:
            #   \g    send query (alias of ;)
            #   \o    reset output to stdout
            #   \gx   send query, expanded display
            #   \w    error without arg, no side effect
            #   \s    print history to stdout (no arg = stdout)
            #   \copy error without args
            if echo "$pqsql" | grep -qE '^(o|g|gx|w|s|copy)([[:space:]]+[^[:space:]]|/|\||\\)'; then
              # \copy ... (to|from) (stdin|stdout|pstdin|pstdout) writes
              # NOTHING to the local filesystem — the endpoints are the
              # caller's stdio, not files. Modifies/reads DB rows only,
              # which is the normal operation of psql and outside the
              # boundary's scope. The other meta-commands (o/g/gx/w/s)
              # have no analogous safe form and stay blocked.
              if ! echo "$pqsql" | grep -iqE '^copy[[:space:]].*[[:space:]](from|to)[[:space:]]+p?std(in|out)([[:space:]]|\(|;|$)'; then
                echo "BLOCKED: 'psql -c' contains a backslash meta-command (\\o / \\g / \\gx / \\w / \\s / \\copy) with a file or pipe payload. Cannot be safely inspected. Ask user for explicit permission." >&2
                exit 2
              fi
            fi
            pqi=$((pqi + 1))
          fi
          ;;
        -c?*|--command=*)
          local pqsql
          if [[ "$pqtok" == --command=* ]]; then
            pqsql=$(strip_quotes "${pqtok#--command=}")
          else
            pqsql=$(strip_quotes "${pqtok#-c}")
          fi
          # See note above. Round-4 fix: also check ANSI-C $'...' prefix
          # and extend separator class to cover no-space attached args.
          if [[ "$pqsql" == \$\'* ]]; then
            echo "BLOCKED: 'psql -c' value uses ANSI-C quoting (\$'...') which can encode arbitrary escape sequences. Cannot be safely inspected. Ask user for explicit permission." >&2
            exit 2
          fi
          # \! always opens a shell — fail-closed regardless of arg shape.
          # Codex#1 HIGH: also catch \! after `;` separator (mirror of
          # the split -c VALUE branch above).
          if echo "$pqsql" | grep -qE '(^|;)[[:space:]]*\\!'; then
            echo "BLOCKED: 'psql -c' contains the \\! meta-command which executes a shell. Cannot be safely inspected. Ask user for explicit permission." >&2
            exit 2
          fi
          # Post-separator meta with payload — block unconditionally.
          if echo "$pqsql" | grep -qE ';[[:space:]]*(o|g|gx|w|s|copy)([[:space:]]+[^[:space:]]|/|\||\\)'; then
            echo "BLOCKED: 'psql -c' contains a backslash meta-command (\\o / \\g / \\gx / \\w / \\s / \\copy) after a statement separator with a file or pipe payload. Cannot be safely inspected. Ask user for explicit permission." >&2
            exit 2
          fi
          # \o / \g / \gx / \w / \s / \copy with an attached payload only —
          # bare forms have no file write side-effect and stay ALLOWED.
          if echo "$pqsql" | grep -qE '^(o|g|gx|w|s|copy)([[:space:]]+[^[:space:]]|/|\||\\)'; then
            # \copy ... (to|from) (stdin|stdout|pstdin|pstdout) endpoints
            # write nothing to the local filesystem (mirror of the same
            # exception in the split -c VALUE branch above). Other metas
            # have no analogous safe form and stay blocked.
            if ! echo "$pqsql" | grep -iqE '^copy[[:space:]].*[[:space:]](from|to)[[:space:]]+p?std(in|out)([[:space:]]|\(|;|$)'; then
              echo "BLOCKED: 'psql -c' contains a backslash meta-command (\\o / \\g / \\gx / \\w / \\s / \\copy) with a file or pipe payload. Cannot be safely inspected. Ask user for explicit permission." >&2
              exit 2
            fi
          fi
          ;;
      esac
      if [ -n "$pqfile" ]; then
        # Codex r5 round-3 P1: a value beginning with `|` is interpreted
        # by psql as a pipe-to-shell-command, not a file path. Same
        # un-inspectable surface as `bash -c` — fail-closed.
        if [[ "$pqfile" == \|* ]]; then
          echo "BLOCKED: 'psql $pqkind' pipe operand '$pqfile' executes a shell command and cannot be safely inspected. Ask user for explicit permission." >&2
          exit 2
        fi
        validate_command_path write "psql $pqkind" "$pqfile"
      fi
      pqi=$((pqi + 1))
    done
  fi

  # --- mysql --tee=FILE: session echo to file (round-5 follow) ---
  if command_name_is "mysql"; then
    local msi=1 msn=${#CMD_TOKENS_SCAN[@]}
    while [ $msi -lt $msn ]; do
      local mstok
      mstok=$(strip_quotes "${CMD_TOKENS_SCAN[$msi]}")
      local msfile=""
      case "$mstok" in
        --tee)
          if [ $((msi + 1)) -lt $msn ]; then
            local msnext
            msnext=$(strip_quotes "${CMD_TOKENS_SCAN[$((msi + 1))]}")
            case "$msnext" in
              -*) ;;
              *) msfile="$msnext"; msi=$((msi + 1)) ;;
            esac
          fi
          ;;
        --tee=*)
          msfile="${mstok#--tee=}" ;;
      esac
      [ -n "$msfile" ] && validate_command_path write "mysql --tee" "$msfile"
      msi=$((msi + 1))
    done
  fi
  if command_name_is "mysqldump"; then
    local myfile
    while IFS= read -r myfile; do
      [ -n "$myfile" ] && validate_command_path write "mysqldump --result-file" "$myfile"
    done < <(extract_attached_or_split_from CMD_TOKENS_SCAN -r --result-file)
  fi
}
