---
description: Continue a completed/failed/cancelled Codex agent with a new prompt
disable-model-invocation: true
---

Parse `$ARGUMENTS` as `<agent_id> <prompt...>`.

Call `magic-codex` MCP tool `resume` with `agent_id` and `prompt`. If the tool rejects (still running, no thread_id, etc.), explain the reason clearly.

After success, remind the user to poll `/magic-codex:status $agent_id`.
