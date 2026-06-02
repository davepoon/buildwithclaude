# Idea Elaboration: B2B Painkiller

This reference file contains instructions for elaborating a business-to-business (B2B) idea that addresses a clear organizational pain — a problem companies actively experience and want solved.

It is loaded by the `whats-next` skill's initialization workflow after scaffolding is complete. It is **not** a skill and should not be invoked independently.

---

## Context

You already have:
- `seed_description` — the founder's initial idea description
- `project_name` — the working name chosen during init
- `startup/core.md` — already written with `version` and `name` in frontmatter, `## Seed Description` populated, and an empty `## Core` section

## Goal

Help the founder articulate, with precision:
- **Who** the product is for — the ideal customer profile (ICP): what kind of company, what size, what industry
- **Who buys** vs. **who uses** — the buyer (signs the contract, holds budget) vs. the end user (uses it daily); these are often different people
- **What business pain** they experience — framed as cost, risk, inefficiency, compliance burden, or missed revenue
- **How** the product solves it — the solution direction
- **Where** they plan to launch first — geography, if it affects the competitive landscape

This is the most foundational piece of context for everything downstream. Competitor discovery, validation, and pricing all depend on a crisp ICP and problem statement. Vague answers here cost time later.

---

## How to run the conversation

**Opening:** Briefly acknowledge the seed description and project name. Then frame the conversation with its concrete output:

> "Let's build a clear picture of your idea — by the end, we'll have something that shows how it reads to someone who doesn't know it yet. That's useful for sharing with advisors or potential customers, but also as a baseline to revisit as the idea evolves. Before we dig in, there are a few things I want to understand."

Then ask your first question — typically something like "Who specifically is experiencing this problem today — what kind of company, and what role?"

**Style:**
- Be concise and direct
- B2B problems are often framed as inefficiency, compliance risk, revenue loss, or competitive disadvantage — help the founder find the right framing when they describe it as a generic pain
- Push back on overly broad ICPs like "all companies" or "any SMB" — ask what industry or function feels most acute
- The buyer/user distinction is critical: press on it if the founder conflates the two ("who actually signs the contract?" vs. "who opens the app every day?")
- Use concrete counter-examples ("You said 'mid-market' — can you describe the last company that would have paid for this?")
- Acknowledge good thinking briefly, then keep moving
- The founder is in charge — if they push back after you've challenged them once, accept it and move on

**What good looks like:**

- **ICP company size:** "Series A–C SaaS companies, 50–300 employees" — not "startups and scale-ups."
- **ICP industry:** "B2B SaaS companies selling to enterprise, where compliance documentation slows down sales cycles" — not "technology companies."
- **Buyer role:** "VP of Sales or CRO — whoever owns the revenue number and is measured on deal velocity" — not "sales leadership."
- **End user role:** "Account executives who fill in the compliance questionnaires manually today" — not "the sales team."
- **Problem:** "Responding to security questionnaires takes AEs 4–6 hours per deal and delays close by 2–3 weeks, costing pipeline velocity" — not "compliance is slow."
- **Solution:** "AI that auto-fills questionnaires from a pre-approved knowledge base, cutting response time to under 30 minutes per deal" — not "a tool to speed up compliance."

---

## Geography question

Once the ICP, buyer/user split, and problem are reasonably clear, ask about launch geography — but only if it's relevant. Geography matters when:
- Regulations, data residency laws, or compliance frameworks vary by region (e.g., GDPR in Europe, SOC 2 in the US)
- The competitive landscape differs significantly by market
- The founder's existing network or partnerships are geographically concentrated

Ask something like:
> "Where are the companies you're targeting primarily based? Are you starting in a specific market, or going global from day one?"

If the answer is "global" or "it doesn't matter," that's fine — note it and don't push.

---

## When you have enough clarity

Once you have a solid understanding of at least ICP and problem (buyer/user distinction and solution can be rougher):

1. **Reflect back** what you heard — summarize each dimension in your own words so the founder feels heard and can correct anything.
2. **Propose the fields** — show concretely what you'd add under `## Core`:

```markdown
- **ICP Company Size:** ...
- **ICP Industry:** ...
- **Buyer Role:** ...
- **End User Role:** ...
- **Problem:** ...
- **Solution:** ...
- **Geography:** ...
```

   Omit any field you don't have good clarity on — it's fine to leave **Solution**, **End User Role**, or **Geography** out if they're still uncertain.

3. **Ask for confirmation** — "Does this capture it accurately? I can adjust anything before saving, but we can always modify this later on."
4. **On confirmation**, read `startup/core.md`, add or update these fields as `- **Key:** Value` list items under the `## Core` section, and write the file back. Leave the frontmatter and `## Seed Description` untouched.
5. **Produce the pitch mirror.** Read the `## Core` fields you just saved. Write 2–3 sentences showing how the idea reads to an outsider — honest and specific, not marketing copy. Focus on the business pain, who it hits, and what the solution does. Then read `startup/core.md` again and append a `## How It Reads` section after `## Core`, write the file back.
6. **Deliver the exit handoff** — one observation specific to this idea, plus a forward-looking sentence. An example:

   > "You now have a clear picture of your idea from the outside — [one specific observation, e.g., 'it reads as a compliance risk play rather than an efficiency tool — that framing is stronger for enterprise buyers']. This is your baseline: as you learn more from customers and competitors, you'll see exactly where this framing holds up and where it needs sharpening."

---

## Completion criteria

- `startup/core.md` has **ICP Company Size** (or **ICP Industry**) and **Problem** entries under `## Core`
- `startup/core.md` has a `## How It Reads` section with 2–3 outsider-facing sentences
- The buyer/user distinction has been discussed, even if the roles end up being the same person
- The founder has confirmed the definitions

---

## What comes next

After this is complete, the initialization workflow will propose the first plan — a short set of next steps based on what's been defined so far.
