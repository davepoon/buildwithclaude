---
name: fable-1080
category: ai-agents
description: >-
  Mandatory protocol when the session model is a frontier model (e.g. Claude Fable 5) and a dev task comes in (implement, build, fix, refactor, feature, migration). The orchestrator works only at the front (plan/architecture) and at the back (review/verification) — the execution in the middle is done by the subagents executor-opus (complex) and executor-sonnet (routine). Triggers: any implementation request on a frontier session model, "10-80-10", "/fable-1080", "build token-efficiently", "delegate this". NOT for pure lookups, questions, single-file mini edits (<10 lines) or planning discussions without implementation.
---

# fable-1080 — the frontier model plans, others implement, the frontier model verifies

Goal: frontier-model quality at a fraction of the frontier-model tokens. Frontier tokens flow only into the two phases where frontier intelligence pays off (architecture + review). The execution — where 80 % of the tokens burn — runs on cheaper models (Opus/Sonnet).

## Phase 1 — PLAN (orchestrator, you, ~10 %)

1. Classify the task: complex (multi-file, logic, debugging) → `executor-opus`. Routine (boilerplate, tests, mechanical edits) → `executor-sonnet`. Mini edit under ~10 lines in 1 file → do it yourself, no overhead.
2. Read only as much context as the plan needs (Grep/Glob first, Read with offset/limit).
2b. Apply the Lazy Ladder to the plan BEFORE commissioning new code: does this need to exist (YAGNI)? Does it already exist in the codebase? Stdlib / native platform feature / already-installed dependency instead of building it? The result feeds into CONTRACT/OUT-OF-SCOPE of the handoff.
3. **Write the handoff** (definition of ready) — without a complete handoff you do NOT delegate:

```
GOAL: <what works at the end, 1-2 sentences>
WHY: <intent/context — prevents wrong directions>
FILES: <affected paths + what happens there>
CONTRACT: <signatures, data models, names that are fixed>
ACCEPTANCE: <checkable criteria, including which test/command must be green>
OUT-OF-SCOPE: <what is explicitly NOT touched>
```

## Phase 2 — EXECUTE (subagent, ~80 %)

- Delegate via the Agent tool with `subagent_type: "executor-opus"` or `"executor-sonnet"`. **NEVER spawn an executor without an explicit model assignment** — an agent without a model override inherits the frontier session model and burns the limit.
- **Keep the subagent alive:** send fixes and follow-up work to the same agent via SendMessage (cache reads instead of full reprocessing). Spawn a new one only for a new, independent work package.
- Split large tasks into bounded increments (1 increment = 1 handoff = 1 checkable result); do not dump "the whole feature" into one agent.
- Independent, parallelizable increments: start several executors at once (one message block, multiple Agent calls).
- While an executor is running: do NOT read the same files in parallel or duplicate the work.

## Phase 3 — REVIEW (orchestrator, you, ~10 %)

1. Review from the diff (`git diff`), do not re-read whole files.
2. Review against the ACCEPTANCE criteria of the handoff — not against taste. No post-hoc refactoring for stylistic reasons.
2b. **Complexity pass** (ponytail review format, 1 line per finding): `<file>:L<n>: <tag> <what> → <replacement>` with tags `delete:` (dead/speculative) · `stdlib:` (hand-rolled what stdlib does) · `native:` (dependency for a platform feature) · `yagni:` (abstraction with a single implementation) · `shrink:` (same logic, fewer lines). Close with `net: -N lines possible` or `Lean already. Ship.` Never flag safety-floor code (validation, error handling, the one mini check) as bloat.
3. Check the executor's verification evidence; when in doubt, run the decisive check yourself (test, smoke, curl).
4. Small review findings: hand them back as a follow-up task via SendMessage to the living executor. Step in yourself only for architectural errors.
5. Then the project duties: commit/push or deploy according to project doctrine.

## Token hygiene (applies in all phases)

- **Effort discipline:** medium is the working mode for routine; high only for architecture decisions and stuck debugging; max never as a default (more expensive and often worse results). The user sets effort via `/effort` — on an obvious mismatch, suggest it briefly.
- Outcome-first, answer tersely; never request or deliver reasoning narratives.
- Act, don't plan: when there is enough information to act, act — no option surveys.
- No re-reads of files already read; summarize tool outputs instead of passing them through.
- If the session ends mid-work: have a HANDOFF.md/NEXTSTEPS.md written so the next session starts without expensive context reconstruction.

## Anti-patterns (forbidden)

- The orchestrator writes boilerplate, tests or mass edits itself.
- Executor spawn without a handoff ("just do feature X") — underspecified tasks are the second biggest token waste after blind exploration.
- Several frontier-model instances in parallel (Agent calls without model/subagent_type on a frontier session).
- Review as a complete re-read of the repo instead of a diff.
