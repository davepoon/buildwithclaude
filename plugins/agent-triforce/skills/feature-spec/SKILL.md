---
name: feature-spec
category: workflow-orchestration
description: Creates a complete product feature specification with acceptance criteria, scope, dependencies, and risks. Delegates to the Prometeo (PM) agent.
---

# Feature Spec

Creates a complete product feature specification using the Prometeo (PM) agent.

## When to Use This Skill

- Defining a new feature or product requirement
- Writing user stories with acceptance criteria
- Planning product work that needs a structured spec
- Documenting business requirements before implementation

## What This Skill Does

1. Runs the SIGN IN checklist (identity, task, memory review)
2. Researches existing specs to avoid conflicts
3. Creates a comprehensive spec at `docs/specs/{feature-name}.md`
4. Runs the Spec Completion checklist (TIME OUT)
5. Prepares a structured handoff to the Dev agent
6. Runs the SIGN OUT checklist (memory update, deliverables)

## How to Use

### Basic Usage

```
/feature-spec user authentication with JWT tokens
```

### Detailed Usage

```
/feature-spec multi-tenant billing system with Stripe integration
```

## Example

**User**: `/feature-spec webhook event system`

**Output**: A complete spec at `docs/specs/webhook-event-system.md` containing:
- Problem statement and success metrics
- User stories with GIVEN/WHEN/THEN acceptance criteria
- In-scope and out-of-scope items
- Dependencies, risks, and open questions
- Handoff notes for the Dev agent

## Tips

- Be specific about the feature scope in your description
- The agent will ask clarifying questions rather than guess
- Review the generated spec before passing to implementation
