---
name: force-push-guard
description: Block dangerous --force flags in git push, npm install, and docker prune
category: security
event: PreToolUse
matcher: Bash
language: bash
version: 1.0.0
---

# force-push-guard

Blocks dangerous `--force` flags that bypass safety checks. Catches `git push --force` (suggests `--force-with-lease`), `npm install --force`, and `docker prune --force`.

## Event Configuration

- **Event Type**: `PreToolUse`
- **Tool Matcher**: `Bash`
- **Category**: security

### Script

```bash
#!/bin/bash
# force-push-guard.sh — Block dangerous --force flags

INPUT=$(cat)
COMMAND=$(echo "$INPUT" | jq -r '.tool_input.command // empty' 2>/dev/null)
[ -z "$COMMAND" ] && exit 0

# npm install --force
if echo "$COMMAND" | grep -qE 'npm\s+install.*--force|npm\s+i\s.*--force'; then
    echo "BLOCKED: npm install --force bypasses peer dependency checks." >&2
    echo "Fix the dependency conflict instead of forcing." >&2
    exit 2
fi

# git push --force (not --force-with-lease)
if echo "$COMMAND" | grep -qE 'git\s+push.*--force($|\s)' && ! echo "$COMMAND" | grep -q 'force-with-lease'; then
    echo "BLOCKED: git push --force can destroy remote history." >&2
    echo "Use --force-with-lease for safer force-push." >&2
    exit 2
fi

# docker system prune --force
if echo "$COMMAND" | grep -qE 'docker\s+(system\s+)?prune.*-f|docker\s+(system\s+)?prune.*--force'; then
    echo "BLOCKED: docker prune --force removes all unused data without confirmation." >&2
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
      "hooks": [{ "type": "command", "command": "~/.claude/hooks/force-push-guard.sh" }]
    }]
  }
}
```
