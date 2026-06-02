# Initial Interview Script

This reference file guides the first-time script-drafting conversation — helping the founder shape a customer discovery interview script tailored to their target segment, desired length, and their own facilitation experience.

It is loaded by the `interviews` skill when no scripts exist yet (or when the founder explicitly wants a guided draft). It is **not** a skill and should not be invoked independently.

---

## Context

You already have:
- `startup/core.md` — the project definition; `## Core` contains at least `Audience` (ideally also `Problem`)
- `startup/hypotheses/*.md` — one or more testable hypotheses (ideally ≥3; proceed even if fewer)
- An empty (or newly created) `startup/interview-scripts/` directory

## Goal

Produce **one well-scoped script** — written to a single `.md` file — that the founder can use for customer discovery interviews with their target segment. The script must be tailored to three inputs: segment, desired length, and the founder's interview experience.

---

## The single most important rule

**Ask exactly one question at a time. Always.**

Do not stack questions. Do not ask a question and then add a follow-up in the same message. Do not list "a few things to think about." One question. Wait. Then respond.

---

## How to run the conversation

### Opening

Acknowledge the project briefly from `core.md`. Frame in one sentence:

> "Let's draft an interview script you can use for customer discovery. I'll tailor it to your segment, how long you want the interviews to be, and how much facilitating experience you have."

Then go to Step 1.

### Step 1 — Confirm the target persona

Read the `Audience` field from `core.md` and reflect it back. Ask whether this script is for that segment or for a narrower / different one. If the founder wants a narrower slice (e.g. "actually, just solo designers in the US, not agencies"), capture that.

A single script should serve a single persona. If the founder describes two distinct personas in one breath, ask them which one to start with — mention that a second script can be drafted later.

### Step 2 — Agree on length

Ask how long they want the interviews to be. Offer four options with short trade-off notes:

- **15 min** — very tight, 3–4 questions, easy to land with busy people, low depth
- **30 min** — the workhorse length, 5–7 questions, good for most discovery
- **45 min** — room for depth and follow-ups, 7–10 questions, harder to schedule
- **60 min** — only when the topic genuinely needs it, risks fatigue on both sides

### Step 3 — Gauge experience

Ask whether they've run customer discovery interviews before. Three buckets:

- **never** — first time
- **a few** — done a handful, not fully comfortable yet
- **plenty** — done many, comfortable improvising

### Step 4 — Tailor and announce the plan

Before drafting, announce in one short message what the script will look like given their answers. Use this matrix:

- **never + 45 or 60 min** — flag that long interviews are hard to run well on a first try. Suggest dropping to 30 min. If they insist on longer, proceed — but the script will be heavily scripted throughout and include extra facilitation prompts inline.
- **never + 15 or 30 min** — fewer questions (3–5), heavily scripted opening and closing, pre-written probes under each core question, inline reminders to let the interviewee talk.
- **a few + any length** — standard density (5–7 for 30 min; 7–10 for 45–60), normal level of probe scaffolding, opening and closing written out but short.
- **plenty + any length** — leaner script, more open-ended questions, lighter probe scaffolding, trust the founder to improvise.

The founder can override the tailoring.

### Step 5 — Map hypotheses to questions

Load `startup/hypotheses/*.md`. For each hypothesis, identify what kind of question would test it. Surface the mapping to the founder — e.g.:

> "I'll use your hypothesis that designers track invoices in spreadsheets to shape a question about current workflow. Your willingness-to-pay hypothesis is better tested by observing what they already spend money on, so I'll turn that into a past-behavior question rather than asking directly."

Don't mechanically turn every hypothesis into a question. Some hypotheses (e.g. pricing specifics) are better tested by experiments than interviews — say so when it applies.

If fewer than 3 hypotheses exist, work with what's there and flag that the script can be sharpened later once more hypotheses are defined.

### Step 6 — Draft section by section

Propose **Opening** first — show the exact text. Ask for feedback. Revise once if needed.

Then propose **Core Questions** — show the numbered list with probes. Ask for feedback. Revise.

Then propose **Closing** — show the exact text. Ask for feedback. Revise.

One section at a time. One question at a time when gathering feedback.

### Step 7 — Reflect the whole script back

Show the full proposed script (all four sections stitched together) so the founder sees the whole picture. Ask for confirmation before writing.

### Step 8 — Write the file

Derive the slug from the title: lowercase, replace spaces and non-alphanumeric characters with hyphens, collapse multiples.

Write `startup/interview-scripts/{slug}.md` with this structure:

```markdown
---
status: draft
length_minutes: {15|30|45|60}
target_persona: {one-line segment descriptor}
---

# {Title — segment + focus}

## Target Persona

{2–4 sentences: who this script is for, their context, why they were chosen for this round.}

## Opening

{What the founder says at the start: purpose of the call, consent to record, the "not a sales call" framing, rapport-setting.}

## Core Questions

1. {Open question about current behavior or past experience}
   - Probe: {follow-up}
2. {Question testing a specific hypothesis}
   - Probe: {follow-up}
...

## Closing

{Wrap-up: "anything I didn't ask that I should have?", referrals ask if appropriate, thank-you, next step if relevant.}

## Notes

{Optional — facilitation tips, reminders for the founder, things to avoid.}
```

Default `status: draft`. If the founder says the script is ready to use, write `status: ready` instead.

---

## Style guidelines for the questions themselves

- **Open, not leading.** "Tell me about the last time..." beats "Don't you find it frustrating when...?"
- **Past behavior over hypothetical.** "Walk me through what you did last time" beats "would you pay for X?" — people are bad at predicting their own future behavior.
- **One idea per question.** If it has an "and" in it, split it.
- **Avoid pitching.** The script should not describe or hint at the solution. The goal is learning, not selling.
- **Short.** Long questions invite short answers.

---

## Completion criteria

- File written to `startup/interview-scripts/{slug}.md`
- Frontmatter includes `status`, `length_minutes`, `target_persona`
- H1 and all four required sections present: `## Target Persona`, `## Opening`, `## Core Questions`, `## Closing`
- Founder has confirmed the final content

---

## What comes next

Briefly confirm the save: "Saved to `startup/interview-scripts/{slug}.md`."

Then mention natural next steps without pushing:

- **Schedule and run interviews** — find 5–10 people from the target segment to talk to
- **Draft a second script** — if they have a meaningfully different adjacent segment
- **Revisit after a few runs** — the first version is never the final; questions that don't land, or unexpectedly rich threads, inform the next revision

Let the founder decide where to go next.
