---
name: interviews
description: Manages the founder's customer discovery interview lifecycle — drafting scripts tailored to a target segment, refining existing ones, managing script status, and analyzing interview transcripts to extract insights, review technique, and update hypothesis state. Use when the founder wants to prep for interviews, draft a discovery script, refine questions, change a script's status, analyze a completed interview (transcript, paste, or recollection), extract insights, or review how an interview went.
---

# Interviews

Help the founder run the full customer discovery interview loop — from preparing a script to analyzing what was said afterward.

This skill covers two phases:

1. **Script management** — drafting, refining, and managing the lifecycle of reusable interview scripts.
2. **Transcript analysis** — after an interview has happened, extracting statements, linking them to hypotheses, reviewing the founder's interviewing technique, and recommending hypothesis state changes.

An interview script is a reusable guide, not a teleprompter: it anchors the conversation around the assumptions being tested while leaving room for the founder to follow threads that open up. Most founders need one script for their primary segment; occasionally a second script for an adjacent segment.

## Before you start

Read `startup/core.md` to load project context (name, seed description, and all fields under `## Core` — especially `Audience`).

Check if `startup/interview-scripts/` contains any `.md` files.

Scaffold the folders if they don't exist yet:
```bash
mkdir -p startup/interview-scripts
mkdir -p startup/interviews/transcripts
```

---

## When scripts already exist

Load and understand them for context. Infer intent from the conversation — don't mechanically ask "what do you want to do?" If the founder is:

- **Referring to a specific script** — load that file, discuss, help edit the relevant section
- **Iterating after running interviews** — help revise questions that didn't land, add follow-ups that proved useful, tighten or expand as needed
- **Drafting a script for a different segment** — start a new script (route to the reference file below if they want a guided draft, or draft directly if they know what they want)
- **Changing status** — read the file, propose the change, write it back
  - `draft` — still being shaped, not yet used
  - `ready` — actively in use for interviews
  - `retired` — superseded or no longer in rotation

When adding or updating scripts, follow the file conventions:
- YAML frontmatter with `status` (`draft`, `ready`, `retired`), `length_minutes` (number — 15/30/45/60), and `target_persona` (one-line segment descriptor)
- H1 heading: script title — segment + focus, e.g. "Freelance designers — invoice chasing"
- `## Target Persona` — 2–4 sentences describing who this script is for and why
- `## Opening` — what the founder says at the start: purpose, consent to record, framing
- `## Core Questions` — numbered questions with optional indented probes
- `## Closing` — wrap-up, referrals ask, thank-you
- Optional `## Notes` — facilitation tips for the founder

**Slug convention:** lowercase the title, replace spaces and non-alphanumeric characters with hyphens, collapse multiple hyphens. "Freelance designers — invoice chasing" → `freelance-designers-invoice-chasing`.

Read before writing, propose before saving, get confirmation.

---

## When no scripts exist

Check prerequisites:

- **`core.md` is missing or has no `Audience` or similar information that provides this information under `## Core`:** Mention that a defined target audience sharpens the script considerably — suggest filling that in first (via the `whats-next` skill or directly in `core.md`). Do not block: if the founder wants to proceed with a rough persona, proceed.

- **`startup/hypotheses/` is empty or has fewer than 3 hypotheses:** Mention that scripts work best when they're built around specific hypotheses to test — suggest invoking the `hypotheses` skill first. Do not block: if the founder insists on drafting a script now, proceed.

- **Prerequisites met (or founder insists):** Load the reference file for the guided script-creation conversation:

```
.claude/skills/interviews/references/initial-interview-script.md
```

The reference file's instructions take over from this point.

---

## When a transcript arrives

After the founder runs an interview, they may bring back a transcript, paste text into chat, or simply recount a conversation from memory. In any of these cases, the workflow is the same: save the source material, dispatch the `interview-analyst` subagent, then dispatch the `hypotheses-manager` subagent, surface recommendations to the founder, and route confirmed hypothesis changes through the `hypotheses` skill.

Recognize this intent when the founder:
- Points at a transcript file under `startup/interviews/transcripts/` (or similar)
- Pastes transcript-shaped text (dialogue, Q&A, long monologue) into chat
- Describes a conversation from memory ("I talked to someone at a coffee shop…", "I had a call with a designer and she said…")
- Asks to analyze, review, or extract insights from a completed interview

Load the Layer 2 reference file that owns this workflow end-to-end:

```
.claude/skills/interviews/references/transcript-analysis.md
```

The reference file's instructions take over from this point, including the three input branches (file / pasted / recollection), dispatching both subagents, summarizing to the founder, and routing confirmed edits through the `hypotheses` skill.

**Do not extract statements, evaluate hypothesis state, or edit hypothesis files yourself** — the reference file describes how to delegate that work to the two subagents.
