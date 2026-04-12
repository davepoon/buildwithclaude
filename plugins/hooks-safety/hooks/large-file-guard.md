---
name: large-file-guard
description: Warn when files larger than 100KB are written to prevent repo bloat
category: security
event: PostToolUse
matcher: Write
language: bash
version: 1.0.0
---

# large-file-guard

Warns when a written file exceeds the size threshold (default 100KB). Claude sometimes generates entire datasets, logs, or documentation dumps as single files that bloat the repository. The threshold is configurable via `CC_MAX_FILE_SIZE` environment variable.

## Event Configuration

- **Event Type**: `PostToolUse`
- **Tool Matcher**: `Write`
- **Category**: security

## Environment Variables

- `CC_MAX_FILE_SIZE` - Maximum file size in bytes (default: 102400 = 100KB)

### Script

```bash
#!/bin/bash
# large-file-guard.sh — Warn when writing large files

INPUT=$(cat)
FILE=$(echo "$INPUT" | jq -r '.tool_input.file_path // empty' 2>/dev/null)
[ -z "$FILE" ] && exit 0
[ ! -f "$FILE" ] && exit 0

MAX_SIZE="${CC_MAX_FILE_SIZE:-102400}"  # 100KB default

FILE_SIZE=$(wc -c < "$FILE" 2>/dev/null)
[ -z "$FILE_SIZE" ] && exit 0

if [ "$FILE_SIZE" -gt "$MAX_SIZE" ]; then
  SIZE_KB=$((FILE_SIZE / 1024))
  MAX_KB=$((MAX_SIZE / 1024))
  echo "WARNING: Large file written: $FILE (${SIZE_KB}KB > ${MAX_KB}KB limit)" >&2
  echo "  Consider splitting into smaller files or using .gitignore." >&2
fi

exit 0
```

## Usage

Add to your `.claude/settings.json`:

```json
{
  "hooks": {
    "PostToolUse": [{
      "matcher": "Write",
      "hooks": [{ "type": "command", "command": "~/.claude/hooks/large-file-guard.sh" }]
    }]
  }
}
```

To customize the threshold:

```bash
export CC_MAX_FILE_SIZE=51200  # 50KB
```
