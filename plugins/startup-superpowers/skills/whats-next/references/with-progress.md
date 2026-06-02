# With Progress — Materials-Based Onboarding

This reference file guides onboarding for founders who already have materials (tier 2) or significant progress (tier 3). It is loaded by `initialization.md` when the founder picks option 2 or 3 in the progress check.

It is **not** a skill and should not be invoked independently.

---

## Context

The founder has indicated they already have something to show. Your job is to read their materials, extract the project definition from them, and set up the workspace — rather than reconstructing it through Q&A.

**Tier 2** — has a landing page, pitch, or one-pager. Flow: materials → core.md → plan.

**Tier 3** — has done customer discovery or built something. Same as tier 2, plus: competitors intake and interviews intake before the plan.

---

## Step 1 — Materials intake

Ask the founder to share everything they have:

> "Great — share anything you have and I'll read through it before we set anything up. A URL works, pasted text works, or both."

If tier 3, add:

> "After I've read your materials we'll also go through any competitors you know and any interviews you've done."

Wait for their response. Accept URLs, pasted text, or a mix. Collect everything before proceeding.

---

## Step 2 — Read and classify

**Fetch all URLs** using `WebFetch`. Read all pasted text. Do not proceed until all materials have been read.

**Classify B2B vs B2C** from what you read:

| Signal | Type |
|---|---|
| Companies, enterprises, teams, organizations, SaaS-for-business, B2B explicitly | `b2b` |
| Consumers, individuals, personal use, general public, B2C explicitly | `b2c` |
| Ambiguous or mixed signals | Ask the founder |

**If ambiguous**, ask using a structured question (one question, wait for response):

1. **Businesses** (B2B) — selling to companies, teams, or organizations
2. **Consumers** (B2C) — selling to individual people
3. **Not sure yet** — still figuring this out

---

## Step 3 — Propose core.md fields

Based on what you read, derive the `## Core` fields. **Do not ask the founder to answer these — infer them from the materials and propose them for review.**

**B2C fields to derive:**
- **Audience** — specific target persona (not "everyone who...")
- **Problem** — the concrete pain they experience
- **Solution** — how the product solves it
- **Geography** — launch market, if stated or clearly implied

**B2B fields to derive:**
- **ICP Company Size** — firmographic size range (e.g., "Series A–C SaaS, 50–300 employees")
- **ICP Industry** — vertical or function targeted
- **Buyer Role** — who signs the contract
- **End User Role** — who uses it day to day
- **Problem** — framed as cost, risk, inefficiency, or revenue impact
- **Solution** — how the product addresses it
- **Geography** — if stated or clearly implied

Omit any field the materials don't address — leave it for later. Do not make fields up.

Present the proposed fields as a `## Core` block:

> "Here's what I got from your materials — let me know if anything needs adjusting:"
>
> ```
> - **Audience:** Freelance designers who invoice 5+ clients monthly
> - **Problem:** They lose track of unpaid invoices and feel awkward chasing clients
> - **Solution:** Automated, polite follow-up sequences that remove the awkwardness
> ```

Ask the founder to confirm or correct. Apply any corrections they give. One round of review — if corrections are minor, apply and confirm in the same message.

---

## Step 4 — Scaffold

**Suggest a project name.** Generate 2–3 short working titles from the materials (use the product name if one is clear). Present with an option to type their own:

> "What should we call this project? I can see a few options from what you shared:"
>
> 1. **{suggestion_1}**
> 2. **{suggestion_2}**
> 3. **{suggestion_3}**
> 4. **Something else** — type your own

Use `AskUserQuestion`. If they pick "Something else", ask them to type a name. Store as `project_name`.

**Run the init script:**

```bash
npx tsx .claude/skills/whats-next/scripts/init-project.ts \
  --name "<project_name>" \
  --description "<seed_description>"
```

For `seed_description`, pass a one-paragraph summary of the founder's idea as reconstructed from the materials — their concept in plain language, not a citation like "see landing page."

If the script fails, handle the error and inform the founder.

**Write the confirmed `## Core` fields** into `startup/core.md`. Read the file first, then update only the `## Core` section — leave frontmatter and `## Seed Description` untouched.

---

## Step 5 — Competitors intake (tier 3 only; skip if tier 2)

Ask the founder (one question, wait for response):

> "Do you have competitors in mind already?"

**If no:** continue to Step 6.

**If yes:** ask them to list names and URLs for what they know. Then create a stub file for each in `startup/competitors/`:

```markdown
---
type: direct
url: {url or "unknown"}
---

# {Competitor Name}

## Description

*To be filled in.*
```

Use `type: direct` as the default — the founder named these explicitly. They can update it to `indirect` later if needed. Slug the filename from the name: lowercase, spaces and special characters replaced with hyphens.

Then ask (one question):

> "Want me to run a search to fill these out and potentially find more competitors you might not know about yet?"

- **If yes:** dispatch the `web-researcher` agent using the same approach as the competitors/discovery workflow. The agent is generic, so include the **Competitor output format** spec from `competitors/references/discovery.md` in the dispatch prompt (per-competitor fields + direct/indirect + maturity) — don't assume the agent supplies a competitor shape. Save research output to `startup/research/`. Save filled competitor files to `startup/competitors/`.
- **If no:** leave the stubs for the founder to fill in later.

---

## Step 6 — Interviews intake (tier 3 only; skip if tier 2)

Ask the founder (one question, wait for response):

> "Have you done any customer interviews?"

**If no:** continue to Step 7.

**If yes:** ask (one question):

> "Do you want to process transcripts or notes now, or add it as a next step in your plan?"

- **Now:** hand off to the interviews skill. Read `.claude/skills/interviews/SKILL.md` and follow it.
- **Later:** note this — you'll include "Process existing interview transcripts" as a step in the plan.

---

## Step 7 — Plan proposal

Assess the founder's actual state from what you've read and what came out of the intake questions. Propose a plan that reflects where they actually are — not where a brand new founder would be.

**Pre-check steps that are clearly done** (`[x]`). Examples:
- Idea defined → `[x]` if core.md has Audience and Problem
- Landing page live → `[x]`
- Known competitors saved → `[x]` if stubs were created in Step 5
- Customer interviews done → `[x]` if the founder said yes in Step 6 (even if not yet analyzed)

**Set Current Focus** to the real next milestone — not "define your idea."

**Propose next steps** — scope the plan to the next 1–2 milestones, not the entire journey. A founder who sees 2–3 clear steps feels momentum; a founder who sees 8 steps feels overwhelmed. Future reassessments will extend the plan when the time comes.

Apply lean startup thinking to decide what comes next. The core question: **what would most reduce the founder's risk right now?** Use this progression as a guide (not a rigid sequence — adapt to what's already been done):

1. **Competitive landscape** — who else is solving this, how does the founder differentiate? If competitors are unknown, this is usually the first gap to fill.
2. **Hypotheses** — are the key assumptions surfaced as testable statements? Formalizing hypotheses gives interviews a clear focus — each conversation tests something specific instead of being open-ended.
3. **Customer discovery** — has the founder talked to potential customers? Even 3–4 short conversations tend to reveal something surprising. If interviews happened but aren't analyzed, analysis is the next step.
4. **Synthesis** — what was learned, does the direction hold?

Skip steps the founder has clearly completed. If they've already done customer interviews, don't suggest "discover competitors" as the next step just because it's earlier in the progression — meet them where they are.

Present the proposed plan conversationally, get the founder's confirmation, and write `startup/plan.md`. Read the file before writing.

---

## Completion criteria

- `startup/core.md` exists with `version` and `name` in frontmatter, a `## Seed Description` section, and at least **Audience** (or **ICP**) and **Problem** under `## Core`
- `startup/plan.md` exists with a plan that reflects the founder's actual state (pre-checked steps, appropriate Current Focus)
- (Tier 3) Any competitors the founder named exist as stub files in `startup/competitors/`
