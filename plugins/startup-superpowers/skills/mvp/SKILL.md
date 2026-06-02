---
name: mvp
description: Guides the founder through designing and optionally building the simplest MVP or prototype that validates their current hypotheses. Use when the founder wants to build something to test assumptions, discusses what to build next, wants to interpret results from a live MVP, or is deciding whether the current approach is still right. Also use when a founder proposes something to build — the skill will check whether the proposed form is the simplest thing that generates honest signal.
---

# MVP / Prototype

Help the founder figure out the simplest thing worth building to validate their remaining assumptions — and optionally scaffold and deploy it.

The central job of this skill is to be a principled counterweight to over-engineering. Most founders want to build more than they need to test what they don't yet know. This skill reads what's been validated, identifies the riskiest untested assumptions, and argues for the form of MVP that generates honest signal with the least build effort.

Two modes:

1. **Design conversation** — structured dialogue that produces `startup/mvp-plan.md`: what to build, why this form, which hypotheses it tests, and what success looks like
2. **Scaffold and deploy** — optional Layer 2 reference that writes code to the project root and deploys using Vercel MCP, Supabase MCP, and the v0 Platform API

---

## Before you start

Read `startup/core.md` and scan `startup/hypotheses/` to understand what's been established and what's still untested. Check `startup/interviews/` and `startup/surveys/` for evidence gathered so far. No directory scaffolding is needed — `startup/` is created during project initialization.

---

## When no `startup/mvp-plan.md` exists

Load the reference file that runs the design conversation:

```
.claude/skills/mvp/references/initial-mvp-design.md
```

The reference file's instructions take over from this point.

---

## When `startup/mvp-plan.md` exists

Read it for context. Infer intent from the conversation — don't ask "what do you want to do?"

**If the founder is discussing results or what they're seeing:**
Handle inline. Read the plan to understand what was built, what hypotheses were being tested, and what the success criteria were. Also check `startup/interviews/` and `startup/surveys/` for any evidence collected since the MVP launched — this context informs the assessment. Ask what they're seeing — numbers, anecdotes, surprises. Compare against the success criteria and give a frank read:

- **Confirmed** — signal clearly supports the hypothesis; route updates through the `hypotheses` skill
- **Contradicted** — signal clearly runs against it; route updates through the `hypotheses` skill
- **Inconclusive** — make the distinction explicit: "the hypothesis is probably wrong" is different from "the experiment didn't reach the right audience or ran too short." The first warrants invalidating the hypothesis; the second warrants redesigning the experiment, not changing hypothesis state.

Update the `## Experiments Log` in `mvp-plan.md` with what was learned (dated entry). If the plan needs to evolve, propose changes and get confirmation before writing back.

**If the founder wants to iterate or pivot the experiment:**
Discuss what's changed. Propose what the next experiment should look like. Before overwriting the plan, move the current success criteria and outcome into the `## Experiments Log` as a completed entry. Then update `## What We're Building`, `## Why This Form`, `## Hypotheses Being Tested`, `## Success Criteria`, and `## Distribution Plan` with the new experiment. Propose the full updated content before writing. Get confirmation.

**If the founder wants to scaffold and deploy:**
- `status: ready` and a deployable form (landing page, demo, simple app) → load:
  ```
  .claude/skills/mvp/references/scaffold-and-deploy.md
  ```
- `status: designing` → suggest finishing the design conversation first; offer to continue it
- `status: live` → ask whether they want to redeploy or add something new; if yes, load the scaffold reference

**If a founder proposes building something without a prior design conversation:**
Read the existing hypotheses. Brief honest check (2–3 sentences): is the proposed form the simplest thing that would test the riskiest untested assumptions? Share the assessment before proceeding — not a gate, just an informed nudge.

**If the founder wants to archive:**
Archiving marks this MVP track as closed — the plan remains for reference but is no longer the active experiment. Read the file. Set `status: archived`, `last_updated: today`. Add a final log entry summarising the experiment outcome. Propose changes, get confirmation, write back.

---

## After saving `startup/mvp-plan.md`

Briefly confirm: "Saved to `startup/mvp-plan.md`."

Mention natural next steps without pushing:
- `status: ready` and deployable form → "Ready to scaffold and deploy — just say the word"
- `status: live` → "When you have results, come back and we'll assess them against the success criteria"
- Running interviews or surveys in parallel often produces richer validation than the MVP alone
