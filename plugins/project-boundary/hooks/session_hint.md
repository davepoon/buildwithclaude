[project-boundary] Guard blocks `$(...)` AND `$VAR`/`${VAR}` operands (fail-closed, uninspectable; only `$HOME` is allowed). Inline literal values, or use Read/Grep tools instead of Bash piping with shell vars. For git commit with multiline body, ALWAYS use stdin heredoc:
  git commit -F - <<'EOF'
  <title>

  <body>
  EOF
Do NOT: `git commit -m "$(cat <<EOF)"` (blocked), write to `.git/COMMIT_*` temp files (triggers Write prompt), write to `/tmp/*_msg.txt` (outside-project blocked). The stdin heredoc is the ONE supported path.
