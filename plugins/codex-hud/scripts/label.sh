#!/bin/bash
SCRIPT_REAL="$(readlink -f "$0" 2>/dev/null || perl -MCwd -e 'print Cwd::realpath($ARGV[0])' "$0")"
CODEX_HUD_DIR="$(cd "$(dirname "$SCRIPT_REAL")/.." && pwd)"
exec "$(command -v node)" "$CODEX_HUD_DIR/dist/index.js" label
