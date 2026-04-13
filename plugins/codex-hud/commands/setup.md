---
description: Install codex-hud statusline and optionally configure OpenAI Admin API key
allowed-tools: Bash(node:*), AskUserQuestion, Read
---

# Setup Codex HUD

## Step 1: Install the statusline integration

Install the symlink and update `~/.claude/settings.json` so the Codex usage bars appear below claude-hud's statusline:

```bash
node "${CLAUDE_PLUGIN_ROOT}/dist/index.js" install-statusline --json
```

Report the outcome to the user. If it succeeded, remind them to run `/reload-plugins` or restart Claude Code to see the Codex statusline.

If `statusline` was already pointing to a custom command (not claude-hud and not codex-hud), warn them that it was replaced — the wrapper chains claude-hud automatically, so claude-hud users are covered.

## Step 2: Check API key status (optional — only for dollar cost tracking)

```bash
node "${CLAUDE_PLUGIN_ROOT}/dist/index.js" setup --json
```

Based on the result:

### If `status` is `"connected"`
The Admin API key is already configured and working. Show the last 24h cost if available.

### If `status` is `"no_key"`
Explain that the API key is **optional** — only needed for dollar cost tracking (`/codex-hud:costs-*`). Rate limits, token usage, and statusline all work without it.

Then ask the user whether they want to configure an Admin key now:

- **Skip** — leave it unconfigured (recommended for Teams/Enterprise subscribers whose costs are included in their plan)
- **Add key now** — ask for the `sk-admin-...` key via `AskUserQuestion`, then:

  ```bash
  node "${CLAUDE_PLUGIN_ROOT}/dist/index.js" setup --key "USER_PROVIDED_KEY" --json
  ```

### If `status` is `"error"`
Show the error and suggest the user check their key.

Get an Admin key at: https://platform.openai.com/settings/organization/admin-keys
