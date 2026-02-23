---
name: implement-feature
category: workflow-orchestration
description: Implements a feature from its specification. Reads the spec, designs architecture, writes code and tests. Delegates to the Forja (Dev) agent.
---

# Implement Feature

Implements a feature from its specification using the Forja (Dev) agent.

## When to Use This Skill

- A feature spec has been approved and is ready for implementation
- You need architecture design, code, and tests for a defined feature
- Translating product requirements into working software

## What This Skill Does

1. Runs the SIGN IN checklist and verifies the spec handoff
2. Designs architecture (creates ADR if needed)
3. Defines interfaces/contracts, then implements in `src/`
4. Writes tests in `tests/` (unit + integration)
5. Runs the Implementation Complete checklist (TIME OUT 1)
6. Runs the Pre-Delivery checklist (TIME OUT 2)
7. Prepares structured handoff to QA agent
8. Runs the SIGN OUT checklist

## How to Use

### Basic Usage

```
/implement-feature webhook-event-system
```

### With Spec Reference

```
/implement-feature docs/specs/webhook-event-system.md
```

## Example

**User**: `/implement-feature user-authentication`

**Output**:
- Implementation in `src/` with all acceptance criteria met
- Tests in `tests/` covering critical paths
- ADR if significant architecture decisions were made
- Handoff notes for QA: files changed, how to test, known limitations

## Tips

- Ensure the feature spec exists before running this skill
- The agent creates an ADR for any significant architecture decisions
- Two TIME OUT checkpoints ensure both correctness and delivery cleanliness
