---
name: debrief
description: >
  Alias for `/origin:handoff` — symmetric brief/debrief naming. Same
  behavior: end-of-session ritual that writes session log + project
  status + granular MCP captures. Invoked as `/debrief`. Use when the
  user prefers the brief/debrief pair over brief/handoff.
allowed-tools: ["Bash", "mcp__plugin_origin_origin__capture"]
---

# /debrief

Alias for `/handoff`. Identical behavior — full end-of-session ritual:
git context grab (if repo), narrative session log at
`~/.origin/sessions/`, project status update, granular MCP captures.

Run the steps in `/origin:handoff` exactly. Same artifacts, same
guardrails. The only reason this skill exists is the symmetric naming —
`/brief` (session start) ↔ `/debrief` (session end). Pick whichever
verb feels natural; both invoke the same flow.

## When to use

- User says "wrapping up", "let's call it", "we're done", "debrief".
- Session about to close and useful state would otherwise be lost.

## When NOT to use

- Mid-flow capture during work → use `/capture` (single memory).
- Search / lookup → use `/recall`.
