---
name: context
argument-hint: "[file, directory, or topic; leave empty for current-focus pickup]"
description: "Load the rules, ADRs, specs, and patterns that apply to a code area before changing it — or summarize current project focus when picking up work. Activate when user says 'what rules apply to X', 'what should I know before touching Y', 'before I refactor Z', 'pick up where we left off', 'where is the payments work right now', 'what was I working on in X', 'load project context', 'show me the decisions/rules/specs for X'. Do NOT activate for creating documentation (use /archcore:capture, /archcore:decide, /archcore:standard), for feature planning (use /archcore:plan), for detecting stale docs (use /archcore:actualize), for health audits or current-state counts (use /archcore:review)."
---

# /archcore:context

Pull-mode project context. Surfaces the rules, decisions, specs, and patterns that apply to a code area before you change it — or recaps current focus when picking up work.

_Not related to the AI context window or session state — this is about the `.archcore/` knowledge base._

## When to use

- "What rules apply to `src/payments/`?"
- "Before I refactor the auth module, show me what I should know"
- "Show me the decisions for `src/api/`"
- "Pick up where we left off"
- "What was I working on in payments?"
- "Where is the checkout work right now?"
- "Load project context"

**Not context:**
- Creating documentation → `/archcore:capture`, `/archcore:decide`, `/archcore:standard`
- Planning a feature → `/archcore:plan`
- Detecting stale docs → `/archcore:actualize`
- Health audit, counts, or status breakdown → `/archcore:review` (`--deep` for the full audit)

## Routing table

Classify `$ARGUMENTS` into one mode:

| Signal | Mode |
|---|---|
| Empty or whitespace only | **pickup** |
| Contains `/`, OR matches an existing repo directory | **path** |
| Otherwise | **topic** |

## Execution

### Step 1: Classify

Determine mode from `$ARGUMENTS` per routing table.

### Step 2: Query

**Path mode:**

Normalize the argument: trim whitespace, convert `\` to `/`, strip trailing `/`.

Call `mcp__archcore__search_documents(path_ref="<normalized>", limit=50, sort="relevance")`.

**Topic mode:**

Call `mcp__archcore__search_documents(content="<argument>", limit=50, sort="relevance")`.

Topic search is strict substring — singular/plural and near-synonyms do not match. If the first call returns empty, retry once with a shorter or alternate phrasing of the same term before falling through to the empty state.

**Pickup mode:**

Call in parallel:
- `mcp__archcore__search_documents(types=["plan", "idea"], status="draft", limit=10, sort="mtime")`
- `mcp__archcore__search_documents(types=["adr", "rule"], status="accepted", mtime_after="30d", limit=10, sort="mtime")`

If the recent-accepted call returns empty, retry once with `mtime_after="90d"`.

### Step 3: Group

**Path and topic modes** — group results by type:

| Section | Types included |
|---|---|
| Rules | `rule` |
| Decisions | `adr` |
| Specs | `spec` |
| Patterns | `cpat` |
| In Progress | `plan` or `idea` with status `draft` |

Drop other types. Results are already sorted by `search_documents` (specificity → type priority → mtime); keep the top 5 per section.

**Pickup mode** — three fixed sections:
- **In Progress** — results from the drafts call
- **Recent Decisions** — `adr` results from the recent-accepted call
- **Recent Rules** — `rule` results from the recent-accepted call

### Step 4: Guide routing

For each item in the Rules, Decisions, or Specs sections, inspect its `incoming_relations`. If a relation of type `implements` or `related` points from a `guide`, inline that guide as an indented bullet under the parent. Skip a guide that is already inlined under a sibling in the same section.

### Step 5: Render

```
## Rules (N)
- **<title>** [rule · <status> · <match.kind>]
  `<path>`
  > <excerpt>
  - 📖 **<guide title>** [guide · <status>]

## Decisions (N)
- **<title>** [adr · <status> · <match.kind>]
  `<path>`
  > <excerpt>

## Specs (N)
...

## Patterns (N)
...

## In Progress (N)
⚠️  **<title>** [plan · draft]
  `<path>`
  > <excerpt>

_Classified as: <mode>._
```

**Do NOT emit a section header if its group is empty.** The classification footer is always emitted.

If all sections are empty, fall through to Step 6.

### Step 6: Empty state

- Call `mcp__archcore__list_documents(limit=1)`. If the knowledge base is empty → "No documents indexed yet. Run `/archcore:capture` or `/archcore:decide` to seed `.archcore/`."
- Otherwise → "No documents reference `<scope>`. Consider using `@<scope>` in a rule or ADR so future work in this area surfaces the context automatically."

## Result

A grouped markdown surface of the rules, ADRs, specs, patterns, and in-progress work that applies to the requested scope — or a pickup summary of draft work + recent accepted decisions and rules when called with no argument. A classification footer identifies which mode was chosen.
