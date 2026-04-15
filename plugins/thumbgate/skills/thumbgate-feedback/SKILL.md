---
name: thumbgate-feedback
description: Capture structured thumbs-up/thumbs-down feedback on agent actions and auto-promote repeated failures into prevention rules.
---

# ThumbGate Feedback Capture

When the user gives a 👍 or 👎 signal on any agent action, capture structured feedback including:

- **signal**: "up" or "down"
- **context**: what the agent was doing
- **whatWentWrong**: (for thumbs-down) description of the mistake
- **whatToChange**: (for thumbs-down) how to prevent it
- **whatWorked**: (for thumbs-up) what was good

Use the `capture_feedback` MCP tool from the thumbgate server to record feedback.
After 2+ thumbs-down on the same pattern, use `prevention_rules` to auto-generate blocking rules.

## Setup

```bash
npx thumbgate init
```
