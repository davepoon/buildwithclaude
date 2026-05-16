---
name: capture
description: >
  Save a memory to Origin in flow. Active capture verb — use proactively
  when the user states a preference, makes a decision, corrects you, or
  shares a durable fact. Invoked as `/capture <content>`.
argument-hint: "<content>"
allowed-tools: ["mcp__plugin_origin_origin__capture", "mcp__plugin_origin_origin__recall", "mcp__plugin_origin_origin__create_entity", "mcp__plugin_origin_origin__create_relation", "mcp__plugin_origin_origin__accept_revision", "mcp__plugin_origin_origin__dismiss_revision", "Bash"]
---

# /capture

Capture a single memory in the moment. Active verb: agent captures the
moment of insight, like a photograph.

## How to invoke

Call the `origin` MCP server's `capture` tool with the user's content as a
complete, self-contained statement. Attach `topic` from cwd or the
conversation — don't make the user type it.

```
capture(content="<args, written as a full sentence with WHY>",
        memory_type="<picked from the 6 types>",
        entity="<primary entity name, if any>",
        space=<inferred>)
```

### `memory_type` — agent picks one of 6

The daemon classifies when a local model or API key is configured. In
local memory mode it does not, so the agent picks the type from the content itself. Use this
mapping:

| Type | Use for |
|---|---|
| `identity` | Durable facts about the user (role, company, language preference) |
| `preference` | "I prefer X because Y" — a habit, a correction, a stylistic choice |
| `decision` | "Going with A over B because C" — a specific choice with rationale |
| `lesson` | Root cause found, workaround discovered, technical insight earned |
| `gotcha` | Sharp edge, surprising behavior, a thing to watch out for |
| `fact` | Durable info about people, projects, tools — anchor to `entity` when possible |

If two types fit, pick the one closest to *why the memory matters*. A
decision *also* implies a preference, but `decision` is more specific.

### `entity` — extract the anchor

Pick the single most important named thing in the content: a person,
project, tool, place. Use the exact name. Example: "Alice prefers TDD
because…" → `entity="Alice"`. If the content has no named anchor,
omit `entity`.

### `topic` / `space` inference

- cwd inside a repo → repo name (e.g. `~/Repos/origin/...` → `"origin"`).
- Outside any repo → most recent topic from the conversation, or omit.
- Always pass `space` when scope is known; if uncertain, run `list_spaces`
  later (post-PR-C) or omit.

### Multiple entities or relations

The MCP `capture` tool takes a single primary `entity`. For additional
entities or relations, use the dedicated MCP tools. If the content
names more than one entity, capture the memory first, then for each
additional entity:

```
create_entity(name="<entity>", entity_type="<person|project|tool|place>")
```

For a relation between two entities:

```
create_relation(from_entity="<a>", to_entity="<b>", relation_type="<verb>")
```

Skip these calls when the daemon has an LLM — its post-ingest enrichment
covers extraction.

## What to capture

- Decisions: "Going with approach A because B"
- Preferences: "Prefers TDD because catches regressions early"
- Corrections: "Actually it's C, not D"
- Identity / project facts: "Works on Origin, a local memory daemon for AI tools"

## What NOT to capture

- System prompts, boot logs, heartbeats
- Transient task state ("currently working on...")
- Tool output, command results, architecture dumps
- Single-word acknowledgments
- Things the user can trivially re-derive (file paths, recent git history)

## Atomic ideas

One capture = one idea. "Prefers TDD" and "Uses pytest" are two captures, not
one.

## When to use

- User explicitly says "remember this", "save that", "capture this".
- User states a durable preference / decision / correction proactively (no
  ask required — that's the floor, not the trigger).

## When NOT to use

- End of session bulk store → use `/handoff` (multi-item batch).
- Pulling memories back out → use `/recall`.

## Post-capture contradiction signal

After `capture` returns, check `response.triggered_revisions` and `response.auto_superseded`.

### auto_superseded (no action needed)

If `auto_superseded` is non-empty, the daemon already resolved the contradiction. Surface it as informational:

```
Note: auto-superseded mem_X. Origin replaced a prior protected memory because
trust=high and similarity > 0.9. No action needed.
```

No accept/dismiss call required. The revision was applied automatically.

### triggered_revisions (human review needed)

If `triggered_revisions` is non-empty (and `auto_superseded` is empty), render an inline block to the user:

```
Stored mem_new.

This capture topic-matches a protected memory now flagged for revision:
  - mem_target_abc

Action: accept (replace original content) | dismiss (drop the revision) | leave (decide later)
```

Inline verb map:

- accept: `accept_revision(target_source_id="mem_target_abc")`
- dismiss: `dismiss_revision(target_source_id="mem_target_abc")`
- leave: no call; surfaces again in next `/brief`

Both fields can technically be non-empty in a single response (multiple protected matches), but in practice only one fires per capture: `auto_superseded` fires when trust=full and similarity > 0.9, `triggered_revisions` fires otherwise.

If neither field is non-empty, the capture stored cleanly with no conflicts.
