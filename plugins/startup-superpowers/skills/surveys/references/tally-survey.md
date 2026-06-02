# Tally Survey Deployment

This reference file handles deploying a survey to Tally — creating the form via the Tally MCP, retrieving the shareable link, and updating the survey file with the live form details.

It is loaded by the `surveys` skill when the founder wants to activate a survey in Tally: either immediately after the `initial-survey-questions` workflow, or standalone when an existing `questions-only` survey is ready to deploy. It is **not** a skill and should not be invoked independently.

---

## Context

You already have:
- A survey file at `startup/surveys/{slug}.md` with `mode: questions-only` and a complete `## Questions` section
- The founder's confirmed question set, distribution plan, and respondent value prop

## Goal

Create a live Tally form from the existing question set, retrieve the public shareable URL, and update the survey file to reflect the active deployment.

---

## The single most important rule

**Ask exactly one question at a time. Always.**

Do not stack questions. Do not ask a question and then add a follow-up in the same message. One question. Wait. Then respond.

---

## How to run the workflow

### Step 1 — Check Tally MCP configuration

Check whether the Tally MCP is available. The Tally MCP is configured when:
- `TALLY_API_KEY` is set in the environment, **or**
- The Tally MCP server (`https://api.tally.so/mcp`) is connected in the current session

If not configured, stop here and provide setup instructions:

---

**To connect Tally:**

1. **Get an API key:**
   - Log into your Tally account at [tally.so](https://tally.so)
   - Go to **Settings → API Keys**
   - Create a new API key and copy it

2. **Add the Tally MCP to Claude Code:**
   ```bash
   claude mcp add --transport http tally https://api.tally.so/mcp --header "Authorization: Bearer YOUR_API_KEY"
   ```
   Replace `YOUR_API_KEY` with the key you just copied.

3. **Verify it's connected:**
   ```bash
   claude mcp list
   ```
   You should see `tally` in the list.

> **Note:** Tally's UI and API change occasionally. If these steps don't match what you see or something isn't working, let me know and I'll look up the current instructions.

Once you've done this, come back and I'll create the survey.

---

If the founder says the steps didn't work or something looks different in the Tally UI, do a web search for current Tally MCP or API setup instructions before retrying — Tally's UI and API surface change and the instructions here may be stale.

If configured, proceed to Step 2.

### Step 2 — Confirm the question source

Identify which survey to deploy:

- If arriving from `initial-survey-questions.md`: the question set is already confirmed — proceed with those questions.
- If entering standalone: ask which survey to activate if multiple `questions-only` surveys exist. Load the file and show the question set:

  > "Here are the questions from '{Survey Title}'. Ready to create this in Tally?"

  Wait for confirmation.

### Step 3 — Map questions to Tally block types

Before creating the form, map each question to the appropriate Tally block type:

| Question annotation | Tally block type |
|---|---|
| `multiple choice` | `MULTIPLE_CHOICE` |
| `rating scale` | `LINEAR_SCALE` |
| `open-ended` | `TEXTAREA` |
| `yes/no` | `MULTIPLE_CHOICE` with two options |
| `short text` | `INPUT_TEXT` |

### Step 4 — Create the survey in Tally

Use the Tally MCP to create the form. The form should include:

- A title derived from the survey's H1 heading
- All questions in order, with correct block types and options
- A closing screen that includes the respondent value prop from `## Distribution Plan` (e.g., "We'll share the results back with everyone who completes this survey" or a link to the MVP/waitlist)

If the Tally MCP `create_form` call fails, report the error verbatim and suggest checking the API key or retrying.

### Step 5 — Retrieve and display the shareable URL

Get the public Tally form URL from the API response (format: `https://tally.so/r/{formId}`).

Display it clearly:

> "Your survey is live:
> **{tally_url}**
>
> Copy this link and post it to the channels in your distribution plan."

### Step 6 — Update the survey file

Read the existing survey file. Update the frontmatter:

```yaml
status: active
mode: tally
tally_form_id: {formId from API response}
tally_url: https://tally.so/r/{formId}
```

Leave all other frontmatter fields and all sections unchanged.

Propose the updated frontmatter before writing. Get confirmation. Write the file back.

After writing: "Updated `startup/surveys/{slug}.md` — status is now `active`."

### Step 7 — Close and hand off

Remind the founder of the two things that matter now:

1. **Post the link** — to the distribution channels in the survey file; the survey only generates signal if it reaches the right audience
2. **Check back** — when they want to see how it's going, they can ask: "How is the [survey name] survey going?" and the agent will fetch the current response count from Tally

Optional: if `startup/interviews/*.md` is sparse (fewer than 5 interviews), suggest running interviews in parallel — surveys and interviews answer different questions and the combination is stronger than either alone.

---

## Completion criteria

- Tally form created successfully
- Public URL retrieved and displayed to founder
- `startup/surveys/{slug}.md` updated with `tally_form_id`, `tally_url`, `status: active`, `mode: tally`
- Founder confirmed the file update

---

## What comes next

- **Post the link** to every channel in the Distribution Plan — this is on the founder
- **Run interviews in parallel** — qualitative and quantitative together give the strongest signal
- **Check results** — when the founder asks how the survey is going, the agent fetches the current Tally submission count and any available aggregate data
- **Analyze results** — once enough responses are in, the agent will be able to dispatch a survey analyst to map responses to hypotheses and suggest state updates (coming in a future update to this skill)
