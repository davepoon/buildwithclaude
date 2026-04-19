---
name: comms-scanner
description: Scans all communication channels for FULL inbox state (not just unread). Classifies each conversation as NEEDS_REPLY, WAITING, or HANDLED. Returns structured JSON. Used by ops-inbox and ops-go.
model: claude-sonnet-4-6
effort: low
maxTurns: 10
tools:
  - Bash
  - Read
disallowedTools:
  - Write
  - Edit
  - Agent
memory: user
initialPrompt: "Scan all configured channels and classify conversations. Return structured JSON."
---

# COMMS SCANNER AGENT

Scan all channels for FULL inbox state — not just unread, but all recent conversations classified by action needed.

## Task

Run all channel scans in parallel:

```bash
# WhatsApp — ALL non-archived chats (not just unread)
wacli chats list --json 2>/dev/null || echo '{"error": "wacli not available"}'
# Then for each chat with recent activity (last 7 days):
# wacli messages list --chat "<JID>" --limit 5 --json
# Check FromMe on last message to classify NEEDS_REPLY vs WAITING
```

```bash
# Email — FULL inbox (not just unread)
# Read account from preferences.json (channels.email.account) or use gog's default
EMAIL_ACCOUNT=$(jq -r '.channels.email.account // empty' "${CLAUDE_PLUGIN_DATA_DIR:-$HOME/.claude/plugins/data/ops-ops-marketplace}/preferences.json" 2>/dev/null)
if [ -n "$EMAIL_ACCOUNT" ]; then
  gog gmail search -a "$EMAIL_ACCOUNT" -j --results-only --no-input --max 30 "in:inbox" 2>/dev/null || echo '{"error": "gog not available"}'
else
  gog gmail search -j --results-only --no-input --max 30 "in:inbox" 2>/dev/null || echo '{"error": "gog not available or no default account"}'
fi
# For each thread, read last message to check if sender is you (WAITING) or them (NEEDS_REPLY)
```

```bash
# Telegram — user-auth API (NOT bot), list recent dialogs
# Use telegram user-auth MCP or tg-cli if available
echo '{"error": "telegram user-auth not configured"}'
```

Combine results into:

```json
{
  "timestamp": "[ISO8601]",
  "whatsapp": {
    "needs_reply": [
      {
        "contact": "[name]",
        "preview": "[text]",
        "timestamp": "[ISO8601]",
        "jid": "[JID]",
        "urgency": "high|medium|low"
      }
    ],
    "waiting": [
      {
        "contact": "[name]",
        "preview": "[your last msg]",
        "timestamp": "[ISO8601]"
      }
    ],
    "handled": []
  },
  "email": {
    "needs_reply": [
      {
        "from": "[sender]",
        "subject": "[subject]",
        "preview": "[text]",
        "timestamp": "[ISO8601]",
        "urgency": "high|medium|low"
      }
    ],
    "waiting": [
      {
        "from": "[recipient]",
        "subject": "[subject]",
        "timestamp": "[ISO8601]"
      }
    ],
    "fyi": [
      {
        "from": "[sender]",
        "subject": "[subject]",
        "type": "newsletter|notification|receipt"
      }
    ]
  },
  "slack": {
    "needs_reply": [],
    "waiting": [],
    "note": "fetch live via Slack MCP"
  },
  "telegram": {
    "needs_reply": [],
    "waiting": [],
    "note": "user-auth not configured"
  },
  "summary": {
    "total_needs_reply": 0,
    "total_waiting": 0,
    "total_fyi": 0,
    "urgent": []
  }
}
```

## Urgency scoring

Mark a message `high` if:

- Sender is in contacts list with `vip: true`
- Message contains: "urgent", "ASAP", "down", "broken", "help", "emergency", "critical"
- Email subject starts with "Re: Re: Re:" (long chain needing response)

## Output

Print only the JSON to stdout. No preamble. No summary.
