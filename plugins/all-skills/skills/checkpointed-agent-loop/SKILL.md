---
name: checkpointed-agent-loop
category: ai-agents
description: "Run long or failure-prone Claude Code tasks as bounded, resumable loops with a durable state machine, attempt budget, and verification evidence checkpoint."
license: MIT
---

# Checkpointed Agent Loop

Use this skill when a task can be interrupted, needs bounded retries, or must prove verification before it is called complete. It adds a small local checkpoint file around ordinary Claude Code work so a new context can resume from explicit state instead of reconstructing progress from chat.

The included Node.js utility stores state and evidence. It does **not** execute commands, call a model, spawn agents, access secrets, or contact a network service. Claude Code remains responsible for each actual tool call and for deciding whether a human approval is required.

## When to Use This Skill

- A migration, refactor, test repair, or investigation may span multiple sessions.
- A bounded retry loop is safer than repeatedly improvising from conversation history.
- A task needs a durable next action and a record of which verification actually ran.
- You need to stop at an external dependency or a human decision without claiming success.

Do not use it for a one-line edit or a workflow that already has its own durable runner.

## State Model

The checkpoint uses these states and only these transitions:

```text
planned -> running
running -> verifying | failed | blocked
verifying -> succeeded | running | failed | blocked
```

`succeeded`, `failed`, and `blocked` are terminal. Entering `running` consumes one attempt, and the finite `maxAttempts` value cannot be exceeded. A transition to `succeeded` is rejected until the checkpoint contains at least one passing evidence record from `verifying`.

## Setup

Choose a project-local path that is not committed with application code, for example `.agent/checkpoints/data-migration.json`. Keep objectives, reasons, and evidence free of API keys, tokens, passwords, personal data, and raw secret-bearing logs.

Set the helper path for the commands below:

```bash
SKILL_DIR="<absolute path to the installed checkpointed-agent-loop skill>"
CHECKPOINT=".agent/checkpoints/task.json"
```

Initialize with a finite budget:

```bash
node "$SKILL_DIR/scripts/checkpoint-loop.mjs" init \
  --file "$CHECKPOINT" \
  --task "data-migration" \
  --objective "Migrate the user table without losing records" \
  --max-attempts 3 \
  --next-action "Inspect the current migration and test fixture"
```

## Operating Protocol

### 1. Start one bounded attempt

Before making the change, persist the next action and enter `running`:

```bash
node "$SKILL_DIR/scripts/checkpoint-loop.mjs" transition \
  --file "$CHECKPOINT" \
  --to running
```

Use Claude Code-native tools for exactly the bounded action described by `nextAction`. Do not turn one attempt into an unbounded plan.

### 2. Enter verification

After the action, move to verification before deciding the outcome:

```bash
node "$SKILL_DIR/scripts/checkpoint-loop.mjs" transition \
  --file "$CHECKPOINT" \
  --to verifying
```

Run the relevant check yourself. The helper records a check name and outcome; it never runs that check for you:

```bash
node "$SKILL_DIR/scripts/checkpoint-loop.mjs" evidence \
  --file "$CHECKPOINT" \
  --check "npm test -- workspace migration" \
  --outcome passed \
  --artifact "artifacts/migration-test.txt"
```

Only cite an artifact that exists and is safe to share. A failed check can be recorded with `--outcome failed`; do not convert it to a passing record by rewriting the expected value.

### 3. Finish, retry, or escalate

If verification is genuinely passing:

```bash
node "$SKILL_DIR/scripts/checkpoint-loop.mjs" transition \
  --file "$CHECKPOINT" \
  --to succeeded
```

If the change needs another bounded attempt, provide a concrete next action and reason:

```bash
node "$SKILL_DIR/scripts/checkpoint-loop.mjs" transition \
  --file "$CHECKPOINT" \
  --to running \
  --next-action "Fix the null-row fixture and rerun the focused test" \
  --reason "Verification found a reproducible null-row failure"
```

Use `failed` for a terminal technical failure. Use `blocked` only when progress needs an external dependency or human decision:

```bash
node "$SKILL_DIR/scripts/checkpoint-loop.mjs" transition \
  --file "$CHECKPOINT" \
  --to blocked \
  --reason "Waiting for the database owner to approve the production window"
```

### 4. Resume after interruption

Read the checkpoint before doing any work in a new session:

```bash
node "$SKILL_DIR/scripts/checkpoint-loop.mjs" status \
  --file "$CHECKPOINT" \
  --format summary
```

For machine-readable recovery, omit `--format summary`. Continue from `nextAction`, inspect the history and evidence, and never repeat a completed attempt merely because the old conversation is unavailable.

## Safety Rules

- Use a positive, finite attempt budget. A loop without a ceiling is not a recoverable loop.
- Never mark `succeeded` without passing verification evidence in the checkpoint.
- Do not place secrets or full sensitive logs in the checkpoint; store only a safe check name and sanitized artifact path.
- The helper does not run evidence commands. Execute checks with normal approval and tool policy, then record their observed result.
- Destructive actions, external writes, payments, deployments, and permission changes still require the normal human approval boundary.
- Treat a malformed or manually edited checkpoint as invalid and stop for review; do not guess its missing state.

## Examples

### Interrupted migration

An agent initializes `data-migration` with three attempts, enters `running`, updates the migration, and is interrupted before verification. The next session runs `status`, sees `running` and the saved `nextAction`, performs only that action, then records the actual test result before moving to `succeeded` or a bounded retry.

### Attempt ceiling reached

An agent records a failed verification, transitions back to `running` with `maxAttempts: 2`, and fails the same focused check on the second attempt. A third transition into `running` is rejected with `attempt budget exhausted`; the agent must report the failure or escalate rather than silently looping forever.

## Verification

The script has a local Node test suite covering legal transitions, terminal immutability, attempt limits, evidence rules, malformed input, atomic persistence, and rejected-operation preservation:

```bash
node --test "$SKILL_DIR/scripts/checkpoint-loop.test.mjs"
```

The repository validator checks the frontmatter and directory/name contract:

```bash
node scripts/validate-skills.js
```
