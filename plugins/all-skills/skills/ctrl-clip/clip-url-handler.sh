#!/usr/bin/env bash
# Desktop handler for ~/.cache/claude-clip/<id>.claudeclip files (opened by Ctrl+clicking a
# file:// link in Claude Code): copies the draft via clip.sh and shows a notification.
set -euo pipefail

clip_dir="$HOME/.cache/claude-clip"

notify() {
  if command -v notify-send >/dev/null; then
    notify-send -t 2500 -i edit-copy "⧉ Claude" "$1" || true
  fi
}

# shellcheck disable=SC2174  # mode only matters when the dir is new
mkdir -p -m 700 "$clip_dir"
printf '%s invoked with: %s\n' "$(date -Is)" "${1:-}" >> "$clip_dir/handler.log"

path=${1:-}
path=${path#file://}
id=$(basename -- "$path" .claudeclip)

if [[ ! "$id" =~ ^[A-Za-z0-9_-]{1,64}$ || "$path" != "$clip_dir/$id.claudeclip" || -L "$path" ]]; then
  notify "Invalid link"
  exit 1
fi

if [[ ! -f "$path" ]]; then
  notify "Draft '$id' not found"
  exit 1
fi

result=$("$(dirname "$(readlink -f "$0")")/clip.sh" "$path")
notify "$result"
