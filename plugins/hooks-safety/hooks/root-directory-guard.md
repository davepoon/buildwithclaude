---
name: root-directory-guard
description: Block write operations targeting system directories like /etc, /usr, /bin, and /boot
category: security
event: PreToolUse
matcher: Write
language: bash
version: 1.0.0
---

# root-directory-guard

Blocks file write operations that target system directories (`/etc`, `/usr`, `/bin`, `/sbin`, `/boot`, `/sys`, `/proc`). Prevents accidental modification of OS-level files that could break the system.

## Event Configuration

- **Event Type**: `PreToolUse`
- **Tool Matcher**: `Write`
- **Category**: security

### Script

```bash
#!/bin/bash
# root-directory-guard.sh — Block writes to system directories

INPUT=$(cat)
FILE=$(echo "$INPUT" | jq -r '.tool_input.file_path // empty' 2>/dev/null)
[ -z "$FILE" ] && exit 0

case "$FILE" in
    /etc/*|/usr/*|/bin/*|/sbin/*|/boot/*|/sys/*|/proc/*)
        echo "BLOCKED: Write to system directory: $FILE" >&2
        exit 2
        ;;
esac

exit 0
```

## Usage

Add to your `.claude/settings.json`:

```json
{
  "hooks": {
    "PreToolUse": [{
      "matcher": "Write",
      "hooks": [{ "type": "command", "command": "~/.claude/hooks/root-directory-guard.sh" }]
    }]
  }
}
```
