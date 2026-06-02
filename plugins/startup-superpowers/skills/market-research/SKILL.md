---
name: market-research
description: Manages the founder's market understanding — running initial market research, updating findings, and answering questions about market size, customer segments, buying behavior, pricing benchmarks, and industry trends. Use when the conversation touches market size (TAM/SAM/SOM), who the buyers are and how they make decisions, what people typically pay, industry tailwinds or headwinds, or when the founder wants to understand the broader landscape their idea sits in.
---

# Market Research

Help the founder understand the market they're entering — whether it's real, who's in it, how buyers behave, and what they expect to pay. This context strengthens interviews, sharpens hypotheses, and gives the founder a confident answer to "what's the market opportunity?"

## Before you start

Read `startup/core.md` to load project context (name, seed description, type of business — B2B or B2C — and all fields under `## Core`).

Check if `startup/market-research.md` exists.

---

## When market research already exists

Load it for context. Infer intent from the conversation — don't ask "what do you want to do?" If the founder is:

- **Asking about a specific dimension** (size, segments, pricing, trends) — answer from the existing file; if the file is thin on that dimension, offer to run targeted research to fill it in
- **Wanting to update a section** — read the file, discuss the new information, propose the change, get confirmation, write it back. Update `last_updated` in frontmatter
- **Flagging the research as stale** — set `status: needs-refresh` in frontmatter and offer to re-run the full research or a targeted pass on specific sections
- **Wanting web research on a specific topic** — dispatch the `web-researcher` agent (fast model) with a focused prompt about that market dimension; incorporate findings into the relevant section; save the full output to `startup/research/{YYYY-MM-DD}-{topic-slug}-research.md` with frontmatter `date`, `topic`, and `source_skill: market-research`
- **Asking how market research connects to hypotheses** — surface which findings in the file could confirm or challenge existing hypotheses, and suggest updating hypothesis status or Notes accordingly

When updating the file, follow the format conventions:
- YAML frontmatter with `version` (number), `last_updated` (ISO date), `type` (`b2b` or `b2c`), and `status` (`draft`, `complete`, or `needs-refresh`)
- H1 heading: `Market Research — {Project Name}`
- Sections: Market Overview, Customer Segments, Buying Behavior, Pricing Landscape, Trends, Key Sources, Open Questions

Read before writing, propose before saving, get confirmation.

---

## When no market research exists

Load the reference file for the guided first-time workflow:

```
.claude/skills/market-research/references/initial-market-research.md
```

The reference file's instructions take over from this point.

---

## Ad-hoc web search vs. dispatching web-researcher

Not every web question needs a subagent:

- **Inline `WebSearch` / `WebFetch` (you, the main agent):** single-fact lookups ("what does Pendo charge?", "is ACME still active?"), quick verification of a claim the founder made, one data point asked about in flow. Stays in conversation, no persistence needed.
- **Dispatch `web-researcher`:** multi-source passes that benefit from an isolated context (scanning pricing across a whole category, surveying buyer-behavior signals across communities, structured landscape passes). Output is structured and gets saved to `startup/research/{YYYY-MM-DD}-{topic-slug}-research.md` for later reference.

Rough rule: one fact in flow → inline. Multi-source or results-should-persist → dispatch.
