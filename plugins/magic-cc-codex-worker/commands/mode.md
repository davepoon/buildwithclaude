---
description: View or set the magic-codex delegation level (minimal/balance/max)
disable-model-invocation: true
---

If `$ARGUMENTS` is empty, call the `magic-codex` MCP tool `get_delegation_policy` and show the current level, its source (env/project/user/default), and a one-line summary of each level.

Otherwise parse `$ARGUMENTS`. The first token must be one of `minimal`, `balance`, `max`. Optional flag `--project` writes the setting to the project repo instead of user-global.

**Default behavior — user-global (affects every project for this user):**

1. Ensure `~/.magic-codex/` directory exists (create it if missing).
2. Write `~/.magic-codex/config.toml` with:
   ```toml
   [delegation]
   level = "<value>"
   ```
   If the file already exists, preserve any other sections and only update the `[delegation]` block.
3. Confirm: "Delegation level set to `<value>` (user-global at `~/.magic-codex/config.toml`). Affects every project for this user."

**With `--project` flag — project-scoped (affects only this repo, team-wide when committed):**

1. Resolve the repo root via `git rev-parse --show-toplevel`. If not inside a git repo, abort and tell the user to drop the flag to use the user-global form instead.
2. Write `<repo-root>/magic-codex.toml` with the same `[delegation]` block.
3. Confirm: "Delegation level set to `<value>` (project-scoped at `<repo-root>/magic-codex.toml`). Commit this file to share with your team."

Precedence when the MCP server resolves the active level: `MAGIC_CODEX_DELEGATION_LEVEL` env var > project `magic-codex.toml` > user-global `~/.magic-codex/config.toml` > built-in default (`balance`).
