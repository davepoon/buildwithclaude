---
name: ralph-review-trio
description: Run a sequential three-tier code review on a finished implementation branch — Haiku (surface) → Sonnet (logic) → Opus (deep). Restarts from Tier 1 on any tier failure. Use when a solo branch or PR is code-complete and you want structured pre-merge verification before human review.
---

# Ralph Review Trio

This skill triggers `/ralph-review`, which runs three sequential reviewer subagents at increasing depth. If any tier flags a failure, the loop restarts from Tier 1 after fixes.

## When to trigger

- An implementation is code-complete on a feature / solo branch.
- All acceptance criteria for the underlying issue are believed satisfied.
- Pre-merge verification is needed before human review or merge-to-main.
- You want structured evidence that each tier's checklist was walked.

## When NOT to trigger

- Work-in-progress branches mid-implementation — Ralph assumes the change is complete.
- Documentation-only diffs with no code — Tier 2/3 still run but most checks short-circuit to "doc-only PR" exemption; overkill for a single README edit.
- Hotfix branches where speed dominates verification — use the project's normal PR review.

## How it works

```
/ralph-review
    │
    ▼
  Tier 1  — Haiku  (surface checks)   ─── fail ──> restart
    │  pass
    ▼
  Tier 2  — Sonnet (logic checks)     ─── fail ──> restart
    │  pass
    ▼
  Tier 3  — Opus   (deep analysis)    ─── fail ──> restart
    │  pass
    ▼
  RALPH_PASS  →  merge OK
```

A `<promise>HAIKU_PASS</promise>` / `<promise>SONNET_PASS</promise>` / `<promise>OPUS_PASS</promise>` token is emitted by each tier on pass. All three required for overall pass.

## Entry point

`/ralph-review` — defined in `../../commands/ralph-review.md`.

## Per-tier checklists

- `../../agents/haiku-reviewer.md` — Tier 1 surface checklist
- `../../agents/sonnet-reviewer.md` — Tier 2 logic checklist
- `../../agents/opus-reviewer.md` — Tier 3 deep-analysis checklist

Extended reference content under `references/` (same dir as this SKILL.md) is loaded on demand by each tier when a specific check requires more context.

## Outputs

Each tier writes a fenced `## RESULT` block with:

```
## RESULT
mcp_graph_available: yes|no      # first line when discussing graph queries
verdict: pass|fail|unknown
files_touched: [paths]
findings: [{path, line, claim, evidence}]
scope_gaps: [list or "none"]
```

The main agent reads the RESULT block and decides next action (restart, next tier, or PASS).
