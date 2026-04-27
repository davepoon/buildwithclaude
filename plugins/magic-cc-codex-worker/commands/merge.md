---
description: Merge a completed Codex implementer's worktree back into its base_ref
disable-model-invocation: true
---

Parse `$ARGUMENTS`: first token is `agent_id`. Optional flags:
- `--strategy squash|ff|rebase` (default: squash)
- `--keep-worktree` (don't auto-remove after)
- `--message "commit msg"` (for squash strategy)

Call `magic-codex` MCP tool `merge`. On success, show the merged SHA and base ref. On conflict or other failure, surface the error and suggest manual resolution inside the worktree.
