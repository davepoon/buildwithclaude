---
name: review
description: >
  Power-user audit of Origin's pending surfaces. Most users want
  `/brief` for revisions. That handles the daily flow. Use `/review` only
  for explicit deep-walk audits after bulk imports, or when you want to walk
  the full queue rather than the top 3 shown in /brief.
  Invoked as `/review captures` or `/review revisions`.
argument-hint: "captures | revisions"
allowed-tools: ["mcp__plugin_origin_origin__list_pending", "mcp__plugin_origin_origin__list_pending_revisions", "mcp__plugin_origin_origin__confirm_memory", "mcp__plugin_origin_origin__forget", "mcp__plugin_origin_origin__capture", "mcp__plugin_origin_origin__accept_revision", "mcp__plugin_origin_origin__dismiss_revision"]
---

# /review

Power-user audit lever. Most users do not need /review in daily flow:

- **Pending revisions** surface in `/brief` automatically (top 3 with inline accept/dismiss).
- **Pending captures from this session** surface in `/handoff`'s preview
  block (top 3, informational). Use `/review captures` for the deep walk.
- **Orphan wikilinks** surface in `/distill`'s topic-suggestion block.

Use /review only when you want the deep walk those skills intentionally do not force.

## Scoped invocation

- `/review captures`: walk every unconfirmed memory (`list_pending`,
  unfiltered by session). Per item: accept (`confirm_memory`), edit
  (`capture` with `supersedes=<old_id>` then `forget(old_id)`), or
  reject (`forget`).

- `/review revisions`: walk every pending revision (`list_pending_revisions`,
  no cap). Per item: accept (`accept_revision`), dismiss (`dismiss_revision`),
  or skip.

Bare `/review` (no arg) prints this help block and exits. Does not auto-walk.

## When to use

- After a bulk import (ChatGPT, Obsidian dump) when you want to audit
  every auto-classification before sealing.
- When `/brief` shows ">3 pending revisions" and you want to clear the
  full queue, not just the top 3.

## When NOT to use

- Daily session work. `/brief` handles the surface that matters today.
- Specific factual lookup: use `/recall`.
- Searching for facts: use `/recall`.

## Cost

Read-only until the user confirms or rejects. No LLM calls. Cheap.
