---
name: capture
argument-hint: "[module, component, or topic]"
description: "Document a module, component, or system — automatically picks the right type (ADR, spec, doc, or guide). Use when you need comprehensive docs for a codebase element and don't want to choose the document type yourself."
---

# /archcore:capture

Document a module, component, or topic. You describe what needs documenting — the system picks the right document type.

## When to use

- "Document the auth module"
- "Capture how the payment system works"
- "Write down the API contract"
- "Create reference docs for the config system"

**Not capture:**
- Recording a specific decision → `/archcore:decide`
- Planning a feature → `/archcore:plan`
- Making something a standard → `/archcore:standard`
- Reading applicable rules/ADRs/specs before coding → `/archcore:context`
- Picking up where work left off → `/archcore:context`

## Routing table

Given `$ARGUMENTS` and conversation context, classify what the user needs:

| Signal | Route | Documents |
|---|---|---|
| User describes a **decision** already made | → `adr` | Single ADR |
| User describes a **component contract** or interface | → `spec` | Single spec |
| User describes **reference material** (registry, glossary, lookup) | → `doc` | Single doc |
| User describes **how-to instructions** or procedures | → `guide` | Single guide |
| User describes a **module comprehensively** ("document everything about X") | → `adr` + `spec` + `guide` | Multiple docs with relations |
| Ambiguous | → ask one question | "Is this primarily a decision, a technical contract, reference material, or instructions?" |

Default: if still unclear after one question, create an `adr` (the most common documentation need).

## Execution

### Step 1: Check existing

`mcp__archcore__list_documents` — scan for existing documents on this topic. Prevent duplicates.

### Step 2: Route

Apply the routing table above. If `$ARGUMENTS` clearly signals a type, proceed. If ambiguous, use `AskUserQuestion` to ask: "Is this primarily a decision, a technical contract, reference material, or instructions?"

### Step 3: Create documents

For each document determined by routing:

**If ADR:**
- Ask: "What was the decision? What alternatives were considered?"
- Compose content covering Context, Decision, Alternatives Considered, Consequences.
- `mcp__archcore__create_document(type="adr")`

**If spec:**
- Ask: "What is the contract surface? What are the key constraints?"
- Compose content covering Purpose, Scope, Subject, Contract Surface, Normative Behavior, Constraints.
- `mcp__archcore__create_document(type="spec")`

**If doc:**
- Ask: "What information should this reference contain?"
- Compose content covering Overview, Content (structured sections/tables), Examples.
- `mcp__archcore__create_document(type="doc")`

**If guide:**
- Ask: "What task does this guide walk through? What prerequisites exist?"
- Compose content covering Prerequisites, Steps (numbered), Verification, Common Issues.
- `mcp__archcore__create_document(type="guide")`

### Step 4: Relate

After each document, call `mcp__archcore__add_relation` to link to existing related documents. If multiple documents were created, link them with `related`.

## Result

One or more documents created and linked. Report: which documents, their paths, relations added, and suggested next actions (e.g., "consider adding a rule to codify this decision").
