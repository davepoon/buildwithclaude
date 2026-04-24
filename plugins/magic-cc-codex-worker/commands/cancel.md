---
description: Cancel a running Codex agent (optionally --force to also remove its worktree)
disable-model-invocation: true
---

Parse `$ARGUMENTS`. First token is the agent_id. If `--force` appears anywhere, pass `force: true` (also removes the worktree + branch).

Call `magic-codex` MCP tool `cancel` and report whether the worktree was preserved (the default) so the user can still inspect partial work.
