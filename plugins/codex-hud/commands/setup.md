---
description: Install codex-hud statusline (automatic, idempotent)
allowed-tools: Bash(node:*)
---

# Setup Codex HUD

Install (or re-install) the statusline integration so the Codex usage bars render below claude-hud's statusline.

```bash
node "${CLAUDE_PLUGIN_ROOT}/dist/index.js" install-statusline --json
```

Read the JSON output. Report concisely to the user:
- If `ok: true`, confirm that the symlink was created (or already in place) and that `~/.claude/settings.json` is configured.
- If `settingsUpdated: true`, remind them to run `/reload-plugins` or restart Claude Code.
- If `ok: false`, print the `message` field so the user can fix it.

Then briefly check API key status (informational only, no prompt):

```bash
node "${CLAUDE_PLUGIN_ROOT}/dist/index.js" setup --json
```

Interpret the output:
- `"status": "connected"` → tell the user costs tracking is active.
- `"status": "no_key"` → tell the user: "Admin API key not configured. Costs commands will show a no-key notice. If you want to enable dollar cost tracking, run `/codex-hud:setup-key`. Otherwise no action needed — rate limits and usage work without a key."
- `"status": "error"` → show the error.

**Do not prompt for the API key from this command.** Direct the user to `/codex-hud:setup-key` if they want to configure one.
