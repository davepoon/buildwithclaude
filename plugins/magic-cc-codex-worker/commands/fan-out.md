---
description: Fan out multiple Codex implementer agents in parallel, one per subtask or per Linear epic child
disable-model-invocation: true
---

Two modes based on `$ARGUMENTS`:

**Mode 1: Epic fan-out (MF projects only).** If `$ARGUMENTS` is a Linear epic identifier (e.g. `TEAM-100`):
1. Read the epic's child issues via Linear MCP (`mcp__claude_ai_Linear__list_issues` with `parentId: <epic-id>`).
2. For each child whose status is Backlog or Todo, call `magic-codex` `spawn` with:
   - `role: "implementer"`
   - `prompt`: a clear task description from the child's title + description
   - `issue_id`: the child's identifier
3. Collect all `agent_id`s. Report: "Spawned N agents for epic TEAM-100 children: [list]."
4. Suggest polling via `/magic-codex:status` (no args → all-agents table) until all terminal.

**Mode 2: Inline list.** If `$ARGUMENTS` is a list of prompts separated by `---` or `;;`:
1. Split into N prompts.
2. Spawn one implementer per prompt (no `issue_id`).
3. Return the agent_ids.

**Guardrails:**
- Warn if spawning more than 5 agents at once (resource concern, and most users want to review in batches).
- If `get_delegation_policy` returns `minimal`, ask the user to confirm before fan-out (fan-out is high-delegation by definition).
