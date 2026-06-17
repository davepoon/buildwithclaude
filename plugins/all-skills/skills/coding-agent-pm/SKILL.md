---
name: coding-agent-pm
description: Plan, delegate, review, and recover coding-agent implementation work with tight scope control, acceptance criteria, and validation.
category: ai-agents
license: MIT
---

# Coding Agent PM

Use this skill when a human is preparing, delegating, reviewing, or recovering implementation work done by Claude Code, Codex, OpenClaw, or another coding agent.

## When to Use This Skill

- You need to turn a vague implementation request into a bounded agent task.
- You are assigning work to one or more coding agents and need clear file ownership.
- You are reviewing an agent diff for scope drift, regressions, or missing validation.
- A coding agent has stalled, over-edited, or returned a result that is hard to trust.

## What This Skill Does

1. Defines the shipped outcome in one sentence.
2. Sets explicit scope: files or modules owned, files or modules excluded, and destructive actions that are forbidden.
3. Captures relevant project context before implementation starts.
4. Writes acceptance criteria that can be checked directly.
5. Requires validation commands or manual checks before final delivery.
6. Reviews the diff before accepting the work.

## Assignment Rules

- Keep the task brief concrete and bounded.
- State whether the agent may edit files or should only inspect and plan.
- Give ownership boundaries for code changes.
- Tell the agent not to revert unrelated user work.
- Prefer existing project patterns over new abstractions.
- Require the final response to include changed files, checks run, results, and remaining risks.

## Agent Brief Template

```markdown
# Agent Brief

## Outcome
Ship:

## Scope
Owned files/modules:

Do not edit:

Forbidden actions:
- Do not run destructive git commands.
- Do not revert unrelated user changes.

## Context
Relevant files:

Existing patterns to follow:

## Acceptance Criteria
- [ ] 
- [ ] 
- [ ] 

## Validation
Run:

Manual checks:

## Final Response Must Include
- Files changed
- Validation run and result
- Remaining risks or follow-ups
```

## Review Checklist

Review in this order:

1. Behavioral bugs or regressions.
2. Missing acceptance criteria.
3. Missing tests or weak validation.
4. Scope drift and unrelated refactors.
5. Security, privacy, or destructive-command risk.

If the agent drifted, stop new edits and ask it to map each change back to the original acceptance criteria.

## Recovery Prompt

Use this when a coding agent's work is hard to trust:

```text
Pause implementation. Map every changed file and every material change back to the original acceptance criteria. For each change, mark it as required, optional, or unrelated. Do not edit files until this map is complete.
```

## Example

**User**: "Have a coding agent add OAuth login."

**Better assignment**:

```markdown
Outcome: Add GitHub OAuth login to the existing auth flow.

Scope:
- Own: src/auth/*, src/routes/login.tsx, tests/auth/*
- Do not edit: billing, onboarding, database migrations unless a failing test proves it is required

Acceptance criteria:
- [ ] Existing email login still works.
- [ ] GitHub login creates or links a user through the existing auth service.
- [ ] Auth errors render through the existing form error pattern.
- [ ] Tests cover success, denied OAuth, and existing linked account.

Validation:
- npm test -- auth
- npm run lint
```

## Tips

- The smaller the owned file set, the better the agent result.
- Make "do not edit" lists explicit for shared or risky modules.
- Prefer acceptance criteria over long implementation instructions.
- Treat validation as part of the task, not a follow-up.
