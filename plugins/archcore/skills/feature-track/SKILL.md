---
name: feature-track
argument-hint: "[topic]"
description: "Advanced — Full feature delivery flow: PRD → spec → plan → task-type. Best for well-scoped features that need formal specification and a repeatable delivery pattern. For lightweight product planning, use /archcore:product-track."
---

# Feature Track: PRD → spec → plan → task-type

Full feature lifecycle from requirements to repeatable implementation pattern. Best for well-scoped features that need formal specification and a recurring delivery pattern.

## Step 1: Check existing

`mcp__archcore__list_documents(types=["prd", "spec", "plan", "task-type"])` — see what exists. If `$ARGUMENTS` provided, check for duplicates on this topic.

## Step 2: Determine scope

If related documents already exist (e.g., a PRD without a spec), pick up where the chain left off — don't recreate.

## Step 3: PRD

Use the `AskUserQuestion` tool to ask: "What problem does this solve? What are the success metrics?"

Compose content covering Vision, Problem Statement, Goals and Success Metrics, Requirements. Create via `mcp__archcore__create_document(type="prd")`.

## Step 4: Spec

Use the `AskUserQuestion` tool to ask: "What is the technical contract? What is the API surface?"

Compose content covering Purpose, Scope, Authority, Subject, Contract Surface, Normative Behavior, Constraints, Invariants, Error Handling, Conformance. Create via `mcp__archcore__create_document(type="spec")`.

Add relation: `mcp__archcore__add_relation` — spec `implements` prd.

## Step 5: Plan

Use the `AskUserQuestion` tool to ask: "What are the implementation phases? What are the blockers?"

Compose content covering Goal, Tasks (phased), Acceptance Criteria, Dependencies. Create via `mcp__archcore__create_document(type="plan")`.

Add relation: `mcp__archcore__add_relation` — plan `implements` spec.

## Step 6: Task-type

Use the `AskUserQuestion` tool to ask: "What's the recurring implementation pattern? What are the key steps each time?"

Compose content covering Context, Steps, Checklist, Pitfalls. Create via `mcp__archcore__create_document(type="task-type")`.

Add relation: `mcp__archcore__add_relation` — task-type `related` plan.

## Step 7: Relate to existing

Check for ADRs, rules, or other documents that should be linked. Suggest additional `add_relation` calls.

## Result

Four linked documents: PRD → spec → plan → task-type (spec `implements` prd, plan `implements` spec, task-type `related` plan).
