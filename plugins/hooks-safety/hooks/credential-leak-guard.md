---
name: credential-leak-guard
description: Block credential hunting and exfiltration attempts via environment scanning, file access, and HTTP upload
category: security
event: PreToolUse
matcher: Bash
language: bash
version: 1.0.0
---

# credential-leak-guard

Detects and blocks credential hunting patterns: environment variable scanning for tokens/secrets, direct access to SSH keys and cloud credentials, searching for credential files, and exfiltration via `curl`/`wget`.

This addresses [anthropics/claude-code#37845](https://github.com/anthropics/claude-code/issues/37845) where 48 bash commands were auto-executed to scan for credentials.

## Event Configuration

- **Event Type**: `PreToolUse`
- **Tool Matcher**: `Bash`
- **Category**: security

### Script

```bash
#!/bin/bash
# credential-leak-guard.sh — Block credential hunting and exfiltration

INPUT=$(cat)
COMMAND=$(echo "$INPUT" | jq -r '.tool_input.command // empty' 2>/dev/null)

[ -z "$COMMAND" ] && exit 0

# Pattern 1: env/printenv piped to grep for secrets
if echo "$COMMAND" | grep -qiE '(env|printenv|set)\s*\|.*grep.*\b(token|secret|key|password|credential|auth|oauth|cookie|session|api.key)\b'; then
    echo "BLOCKED: Credential hunting via environment variable scanning" >&2
    exit 2
fi

# Pattern 2: find searching for credential files
if echo "$COMMAND" | grep -qiE 'find\s.*-name\s.*\*?(token|secret|credential|password|\.key|\.pem|\.p12|\.pfx|\.keystore|\.jks|\.env)'; then
    echo "BLOCKED: Credential hunting via file system search" >&2
    exit 2
fi

# Pattern 3: Direct access to SSH credentials
if echo "$COMMAND" | grep -qE 'cat\s+(~|/home|/root)/.ssh/(id_|authorized_keys|known_hosts|config)'; then
    echo "BLOCKED: Direct SSH credential access" >&2
    exit 2
fi

# Pattern 4: System credential files
if echo "$COMMAND" | grep -qE 'cat\s+(/etc/shadow|/etc/gshadow|/etc/passwd)'; then
    echo "BLOCKED: System credential file access" >&2
    exit 2
fi

# Pattern 5: Cloud provider credentials
if echo "$COMMAND" | grep -qE 'cat\s+(~|/home|/root)/\.(aws|gcloud|azure|kube)/(credentials|config|token)'; then
    echo "BLOCKED: Cloud provider credential access" >&2
    exit 2
fi

# Pattern 6: Browser credential stores
if echo "$COMMAND" | grep -qiE 'find\s.*\.(chrome|firefox|mozilla|safari).*\b(login|password|cookie|token)\b'; then
    echo "BLOCKED: Browser credential hunting" >&2
    exit 2
fi

# Pattern 7: HTTP upload of credential files
if echo "$COMMAND" | grep -qiP 'curl\s.*-d\s+@[^\s]*(\.env|\.pem|\.key|credentials|\.ssh/id_)|wget\s.*--post-file[= ][^\s]*(\.env|\.pem|\.key|credentials|\.ssh/id_)'; then
    echo "BLOCKED: Credential file exfiltration via HTTP upload" >&2
    exit 2
fi

# Pattern 8: Piping credential files to HTTP clients
if echo "$COMMAND" | grep -qiP 'cat\s+[^\s]*(\.env|\.pem|\.key|credentials|\.ssh/id_)\S*\s*\|.*curl|cat\s+[^\s]*(\.env|\.pem|\.key|credentials|\.ssh/id_)\S*\s*\|.*wget'; then
    echo "BLOCKED: Credential file piped to HTTP client" >&2
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
      "hooks": [{ "type": "command", "command": "~/.claude/hooks/credential-leak-guard.sh" }]
    }]
  }
}
```
