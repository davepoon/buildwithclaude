---
name: windows-python-stub-detector
description: SessionStart probe that surfaces the Microsoft Store python3 stub on Windows Git Bash before Python-based hooks silently no-op
category: development
event: SessionStart
matcher: "*"
language: bash
version: 1.0.0
---

# windows-python-stub-detector

SessionStart probe that surfaces the Microsoft Store `python3` stub on Windows Git Bash before Python-based hooks silently no-op.

Motivated by [claude-code issue #57946](https://github.com/anthropics/claude-code/issues/57946). On Windows Git Bash, `python3` may resolve to the Microsoft Store stub rather than a real interpreter. The stub is on `PATH`, `which python3` succeeds, but invoking it as a subprocess exits 49 with no stdout and no stderr. Python-based `PreToolUse` and `PostToolUse` hooks then exit silently before they can inspect the tool call — the hook configuration is valid, the script file is present, and the agent proceeds as if the hook approved. This is the silent-no-op failure mode that gives every operator the false belief their hooks are running.

This hook detects the stub at session start and surfaces the problem via `hookSpecificOutput.additionalContext`, so the model can warn the user immediately.

## Event Configuration

- **Event Type**: `SessionStart`
- **Tool Matcher**: `*` (required by catalog schema; SessionStart runs once per session)
- **Category**: `development`

## Detection conditions

Any one of the following trips the warning:

1. Exit code 49 — the documented Store-redirect signal in Git Bash subprocess
2. Stderr contains `"Microsoft Store"` or `"install Python"` — the Store-redirect marker
3. Exit code 127 or `"command not found"` / `"no such file"` — `python3` missing from `PATH`
4. Exit code 0 but no `"ok"` in output — silent stub variant that exits cleanly without running the script

## Why advisory (never blocks)

`SessionStart` hooks that block prevent the user from working at all. The user may have intentional fallback paths. This hook surfaces the problem; the user decides what to do.

## Environment Variables

- `CC_PYTHON_CMD` — override the binary probed (default: `python3`). Useful if the project uses `py`, `python`, or a venv-anchored absolute path.

## Requirements

- `bash` (3.2+, macOS-default-compatible)

### Script

```bash
INPUT=$(cat)

# Allow tests / explicit overrides to point at a different binary
PYTHON_CMD="${CC_PYTHON_CMD:-python3}"

# Probe with a minimal Python statement.
# Real Python: prints "ok", exits 0.
# Microsoft Store stub: exits 49 with no output (sometimes "Microsoft Store"
#   markers in stderr depending on shell wrapper).
PROBE_OUTPUT=$("$PYTHON_CMD" -c 'import sys; sys.stdout.write("ok"); sys.exit(0)' 2>&1)
PROBE_EXIT=$?

# Detection conditions (any one trips the warning):
#   - exit code 49: documented Store-redirect signal in Git Bash subprocess
#   - stderr contains "Microsoft Store" or "install Python"
#   - exit code 127 or "command not found" / "no such file" output: python3 missing
#   - exit code 0 but no "ok" in output (stub may succeed silently in some shells)
TRIGGERED=0
if [ "$PROBE_EXIT" -eq 49 ]; then
    TRIGGERED=1
    REASON="python3 exited 49 (Microsoft Store redirect)"
elif echo "$PROBE_OUTPUT" | grep -qi 'microsoft store\|install python'; then
    TRIGGERED=1
    REASON="python3 stderr matched Store-redirect marker"
elif [ "$PROBE_EXIT" -eq 127 ] || echo "$PROBE_OUTPUT" | grep -qi 'command not found\|no such file'; then
    TRIGGERED=1
    REASON="python3 not found in PATH"
elif [ "$PROBE_EXIT" -eq 0 ] && ! echo "$PROBE_OUTPUT" | grep -q '^ok$'; then
    TRIGGERED=1
    REASON="python3 exited 0 but produced no output (suspected silent stub)"
fi

if [ "$TRIGGERED" -eq 1 ]; then
    cat <<EOF
{"hookSpecificOutput":{"hookEventName":"SessionStart","additionalContext":"⚠️ python3 stub detected ($REASON). Any Python-based PreToolUse/PostToolUse hooks will exit 49 silently on this system and be ineffective. The hook configuration looks valid but the hooks never run. Fix: install real Python (winget install Python.Python.3.12, or from python.org) and ensure it precedes the Store stub in PATH, or rewrite hooks in bash. Reference: claude-code#57946."}}
EOF
fi

exit 0
```

## Source attribution

This hook ships in [cc-safe-setup](https://github.com/yurukusa/cc-safe-setup) (MIT). Contributed here in single-file Markdown form so buildwithclaude users on Windows Git Bash can install it standalone, without taking the full cc-safe-setup dependency.
