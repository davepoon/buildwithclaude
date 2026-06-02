# Initial Survey Questions

This reference file guides the full survey creation conversation — helping the founder identify what to test, find the right audience, design a short and honest question set, and save it as a survey artifact. It ends with an optional handoff to Tally for deployment.

It is loaded by the `surveys` skill when creating a new survey. It is **not** a skill and should not be invoked independently.

---

## Context

You already have:
- `startup/core.md` — project definition; contains at least `Audience` and `Problem`
- `startup/hypotheses/*.md` — testable hypotheses (ideally some untested ones)
- `startup/interviews/*.md` — prior qualitative work, if any
- A `startup/surveys/` directory (newly created or existing)

## Goal

Produce **one well-targeted survey** — written to a single `.md` file — with a short question set the founder can actually deploy and get meaningful signal from. Both the question quality and the distribution plan matter equally.

---

## The single most important rule

**Ask exactly one question at a time. Always.**

Do not stack questions. Do not ask a question and then add a follow-up in the same message. Do not list "a few things to think about." One question. Wait. Then respond.

---

## What you know about surveys — apply this throughout

These are not rules to read aloud. They are constraints that should silently shape every question you draft and every piece of advice you give:

- **Short beats comprehensive.** Cold audiences: 3–7 questions. Warm communities: up to 10. Every extra question costs completion rate. If it doesn't directly test a hypothesis, cut it.
- **Behavioral over attitudinal.** "What do you currently do when an invoice goes unpaid?" beats "Would you use an automated follow-up tool?" People lie about future behavior; they can't lie about what they already did.
- **Closed questions for quantitative signal, one open-ended question at the end for unexpected signal.** Multiple choice and rating scales produce numbers you can aggregate; open-ended questions catch things you didn't anticipate.
- **No compound questions.** If the question has "and" in it, split it.
- **No leading questions.** Questions should not hint at your solution or telegraph the "right" answer. Apply the Mom's Test principle: ask about their life, not their opinion of your idea.
- **Response rate benchmarks:** cold audience ~5–10%, warm community ~20–30%. Size the response_goal realistically given the distribution channel.
- **Respondent value prop matters.** Sharing the results back, linking to an MVP or waitlist, or offering a small incentive meaningfully lifts completion and goodwill.
- **Distribution without a targeted audience is wasted effort.** A survey posted in the wrong community generates noise, not signal.

---

## How to run the conversation

### Step 1 — Read context and orient

Read `startup/core.md`, scan `startup/hypotheses/`, and check `startup/interviews/` for prior qualitative work.

Share a brief orientation (2–3 sentences, not a wall of text): what's in place, what the survey could add, any risk worth naming. Then frame what's ahead:

> "Let's build a survey together. I'll help you pick what to test, find the right audience, and draft each question — one at a time."

Then go to Step 2.

---

### Step 2 — Identify the hypotheses to test

Ask:

> "Which hypotheses do you most want quantitative signal on — or would you like me to suggest the best candidates?"

Wait for the answer.

If the founder asks for suggestions: propose 2–3 hypotheses from `startup/hypotheses/*.md` that are untested or where quantitative confirmation would meaningfully change the plan. Prioritize `#problem` and `#willingness_to_pay` hypotheses over `#solution` ones — surveys are better for confirming problem scope than validating solution desirability. Show the suggestions and ask which to use.

Confirm the selection before moving on. Cap at 4–5 hypotheses maximum — more than that will bloat the survey past the point of reasonable completion rates.

---

### Step 3 — Distribution channel

Ask:

> "Where can you actually reach people who match your target audience — specific communities, channels, email lists, Slack groups, subreddits, or other places?"

Wait for the answer.

Evaluate the channel honestly. If they name something vague ("social media," "people I know"), push gently:

> "That's a start — can you get more specific? The channel matters as much as the questions. A survey posted in the wrong community generates noise, not signal."

If they have no clear channel, name this as a real problem: a well-crafted survey with no distribution plan is wasted effort. Suggest concrete options based on the project context — relevant subreddits, Indie Hackers, LinkedIn groups, Slack communities, Product Hunt Ship, their existing interview contacts, etc. Ask if any are realistic.

Once they have a plausible channel, ask the follow-up:

> "What could you offer respondents to make it worth their time — sharing the results back, a link to your product, a small incentive, or something else?"

Wait. Capture both the distribution plan and the respondent value prop. These go into the survey file.

---

### Step 4 — Set the question budget

Based on the number of hypotheses selected and the distribution channel (cold vs. warm), announce the question budget before drafting:

> "Given [N] hypotheses and a [cold/warm] audience, let's aim for [X] questions total — one per hypothesis, plus possibly one more at the end. I'll draft them one at a time."

The founder can override the budget. Then begin Step 5.

---

### Step 5 — Draft questions one at a time

For each hypothesis selected, draft one question. Before presenting it, silently run this self-check:

**Bias check (do not skip):**
- Does the question wording imply a "correct" or expected answer? (e.g., "If you've ever skipped X…" implies skipping is wrong)
- Does any option hint at your solution or frame the problem in a way that telegraphs what you expect to hear?
- Could a respondent feel embarrassed or judged by their honest answer? (social desirability bias)
- Is there an "and" in the question? If so, split it.
- Is the question asking about future intent rather than past behavior? If so, rewrite to be behavioral.

If any of these fire, rewrite until they don't. The founder should not have to catch this — the agent should.

Present each question like this:

> **Draft question [N]:** [question text]
> *Type: [multiple choice / rating scale 1–5 / open-ended]*
> *Tests: [[hypothesis-slug]]*
>
> Options (if multiple choice):
> - Option A
> - Option B
> - Option C
> - Other (please specify)
>
> Does this capture what you want to test, or should we adjust?

Wait for feedback. Revise once if needed, then move to the next hypothesis.

**Question type guidance:**
- Use **multiple choice** for categorical hypotheses ("which of these do you currently use?")
- Use **rating scale (1–5 or 1–7)** for magnitude hypotheses ("how much does this frustrate you?")
- Avoid **yes/no** for the core hypothesis questions — they collapse nuance; use a scale or multiple choice instead
- Use **open-ended** carefully — see guidance below before proposing one

After all hypothesis questions are drafted, evaluate whether an open-ended closing question is worth it. Consider:

- **Worth it when:** the hypothesis set is exploratory, important segments may be missing from the options, or the founder genuinely doesn't know what they don't know yet
- **Not worth it when:** the audience is cold and completion rate is a concern, the hypotheses are specific enough that closed questions cover the space, or the founder already has qualitative signal from interviews

Present the tradeoff explicitly and let the founder decide:

> "One option is to close with an open-ended question — something like 'Is there anything about [topic] we didn't ask?' Open-ended questions catch unexpected signal you didn't anticipate, but they also add friction and some respondents will skip or drop off. [Given your cold/warm audience and X existing questions], I'd [recommend / suggest skipping] one here. What do you think?"

Do not propose the open-ended question as the default — earn it by making the case.

---

### Step 6 — Review the complete set

Show all confirmed questions together. Quietly check before displaying:
- Total count is within the question budget
- No compound questions (no "and" in a single question)
- No leading language or solution hints
- At least one closed question per hypothesis (not all open-ended)

Show the full list and ask:

> "Does this look right, or is there anything you'd like to change before we save it?"

Wait. Make any final adjustments.

---

### Step 7 — Save the survey file

Propose the full file content — frontmatter and all sections — before writing. Get confirmation.

Derive the slug: lowercase the title, replace spaces and non-alphanumeric characters with hyphens, collapse multiples. Prefix with today's date. Example: "Invoice chasing validation" → `2026-04-19-invoice-chasing-validation`.

Write `startup/surveys/{YYYY-MM-DD}-{short-descriptor}.md`:

```markdown
---
status: draft
mode: questions-only
date_created: {YYYY-MM-DD}
target_persona: {one-line segment descriptor from core.md or refined during conversation}
hypothesis_slugs:
  - {slug}
  - {slug}
response_goal: {realistic number based on channel and benchmark}
---

# Survey — {Short descriptive title}

## Purpose

{Why this survey exists — what it's trying to learn and what decisions it will inform.}

## Target Audience

{Who should fill it out, the response goal, and why that sample size makes sense given the distribution channel and completion rate benchmarks.}

## Distribution Plan

{Where to post it, why those channels reach the right people, and what value is offered to respondents.}

## Questions

1. {Question text} *(type: multiple choice)*
   - Option A
   - Option B
   - Option C
   - Other (please specify)
2. {Question text} *(type: rating scale 1–5)*
3. {Question text} *(type: open-ended)*

## Notes

{Optional — context, links to related interviews, things to revisit.}
```

---

### Step 8 — Tally offramp

Ask:

> "Would you like me to create this survey in Tally now and get you a shareable link — or would you prefer to handle the posting yourself?"

Wait.

If yes → load the reference file that handles Tally deployment:

```
.claude/skills/surveys/references/tally-survey.md
```

The reference file's instructions take over from this point.

If no → close cleanly:

> "Saved. When you're ready to deploy it, just say the word and I'll set it up in Tally and get you a link."

---

## Completion criteria

- File written to `startup/surveys/{slug}.md`
- Frontmatter includes `status: draft`, `mode: questions-only`, `date_created`, `target_persona`, `hypothesis_slugs`, `response_goal`
- All required sections present: `## Purpose`, `## Target Audience`, `## Distribution Plan`, `## Questions`
- Founder has confirmed the full content
- Distribution channel and respondent value prop are captured in the file (not just discussed)

---

## What comes next

After the survey is saved, natural next steps include:

- **Deploy to Tally** — agent creates the survey and returns a shareable link
- **Run more interviews in parallel** — surveys show what, interviews show why; running both gives the strongest signal
- **Post the link** — to the distribution channels identified in the file; the distribution plan is only as good as its execution

Mention these as available directions. Don't push — let the founder decide.
