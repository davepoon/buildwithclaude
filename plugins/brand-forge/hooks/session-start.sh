#!/usr/bin/env bash
# Thin dispatcher: run each context emitter whenever the plugin is active.
# Its combined stdout is injected into the session as context. No network.
# The emitters self-gate: they show the active-brand kit when a brand exists,
# or a "run /brand-new" setup nudge when one doesn't.
set -euo pipefail

# SessionStart runs the hook outside the project dir; anchor to the project root
# so the emitters' relative brand/ paths resolve against it.
cd "${CLAUDE_PROJECT_DIR:-$PWD}" 2>/dev/null || true

export BRAND_FORGE_ROOT="${CLAUDE_PLUGIN_ROOT:-}"
# Emitters are numbered (NN-name). Match only those, so the reference PNGs that
# also live in lib/context/ aren't executed as shell scripts.
for f in "${CLAUDE_PLUGIN_ROOT}"/lib/context/*; do
  [ -f "$f" ] && bash "$f" || true
done
