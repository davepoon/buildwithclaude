---
description: Show status of Codex agents — one agent by id, or all
disable-model-invocation: true
---

If `$ARGUMENTS` contains an agent_id (starts with `codex-`), call the `magic-codex` MCP `status` tool with `agent_id`. Otherwise call it with no args.

Render the response as a compact table: agent_id, role, status, started_at, last_output_preview. For all-agent queries, include the summary counts.
