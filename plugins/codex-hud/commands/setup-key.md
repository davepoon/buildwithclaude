---
description: Configure or update the OpenAI Admin API key (enables /codex-hud:costs-*)
allowed-tools: Bash(node:*), AskUserQuestion
---

# Configure OpenAI Admin API Key

This command is only needed for dollar-cost tracking via `/codex-hud:costs-today/week/month`. Rate limits, token usage, and the statusline work without it.

First, check the current state:

```bash
node "${CLAUDE_PLUGIN_ROOT}/dist/index.js" setup --json
```

If `"status": "connected"`, tell the user the key is already configured and working. Offer to replace it (optional).

If `"status": "no_key"` or user wants to replace, ask via `AskUserQuestion`:

- header: "Admin Key"
- question: "Paste your OpenAI Admin API key (sk-admin-...). Get one at https://platform.openai.com/settings/organization/admin-keys"
- multiSelect: false
- options:
  - "Paste key" — use the Other/free-text input to provide the key
  - "Cancel" — abort without changes

If the user provides a key (via free text), save and verify it:

```bash
node "${CLAUDE_PLUGIN_ROOT}/dist/index.js" setup --key "USER_KEY" --json
```

On success (`"status": "saved"`), tell the user it was saved and verified. On failure, show the error and suggest they check the key at the URL above.
