# Competitor Discovery

This reference file guides the competitor discovery process — building a research brief, dispatching web-researcher agents, reviewing results with the founder, and writing competitor files.

It is loaded by the `competitors` skill when a full discovery or landscape reassessment is needed. It is **not** a skill and should not be invoked independently.

---

## Context

You already have:
- `startup/core.md` — the project definition with seed description and whatever `## Core` fields are populated
- `startup/competitors/` — may be empty (first-time discovery) or already contain competitor files (reassessment)

## Goal

Discover or refresh the competitive landscape through structured web research and save findings as individual competitor files.

---

## First-time vs. reassessment

**If no competitors exist yet:** proceed to "Why this matters" below and deliver the framing before diving in.

**If competitors already exist:** skip the framing. Instead, briefly orient the founder:
- Note what's already saved (N direct, N indirect) and name them
- Frame this as looking for what's missing, what's changed, or what's emerged since the last look
- Carry the existing competitor list into the research brief so the agent doesn't resurface what's already known

Then proceed directly to Step 1.

---

## Why this matters — framing for the founder

*(First-time discovery only — skip if competitors already exist)*

Before diving into questions, frame the concrete output they'll walk away with:

> "We're building your competitive landscape map — a clear picture of who's already in this space, what they cover, and where your idea fits. By the end, you'll have something you can use to sharpen your pitch and shape your first customer conversations. Before we search, there are a few things I want to understand."

Then briefly frame why finding competitors is a good thing:

- **Competitors are validation.** If other people are building solutions for this problem, it confirms the problem is real and worth solving. An empty competitive landscape is often a warning sign, not an opportunity.
- **Understanding alternatives sharpens your pitch.** Once you know what's out there, you can articulate exactly why your approach is different — to customers, investors, and yourself.
- **The best startups aren't in empty markets.** They're in markets where existing solutions leave gaps. Finding those gaps is what this exercise is about.

Don't be apologetic about finding competitors — present it as useful intelligence. "Good news: there's clearly a market here. Let's see what's out there and figure out where you fit."

---

## The single most important rule

**Ask exactly one question at a time. Always.**

Do not stack questions. Do not ask a question and then add a follow-up in the same message. Do not list "a few things to think about." One question. Wait. Then respond.

---

## Competitor output format

The `web-researcher` agent is generic — it does not assume a competitor shape. **Every competitor dispatch below must include this output spec in its prompt**, so the agent returns the fields the competitor files need:

```
For each competitor, return:
### [Company Name]
- **URL:** https://...
- **Type:** direct / indirect
- **Maturity:** incumbent / scaleup / startup / unknown
- **Description:** One sentence on what they do and who they target.
- **Key Features:** 2–4 bullet points of notable capabilities
- **Differentiation note:** How they compare to our project — what overlaps, and where gaps exist.
- **Sources:** [source 1](url), [source 2](url)
- **Confidence:** High / Medium / Low (High = multiple independent sources; Low = single source, flag it)

End with a brief coverage summary: what you searched, any gaps, and whether you hit the exclusion criteria.
```

**Direct vs indirect** (include this guidance in the dispatch when relevant):
- **Direct:** Solves the same core problem for the same audience. A founder would evaluate these head-to-head.
- **Indirect:** Adjacent tool that could be adapted, or solves a related problem. Customers might consider these as partial substitutes or complements.

The briefs below reference this spec. Where a brief says "use the competitor output format above," include the block verbatim in the dispatch prompt (along with the maturity classification instructions in each brief).

---

## How to run the conversation

### Step 1 — Build the research brief (one question at a time)

Establish three things before dispatching any research. Ask them sequentially — one at a time, wait for the answer before asking the next.

**Question 1:** Known or new competitors

*First-time discovery:*
> "Are there any competitors you're already aware of? Names, URLs, or even vague references — anything helps."

*Reassessment (competitors already exist):*
> "Have you come across any new competitors since we last looked?"

**If they name competitors** — note them. These become the input for **Path A** below.

**If they have none / nothing new:**
- First-time → proceed with **Path B** (scout).
- Reassessment → skip Path B and Path A entirely. Go straight to **Step 4** (expansion) — the scout would just resurface already-documented players, so go straight to the deeper search for what's new or emerged.

**Question 2:** Focus areas
> "Are there specific aspects you want us to focus on — certain pricing models, integrations, target market segments, or features? Or should we keep the search broad for now?"

**Question 3:** Hard exclusions
> "Anything we should definitely exclude — certain company types, geographies, price points, or categories that aren't relevant?"

---

### Path A — Research what you know

*Take this path when the founder named competitors in Question 1.*

The founder already has a map. Don't run a scout that will resurface the same names. Instead, research what they know, fill it out properly, and then offer to expand.

**Confirm the approach:**

> "I'll research {those competitors} first, fill out their profiles, then we can decide if we want to look for more."

**Create any missing stubs:**

For each named competitor not already in `startup/competitors/`, create a stub file now (slug the name, set `type: direct` as default, use the URL if provided):

```markdown
---
type: direct
url: {url or "unknown"}
---

# {Name}

## Description

*To be filled in.*
```

**Dispatch the research as a background task:**

Send a single **background** Task call to the `web-researcher` agent so the conversation can continue while the search runs:

```
Research the following competitors for this project. For each, find their website, what they do, who they target, their key features, and how they compare to the project below.

## Project context
Name: {name}
Description: {seed_description}
{core fields from ## Core: audience/ICP, problem, solution, geography — include whatever is filled in core.md}

## Competitors to research
{list each named competitor with name and URL if known}

## Already documented (do not resurface)
{list any existing competitor files not in the research list, or "none"}

## Research brief
- Focus areas: {focus areas from Question 2, or "broad"}
- Hard exclusions: {exclusions from Question 3, or "none"}

Return results using the competitor output format below (include it in the dispatch). Classify each competitor's maturity using these tiers:
- incumbent — established/large: significant funding or revenue, large headcount, long in market, recognized brand
- scaleup — growing fast: Series A+ funding, moderate headcount, a few years in market
- startup — early: pre-seed/seed or bootstrapped, small team, recently launched
- unknown — signals insufficient to classify confidently

Base maturity on funding stage, founding year, headcount, and market presence (Crunchbase, LinkedIn, YC, press).

{include the "Competitor output format" spec from this reference here, verbatim}
```

**While the search runs — keep the conversation going:**

Don't wait in silence. Read the conversation so far and pick up a natural thread — something the founder mentioned about their vision, a feature they're excited about, a problem they kept coming back to. Continue that thread.

If there's no clear thread to pull, ask:

> "While we wait — what do you think makes your approach different from what's out there?"

Keep it to 1–2 exchanges. What the founder says here is useful: it'll inform the `## Notes` section of each competitor file, capturing their differentiation angle before the research anchors their thinking.

When the search result arrives, acknowledge it and move on to saving and reviewing.

**Save and present results:**

Save the raw output to `startup/research/{YYYY-MM-DD}-competitive-landscape-known.md`:

```markdown
---
date: {today}
topic: Known competitors research — {project name}
source_skill: competitors
---

# Research: Known competitors — {project name}

{Full web-researcher output}
```

Present the results as a compact summary — one sentence per competitor. Then ask:

> "Does this look right? Any of these mischaracterized, or any corrections to make?"

Apply any corrections. Then **write the competitor files** for this set (follow Step 6 format below), updating any stubs created above.

**Then proceed to Step 4 (expansion offer).**

---

### Path B — Scout the landscape

*Take this path when the founder said they don't know any competitors.*

**Confirm the brief:**

> "Got it. I'll do a quick scout first — find the top 2–3 direct and 2–3 indirect competitors so we can make sure we're looking in the right direction. Then we can go deeper if needed."

**Dispatch the scout as a background task:**

Send a single **background** Task call to the `web-researcher` agent so the conversation can continue while the search runs. Use a `fast` model to keep this lightweight.

```
You are doing a QUICK SCOUT of the competitive landscape for the following project.

## Project context
Name: {name}
Description: {seed_description}
{core fields from ## Core: audience/ICP, problem, solution, geography — include whatever is filled in core.md}

## Research task
Find the TOP 2–3 DIRECT competitors and TOP 2–3 INDIRECT competitors. Focus on the most prominent, well-known players — this is a quick landscape scan, not an exhaustive search.

- Direct: products solving the same core problem for the same audience
- Indirect: adjacent tools, different-approach-same-outcome products, or partial substitutes

## Research brief
- Already documented (do not resurface): {list existing competitor names, or "none"}
- Focus areas: {focus areas or "broad"}
- Hard exclusions: {exclusions or "none"}

For each competitor, also classify maturity as one of: incumbent (established/large — significant funding/revenue, large team, long in market), scaleup (growing — Series A+, moderate team, a few years in), startup (early — pre-seed/seed or bootstrapped, small team, recently launched), or unknown (signals insufficient). Base it on funding stage, founding year, headcount, and market presence.

IMPORTANT: Keep this focused. Return at most 3 direct + 3 indirect competitors. Stick to Tier 1 and Tier 2 sources — skip community/industry deep dives for now. Return results using the competitor output format below.

{include the "Competitor output format" spec from this reference here, verbatim}
```

**While the search runs — keep the conversation going:**

Don't wait in silence. Read the conversation so far and pick up a natural thread. If there's no clear thread, ask:

> "While we wait — what do you think makes your approach different from what's out there?"

Keep it to 1–2 exchanges. What the founder says will inform the `## Notes` section of each competitor file. When the search result arrives, acknowledge it and move to the review.

**Save scout research and review with the founder:**

Save the raw output to `startup/research/{YYYY-MM-DD}-competitive-landscape-scout.md`:

```markdown
---
date: {today}
topic: Competitive landscape scout — {project name}
source_skill: competitors
---

# Research: Competitive landscape scout — {project name}

{Full web-researcher output}
```

Present as a compact summary:

> **Direct competitors (N):** [Name 1], [Name 2], ...
> **Indirect competitors (N):** [Name 1], [Name 2], ...

Walk through each briefly — one sentence on what they do.

Then ask:

> "Does this look like the right landscape? Any of these off-base, or any obvious gaps — companies you expected to see?"

If the founder flags issues, adjust the brief and re-scout. Once confirmed, **save the scout results** (follow Step 6 format below).

**Then proceed to Step 4 (expansion offer).**

---

### Step 4 — Expand (optional)

Once the founder has confirmed the initial results (from either path), offer to go deeper:

> "I've saved those {N} competitors. Want me to do a deeper search for up to 5 more? This takes a bit more time and tokens — or we can stop here and come back to it later."

If the founder wants to expand, dispatch **one** Task call to the `web-researcher` agent:

```
You are EXPANDING a competitive landscape scan for the following project.

## Project context
Name: {name}
Description: {seed_description}
{core fields from ## Core: audience/ICP, problem, solution, geography — include whatever is filled in core.md}

## Already discovered
{list all competitors already saved — names and types, including any that existed before this session}

## Research task
Find UP TO 5 additional competitors (mix of direct and indirect) that were NOT already discovered. Go deeper: check community sources (Reddit, Hacker News), niche directories, and industry publications. Look for smaller or newer entrants that a quick search might miss.

## Research brief
- Focus areas: {focus areas or "broad"}
- Hard exclusions: {exclusions or "none"}

For each competitor, also classify maturity as one of: incumbent (established/large — significant funding/revenue, large team, long in market), scaleup (growing — Series A+, moderate team, a few years in), startup (early — pre-seed/seed or bootstrapped, small team, recently launched), or unknown (signals insufficient). Base it on funding stage, founding year, headcount, and market presence.

IMPORTANT: Do NOT repeat competitors already listed above. Return at most 5 new findings. Return results using the competitor output format below.

{include the "Competitor output format" spec from this reference here, verbatim}
```

Save the raw findings to `startup/research/{YYYY-MM-DD}-competitive-landscape-expansion.md`:

```markdown
---
date: {today}
topic: Competitive landscape expansion — {project name}
source_skill: competitors
---

# Research: Competitive landscape expansion — {project name}

{Full web-researcher output}
```

Present the new findings the same way as before. Ask the founder to confirm which to keep. If they flag more gaps, dispatch targeted follow-ups — but default to wrapping up. The goal is a useful landscape, not an exhaustive one.

---

### Step 5 — Write the files

For each kept competitor (from either path):

1. **Derive the slug:** lowercase the name, replace spaces and non-alphanumeric characters with hyphens, collapse multiple hyphens. Examples: "Notion AI" -> `notion-ai`, "G2.com" -> `g2-com`.

2. **Write `startup/competitors/{slug}.md`** with this structure:

```markdown
---
type: direct
url: https://example.com
maturity: incumbent
---

# {Name}

## Description

{What the company does and who it targets — 2-3 sentences.}

## Core Features

- {Feature 1}
- {Feature 2}
- {Feature 3}

## Notes

{How they compare to the project: overlaps, gaps, differentiation angle. Include founder comments if any were made during review.}
```

Use `type: direct` or `type: indirect` in the frontmatter. The `url` is the competitor's main website. Set `maturity` to the value the agent returned (`incumbent`, `scaleup`, `startup`, or `unknown`) — omit the field or use `unknown` when the agent couldn't classify it confidently.

If a stub file already exists for this competitor, **overwrite it** with the full researched content — don't create a duplicate.

---

## Step 6 — Produce the competitive landscape map

After all competitor files are written and the founder has confirmed the set:

1. **Read all files** in `startup/competitors/` (skip any with `status: archived`).
2. **Build the map** — a markdown table followed by a positioning paragraph:

```markdown
---
date: {today}
source_skill: competitors
---

# Competitive Landscape — {Project Name}

| Competitor | Type | Maturity | What they do | What they miss | URL |
|---|---|---|---|---|---|
| {Name} | direct | incumbent | {one sentence} | {one sentence} | {url} |
| {Name} | indirect | startup | {one sentence} | {one sentence} | {url} |

## Positioning

{2–3 sentences: what the market currently serves well, what gap exists, where the founder's idea fits in that gap. Drawn from the actual competitor files — not a template.}
```

3. **Save to `startup/competitive-landscape.md`**, overwriting if it already exists.
4. **Deliver the exit handoff** — one specific observation from the actual content, plus a forward-looking sentence:

   > "You now have a competitive landscape map — [specific observation, e.g., 'everyone in this space targets enterprises, and nobody is serving the self-serve segment you're going after']. Your customer conversations can now include 'have you tried X?' questions, and you have a concrete differentiation point to articulate."

5. **Offer the user-feedback pass (opt-in).** Once the landscape is confirmed, offer to mine what real users say about these competitors:

   > "Want me to mine what real users say about these {N} competitors? I'll scan review sites and community threads and pull out what users love, complain about, and wish existed — per competitor. It's more time- and token-intensive than this scan, but it's strong fuel for positioning and interview prompts. Or we can skip it and come back later."

   If the founder accepts, load `references/user-feedback.md` and follow it for the confirmed set. If they skip, leave it as a natural next step they can return to.

6. **Invite feedback (first time only).** The founder has just received their competitive landscape — a high-value moment. As the final beat of the close, follow the Layer 0 *Feedback invites* protocol for stage `competitors-done`: read `startup/.superpowers/feedback.md`, and unless the founder opted out, the tag is already recorded, or `FORM_ID` is still the placeholder, emit the invite tying it to the landscape they just got, then append the ledger line. If the user-feedback pass in item 5 is running, deliver this after that exchange settles so it remains the last beat.

---

## Completion criteria

- Competitor files written to `startup/competitors/`
- The founder has reviewed and confirmed the set
- `startup/competitive-landscape.md` written with table + positioning paragraph

---

## What comes next

After the exit handoff, mention natural next steps without pushing:
- **User-feedback mining** — if the founder skipped the opt-in pass above, it stays available: mine review sites and communities for what users love, complain about, and wish existed per competitor (`references/user-feedback.md`)
- **Hypothesis exploration** — if not done yet, the landscape informs the key assumptions worth testing
- **Interview scripts** — competitor awareness shapes what to ask customers ("have you tried X? what was missing?")
