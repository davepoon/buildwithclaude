---
description: Launch a Codex agent in the background (implementer/reviewer/planner/generic)
disable-model-invocation: true
---

Parse `$ARGUMENTS` as `<role> <prompt...>`. Valid roles: `implementer`, `reviewer`, `planner`, `generic`.

Then call the `magic-codex` MCP tool `spawn` with:
- `role`: the parsed role
- `prompt`: the rest of the arguments

Return the `agent_id` and remind the user they can check progress with `/magic-codex:status $agent_id`.

If the user hasn't specified a role, default to `generic` and use the full `$ARGUMENTS` as prompt.
