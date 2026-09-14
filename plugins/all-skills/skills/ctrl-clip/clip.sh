#!/usr/bin/env bash
# Copy a text file (or stdin) to the system clipboard, stripping terminal/markdown
# artifacts that paste badly: blockquote markers, box-drawing bars, Claude bullets.
set -euo pipefail

input=$(if [[ $# -gt 0 ]]; then cat -- "$1"; else cat; fi)

clean=$(printf '%s\n' "$input" \
  | sed -E \
      -e 's/^[[:space:]]*(>[[:space:]]?)+//' \
      -e 's/^[[:space:]]*(│|┃|▎|▍|▌|⎿|⏺)[[:space:]]?//' \
      -e 's/[[:space:]]+$//' \
  | cat -s \
  | sed -e '/./,$!d' \
  | sed -e ':a' -e '/^\n*$/{$d;N;ba' -e '}')

copy_with_osc52() {
  local pid=$$ tty
  while [[ "$pid" -gt 1 ]]; do
    tty=$(ps -o tty= -p "$pid" | tr -d ' ')
    if [[ -n "$tty" && "$tty" != "?" && "$tty" != "??" ]]; then
      printf '\033]52;c;%s\a' "$(printf '%s' "$clean" | base64 | tr -d '\n')" > "/dev/$tty"
      return 0
    fi
    pid=$(ps -o ppid= -p "$pid" | tr -d ' ')
  done
  return 1
}

# X11/Wayland backends fork a process that keeps owning the selection. Detach its stdout
# and stderr, or anything reading our output ($(…), a pipe) waits until that process exits.
copy_with() {
  if ! printf '%s' "$clean" | "$@" >/dev/null 2>&1; then
    echo "clip: $1 could not copy to the clipboard" >&2
    exit 1
  fi
}

if [[ -n "${WAYLAND_DISPLAY:-}" ]] && command -v wl-copy >/dev/null; then
  copy_with wl-copy
elif [[ -n "${DISPLAY:-}" ]] && command -v xclip >/dev/null; then
  copy_with xclip -selection clipboard -i
elif [[ -n "${DISPLAY:-}" ]] && command -v xsel >/dev/null; then
  copy_with xsel --clipboard --input
elif command -v pbcopy >/dev/null; then
  copy_with pbcopy
elif ! copy_with_osc52; then
  echo "clip: no clipboard backend available (wl-copy, xclip, xsel, pbcopy, OSC 52)" >&2
  exit 1
fi

lines=$(printf '%s\n' "$clean" | wc -l | tr -d ' ')
chars=$(printf '%s' "$clean" | wc -m | tr -d ' ')
echo "⧉ Copied ${lines} lines / ${chars} chars"
