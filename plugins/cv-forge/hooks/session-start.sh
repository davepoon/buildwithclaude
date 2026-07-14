#!/usr/bin/env bash
# Thin pure-bash dispatcher: run each context emitter when a résumé project is present.
# No network, no Node. Emitters self-gate.
set -euo pipefail
cd "${CLAUDE_PROJECT_DIR:-$PWD}" 2>/dev/null || true
[ -f "resume.json" ] || [ -d "resumes" ] || exit 0
export CV_FORGE_ROOT="${CLAUDE_PLUGIN_ROOT:-}"
for f in "${CLAUDE_PLUGIN_ROOT}"/lib/context/*; do
  [ -f "$f" ] && bash "$f" || true
done
