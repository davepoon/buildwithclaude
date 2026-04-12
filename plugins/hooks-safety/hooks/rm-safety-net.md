---
name: rm-safety-net
description: Block dangerous rm commands on critical paths while allowing cleanup of safe directories
category: security
event: PreToolUse
matcher: Bash
language: bash
version: 1.0.0
---

# rm-safety-net

Prevents `rm` from deleting critical directories like `/`, `~/`, `.git`, and `/etc`. Also catches `find -delete` and `shred` commands. Safe cleanup targets like `node_modules`, `dist`, `build`, and `/tmp` are allowed through.

This addresses [anthropics/claude-code#38607](https://github.com/anthropics/claude-code/issues/38607) where `rm` commands bypassed the permission system.

## Event Configuration

- **Event Type**: `PreToolUse`
- **Tool Matcher**: `Bash`
- **Category**: security

### Script

```bash
#!/bin/bash
# rm-safety-net.sh — Block rm on critical paths, allow safe cleanup targets
#
# Blocks:
#   rm (any flags) on: /, ~, .., /home, /etc, /usr, /var, .git, .env
#   find -delete (outside safe directories)
#   shred (all usage)
#
# Allows:
#   rm on: node_modules, dist, build, __pycache__, .cache, /tmp

INPUT=$(cat)
COMMAND=$(echo "$INPUT" | jq -r '.tool_input.command // empty' 2>/dev/null)

[ -z "$COMMAND" ] && exit 0

# --- rm command analysis ---
if echo "$COMMAND" | grep -qE '^\s*(sudo\s+)?rm\s'; then
    SAFE_TARGETS="node_modules|dist|build|__pycache__|\.cache|\.pytest_cache|coverage|\.nyc_output|\.next|\.nuxt|tmp|temp"
    TARGET=$(echo "$COMMAND" | grep -oP 'rm\s+[^;|&]*' | awk '{print $NF}')

    # Block path traversal
    if echo "$TARGET" | grep -qF '..'; then
        echo "BLOCKED: path traversal detected in rm target" >&2
        exit 2
    fi

    # Allow safe targets
    if echo "$TARGET" | grep -qE "^(\./)?(${SAFE_TARGETS})(/|$)"; then
        exit 0
    fi

    # Allow /tmp paths
    if echo "$TARGET" | grep -qE "^/tmp/"; then
        exit 0
    fi

    # Block rm on critical paths
    CRITICAL="^/\$|^/home|^/etc|^/usr|^/var|^/opt|^/root|^~|^\.\.|^\.git$|^\.env"
    if echo "$TARGET" | grep -qE "$CRITICAL"; then
        echo "BLOCKED: rm targeting critical path: $TARGET" >&2
        exit 2
    fi

    # Block rm -rf on any non-safe path
    if echo "$COMMAND" | grep -qE 'rm\s+.*-[rRf]*[rR][rRf]*'; then
        if ! echo "$TARGET" | grep -qE "^(\./)?(${SAFE_TARGETS})(/|$)|^/tmp/"; then
            echo "BLOCKED: rm -rf on non-safe target: $TARGET" >&2
            exit 2
        fi
    fi
fi

# --- find -delete ---
if echo "$COMMAND" | grep -qE 'find\s.*-delete'; then
    FIND_PATH=$(echo "$COMMAND" | grep -oP 'find\s+\K[^\s]+')
    if echo "$FIND_PATH" | grep -qE '^\.|^node_modules|^dist|^build|^/tmp'; then
        exit 0
    fi
    echo "BLOCKED: find -delete outside safe directory: $FIND_PATH" >&2
    exit 2
fi

# --- shred ---
if echo "$COMMAND" | grep -qE '^\s*(sudo\s+)?shred\s'; then
    echo "BLOCKED: shred command (secure file deletion)" >&2
    exit 2
fi

exit 0
```

## Usage

Add to your `.claude/settings.json`:

```json
{
  "hooks": {
    "PreToolUse": [{
      "matcher": "Bash",
      "hooks": [{ "type": "command", "command": "~/.claude/hooks/rm-safety-net.sh" }]
    }]
  }
}
```
