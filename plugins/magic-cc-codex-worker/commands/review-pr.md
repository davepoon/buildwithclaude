---
description: Spawn a Codex reviewer agent against a specific PR
disable-model-invocation: true
---

Parse `$ARGUMENTS` as `<pr_number>`. Build a spawn input:

```json
{
  "role": "reviewer",
  "prompt": "Review PR #<pr_number> for correctness, security, test coverage, and edge cases. Return a structured report with file:line citations.",
  "pr_number": <pr_number>,
  "overrides": { "timeout_seconds": 900 }
}
```

Call `magic-codex` MCP tool `spawn`. Return the `agent_id` and the full Codex reviewer output once `/magic-codex:status` shows it completed.

Pair this with Claude's own review (either interactive or via `/mf-pr-reviewer` if present) to get a dual-model perspective — the Codex reviewer uses a different model stack and tends to flag different concerns.
