# Idea Elaboration: B2C Painkiller

This reference file contains instructions for elaborating a consumer (B2C) idea that addresses a clear pain — a problem people actively experience and want solved.

It is loaded by the `whats-next` skill's initialization workflow after scaffolding is complete. It is **not** a skill and should not be invoked independently.

---

## Context

You already have:
- `seed_description` — the founder's initial idea description
- `project_name` — the working name chosen during init
- `startup/core.md` — already written with `version` and `name` in frontmatter, `## Seed Description` populated, and an empty `## Core` section

## Goal

Help the founder articulate, with precision:
- **Who** the product is for (target audience)
- **What pain** they experience (the problem)
- **How** the product solves it (the solution)
- **Where** they plan to launch first (geography) — if relevant

This is the most foundational piece of context. Everything downstream — competitor discovery, validation, MVP scope — builds on it. Vague answers here cost time later.

---

## How to run the conversation

**Opening:** Briefly acknowledge the seed description and project name. Then frame the conversation with its concrete output:

> "Let's build a clear picture of your idea — by the end, we'll have something that shows how it reads to someone who doesn't know it yet. That's useful for sharing, but also as a baseline to revisit as the idea evolves. Before we dig in, there are a few things I want to understand."

Then ask your first question.

**Style:**
- Be concise and direct
- Be supportive but challenging: push back on vague or unrealistic claims
- Use a concrete counter-example when the answer is too broad (e.g., "You said 'busy people' — can you describe one specific person who would use this tomorrow?")
- Acknowledge good thinking briefly, then keep moving
- Don't be afraid to say "that's still a bit broad" or "how do you know that's true?"
- The founder is in charge — if they push back after you've challenged them once, accept it and move on

**What good looks like:**

- **Audience:** Specific enough to find these people. "Freelance designers who invoice clients monthly and forget to follow up" — not "creative professionals."
- **Problem:** A real pain, not a feature wish. "They lose track of unpaid invoices and feel awkward chasing clients, leading to late or missing payments" — not "invoicing is annoying."
- **Solution:** How the product specifically addresses the pain. "Automated, polite follow-up sequences that go out without the founder having to think about it" — not "an invoicing app with reminders."

---

## Geography question

Once the audience, problem, and solution are reasonably clear, ask about launch geography — but only if it's relevant. Geography matters when:
- The product addresses local regulations, languages, or markets
- The competitive landscape varies significantly by region
- The founder's network or distribution is geographically constrained

Ask something like:
> "Where are you planning to launch first? Is this a global product from day one, or are you targeting a specific country or region to start?"

If the answer is "global" or "it doesn't matter," that's fine — note it and don't push.

---

## When you have enough clarity

Once you have a solid understanding of at least audience and problem (solution and geography can be rougher):

1. **Reflect back** what you heard — summarize each dimension in your own words so the founder feels heard and can correct anything.
2. **Propose the fields** — show concretely what you'd add under `## Core`:

```markdown
- **Audience:** ...
- **Problem:** ...
- **Solution:** ...
- **Geography:** ...
```

   Omit any field you don't have good clarity on — it's fine to leave **Solution** or **Geography** out if they're still uncertain.

3. **Ask for confirmation** — "Does this capture it accurately? I can adjust anything before saving, but we can always modify this later on."
4. **On confirmation**, read `startup/core.md`, add or update these fields as `- **Key:** Value` list items under the `## Core` section, and write the file back. Leave the frontmatter and `## Seed Description` untouched.
5. **Produce the pitch mirror.** Read the `## Core` fields you just saved. Write 2–3 sentences showing how the idea reads to an outsider — honest and specific, not marketing copy. Then read `startup/core.md` again and append a `## How It Reads` section after `## Core`, write the file back.
6. **Deliver the exit handoff** — one observation specific to this idea, plus a forward-looking sentence. An example:

   > "You now have a clear picture of your idea from the outside — [one specific observation, e.g., 'it reads as a solution to an emotional problem more than a logistical one']. This is your baseline: as you learn more from customers and competitors, you'll see exactly where this framing holds up and where it needs sharpening."

---

## Completion criteria

- `startup/core.md` has **Audience** and **Problem** entries under `## Core`
- `startup/core.md` has a `## How It Reads` section with 2–3 outsider-facing sentences
- The founder has confirmed the definitions

---

## What comes next

After this is complete, the initialization workflow will propose the first plan — a short set of next steps based on what's been defined so far.
