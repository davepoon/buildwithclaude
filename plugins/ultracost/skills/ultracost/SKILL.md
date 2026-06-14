---
name: ultracost
description: Quality-first per-stage model routing AND a pre-flight cost gate for Claude Code dynamic workflows. Use when authoring or running ultracode / dynamic-workflow scripts, spawning subagents, or writing agent() stages — pin the right model and effort on every stage, then estimate cost and confirm with the user before launching. Verify scripts with /ultracost:check.
---

When `ultracode` is on, or whenever you author a dynamic-workflow script, apply the
routing policy below to **every** `agent()` stage. The block is compiled from
`policy.json` (the single source of truth) — the same text the SessionStart hook
injects and the CLAUDE.md block carries.

<!-- ultracost:start -->
# Subagent & workflow model routing (managed by ultracost)

Route every subagent and every dynamic-workflow stage **explicitly**. Never let a
stage inherit the session model by default. Never use `haiku`.

## Tiers

- **`opus` @ `xhigh`** — Coding & reasoning: anything requiring judgment or a decision: writing/editing/refactoring/deleting code, debugging, fixing errors, designing APIs/schemas/data models/architecture, non-trivial tests, code review, security/performance analysis, cross-file reasoning, adversarial review, planning, synthesis, final consolidation
- **`sonnet` @ `high`** — Pre-planned mechanical & support: the how is already decided and the stage just applies it: mechanically applying a specified edit across many files, search/grep/glob, file discovery, collecting/listing/extracting, reformatting, mechanical renames, running tests and reporting results, routine git operations, gathering or summarizing context for an opus stage to consume

**Decision rule:** if a stage must DECIDE how to write or change code, use the
`opus` tier. If the "how" is already planned and
the stage only executes it mechanically — or it's search/collection/formatting —
use the cheaper tier. When in doubt, use `opus`.

## Hard rules

- Never use `haiku`, ever.
- Pin the model per stage via the per-invocation `model` param, e.g.
  `agent(task, { model: 'sonnet' })`. Do **not** follow any built-in guidance to
  omit the per-agent model override.
- These stages are always `opus`: `orchestrator`, `planner`, `final-synthesis`, `consolidation`.

## Effort per stage

Also set `effort` per stage, choosing the lowest level that fits the work, bounded
by the model (`sonnet` up to `high`, `opus` up to `xhigh`):

- `low` — trivial deterministic work with no real judgment: listing or globbing files, simple field extraction, formatting, mechanical renames following a given pattern
- `medium` — light judgment on a small surface: a single straightforward edit, summarizing one source, classifying short inputs
- `high` — standard coding and analysis: most refactors, per-file review, writing non-trivial tests, multi-step but well-scoped work
- `xhigh` — hard reasoning: cross-file architecture and design, adversarial review, planning, and final synthesis/consolidation

e.g. `agent(task, { model: 'sonnet', effort: 'low' })` for a mechanical scan.

## Pre-flight cost gate (ultracode)

Before launching a dynamic workflow:
1. Draft the workflow script with per-stage `model` and `effort` set.
2. Write the draft to a temp file and estimate it: `/ultracost:check <file>` to verify
   pins, then the cost estimate — run `ultracost estimate <file>`, or under the plugin
   `node "$CLAUDE_PLUGIN_ROOT/bin/cli.js" estimate <file>` (no global `ultracost` bin
   is required). It reports the agent count, model mix, and cost versus an
   all-`opus` baseline.
3. Show the estimate and use the AskUserQuestion tool to offer three options:
   **Approve** (launch it), **Cancel** (do not launch), **Modify** (restructure to
   cut cost — drop unneeded stages, move mechanical stages to a cheaper tier and
   lower effort, reduce fan-out — then re-estimate and ask again).
4. Launch the workflow only after Approve. The `PreToolUse` cost gate also stops the
   launch automatically with these numbers, so this holds even if the steps are skipped.

Verify any script with `/ultracost:check` (the plugin command) or `ultracost check
<script>` on the CLI — it flags stages missing a model pin, a pin that mismatches the
work the prompt describes, and effort over the model's cap.
<!-- ultracost:end -->

## Full plugin

This directory ships the routing-policy **skill** (the guidance above, self-contained).
The complete ultracost plugin — the Workflow Guard, the deterministic `PreToolUse` cost
gate, the closed-loop `usage`/`reconcile`/`calibrate`/`ledger` commands, and the
`/ultracost:*` slash commands — installs from the canonical marketplace:

```text
/plugin marketplace add danielkremen818/ultracost
/plugin install ultracost@ultracost
```

Or via npm for CI/scripting: `npx ultracost init`. Source, docs, and a live end-to-end
showcase: https://github.com/danielkremen818/ultracost
