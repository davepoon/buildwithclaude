# Initial MVP Design

This reference file guides the design conversation that produces `startup/mvp-plan.md` — a document defining what to build, why this form, which hypotheses it tests, and what success looks like.

It is loaded by the `mvp` skill when no `startup/mvp-plan.md` exists, or when the founder explicitly wants a guided design session. It is **not** a skill and should not be invoked independently.

---

## Context

You already have:
- `startup/core.md` — project definition
- `startup/hypotheses/*.md` — testable hypotheses
- `startup/interviews/*.md` — qualitative evidence, if any
- `startup/surveys/*.md` — quantitative evidence, if any

## Goal

Produce `startup/mvp-plan.md` — specific enough that someone could build from it, with success criteria concrete enough that "did we hit it?" has an unambiguous answer.

---

## The single most important rule

**Ask exactly one question at a time. Always.**

Do not stack questions. Do not ask a question and then add a follow-up in the same message. Do not list "a few things to think about." One question. Wait. Then respond.

---

## What you know about MVPs — apply this throughout

These are not rules to read aloud. They are the lens through which you evaluate every proposal:

- **Most founders over-build.** The goal is the minimum that generates honest signal — not the minimum viable product for launch, but the minimum for learning.
- **A landing page can validate more than most founders think.** Interest, messaging, willingness to sign up, even rough willingness to pay. Before proposing something more complex, ask: would a landing page answer the question?
- **Wizard of Oz and Concierge approaches are underused.** Manually doing what the product would do — for even 3–5 people — often reveals more than months of building.
- **The form should match what's being tested:**
  - Problem hypothesis → landing page or concierge is almost always enough
  - Solution hypothesis → clickable demo or simple app may be needed
  - Willingness to pay → Wizard of Oz (take payment manually), not a full billing system
- **Success criteria must be set before building**, not after. Post-hoc success criteria are almost always self-serving.
- **Inconclusive is different from negative.** An experiment that didn't reach the right audience tells you nothing about the hypothesis.
- **The build-cost gap has narrowed.** Deploying a simple working app used to take weeks; now it can take an afternoon. "Simplest form that generates honest signal" now hinges more on *what's being tested* than on *what's cheapest to build*.
- **Building is cheap; audience isn't.** The binding constraint on MVP signal today is whether the experiment reaches people who matter. A beautifully deployed thing seen by the wrong 14 people validates nothing. The old question "what will we build?" has been largely eclipsed by "who will we put this in front of, and how?"
- **Watch for vanity prototypes.** The old failure mode was "I built for six months and nobody wanted it." The new failure mode is "I deployed in two hours and nobody saw it." Polish without distribution is no better than a doc that never ships. If the founder can't name a concrete distribution plan, the MVP is premature regardless of form.

## Five MVP forms

| Form | Best for | Deployable? |
|---|---|---|
| Landing page | Validating interest, messaging, willingness to sign up | Yes |
| Wizard of Oz | Validating the outcome without building the mechanism | No |
| Concierge MVP | Validating the full experience manually for a few people | No |
| Clickable demo | Validating UX flow without a real backend | Yes |
| Simple web app | When value can only be demonstrated with working software | Yes |

---

## How to run the conversation

### Step 1 — Read context and orient

Read `startup/core.md`, all hypothesis files (check `startup/hypotheses/`), any interview analyses, any survey files (`startup/surveys`), competitor files (see `startup/competitors/`).

Produce a brief orientation — 2–3 sentences, not a wall of text:
- What's been validated so far (substantiated by evidence)
- What's still untested (the riskiest remaining assumptions)
- What the MVP therefore needs to accomplish

Frame what's ahead:
> "Let's figure out the simplest thing worth building to test what you don't know yet. I'll start by proposing a form, and we'll work from there."

Then go to Step 2.

### Step 2 — Confirm distribution

Before proposing a form, ask **one question**:

> "Who exactly will you put this MVP in front of, and how will they encounter it? Be specific — 'post on Twitter' is not specific; 'DM 25 freelance designers from [named community] over two weeks' is."

If the founder has a concrete answer, note it and proceed to Step 3. The distribution plan shapes form selection (if the audience is 30 people the founder can email directly, a concierge approach may beat a landing page) and it shapes the success criteria downstream (a "30 signups" bar is meaningless without knowing how many people it's calibrated against).

If the founder can't name a concrete plan, flag it softly — this is not a gate:

> "The form of the MVP matters less than whether you can get honest signal from it. Before we pick what to build, it's worth naming at least a rough distribution plan. Want to keep going with a rough plan, or pause on that first?"

Do not pre-empt their answer. Wait.

### Step 3 — Propose the MVP form

Do not ask "what do you want to build?" Propose the simplest form that generates honest signal on the riskiest untested hypotheses. Include:
- The proposed form (from the five above)
- One sentence of rationale: why this is the minimum that generates honest signal
- What would have to be true for something more complex to be warranted

If the founder pushes for something more complex, engage honestly:
> "What would a [more complex thing] tell you that a [simpler thing] wouldn't? If the answer is 'not much,' let's stick with simpler."

Ask:
> "Does this direction make sense, or do you have a different form in mind?"

Wait for the answer. Adjust if needed.

### Step 4 — Scope the build

Ask:
> "What's explicitly out of scope — things you're deliberately not building for this experiment?"

Wait for the answer. If the founder's out-of-scope list is thin (they've described a full product and excluded nothing), push gently: suggest one or two specific things to cut and explain why excluding them doesn't compromise the validation. Then ask once: "Does that scope feel right, or is there something you'd keep?"

### Step 5 — Map hypotheses to the experiment

For each untested or weakly-tested hypothesis in `startup/hypotheses/`, note whether this experiment would generate signal on it and what a positive result would look like. Surface the mapping explicitly:

> "This experiment would give us signal on [[hypothesis-slug]] — we'd know it's confirmed if [X]. It won't tell us much about [[other-slug]] — that one needs a different test."

No question needed here — this is informational. Share the hypothesis mapping, then **pause and wait** for the founder to acknowledge or respond before proceeding to Step 6. The mapping and the success-criteria question must be in separate messages.

### Step 6 — Define success criteria

Based on the hypothesis mapping and the MVP form, propose specific measurable success criteria:
- Landing page: "X signups in Y days", "Z% of visitors click the CTA"
- Concierge/WoZ: "3 people agree to pay [price] before seeing a product", "5 out of 5 users complete the manual workflow without confusion"
- Simple app: "Y% of users return within a week", "X users complete core action on first visit"

Calibrate the bar against the distribution plan from Step 2. "30 signups" is meaningless if the founder is reaching 40 people; it's sandbagged if they're reaching 4,000. The honest bar depends on reachable audience, not aspiration.

Ask:
> "Does this feel like the right bar — or should we set it higher or lower?"

Wait for the answer. Push back on vague criteria: "people seem interested" is not a success criterion.

### Step 7 — Note tracking

**For deployable forms (landing page, demo, simple app):**
> "When we deploy this, I can also wire up signup capture or click tracking to make measuring the success criteria easy. I'll handle that in the build step."

**For manual forms (Wizard of Oz, Concierge):**
Suggest a lightweight tracking approach — a notes file in `startup/`, a shared spreadsheet, or a Tally form for collecting structured feedback. No action here; just point at the right tool.

After noting the tracking approach, proceed directly to Step 8 — no question needed.

### Step 8 — Save the plan

Propose the full file content before writing. Get confirmation. Then write `startup/mvp-plan.md`:

```markdown
---
version: 1
status: ready
last_updated: {YYYY-MM-DD}
---

# MVP — {Short descriptive name}

## What We're Building

{One paragraph: the form, what it does, what it deliberately does NOT do.}

## Why This Form

{The agent's reasoning: why this is the simplest thing that generates honest signal on the hypotheses below. What would have to be true for something more complex to be warranted.}

## Hypotheses Being Tested

- [[{hypothesis-slug}]] — {what a positive result looks like}
- [[{hypothesis-slug}]] — {what a positive result looks like}

## Success Criteria

{Specific and measurable. "30 signups in 2 weeks." "40% of visitors click the CTA." "3 people agree to pay before we write a line of backend code."}

## Distribution Plan

{Where and how this MVP will reach the target audience. Specific: a list, a channel, a person, a campaign. "Post on Twitter" is not specific; "DM 25 freelance designers from [named community] over two weeks" is. Rough is fine; vague is not.}

## Stack & Deployment

*(Populated when deployed)*

## Experiments Log

*(Populated as experiments run — each entry is dated: `### YYYY-MM-DD — Short label`, followed by what was built, what was measured, and what was learned.)*
```

Use `status: ready` if the form and success criteria are settled. Use `status: designing` if the form or success criteria are still contested or uncertain after Step 6.

### Step 9 — Deployment offramp (deployable forms only)

For landing pages, demos, and simple apps:
> "Want me to scaffold and deploy this now and get you a live URL, or do you have a different way you want to build it?"

If yes → load:
```
.claude/skills/mvp/references/scaffold-and-deploy.md
```
The reference file's instructions take over from this point.

If no → "When you're ready, just say the word."

For Wizard of Oz and Concierge forms: skip this step. The plan is the deliverable — no deployment needed. Remind the founder:
> "Come back when you've run it with a few people and we'll assess what you learned."

---

## Completion criteria

- `startup/mvp-plan.md` written with frontmatter containing `version`, `status`, `last_updated`
- All required sections present: `## What We're Building`, `## Why This Form`, `## Hypotheses Being Tested`, `## Success Criteria`, `## Distribution Plan`, `## Stack & Deployment`, `## Experiments Log`
- `[[hypothesis-slug]]` backlinks used for each hypothesis being tested
- Founder has confirmed the content before the file was written

---

## What comes next

- **Deploy it** — for deployable forms, the agent can scaffold and deploy from the project root
- **Run it** — for manual forms, the founder runs the experiment
- **Run interviews or surveys in parallel** — different evidence types compound; the MVP tells you if they use it, interviews tell you why

---

## Feedback invite (first time only)

Once `startup/mvp-plan.md` is written and the close above is delivered, follow the Layer 0 *Feedback invites* protocol for stage `mvp-designed`: read `startup/.superpowers/feedback.md`, and unless the founder opted out, the tag is already recorded, or `FORM_ID` is still the placeholder, emit the invite tying it to the MVP plan they just shaped, then append the ledger line. Deliver it as the final beat, after the next-steps mention.
