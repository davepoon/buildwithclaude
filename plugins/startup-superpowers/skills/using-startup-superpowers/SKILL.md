---
name: using-startup-superpowers
description: Use at the start of any conversation about a startup idea, product validation, founder strategy, or work inside a `startup/` workspace. Establishes file conventions, voice-input handling, subagent dispatch rules, and how to update each artifact safely. Activate before invoking any other startup-superpowers skill.
---

# Using startup-superpowers

This skill carries the always-on context for the startup-superpowers plugin. When it activates, treat its contents as plugin-wide ground rules — file formats, voice-input handling, subagent dispatch — that apply across every other startup-superpowers skill. It is not a workflow to execute; it is the shared backdrop you operate against.

Load this before invoking `whats-next`, `competitors`, `hypotheses`, `interviews`, `market-research`, `surveys`, or `mvp`.

## Voice input

The founder may be using voice input. Voice transcription is unreliable with proper nouns — competitor names, product names, URLs, technical terms, and non-English words often come through garbled. When the input contains something that looks like a misheard name or an unintelligible fragment, ask the founder to clarify or spell it out rather than guessing.

## Project definition

The source of truth for the project definition is `startup/core.md`. It is a markdown file with:

- **YAML frontmatter** containing `version` (format version) and `name` (working project name)
- **`## Seed Description`** section with the founder's original description of what they're building
- **`## Core`** section with structured fields as `- **Key:** Value` list items (audience, problem, solution, geography, etc.) — these accumulate as the onboarding conversation progresses

Read `startup/core.md` at the start of any conversation that touches the startup idea, product, or strategy.

When updating `core.md`, read the current file first, modify the fields you need under `## Core` (using `- **Key:** Value` format), and write the file back. Leave the frontmatter and `## Seed Description` untouched. Propose changes to the founder and get confirmation before writing. Fields missing from `## Core` are not yet defined — don't push to fill everything at once.

## Plan

The project plan lives in `startup/plan.md`. It tracks the founder's current focus, next steps as a checklist, and a log of past assessments. The `whats-next` skill manages it — don't update it directly. When the founder asks about direction or next steps, invoke the `whats-next` skill which dispatches the lean-startup-advisor subagent for an independent assessment.

## Hypotheses

Hypotheses are testable assumptions about the project — things the founder believes but hasn't validated yet. Each hypothesis is a `.md` file in `startup/hypotheses/`.

Format: YAML frontmatter with `status` (untested/confirmed/invalidated), an H1 title (the testable statement), an Obsidian tag for type (#problem, #solution, #willingness_to_pay, #urgency, #other), a description, and an optional ## Notes section.

When the founder mentions a new assumption or risk in conversation, suggest capturing it as a hypothesis. Read the hypotheses folder before any conversation about validation, interviews, or pivots. To update a hypothesis, read the file first, propose the change, get confirmation, then write it back.

## Competitors

Competitors are tracked as individual `.md` files in `startup/competitors/`.

Format: YAML frontmatter with `type` (direct/indirect) and `url` (competitor's website), an H1 heading with the competitor name, and sections for Description, Core Features, and Notes.

When the founder mentions a competitor or asks about the competitive landscape, read the competitors folder for context. To add or update a competitor, follow the file conventions and get confirmation before writing.

## Web research

A `web-researcher` subagent is available for any research task that goes beyond a quick search — competitive landscape discovery, problem space validation, market signals, community discussion. Use it when the founder asks to research something or when research would meaningfully sharpen an assumption or decision.

Research summaries from web-researcher runs are saved to `startup/research/` as dated `.md` files. This preserves expensive research for future reference. The calling skill is responsible for writing the file after getting the agent's output.

## Feedback invites

At a few high-value milestones, offer the founder an optional, anonymous feedback link. This is the plugin's only feedback mechanism — there is **no telemetry and nothing is ever sent automatically**. Everything here is advisory and founder-driven.

**The ledger.** Invite state lives in `startup/.superpowers/feedback.md`, created lazily on the first invite:

```markdown
---
opted_out: false
---
# Feedback invites (managed by Startup Superpowers — safe to delete)

- competitors-done — invited 2026-05-31
```

- `opted_out: true` → never invite for any milestone again.
- Each `{stage-tag} — invited {YYYY-MM-DD}` line means that milestone was already offered. One invite per stage tag, ever — the "first time only" behavior falls out of this; no counting needed.

**Before inviting** at any milestone, read `startup/.superpowers/feedback.md` (if it doesn't exist, treat it as "nothing invited, not opted out"). Stay silent if it shows `opted_out: true` or already lists the stage tag. Otherwise emit the invite, then append the `{stage-tag} — invited {today}` line, creating the file and `startup/.superpowers/` folder if absent.

**Milestones and stage tags** — each owned by the skill that produces the artifact:

| Stage tag | Fires when |
|---|---|
| `competitors-done` | first `startup/competitive-landscape.md` written |
| `first-interview-analyzed` | first `startup/interviews/*.md` analysis written |
| `mvp-designed` | first `startup/mvp-plan.md` written |
| `market-brief-done` | first `startup/market-brief.md` written |

**The invite** — one warm, milestone-specific sentence tied to the win the founder just got, then the link, then the opt-out clause:

> "Before you go — {one line tying to what they just received}. If you've got 60 seconds, here's a quick, anonymous form: `https://tally.so/r/Bz0ArK?stage={stage-tag}`. Totally optional, and just say the word if you'd rather I never bring this up again."

- Link template: `https://tally.so/r/Bz0ArK?stage={stage-tag}`.
- The `stage` value is the only thing that travels with the link, and only if the founder submits — no identity, no project content.
- Emit it as the **final beat** of the skill's exit handoff, after the founder has the artifact in hand — never mid-workflow.

**Status: live.** The form id is set below (`Bz0ArK`), so invites are active. (Guard: if the id is ever reset to the literal `{FORM_ID}` placeholder, treat the protocol as inert and do not emit any invite.)

**Opt-out.** If the founder ever says "stop asking" / "don't bring this up again," set `opted_out: true` in the ledger and confirm briefly. Never ask again.

**FORM_ID:** `Bz0ArK`  <!-- Live Tally form: https://tally.so/r/Bz0ArK . Reset to the literal {FORM_ID} placeholder to make invites dormant again. -->
