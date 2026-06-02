---
name: surveys
description: Manages the founder's survey-based validation — crafting the right questions, deploying a survey to the internet, and analyzing results against hypotheses. Use when the founder wants to run a survey, create survey questions, validate hypotheses at scale, check how a survey is going, understand whether a survey is the right tool right now, or deploy a question set to get quantitative signal. Also bring this up if you believe that creating a survey to collect quantitative evidence may be useful at this point.
---

# Surveys

Help the founder use surveys as a quantitative validation layer — to confirm patterns found in interviews, prioritize among competing hypotheses, or reach people they can't interview one-on-one.

Surveys are powerful when they're targeted, short, and posted somewhere with the right audience. They're much weaker when deployed before any qualitative discovery, when the distribution channel is vague, or when the questions fish for validation instead of testing assumptions. Part of this skill's job is to help the founder assess fit before building anything.

This skill covers two modes:

1. **Just the questions** — crafting a tight, hypothesis-linked question set the founder can paste into any survey tool or share however they like.
2. **Active Tally mode** — creating the survey in Tally via the Tally MCP, returning a shareable link, and later fetching and analyzing results.

---

## Before you start

Read `startup/core.md` to load project context.

Check prior qualitative work: scan `startup/hypotheses/` and `startup/interviews/`. It is sometimes ok to go for a survey without doing interviews, especially if the user knows and/or has access to a good channel to distribute the survey to aquire diverse responses. Procceeding to survey without hypotheses is not recommended. If no hypotheses present, invoke the `hypotheses` skill and strongly suggest the user to talk about them first.

Scaffold the surveys folder if it doesn't exist yet:
```bash
mkdir -p startup/surveys
```

---

## Applicability assessment

Use judgment when assessing whether surveys make sense right now. This is advisory — never a gate.

**Good signals:**
- The founder has run at least a few interviews (surveys confirm patterns, they rarely discover them)
- There are untested or partially-tested hypotheses that quantitative signal would clarify
- The founder has (or can reach) a channel with a relevant, targetable audience

**Caution signals — raise these, don't block:**
- No interviews done yet: surveys without prior qualitative discovery often surface misleading signal — people answer what sounds good, not what they actually do
- No identified distribution channel: a well-crafted survey shared with the wrong audience (or no audience) is wasted effort
- The idea is still being shaped: surveys freeze assumptions; if core.md is still in flux, hypothesis-testing surveys may be premature

If the founder insists on a survey despite caution signals, help them build a good one. The goal is to inform, not gatekeep.

---

## When no surveys exist

Share a brief applicability assessment (2–3 sentences): what's looking solid, what the risk is, whether this is a good moment for surveys. Then ask if they'd like to proceed.

If proceeding, load the reference file:

```
.claude/skills/surveys/references/initial-survey-questions.md
```

The reference file's instructions take over from this point.

---

## When surveys already exist

Load and read the relevant files for context. Infer intent from the conversation — don't mechanically ask "what do you want to do?" If the founder is:

- **Reviewing or editing a survey** — load the file, discuss, propose the specific changes, get confirmation, write back
- **Adding a new survey** — load `initial-survey-questions.md`
- **Activating a questions-only survey in Tally** — load the relevant survey file to confirm the question set, then load:
  ```
  .claude/skills/surveys/references/tally-survey.md
  ```
- **Checking results or asking how a survey is going** — for now, fetch the Tally submission count via the Tally MCP if configured and share a quick status. Full results analysis workflow (dispatching the `survey-analyst` subagent) is coming in a later version of this skill.
- **Archiving a survey** — read the file, set `status: archived`, propose the change, get confirmation, write back

When adding or updating surveys, follow these file conventions:

**File location:** `startup/surveys/{YYYY-MM-DD}-{short-descriptor}.md`

**Slug convention:** lowercase, replace spaces and non-alphanumeric characters with hyphens, collapse multiples. "Invoice chasing validation" → `invoice-chasing-validation`.

**Frontmatter:**
```yaml
---
status: draft|ready|active|closed|archived
mode: questions-only|tally
date_created: YYYY-MM-DD
target_persona: One-line segment descriptor
hypothesis_slugs:
  - slug-one
  - slug-two
response_goal: 30
tally_form_id: abc123          # tally mode only — omit if questions-only
tally_url: https://tally.so/r/abc123  # tally mode only — omit if questions-only
---
```

**Required sections:**
- `## Purpose` — why this survey exists and what decisions it will inform
- `## Target Audience` — who should fill it out, response goal, and why that sample size
- `## Distribution Plan` — where to post it and what value is offered to respondents
- `## Questions` — numbered list with question type annotated

**Optional sections:**
- `## Notes` — founder comments, links to related interviews, context for later
- `## Results` — populated after fetching Tally data

Read before writing, propose before saving, get confirmation.

---

## After saving a survey

Briefly confirm: "Saved to `startup/surveys/{slug}.md`."

Mention natural next steps without pushing:
- If `mode: questions-only` — when ready, the agent can deploy to Tally and return a shareable link
- If `mode: tally` and `status: active` — remind the founder they can ask "how's the survey going?" at any time
- Triangulating with interviews tends to give the strongest signal: survey results show what, interviews show why
