# Pivot Impact

This reference file guides the artifact-by-artifact walk-through after the founder has changed core project direction — a pivot. It ensures downstream artifacts are assessed for relevance and updated, archived, or kept as-is with the founder's explicit confirmation.

It is loaded by the `whats-next` skill when the lean-startup-advisor's assessment includes an artifact relevance section (indicating a detected pivot). It is **not** a skill and should not be invoked independently.

---

## Context

You have just received the lean-startup-advisor's assessment, which includes an **Artifact Relevance** section because one or more foundational fields in `core.md` changed substantially since the last assessment. The advisor has flagged specific artifacts and recommended actions for each.

You also have:
- `startup/core.md` — the updated project definition (the pivot is already reflected here)
- `startup/plan.md` — the current plan (about to be updated based on the advisor's recommendations)
- Artifact directories: `startup/hypotheses/`, `startup/competitors/`, `startup/interview-scripts/`, `startup/interviews/`

## Goal

Walk the founder through each flagged artifact, explain why it may need attention given the new direction, and execute confirmed changes. Artifacts that are no longer relevant get archived (status change in frontmatter); artifacts that need reframing get edited; artifacts that still apply are left alone.

---

## What counts as a pivot

Not every edit to `core.md` is a pivot. A pivot is a substantial change to one or more of these foundational fields under `## Core`:

- **Audience** (or **ICP**) — the people the product serves changed (e.g., B2C to B2B, freelancers to agencies)
- **Problem** — the core pain being addressed changed (e.g., invoice tracking to project management)
- **Solution** — the product approach changed fundamentally (e.g., automated emails to a marketplace)

Minor refinements — tightening language, narrowing geography, adding a detail — are not pivots. The lean-startup-advisor makes this judgment when it compares the current `core.md` against the plan's log history.

---

## Status values for archiving

Each artifact type uses its existing frontmatter status field. Archiving means setting the status to indicate the artifact is no longer active but is preserved for potential future use:

| Artifact type | Status field | Archive value | Active values |
|---|---|---|---|
| Hypotheses | `status` | `archived` | `untested`, `confirmed`, `invalidated` |
| Competitors | `status` | `archived` | `active` (default when no status field exists) |
| Interview scripts | `status` | `retired` (already exists) | `draft`, `ready` |
| Interview analyses | — | Not archived; always kept as evidence | — |

Interview analyses and transcripts are never archived — they are historical evidence. Even if the hypothesis they linked to is archived, the statements remain valid raw material for future synthesis.

---

## How to run the walk-through

### Step 1 — Present the pivot summary

Before diving into artifacts, give the founder a clear picture of what changed and why it matters:

> "The direction has shifted — {one sentence describing the pivot, e.g., 'from targeting individual freelancers to design agencies'}. This means some of the work we've done still applies, some needs updating, and some is no longer relevant. Let me walk through what I'd recommend for each area."

### Step 2 — Walk through each artifact type

Process artifact types in this order: hypotheses, competitors, interview scripts. For each type, use the advisor's recommendations as a starting point, but apply your own judgment too — the advisor may have missed nuances.

**For each artifact file flagged by the advisor:**

1. Load the file and read it fully.
2. Explain to the founder — in one or two sentences — why this artifact is or isn't relevant under the new direction.
3. Propose one of three actions:
   - **Keep** — still relevant as-is, no changes needed
   - **Reframe** — the core idea is relevant but the framing needs to change (propose specific edits)
   - **Archive** — no longer relevant under the new direction
4. Wait for the founder's confirmation before making any change.

**For artifacts the advisor didn't flag:** Briefly scan the remaining files in each directory. If any seem obviously affected by the pivot, flag them to the founder. Don't belabor files that clearly still apply.

### Step 3 — Execute confirmed changes

For each confirmed action:

- **Keep:** No file change needed. Move on.
- **Reframe:** Read the file, propose specific edits, get confirmation, write the file back. Route hypothesis edits through the `hypotheses` skill conventions; route competitor edits through the `competitors` skill conventions.
- **Archive:** Read the file, add `archived_reason` to the frontmatter (one line explaining why — e.g., `archived_reason: Pivoted from B2C to B2B; hypothesis targets individual consumers`), set the status to the archive value for that artifact type, and write the file back.

Always read before writing. Always propose before saving.

### Step 4 — Surface what's missing

After the walk-through, the new direction likely has gaps. Point these out conversationally:

- Are there new hypotheses that should be formulated for the new audience/problem?
- Are there competitors in the new space that haven't been researched?
- Does the interview script need a full rewrite for a different persona, or can it be adapted?

Don't push the founder to do all of these now — just make them aware. These are natural next steps the existing skills handle.

### Step 5 — Update the plan

The plan update is handled by the normal `whats-next` flow (the advisor already recommended plan changes). But if the walk-through surfaced additional actions — new hypotheses to write, competitor research to run, script to redraft — propose adding them as plan steps before finalizing.

---

## Reversibility

Archiving is not deletion. Archived artifacts stay in their original directory with their original filename. If the founder pivots back or the artifact becomes relevant again, the status can be flipped back to an active value and the `archived_reason` removed from frontmatter. Mention this once during the walk-through so the founder doesn't feel like they're losing work.

---

## Style guidelines

- **One artifact at a time.** Don't batch "here are all 6 hypotheses I'd archive." Walk through each one individually — the founder may see relevance you don't.
- **Propose before writing** — every file change gets confirmed first.
- **Be concise in reasoning** — the founder doesn't need a paragraph per artifact. One or two sentences explaining the relevance assessment is enough.
- **Don't be trigger-happy with archiving.** If an artifact is borderline, lean toward keeping or reframing. The founder can always archive later; un-archiving requires remembering the artifact exists.
- **Channel the pivot as progress, not loss.** Pivots are evidence of learning. Frame the walk-through as "sharpening the toolkit for the new direction," not "cleaning up the mess."

---

## Completion criteria

- Every artifact flagged by the advisor has been discussed with the founder
- Confirmed archives have `archived_reason` in frontmatter and the appropriate archive status
- Confirmed reframes have been edited following the relevant skill's conventions
- The founder is aware of gaps the new direction creates
- The plan reflects any additional steps surfaced during the walk-through
