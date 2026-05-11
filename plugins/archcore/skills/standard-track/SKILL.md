---
name: standard-track
argument-hint: "[topic]"
description: "Advanced — Create an ADR → (optional CPAT) → rule → guide cascade to codify a team standard. Activate when user explicitly requests a standard cascade or a full 'decision to enforcement' chain. For a single decision without enforcement, use /archcore:decide; for mixed intent routing, use /archcore:standard."
---

# Standard Track: ADR → (optional CPAT) → rule → guide

Establishes a team standard from decision to enforceable rule to practical how-to. Best for codifying technical decisions into mandatory practices. If the decision represents a code-pattern shift (before/after), a CPAT is offered between ADR and rule.

## Step 1: Check existing

`mcp__archcore__list_documents(types=["adr", "cpat", "rule", "guide"])` — see what exists. If `$ARGUMENTS` provided, check for duplicates on this topic.

## Step 2: Determine scope

If related documents already exist (e.g., an ADR without a rule), pick up where the chain left off — don't recreate.

## Step 3: ADR

Use the `AskUserQuestion` tool to ask: "What decision was made? Why this approach over alternatives?"

Compose content covering Context, Decision, Alternatives Considered, Consequences. Create via `mcp__archcore__create_document(type="adr")`.

## Step 3b: CPAT (optional)

Offer only if the decision clearly represents a code-pattern change (refactor, code-style shift, idiom migration). Otherwise skip to Step 4.

Ask: "Does this decision represent a code-pattern change (before/after code shift)? If yes, I can document the pattern as a CPAT."

If yes:

- Ask: "What pattern changed? Show the before and after."
- Compose content covering What Changed, Why, Before, After, Scope. Create via `mcp__archcore__create_document(type="cpat")`.
- Add relation: `mcp__archcore__add_relation` — cpat `implements` adr.

## Step 4: Rule

Use the `AskUserQuestion` tool to ask: "What are the mandatory behaviors? How should this be enforced?"

Compose content covering Rule (imperative statements), Rationale, Examples (Good/Bad), Enforcement. Create via `mcp__archcore__create_document(type="rule")`.

Add relation: `mcp__archcore__add_relation` — rule `implements` adr.

If a CPAT was created in Step 3b, also add: `mcp__archcore__add_relation` — rule `related` cpat.

## Step 5: Guide

Use the `AskUserQuestion` tool to ask: "What steps should developers follow? What are common pitfalls?"

Compose content covering Prerequisites, Steps (numbered), Verification, Common Issues. Create via `mcp__archcore__create_document(type="guide")`.

Add relation: `mcp__archcore__add_relation` — guide `related` rule.

## Step 6: Relate to existing

Check for specs, plans, or other documents that should be linked. Suggest additional `add_relation` calls.

## Result

Three or four linked documents: ADR → [optional CPAT] → rule → guide. Relations: rule `implements` adr, guide `related` rule, and if CPAT exists: cpat `implements` adr, rule `related` cpat.
