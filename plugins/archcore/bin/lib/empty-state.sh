#!/bin/sh
# Helper: detect if .archcore/ is "functionally empty".
#
# A directory is functionally empty if it is missing OR contains zero .md
# files of at least 200 bytes. The 200-byte floor filters out stub files,
# .gitkeep placeholders, and scaffolds that don't carry project knowledge.
#
# Pure POSIX shell, no jq / awk dependency.
# Expose: archcore_is_functionally_empty [dir]  (default dir: .archcore)
# Return: 0 if functionally empty, 1 otherwise.

archcore_is_functionally_empty() {
  _dir="${1:-.archcore}"
  [ -d "$_dir" ] || return 0
  _match=$(find "$_dir" -type f -name '*.md' -size +200c 2>/dev/null | head -n 1)
  [ -z "$_match" ]
}
