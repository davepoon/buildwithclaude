#!/bin/bash
# Wrapper: runs claude-hud with stdin, then appends codex-hud status lines.
# Used as the statusLine command in ~/.claude/settings.json.

NODE="$(command -v node)"
# Resolve real path even through symlinks
SCRIPT_REAL="$(readlink -f "$0" 2>/dev/null || perl -MCwd -e 'print Cwd::realpath($ARGV[0])' "$0")"
CODEX_HUD_DIR="$(cd "$(dirname "$SCRIPT_REAL")/.." && pwd)"

# Find latest claude-hud plugin directory
CLAUDE_CONFIG_DIR="${CLAUDE_CONFIG_DIR:-$HOME/.claude}"
CLAUDE_HUD_DIR=$(ls -d "${CLAUDE_CONFIG_DIR}/plugins/cache/claude-hud/claude-hud"/*/ 2>/dev/null \
  | awk -F/ '{ print $(NF-1) "\t" $0 }' \
  | sort -t. -k1,1n -k2,2n -k3,3n -k4,4n \
  | tail -1 \
  | cut -f2-)

if [ -z "$CLAUDE_HUD_DIR" ]; then
  # No claude-hud, just run codex-hud statusline
  exec "$NODE" "$CODEX_HUD_DIR/dist/index.js" statusline
fi

# Save stdin to temp file so both commands can read it
STDIN_TMP=$(mktemp)
cat > "$STDIN_TMP"

# Run claude-hud with stdin
"$NODE" "${CLAUDE_HUD_DIR}dist/index.js" < "$STDIN_TMP"

# Run codex-hud statusline (no stdin needed)
"$NODE" "$CODEX_HUD_DIR/dist/index.js" statusline

# Cleanup
rm -f "$STDIN_TMP"
