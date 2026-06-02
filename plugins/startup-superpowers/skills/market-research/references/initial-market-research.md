# Initial Market Research

This reference file guides the first-time market research conversation — helping the founder understand the landscape their idea sits in: whether the market is real, who the buyers are, how they behave, and what they expect to pay.

It is loaded by the `market-research` skill when no `startup/market-research.md` exists. It is **not** a skill and should not be invoked independently.

---

## Context

You should have:
- `startup/core.md` — the project definition, including at minimum **Audience**, **Problem**, and **Solution** under `## Core`. The `type` field (b2b/b2c) should be present if idea elaboration has been run; if not, infer it from the audience and ICP fields.

## Goal

Dispatch structured web research, synthesize the findings into a clear picture of the market, and save it to `startup/market-research.md`. The goal is not a comprehensive report — it's the minimum understanding needed to know if the market is real, who's in it, and how it works.

---

## The single most important rule

**Ask exactly one question at a time. Always.**

Do not stack questions. Do not ask a question and then add a follow-up in the same message. One question. Wait. Then respond.

---

## How to run the conversation

### Step 1 — Frame it

Frame the conversation with its concrete output before asking anything:

> "We're building your market brief — a one-page picture of the market you're entering that you could show to an advisor or investor. By the end, you'll have a grounded answer when someone asks 'how big is this?' and a clear picture of how buyers in this space think and decide. Before we search, there are a few things I want to understand."

Then move directly into Step 2 — don't ask if they want to do this.

---

### Step 2 — Confirm scope

Ask one focused question to catch anything that would affect the research direction:

> "Are there specific angles you'd like us to focus on — certain segments, geographies, or pricing models? Or any areas we should skip?"

If they say "just go broad," that's fine — proceed with a general research pass.

---

### Step 3 — Dispatch web research

Dispatch **one** Task call to the `web-researcher` agent (fast model).

Determine whether the project is **B2B or B2C** from `core.md`:
- B2B signals: the Audience is a role or company type; ICP mentions company size, industry, or job title
- B2C signals: the Audience is a consumer demographic or behavior; no ICP firmographics

Use the appropriate prompt variant below.

---

**B2B prompt:**

```
You are researching the market landscape for the following B2B project. Your goal is to help the founder understand whether the market is real, how buyers in this space make decisions, and what they typically pay.

## Project context
Name: {name}
Description: {seed_description}
{Core fields: Audience, ICP, Problem, Solution, Geography — include whatever is filled in core.md}

## Research focus
{Any specific focus areas or exclusions the founder mentioned — or "broad"}

## Research tasks

### Task 1 — Market reality and size
Search for evidence that this is a defined category. Look for: analyst coverage (even partial free summaries), G2 or Capterra category pages, SaaS review site category definitions, industry publications. The goal is not a TAM number — it's a signal that the market is named, discussed, and has established players.
Return: how the category is typically named, any size or growth signals found, whether analyst coverage exists.

### Task 2 — Buyer behavior
Find evidence of how buyers in this space evaluate and purchase solutions. Look for: LinkedIn job postings that describe the problem role (reveals what companies actually prioritize), G2/Capterra reviews that mention evaluation criteria or how buyers compared solutions, vendor comparison blog posts, Reddit or Hacker News discussions about how practitioners found or chose tools. 
Return: what roles are typically involved, what evaluation criteria come up repeatedly, how long decisions typically take, where buyers go to discover solutions.

### Task 3 — Pricing norms
Find pricing pages, review-site pricing data, and community discussion about what buyers in this space pay. Look for: competitor pricing pages, G2 pricing category data, Reddit or forum discussions about price. 
Return: predominant pricing models (per seat / flat / usage-based), typical price ranges or tiers, any price sensitivity signals (complaints about being too expensive, or discussion of what's worth paying for).

### Task 4 — Trends
Find 2–3 relevant trends affecting this market. Look for: recent industry blog posts, VC investment thesis posts, trade publication coverage, conference topic shifts.
Return: what's driving this market right now, any macro or category-level shifts.

Source strategy: Tier 1 (category searches), Tier 2 (G2, Capterra, Crunchbase, LinkedIn), then Tier 3 (Reddit, Hacker News) as a sanity check. Return findings organized by task. Include source URLs. Flag anything with a single source.
```

---

**B2C prompt:**

```
You are researching the market landscape for the following B2C project. Your goal is to help the founder understand whether the market is real, how consumers in this space discover and decide to buy, and what they expect to pay.

## Project context
Name: {name}
Description: {seed_description}
{Core fields: Audience, Problem, Solution, Geography — include whatever is filled in core.md}

## Research focus
{Any specific focus areas or exclusions the founder mentioned — or "broad"}

## Research tasks

### Task 1 — Market reality and size
Search for evidence that this is a real consumer category. Look for: App Store or Google Play category sizes and top apps, subreddit sizes and activity (a large, active subreddit is a market signal), consumer media coverage, Google Trends data mentions. The goal is not a TAM number — it's a signal that enough people care about this to form communities, download apps, or search for solutions.
Return: how active is the community around this problem, what platforms are people on, any size or scale signals.

### Task 2 — Buyer behavior
Find evidence of how consumers discover, evaluate, and decide to buy solutions in this space. Look for: Reddit threads asking "what do you use for X" or "best app for X", App Store reviews mentioning what triggered download or switch, blog posts or YouTube videos reviewing solutions in this space, social media communities and hashtags.
Return: how people discover solutions, what triggers them to try something new, what emotional or practical factors drive the decision, where the most active communities are.

### Task 3 — Pricing norms
Find pricing signals for consumer solutions in this space. Look for: competitor pricing pages, App Store pricing, Reddit discussions about what's worth paying for, reviews mentioning price.
Return: predominant pricing models (freemium / subscription / one-time / in-app), typical price points, any discussion of price sensitivity or what features justify paying.

### Task 4 — Trends
Find 2–3 relevant trends affecting this consumer space. Look for: recent consumer blog coverage, growth in related subreddits, viral content around the problem, app category growth signals.
Return: what's driving interest in this space right now, any behavioral or cultural shifts.

Source strategy: Tier 3 (Reddit, App Store, social communities) first for behavior signals, then Tier 1 and Tier 2 for size and category framing. Return findings organized by task. Include source URLs. Flag anything with a single source.
```

---

### Step 4 — Save raw research and review with the founder

Save the full web-researcher output to `startup/research/{YYYY-MM-DD}-market-research.md`:

```markdown
---
date: {today}
topic: Market research — {project name}
source_skill: market-research
---

# Research: Market landscape — {project name}

{Full web-researcher output}
```

Then present the findings conversationally — not as a data dump. Summarize each task's key takeaway in 1–2 sentences, then let the founder react:

> "Here's what the research turned up: [2-3 sentence narrative hitting the most interesting signals]. Does this match your intuition, or does anything here surprise you?"

If they push back or have context that contradicts a finding, note it — it'll go into **Open Questions**.

---

### Step 5 — Write startup/market-research.md

Once the founder has reacted (even briefly), write the file. No need to present a full draft first — just confirm the plan:

> "I'll save this as your market research file. You can update any of it as you learn more."

Write `startup/market-research.md` using this structure:

```markdown
---
version: 1
last_updated: {today}
type: b2b  # or b2c
status: draft
---

# Market Research — {Project Name}

## Market Overview

{What the research found about the category: how it's named, whether it's established or emerging, any size or growth signals. Be honest about confidence — "analyst coverage exists" vs. "no formal sizing found, but active community suggests real demand."}

## Customer Segments

{Distinct buyer groups identified — for B2B: by company size, industry, or trigger; for B2C: by use case intensity, demographic signal, or community.}

## Buying Behavior

{How buyers discover and evaluate solutions. For B2B: roles involved, evaluation criteria, deal cycle signals. For B2C: discovery channels, triggers, emotional drivers, communities.}

## Pricing Landscape

{Pricing models and ranges found. Flag if this is inferred from competitors vs. explicit category data.}

## Trends

{2–3 tailwinds or headwinds. Keep these concrete — "X is driving Y" rather than generic observations.}

## Key Sources

{3–5 most useful sources found — with URLs. These are the sources the founder can return to.}

## Open Questions

{Things the research didn't answer well, or things the founder flagged as surprising or uncertain. These become future interview questions or research tasks.}
```

---

## Step 6 — Produce the market brief

After `startup/market-research.md` is written:

1. **Read `startup/market-research.md`.**
2. **Write a condensed one-page summary** — plain language, no jargon, something the founder could show an advisor. Cover: is this a real market, who's in it, what they typically pay, and the one or two strongest tailwinds. Draw from the actual findings — no generic filler.

```markdown
---
date: {today}
source_skill: market-research
---

# Market Brief — {Project Name}

## The Market

{2–3 sentences: is this a real, named category? any size or growth signal found?}

## Who's In It

{1–2 sentences on the buyer segments — who feels this problem most acutely.}

## What They Pay

{1–2 sentences on pricing norms found — model and range.}

## Tailwinds

{The 1–2 most concrete trends making this a good time to be in this space.}
```

3. **Save to `startup/market-brief.md`**, overwriting if it exists.
4. **Deliver the exit handoff** — one specific observation from the findings, plus a forward-looking sentence. An example:

   > "You now have a market brief — [specific observation drawn from the research, e.g., 'the market is real and growing, but pricing is all over the place, which is actually an opportunity to stand out']. [One forward sentence: e.g., 'This gives you a grounded answer to the market size question, and the buying behavior findings go straight into your interview script.']"

5. **Invite feedback (first time only).** With `startup/market-brief.md` written, follow the Layer 0 *Feedback invites* protocol for stage `market-brief-done`: read `startup/.superpowers/feedback.md`, and unless the founder opted out, the tag is already recorded, or `FORM_ID` is still the placeholder, emit the invite tying it to the brief they just got, then append the ledger line. Deliver it as the final beat, after the exit handoff above.

---

## Completion criteria

- `startup/market-research.md` written with at least Market Overview, Buying Behavior, and Pricing Landscape sections populated (the others can be brief if research was thin)
- `startup/market-brief.md` written as a condensed one-pager
- Raw research saved to `startup/research/`
- The founder has seen and reacted to the findings

---

## What comes next

After the exit handoff, connect the findings forward:

- **Pricing findings → willingness-to-pay hypotheses** — if pricing signals emerged, they're direct inputs to `#willingness_to_pay` hypotheses
- **Buyer behavior → interview script** — how buyers discover and evaluate solutions shapes what to ask in interviews
- **Segment clarity → core.md** — if the research revealed the ICP more precisely, offer to update the Audience or ICP field

Let the founder decide where to go, or suggest checking `/whats-next` for the current plan.
