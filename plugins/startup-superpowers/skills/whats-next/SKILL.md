---
name: whats-next
description: Assesses the current state of the startup project and recommends what to focus on next. Use when there is a need or a question from the user to understand what the next steps are or what to focus on next.
---

# What's Next

Orient the user on where their project stands and what to focus on next. Most of the time this is a quick read of the plan and a conversational nudge — the user just needs reminding. When the plan itself needs structural changes, escalate to the `lean-startup-advisor` subagent for a full reassessment.

## Before you start

Check whether `./startup/core.md` exists in the current working directory. Use a relative path. Do not list parent directories or absolute paths — the project is always the current working directory.

---

## When no `startup/` exists

The project hasn't been initialized yet. Load the initialization workflow:

```
.claude/skills/whats-next/references/initialization.md
```

The reference file's instructions take over from this point. For founders who already have materials or progress, `initialization.md` will route to:

```
.claude/skills/whats-next/references/with-progress.md
```

---

## When `startup/` exists and `plan.md` is present

Start with a quick orientation. Only escalate to a full reassessment if the plan needs structural changes.

### Quick orientation (default)

Read `startup/plan.md` and `startup/core.md`. List the artifact directories (`hypotheses/`, `competitors/`, `interview-scripts/`, `interviews/`) to get a sense of what exists and what's changed. Also read the `## Next Action` sections from `startup/hypotheses/*.md` — these are the per-assumption validation moves written by the last hypothesis assessment.

Then orient the user across **two altitudes**, so the strategic and the tactical don't compete:

- **Strategic (from `plan.md`):** the `## Current Focus` — the milestone-level thing the project is working toward.
- **Tactical (from the hypothesis `## Next Action` sections):** the single sharpest concrete move right now — the smallest observable next step. Pick it with simple judgment: weigh hypothesis status, stakes, and tag (a foundational `untested` assumption with nothing behind it, or one close to flipping, usually wins). If a recent assessment flagged a `Top pick`, prefer that.

Phrase it as both, e.g.: *"Strategically you're on {Current Focus}. The sharpest concrete move right now is {next action from hypothesis X}."* If the user completed something since last time, check it off in `plan.md`. Offer to jump into whatever the current focus or the next action points to.

Keep this lightweight: read the `## Next Action` sections that already exist on disk — do **not** dispatch the `hypotheses-manager` just to refresh them. Those sections are refreshed during full reassessments and after interview analysis, which is where assessments belong.

Quick orientation does not restructure the plan — no adding, removing, or reordering steps, no changing the Current Focus. It works with the plan as-is.

### When to escalate to full reassessment

Use your judgment. These are signals, not a checklist — weigh them in context:

- The plan's current milestone is complete (all or nearly all steps checked off)
- The user says something has fundamentally changed or explicitly asks to reassess
- The user changed core.md's foundational fields (Audience/ICP, Problem, or Solution) — a potential pivot
- Artifacts appear to contradict the plan's assumptions (e.g., interviews revealed a different problem than what the plan is built around)
- The Current Focus no longer makes sense given what exists in the project
- The user is questioning direction ("is this the right approach?"), not asking for next steps

When none of these apply — uncompleted steps remain that still make sense, the Current Focus is clear and not invalidated, the user is just resuming or needs a reminder — stay in quick orientation.

### Full reassessment

When the plan needs structural changes, dispatch the `lean-startup-advisor` subagent.

**Step 1 — Gather all project state:**

Read these files and collect their contents:
- `startup/core.md`
- `startup/plan.md`
- All `.md` files in `startup/hypotheses/` (if any)
- All `.md` files in `startup/competitors/` (if any)
- All `.md` files in `startup/interview-scripts/` (if any)
- All `.md` files in `startup/interviews/` (if any, excluding `transcripts/`)

**Step 2 — Dispatch the subagent:**

Send a single Task call to the `lean-startup-advisor` agent. Include all file contents in the prompt:

```
Assess the current state of this startup project and recommend updates to the plan.

## Project definition (startup/core.md)
{full contents of core.md}

## Current plan (startup/plan.md)
{full contents of plan.md}

## Hypotheses (startup/hypotheses/)
{for each file: filename + full contents, or "No hypothesis files yet."}

## Competitors (startup/competitors/)
{for each file: filename + full contents, or "No competitor files yet."}

## Interview scripts (startup/interview-scripts/)
{for each file: filename + full contents, or "No interview script files yet."}

## Interview analyses (startup/interviews/)
{for each file: filename + full contents, or "No interview analysis files yet."}
```

**Step 3 — Present recommendations:**

When the subagent returns, present its assessment and recommended changes to the user. Walk through the key points conversationally — don't just dump the raw output.

**Step 3a — If the advisor flagged a pivot:**

If the advisor's response includes an **Artifact Relevance** section, a pivot was detected — foundational fields in `core.md` changed substantially. Before updating the plan, load the pivot impact workflow:

```
.claude/skills/whats-next/references/pivot-impact.md
```

The reference file's instructions take over for the artifact walk-through. Return here for the plan update after it completes.

**Step 4 — Update the plan:**

After presenting the recommendations, tell the founder specifically what you're writing — then write it. Don't ask for blanket permission; state the update and do it. For example: "Updating the plan: marking [step] done, setting focus to [X], adding two new steps. Writing now." Then write the file.

Only pause for explicit confirmation if the advisor recommended removing existing steps or the direction change is significant enough that the founder might want to redirect first.

Update `startup/plan.md`:
- Check off completed steps (change `- [ ]` to `- [x]`)
- Update the `## Current Focus` section
- Add new steps to the `## Steps` section
- Remove steps only if the advisor explicitly recommended it and you've surfaced this to the founder
- Append the log entry under `## Log` with a `### {YYYY-MM-DD}` heading
- Update `last_assessed` in frontmatter to today's date

Read `plan.md` before writing.
