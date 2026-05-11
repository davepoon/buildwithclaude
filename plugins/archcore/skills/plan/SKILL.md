---
name: plan
argument-hint: "[feature or initiative]"
description: "Plan a feature or initiative — creates a requirements chain (idea → PRD → plan) for large scope, or a single plan document for focused work. Use when someone says 'let's plan', 'create a roadmap for', or 'I need to plan X'. Not for recording a decision — use /archcore:decide."
---

# /archcore:plan

Plan a feature or initiative. Creates the full requirements chain (idea → PRD → plan) or a single plan document, depending on scope.

## When to use

- "Plan the auth redesign"
- "I need to plan a new notification system"
- "Create a feature plan for the API migration"
- "Let's plan this out"

**Not plan:**
- Recording a decision → `/archcore:decide`
- Documenting existing code → `/archcore:capture`
- Establishing a standard → `/archcore:standard`
- Reading applicable rules/ADRs/specs before coding → `/archcore:context`
- Picking up where work left off → `/archcore:context`

## Routing table

| Signal | Route | Documents |
|---|---|---|
| User describes a **feature or initiative** (default) | → product-track flow | idea → prd → plan |
| User says "just a plan" or "only the plan document" | → single plan | plan only |
| User says "need research first" or "market analysis" | → sources-track then product-track | mrd → brd → urd, then idea → prd → plan |
| Ambiguous | → ask one question | "Full feature plan (idea + PRD + plan) or just a plan document?" |

Default: product-track flow (idea → prd → plan). This is the smallest complete planning unit.

## Execution

### Step 1: Check existing

`mcp__archcore__list_documents(types=["idea", "prd", "plan"])` — check what exists on this topic. If partial chain exists, pick up where it left off.

### Step 2: Scope

If `$ARGUMENTS` is clear, proceed with default (product-track). If ambiguous, ask: "Full feature plan (idea + PRD + plan) or just a plan document?"

### Step 3: Create documents

**If product-track flow (default):**

Skip any documents that already exist on this topic.

**Idea** (if missing):
- Ask: "What's the core concept? Who would benefit?"
- Compose content covering Idea, Value, Possible Implementation, Risks and Constraints.
- `mcp__archcore__create_document(type="idea")`

**PRD** (if missing):
- Ask: "What problem does this solve? What are the success metrics?"
- Compose content covering Vision, Problem Statement, Goals and Success Metrics, Requirements.
- `mcp__archcore__create_document(type="prd")`
- `mcp__archcore__add_relation` — prd `implements` idea

**Plan** (if missing):
- Ask: "What are the key phases? What are the dependencies?"
- Compose content covering Goal, Tasks (phased), Acceptance Criteria, Dependencies.
- `mcp__archcore__create_document(type="plan")`
- `mcp__archcore__add_relation` — plan `implements` prd

**If single plan only:**
- Ask: "What is the goal? What are the key phases and dependencies?"
- Compose content covering Goal, Tasks (phased), Acceptance Criteria, Dependencies.
- `mcp__archcore__create_document(type="plan")`

### Step 4: Relate

Suggest `mcp__archcore__add_relation` calls to link with existing ADRs, specs, or other relevant documents.

## Result

Product-track: three linked documents — idea → prd → plan (each `implements` previous). Single plan: one plan document. Report: paths, relations, recommended next actions (e.g., "consider creating a spec for the technical contract").
