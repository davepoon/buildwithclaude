# Transcript Analysis

This reference file guides the end-to-end workflow after a founder has conducted a customer discovery interview and wants to analyze it: extract statements, link them to existing hypotheses, evaluate hypothesis state, and review interview technique.

It is loaded by the `interviews` skill when the founder has a transcript, paste, or recollection to analyze. It is **not** a skill and should not be invoked independently.

---

## Context

You already have:
- `startup/core.md` — the project definition
- `startup/hypotheses/*.md` — existing testable hypotheses
- Optionally `startup/interview-scripts/*.md` — scripts the founder may have used

You are about to acquire a transcript (or recollection) and turn it into:
- `startup/interviews/transcripts/{slug}.md` — raw source material
- `startup/interviews/{slug}.md` — analysis file with statements, backlinks, and technique feedback
- Zero or more hypothesis state updates routed through the existing `hypotheses` skill
- Zero or more new hypothesis files, also routed through the existing `hypotheses` skill

## Goal

Close the loop on a single interview: persist what was said, tie it to what was assumed, update state where evidence warrants, and give the founder honest feedback on how they ran the conversation.

---

## Single most important rule

**Two subagents do the heavy work; you orchestrate and mediate.** You do not extract statements yourself. You do not evaluate hypothesis state yourself. You do not edit hypothesis files directly. Your job is to route transcripts to `interview-analyst`, route results to `hypotheses-manager`, summarize recommendations to the founder, and — on confirmation — invoke the `hypotheses` skill to make the actual file edits.

---

## How to run the workflow

### Step 1 — Identify the input branch

Determine which branch applies and act accordingly.

**Branch A — file in designated location.** Founder says something like "the transcript is at `startup/interviews/transcripts/2026-04-12-jane.md`" or "I saved it in the usual place." Read the file to confirm it exists and has frontmatter with at minimum `date`, `interviewee`, `persona`, `source`. If frontmatter is missing or incomplete, propose adding it and edit the file — see the persona intake question below if `persona` is missing.

**Branch B — pasted into chat.** Founder pastes the transcript text. Before analyzing:

1. Propose a slug following the convention: `{date}-{short-descriptor}` (e.g., `2026-04-12-jane-freelance-designer`). Use `date: today` and a short descriptor from what the founder tells you about the interviewee.
2. Ask the founder to confirm the slug, date, and interviewee descriptor.
3. Ask the persona intake question (see below).
4. Write the transcript to `startup/interviews/transcripts/{slug}.md` with this frontmatter:

```markdown
---
date: YYYY-MM-DD
interviewee: {name or anonymized handle}
persona: {one-line descriptor from the founder's answer}
script: {script-slug if known, otherwise omit}
source: pasted
---

{the pasted text, verbatim}
```

5. Briefly mention the convention without being preachy: *"Saved to `startup/interviews/transcripts/{slug}.md` — keeping transcripts here lets us re-read them later and sharpens future hypothesis assessments."*

**Branch C — recollection.** Founder describes a conversation from memory (e.g., "I talked to someone at a coffee shop"). Treat this as paste, with two differences:

1. Let the founder dump everything they remember first — ask once "anything else you want to capture before I write this down?" to prompt recall.
2. Ask the persona intake question (see below).
3. Write to `startup/interviews/transcripts/{slug}.md` with `source: recollection` and the `persona` field from the founder's answer. The body is the founder's recollection as they told it.

Note that technique feedback may be limited or omitted by the `interview-analyst` when `source: recollection` — the founder's own questions may not be captured. Mention this lightly if relevant.

**Persona intake question (all branches):**

Ask a single question to capture who the interviewee actually is — the analyst needs this to frame the analysis. Adapt wording, but aim for something like:

> "Quick context on who you talked to — a line or two. Role, relationship to your target audience, how you met, anything that'll help sharpen the analysis."

The answer becomes the `persona` field on the transcript frontmatter. Aim for a rich one-liner (e.g., "Freelance designer, US, 5+ years solo, invoices ~8 clients monthly — met through Designers Guild Slack") rather than a bare role descriptor. If the founder used a script, mention that the script's `target_persona` is what was being *targeted*; the transcript's `persona` captures who they *actually* talked to (which may differ, and that's valuable signal).

If the founder genuinely has nothing to add beyond what's in the transcript, note `persona: {best reasonable descriptor from transcript}` and move on — don't belabor it.

Always scaffold the directory if it doesn't exist:
```bash
mkdir -p startup/interviews/transcripts
```

### Step 2 — Dispatch the `interview-analyst`

Dispatch the `interview-analyst` subagent with:

- `transcript_path`: the path you just wrote (or confirmed) under `startup/interviews/transcripts/`
- `slug`: the shared slug (same as the transcript filename, without extension)
- `script_path`: path to the interview script under `startup/interview-scripts/` if one was used; omit otherwise

The subagent reads the transcript, core.md, hypotheses, the script, and any existing interview analysis files. It writes `startup/interviews/{slug}.md` and returns a short structured summary: which hypothesis slugs were linked, how many statements were unlinked, and technique feedback highlights.

Wait for the subagent to return before proceeding.

### Step 3 — Dispatch the `hypotheses-manager`

Dispatch the `hypotheses-manager` subagent with:

- `slugs`: the list of hypothesis slugs the `interview-analyst` linked in this interview
- `scope`: include instruction to also synthesize candidate new hypotheses from unlinked statements across all interviews (relevant because this interview's unlinked statements may be the one that tips a pre-existing cluster over the threshold)

The subagent greps for each linked slug across `startup/interviews/*.md`, re-reads statements in context, and returns state recommendations — each with a **What changed** line, reasoning, evidence pointers, and a **Next action** — plus a single cross-hypothesis **Top pick**. It also scans unlinked statements across all interview files for cross-interview patterns.

Wait for the subagent to return before proceeding.

Before summarizing, do the eager bookkeeping the `hypotheses` skill defines: for each evaluated hypothesis, write its `last_assessed` to today and overwrite its `## Next Action` section with the subagent's suggested next action. This is advisory and needs no per-item confirmation; route the edits through the `hypotheses` skill conventions (read before writing, touch only frontmatter and the `## Next Action` section).

### Step 4 — Summarize to the founder

Write a single conversational message summarizing everything for the founder. Lead each touched hypothesis with **what changed → the next action** — not just a status. This is the point of the whole loop: the founder should walk away knowing the next small, observable move, not just an updated label. Follow this shape, adapting tone to the content:

> "Interview with {interviewee} is analyzed and saved to `startup/interviews/{slug}.md`.
>
> **What this interview moved:**
> - `{slug-1}` — {what changed: weaker/stronger/no change} → **next:** {next action} ({recommended status if a change is proposed})
> - `{slug-2}` — {what changed} → **next:** {next action} ({recommended status if a change is proposed})
>
> **Sharpest move right now:** {the Top pick — `{slug}` and the one-line why}.
>
> **Candidate new hypotheses** (if any): `{proposed title}` — {cluster size} — {reasoning}.
>
> **Technique feedback:** {1–3 highlight bullets from the analysis file}.
>
> Want to act on any of the state recommendations or candidates? You can also refine any of them before we make changes."

Do not act on status recommendations yet. The founder drives state changes; you never flip a hypothesis status or create a new hypothesis file without explicit confirmation of that specific change. (The `## Next Action` sections and `last_assessed`, written in the eager bookkeeping step above, are the exception — they are advisory and already persisted.)

### Step 5 — Route confirmed changes through the `hypotheses` skill

For each change the founder confirms, invoke the `hypotheses` skill to make the edit. The `hypotheses` skill already handles:

- Reading the hypothesis file, proposing the change, writing back — for status updates
- The full new-hypothesis file creation conventions — frontmatter, tag, slug rules — for new hypotheses

Do not bypass the skill. Route every hypothesis-file edit through it so conventions stay centralized.

Before making each edit, show the founder exactly what will change and get explicit confirmation. Read before writing.

### Step 6 — Confirm and close

After edits are complete, confirm briefly:

> "Done. Analysis file at `startup/interviews/{slug}.md`. Updated {N} hypotheses, created {M} new ones."

Mention natural next steps without pushing:
- **Run more interviews** — a few more in the same persona often changes the picture
- **Revisit the script** — if technique feedback surfaced specific things to adjust
- **Check overall project direction** — if state changes were meaningful, the `whats-next` skill can reassess

Let the founder decide.

**Invite feedback (first time only).** Turning a raw transcript into linked, analyzed evidence is one of the tool's strongest moments. As the final beat of the close, follow the Layer 0 *Feedback invites* protocol for stage `first-interview-analyzed`: read `startup/.superpowers/feedback.md`, and unless the founder opted out, the tag is already recorded, or `FORM_ID` is still the placeholder, emit the invite tying it to the analysis they just got, then append the ledger line.

---

## Style guidelines

- **One question at a time** when gathering missing information from the founder (slug confirmation, branch disambiguation, specific edits to confirm).
- **Propose before writing** — this applies to every file you touch: the transcript, hypothesis edits, new hypothesis files. Show the founder what goes in first.
- **Do not edit hypothesis files directly.** Always route through the `hypotheses` skill.
- **Do not evaluate hypothesis state yourself.** Always dispatch the `hypotheses-manager`.
- **Do not extract statements yourself.** Always dispatch the `interview-analyst`.
- **Keep subagent results in the subagent output.** Don't paraphrase the analysis file back into chat — point the founder to the file and highlight the few things worth discussing.

---

## Completion criteria

- Transcript saved at `startup/interviews/transcripts/{slug}.md` with frontmatter
- Analysis file written at `startup/interviews/{slug}.md` by the `interview-analyst`
- Hypothesis state recommendations surfaced to the founder
- Any confirmed state changes or new hypotheses routed through the `hypotheses` skill
- Founder has seen the technique feedback summary

---

## What comes next

After a handful of interviews are analyzed this way, natural directions are:

- **Cross-interview review** — ask the `hypotheses-manager` to reassess all hypotheses at once (standalone, no new interview needed) to see the aggregate picture
- **Project-level reassessment** — invoke the `whats-next` skill; its `lean-startup-advisor` can now evaluate against interview evidence
- **Script iteration** — revise the interview script based on technique feedback patterns across interviews

Mention these as available directions, but don't push — let the founder decide.
