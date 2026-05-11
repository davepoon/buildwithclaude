---
name: iso-track
argument-hint: "[topic]"
description: "Advanced — Formal ISO 29148 requirements cascade: BRS → StRS → SyRS → SRS. Best for regulated systems, multi-team projects, or complex distributed systems requiring traceable, auditable requirements. For lighter product discovery use /archcore:sources-track."
---

# ISO 29148 Track: BRS → StRS → SyRS → SRS

Formal requirements decomposition with traceability. Best for regulated systems, multi-team projects, complex distributed systems.

## Step 1: Check existing

`mcp__archcore__list_documents(types=["brs", "strs", "syrs", "srs", "mrd", "brd", "urd"])` — see what exists. If `$ARGUMENTS` provided, check for duplicates on this topic.

## Step 2: Determine scope

If upstream documents exist (MRD, BRD, URD), reference them. If part of the cascade already exists, pick up where it left off.

## Step 3: BRS (Business Requirements Specification)

Use the `AskUserQuestion` tool to ask: "What business goals does this formalize? What source documents exist (MRD, BRD)?"

Compose content covering all BRS sections using source documents for depth. Create via `mcp__archcore__create_document(type="brs")`.

Add relations to sources: `mcp__archcore__add_relation` — brs `implements` mrd/brd (if they exist).

## Step 4: StRS (Stakeholder Requirements Specification)

Use the `AskUserQuestion` tool to ask: "What stakeholder classes exist? What are their distinct requirements?"

Compose content covering all StRS sections using BRS and URD for depth. Create via `mcp__archcore__create_document(type="strs")`.

Add relations:
- strs `implements` brs
- strs `implements` urd (if URD exists)

## Step 5: SyRS (System Requirements Specification)

Use the `AskUserQuestion` tool to ask: "What is the system boundary? What are the key interfaces and operational modes?"

Compose content covering all SyRS sections using StRS for depth. Create via `mcp__archcore__create_document(type="syrs")`.

Add relation: `mcp__archcore__add_relation` — syrs `implements` strs.

## Step 6: SRS (Software Requirements Specification)

Use the `AskUserQuestion` tool to ask: "What software components need specifying? What are the functional and non-functional requirements?"

Compose content covering all SRS sections using SyRS for depth. Create via `mcp__archcore__create_document(type="srs")`.

Add relation: `mcp__archcore__add_relation` — srs `implements` syrs.

## Step 7: Relate to existing

Check for specs, plans, or PRDs that should be linked. SRS typically flows into `spec` or `plan` documents.

## Result

Four cascading documents: BRS → StRS → SyRS → SRS (each `implements` previous). Full ISO 29148 traceability chain.
