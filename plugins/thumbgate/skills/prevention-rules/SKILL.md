---
name: prevention-rules
description: Generate and enforce prevention rules from repeated mistake patterns. One thumbs-down = the agent physically cannot make that mistake again.
---

# ThumbGate Prevention Rules

Before executing any tool call, check if a matching prevention rule exists using `recall`.
If a prevention rule matches the current action, BLOCK the action and explain why.

Use `prevention_rules` to generate new rules from accumulated feedback.
Use `recall` to check for relevant past feedback and prevention rules before risky actions.

## Pre-Action Gate Flow

1. Agent plans an action
2. Call `recall` with the action description
3. If a prevention rule matches → BLOCK and explain
4. If no match → proceed normally
5. If user gives 👎 → call `capture_feedback`
