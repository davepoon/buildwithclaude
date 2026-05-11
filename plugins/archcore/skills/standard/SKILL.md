---
name: standard
argument-hint: "[standard topic]"
description: "Establish a team standard end-to-end — creates ADR → rule → guide chain for codifying practices. Activate when user says 'make this a standard', 'establish a convention', 'codify this practice'. Do NOT activate for recording a one-off decision (use /archcore:decide) or feature planning (use /archcore:plan)."
---

# /archcore:standard

Establish a team standard. Creates the full chain: ADR (why this standard) → rule (mandatory behavior) → guide (how to follow it).

## When to use

- "Make this a team standard"
- "We need a coding convention for error handling"
- "Standardize how we do API versioning"
- "Create a standard for database migrations"

**Not standard:**
- Recording a decision without enforcement → `/archcore:decide`
- Planning a feature → `/archcore:plan`
- Documenting existing behavior → `/archcore:capture`
- Reading applicable rules/ADRs/specs before coding → `/archcore:context`
- Picking up where work left off → `/archcore:context`

## Routing table

| Signal | Route | Documents |
|---|---|---|
| User wants a **new standard** (default) | → full chain | adr → rule → guide |
| ADR already exists on this topic | → pick up from rule | rule → guide (link to existing ADR) |
| User says "just a rule" or "skip the ADR" | → rule + guide only | rule + guide |

Default: full standard-track chain (adr → rule → guide).

## Execution

### Step 1: Check existing

`mcp__archcore__list_documents(types=["adr", "rule", "guide"])` — check what exists on this topic. If ADR exists, skip to rule. If rule exists, skip to guide.

### Step 2: Create documents

Skip any documents that already exist on this topic.

**ADR** (if missing):
- Ask: "What decision led to this standard? What alternatives were considered?"
- Compose content covering Context, Decision, Alternatives Considered, Consequences.
- `mcp__archcore__create_document(type="adr")`

**Rule:**
- Ask: "What are the mandatory behaviors? How should this be enforced?"
- Compose content covering Rule (imperative statements), Rationale, Examples (Good/Bad), Enforcement.
- `mcp__archcore__create_document(type="rule")`
- `mcp__archcore__add_relation` — rule `implements` adr

**Guide:**
- Ask: "What steps should developers follow? What are common pitfalls?"
- Compose content covering Prerequisites, Steps (numbered), Verification, Common Issues.
- `mcp__archcore__create_document(type="guide")`
- `mcp__archcore__add_relation` — guide `related` rule

### Step 3: Relate

Suggest `mcp__archcore__add_relation` calls to link with existing specs, plans, or other standards.

## Result

Three linked documents: ADR → rule → guide (rule `implements` adr, guide `related` rule). Report: paths, relations, recommended next actions.
