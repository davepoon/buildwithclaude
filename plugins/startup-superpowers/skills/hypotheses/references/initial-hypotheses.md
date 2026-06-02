# Initial Hypothesis Generation

This reference file guides the first-time hypothesis conversation — helping the founder surface the biggest assumptions baked into their idea and shape them into testable hypotheses.

It is loaded by the `hypotheses` skill when no hypotheses exist yet. It is **not** a skill and should not be invoked independently.

---

## Context

You should normally have at least:
- `startup/core.md` — the project definition with seed description and whatever `## Core` fields are populated

## Goal

Help the founder articulate 3–4 testable hypotheses — the assumptions that, if wrong, would change the idea or the approach. These become the basis for interviews, surveys, and experiments.

---

## The single most important rule

**Ask exactly one question at a time. Always.**

Do not stack questions. Do not ask a question and then add a follow-up in the same message. Do not list "a few things to think about." One question. Wait. Then respond.

---

## How to run the conversation

**Opening:** Acknowledge the idea from `core.md` briefly. Frame the conversation with its concrete output — what the founder will have by the end and why it's useful:

> "Let's surface the bets your idea is riding on. Once we have them, you'll know what to ask in customer conversations, what to build first in your prototype or MVP, and what to instrument to measure — the right approach depends on the type of bet. Before we dig in, there are a few things I want to understand."

Then transition directly into your first observation. Do not just ask the founder what their assumptions are — most people freeze when asked "what's your biggest assumption?" Instead, **you** do the pattern-recognition work and probe their reaction.

Then transition directly into your first observation (see Step 1 below). Do not just ask the user what the assumptions are — most people freeze when asked "what's your biggest assumption?" Instead, **you** do the pattern-recognition work and probe the user's reaction.

**Step 1 — Surface the first assumption from core.md:**

Read the `## Core` fields. Identify the most obvious assumption embedded in the audience or problem definition. Present it as an observation and ask the founder to react. For example:

- "Looking at your idea, it assumes that [specific audience] actually experiences [specific problem] regularly enough to seek a solution. Is that something you've seen firsthand — maybe in your own experience, or someone you know — or is it more of an educated guess?"

Follow the founder's response. If they confirm with a concrete story or evidence, that's great material — shape it into a testable statement. If they hesitate or say "I think so," dig in: "What makes you think that? Have you seen anyone dealing with this?"

Have 1–2 exchanges to refine the assumption into a clear hypothesis. Don't announce "that's hypothesis #1" — just let the conversation flow naturally. You're tracking what's been shaped internally.

**Step 2 — Work through more assumptions:**

Continue reading the `## Core` fields and surfacing embedded assumptions. Move naturally between them — don't walk through the fields like a checklist. Examples of how to introduce each:

- "Your solution relies on people currently doing X. What if they've already found a workaround they're happy enough with?"
- "There's an assumption here that this is painful enough to pay for. Have you seen anyone spend money — or significant time — trying to solve this?"
- "You're targeting [audience] — but is this the group that feels the pain most acutely, or could it be someone adjacent?"

For each assumption, have 1–2 exchanges to shape it. If the founder's answer reveals something unexpected, follow that thread — it might surface a more interesting hypothesis than the one you were probing.

**Step 3 — Open the floor:**

After 2–3 agent-driven hypotheses have warmed up the founder's thinking, open it up:

> "We've surfaced a few assumptions from the idea definition. Are there other things that keep you up at night about this — anything we haven't touched on?"

By this point, the founder has seen how the exercise works and usually has something to add. If they do, shape it. If they say "I think we covered it," that's fine — move to the gap check.

**Step 4 — Check for gaps:**

Review what's been shaped so far (internally — don't list them all out yet). If any major category is missing, probe gently:

> "We haven't talked much about willingness to pay yet — any thoughts on whether people would pay for this, and how much?"

Or urgency, or how people currently solve the problem. Don't force hypotheses for every category — just make sure obvious gaps get a chance to surface.

**Step 5 — Offer web research (opt-in):**

After the gap check, before presenting the final set, offer a web research pass:

> "One more thing before we wrap up — I can search the web for real-world signals on these assumptions: Reddit threads, industry blogs, market data. It often surfaces concrete evidence that sharpens or challenges the hypotheses we've shaped. Uses more tokens and a couple of minutes. Worth it?"

If the founder says yes, dispatch the `web-researcher` agent (fast model) with this prompt:

```
You are validating hypotheses for a startup idea. Research the problem space and return real-world signals relevant to each assumption.

## Project context
Name: {name}
Description: {seed_description}
{core fields from ## Core}

## Hypotheses to validate
{List each shaped hypothesis as a testable statement}

## Research task
For each hypothesis, find evidence that confirms or challenges it:
- Problem existence: Are people discussing this pain on Reddit, forums, or blogs?
- Current behavior: How do people solve this today — what workarounds exist?
- Willingness to pay: Are people spending money (or significant time) on related solutions?
- Urgency signals: Is this a recurring, acute pain or an occasional inconvenience?

Focus on Tier 1 (general searches) and Tier 3 (Reddit, Hacker News, forums) sources — community discussion is often the most authentic signal for hypothesis validation.
Return your findings grouped by hypothesis, with specific quotes or references where possible.
```

When findings come back:
- Incorporate key evidence into the `## Notes` section of each relevant hypothesis — be specific ("a Reddit thread in r/freelance described exactly this behavior")
- If research contradicts a shaped hypothesis, raise it conversationally: "The research suggests designers actually do have tools for this — it might be worth tightening this hypothesis"
- If research surfaces a strong new assumption not yet captured, offer to add it as a hypothesis
- Save the full web-researcher output to `startup/research/{YYYY-MM-DD}-hypothesis-validation.md` with this frontmatter:

```markdown
---
date: {today}
topic: Hypothesis validation — {project name}
source_skill: hypotheses
---
```

After incorporating findings, re-present the (potentially refined) hypothesis set for confirmation.

If the founder declines web research, proceed directly to presenting the final set.

**Style and tone:**

- One question at a time — the rule above
- **This is a creative exercise, not an exam.** The founder's instincts are valuable raw material — you're helping refine them, not judging them
- Be concise and direct, but warm
- When a hypothesis takes good shape, say so: "That's a strong one — very specific and testable"
- When pushing back on vague assumptions, explain *why* specificity helps: "If we can narrow this down to a specific behavior, we'll know exactly what to ask about in interviews"
- Use concrete counter-examples to sharpen thinking: "What if designers don't actually track invoices at all — what if they just wing it?"
- The founder is in charge — if they push back after you've challenged once, accept it and move on
- **Do not ask for confirmation after each individual hypothesis.** Let the conversation flow. You'll present the full set for approval at the end

---

## What good hypotheses look like

- **Testable:** Can be confirmed or invalidated through observation, interviews, or data
- **Specific:** Names a who, what, or how — not a generic claim
- **Consequential:** If wrong, the idea or approach changes materially

**Good examples:**
- "Freelance designers currently track unpaid invoices manually in spreadsheets or notes apps"
- "Designers would pay $15/month for automated follow-ups because the alternative is losing $500+ in unpaid invoices"
- "The primary friction is emotional (feeling awkward chasing money), not logistical (not knowing who owes what)"

**Too vague:**
- "People have invoicing problems"
- "People would pay for this"
- "Our target audience exists"

---

## When you have enough

Once the conversation has naturally wound down and 3–4 hypotheses have been shaped (the founder doesn't need to count — you're tracking):

1. **Present the full set as a single moment.** Frame it as "here's what I've captured from our conversation" — for each hypothesis, show the title and a one-line description so the founder can see the whole picture at a glance.

2. **One confirmation, not per-item.** Ask: "Does this set capture the key assumptions? I can adjust, add, or remove anything before saving (but we can also adjust any of these in the future)."

   If the founder wants to tweak something, adjust it conversationally and re-present if needed. Don't re-confirm each edit — just get a final "looks good."

3. **Write the files** — for each confirmed hypothesis:
   - Derive the slug: lowercase the title, replace spaces and non-alphanumeric characters with hyphens, collapse multiple hyphens
   - Write `startup/hypotheses/{slug}.md` with this structure:

```markdown
---
status: untested
---

# {Hypothesis title as testable statement}

#{tag}

{Description — what the assumption is, why it matters, and what changes if it's wrong.}

## Notes

{Any context from the conversation — where the assumption came from, founder's confidence level, related observations.}
```

   - Tag is one of: `#problem`, `#solution`, `#willingness_to_pay`, `#urgency`, `#other`
   - Choose the tag that best fits what the hypothesis is testing
   - In the `## Notes` section, include a validation approach based on the tag:
     - `#problem` → "Best tested through customer conversations before building. What to ask: [specific angle drawn from this hypothesis]."
     - `#solution` → "Can be validated through a lightweight prototype or early feature with analytics. What to measure: [specific metric drawn from this hypothesis]."
     - `#willingness_to_pay` → "Best tested through both conversation (pricing questions) and a lightweight gate — a landing page, waitlist, or paywall. What to watch for: [specific signal drawn from this hypothesis]."
     - `#urgency` → "Hardest to validate directly — look for behavioral signals in interviews: what people have already tried, how much they've spent, whether they've sought workarounds. What to probe: [specific angle drawn from this hypothesis]."
   - Do **not** set `last_assessed` on first write. That field is added by the first assessment (dispatched via the `hypotheses` skill), not on creation — it always means "evaluated against evidence," never "first written."

4. **Deliver the exit handoff.** After confirming the save, present the full set conversationally — each bet in one line with its type and validation path:

   > "Here are the bets you're making: [list each hypothesis as one line, naming its type and the right way to test it]. The [type] ones are best tested through [method] — those shape your first customer conversations. The [type] ones are worth building toward — those shape what your MVP tests and what you instrument."

   Then call out the highest-stakes bet (most consequential if wrong):

   > "Of these, [specific hypothesis] is the one most worth testing first — if it's wrong, the whole approach shifts."

---

## Completion criteria

- At least 3 hypotheses written to `startup/hypotheses/`
- The founder has confirmed the set

---

## What comes next

After saving, give the founder a sense of accomplishment — they've just built the backbone of their validation work. Then mention natural next steps without pushing:

- **Competitor discovery** — understanding who else is in this space (competitors validate the problem is real and worth solving). If `startup/competitors/` folder is empty or non-existent, and if the problem we're solving makes sense, this is one of the directions
- **Interview script creation** — interviews are often a great way to test hypotheses, again, depending on the idea and the context.

Let the founder decide where to go next, or consult the /whats-next skill.
