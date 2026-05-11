---
name: architecture-track
argument-hint: "[topic]"
description: "Advanced — End-to-end architectural design flow: ADR → spec → plan. Best for significant technical decisions that require a formal specification and an implementation plan. For a decision without a spec, use /archcore:decide. For codifying standards, use /archcore:standard-track."
---

# Architecture Track: ADR → spec → plan

End-to-end architectural design flow. Best for significant technical decisions that need formal specification and an implementation plan.

## Step 1: Check existing

`mcp__archcore__list_documents(types=["adr", "spec", "plan"])` — see what exists. If `$ARGUMENTS` provided, check for duplicates on this topic.

## Step 2: Determine scope

If related documents already exist (e.g., an ADR without a spec), pick up where the chain left off — don't recreate.

## Step 3: ADR

Use the `AskUserQuestion` tool to ask: "What decision was made? What alternatives were considered?"

Compose content covering Context, Decision, Alternatives Considered, Consequences. Create via `mcp__archcore__create_document(type="adr")`.

## Step 4: Spec

Use the `AskUserQuestion` tool to ask: "What is the contract surface? What are the constraints and invariants?"

Compose content covering Purpose, Scope, Authority, Subject, Contract Surface, Normative Behavior, Constraints, Invariants, Error Handling, Conformance. Create via `mcp__archcore__create_document(type="spec")`.

Add relation: `mcp__archcore__add_relation` — spec `implements` adr.

## Step 5: Plan

Use the `AskUserQuestion` tool to ask: "What are the implementation phases? What are the dependencies?"

Compose content covering Goal, Tasks (phased), Acceptance Criteria, Dependencies. Create via `mcp__archcore__create_document(type="plan")`.

Add relation: `mcp__archcore__add_relation` — plan `implements` spec.

## Step 6: Relate to existing

Check for rules, guides, or other documents that should be linked. Suggest additional `add_relation` calls.

## Result

Three linked documents: ADR → spec → plan (each `implements` previous).
