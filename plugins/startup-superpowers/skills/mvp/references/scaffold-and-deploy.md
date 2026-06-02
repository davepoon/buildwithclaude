# Scaffold and Deploy

This reference file handles the technical build and deployment of an MVP. It reads from `startup/mvp-plan.md`, gets the thing into the hands of the audience named in `## Distribution Plan`, and updates the plan with what was built and where it lives.

It is loaded by the `mvp` skill when the founder wants to deploy a landing page, clickable demo, or simple web app. It is **not** a skill and should not be invoked independently.

**This reference only applies to deployable MVP forms** — landing page, clickable demo, simple web app, or whatever else the honest experiment calls for. Wizard of Oz and Concierge MVPs are manual by design and do not use this reference.

---

## Context

You already have:
- `startup/mvp-plan.md` with `status: ready`, a clear scope in `## What We're Building`, a distribution plan in `## Distribution Plan`, and measurable `## Success Criteria`
- `startup/core.md` with the product name and problem

## Goal

Get the MVP in front of people. In most cases that means code in the project root and a live URL — but if the honest experiment is a Tally form or a Notion page, the goal is the same: the thing exists, it reaches the audience, and the instrumentation captures what the success criteria measure. Update `startup/mvp-plan.md` with whatever was built and where it lives.

---

## Capabilities

These are the tools available in this environment. Reach for the one that fits the MVP form — not the other way around.

- **Vercel MCP** — web deploys, returns a live URL. Check with `claude mcp list`. If missing:
  ```bash
  claude mcp add --transport http vercel https://mcp.vercel.com
  ```
  Authenticate with a Vercel account when prompted.

- **Supabase MCP** — lightweight backend for signup capture, simple data persistence, auth. Check with `claude mcp list`. If missing and the MVP needs it:
  ```bash
  npx add-mcp https://mcp.supabase.com/mcp
  ```
  Authenticate via OAuth when prompted.

- **v0 Platform API** — UI generation from a prompt. Check for `V0_API_KEY` in env. Optional; the agent can scaffold manually otherwise.

- **Agent-scaffolded code** — the agent writes whatever stack fits the MVP. Current-stable Next.js + Tailwind is a reasonable default for web-shaped things, but Python/Flask, a static HTML page, a Streamlit app, an LLM-powered workflow, etc. are all on the table when the MVP shape calls for them.

- **No-code options worth knowing about** — Tally or Typeform for pure data capture, a Notion page for simple landing content, Airtable or Google Forms for concierge-style backends, Figma or v0 for clickthrough prototypes. These don't need Vercel; if one of them is the right tool, point the founder at it and help them wire it up.

Keep the `claude mcp add …` commands verbatim when instructing the founder — they're environmental facts, not things to paraphrase.

---

## Principles

- **Single page is usually enough.** No navigation, no footer links, no fabricated social proof.
- **Instrumentation is tied to success criteria.** If the criteria mention signups, capture signups. If they mention clicks or conversions, add lightweight analytics. If the criteria don't name anything measurable, push back during design — don't instrument for vanity.
- **Match the form to what's being tested.** Willingness-to-pay tests do not need a real billing system — take payment manually via a Stripe Payment Link or an invoice. A problem-interest test doesn't need a working product.
- **Code lands in the project root alongside `startup/`.** Don't touch `startup/` from the scaffold path except to update `mvp-plan.md` at the end.
- **The MVP form drives the stack, not the other way around.** If the honest experiment is a Tally form embedded in a Notion page, that's the right answer — Next.js on Vercel is not a requirement.

---

## The single most important rule

**Ask exactly one question at a time. Always.**

---

## Steps

### Step 1 — Check prerequisites

Read `startup/mvp-plan.md` to determine the MVP form and what the success criteria require. Then determine which tools are needed:

| MVP form | Required | Optional |
|---|---|---|
| Landing page | Vercel MCP (or no-code equivalent) | v0 API, Supabase (if signups in criteria) |
| Clickable demo | Vercel MCP (or v0 / Figma link) | v0 API |
| Simple web app | Vercel MCP | v0 API, Supabase (if data persistence needed) |
| No-code (Tally / Notion / etc.) | None — founder owns the account | — |

Check `claude mcp list` to see which MCPs are connected.

For each required tool that is not configured, share the exact setup instruction from Capabilities above and **stop** — do not partially deploy. Once the founder has set it up and re-invoked the workflow, proceed.

If the chosen form is no-code, skip the MCP checks, help the founder set it up in the right tool, and jump ahead to Step 5.

### Step 2 — Generate the UI

**If `V0_API_KEY` is set:**

Construct a generation prompt from the plan documents. Do not ask the founder to re-explain anything — derive everything from the files:

```
Build a [landing page / demo] for a product called {name from core.md}.

Problem being solved: {Problem field from core.md}
What this MVP does: {## What We're Building from mvp-plan.md, first sentence}
What it does NOT do: {out-of-scope items from ## What We're Building}
Primary CTA: {derive from ## Success Criteria — e.g. "Join the waitlist" if criteria mentions signups}
Tone: clean, minimal, founder-built — not a corporate marketing site

Keep it to a single page. No navigation, no footer links, no social proof fabrication.
```

Call the v0 Platform API with this prompt. The response includes a deployable Next.js project structure — use it as the basis for the files in the project root.

**If `V0_API_KEY` is not set:**

Scaffold a minimal current-stable Next.js + Tailwind app directly — one page, one CTA wired to the instrumentation chosen in Step 3. Keep it deliberately sparse: a headline stating the problem plainly, one sentence of elaboration, and the CTA. Pull real strings from `core.md` and `mvp-plan.md` — no placeholder text should survive into the deployed file.

**If the MVP form isn't a vanilla web app**, pick the right tool from Capabilities and scaffold that instead — a Python/Flask app, a Streamlit app, a single HTML file, or a no-code tool. The rest of the workflow still applies: instrumentation tied to success criteria, a live URL, and an updated `mvp-plan.md`.

Once the UI is in place, proceed to Step 3.

### Step 3 — Set up instrumentation

**If success criteria mention signups:**

Use Supabase MCP to:
1. Create (or identify existing) a Supabase project.
2. Run this SQL via the MCP to create the signups table:
   ```sql
   create table if not exists signups (
     id uuid primary key default gen_random_uuid(),
     email text unique not null,
     created_at timestamptz default now()
   );
   ```
3. Get the project URL and service role key.
4. Wire the page's form to a server-side route that accepts a POST with an `email` field, inserts into `signups` using the Supabase service role key (not the anon key — the service role is required for server-side writes), and redirects to `/?success=1` on success. Return a JSON error with an appropriate status code on failure.

**If success criteria mention click or conversion tracking only:**

Add Vercel Analytics — install the package, drop the `<Analytics />` component into the app's root layout. No additional configuration needed.

**If success criteria mention both signups and click/conversion tracking:**

Do both.

**If success criteria don't require instrumentation:**

Skip this step.

### Step 4 — Deploy via Vercel MCP

Use the Vercel MCP to deploy. If Supabase env vars are needed, set them first:
- `NEXT_PUBLIC_SUPABASE_URL` — the Supabase project URL
- `SUPABASE_SERVICE_ROLE_KEY` — the service role key (not the anon key, for server-side writes)

Trigger the deployment. Monitor build logs via the MCP. If the build fails:
- Read the error message in full
- Fix the root cause (missing dependency, type error, etc.)
- Redeploy — do not retry blindly

Retrieve the live URL from the deployment response.

### Step 5 — Update `startup/mvp-plan.md`

Read the file. Populate `## Stack & Deployment` with whatever was actually built. Two examples — follow the shape of whichever is closer to the truth:

```markdown
## Stack & Deployment

**Stack:** Next.js + Tailwind, Supabase for signup capture, Vercel Analytics
**Generated with:** v0 Platform API
**Deployed to:** Vercel
**Live URL:** {url}
**Instrumentation:** Supabase signups table tracking email captures; Vercel Analytics tracking page views and CTA clicks
```

```markdown
## Stack & Deployment

**Stack:** Tally form → Airtable
**Deployed to:** Tally (public form URL)
**Live URL:** {url}
**Instrumentation:** Each submission lands in the Airtable base as a new row
```

Update frontmatter: `status: live`, `last_updated: {today}`.

Add a dated entry to `## Experiments Log`:

```markdown
### {YYYY-MM-DD} — Initial deployment

Built and deployed a {form} to test {hypothesis slugs listed in ## Hypotheses Being Tested}.
Success criteria: {criteria from ## Success Criteria}.
Distribution: {plan from ## Distribution Plan}.
Live at {url}. Instrumentation: {what is tracking what}.
```

Propose these changes before writing. Get confirmation. Write the file back.

### Step 6 — Hand off

Share the live URL:
> "Your MVP is live at: **{url}**"

Remind the founder:
- The URL only generates signal if it reaches the right people — execute the `## Distribution Plan` now.
- When results come in, come back: "How's the MVP doing?" and we'll assess against the success criteria and update the hypotheses.

---

## Default for the common case

If the MVP is a standard landing page and nothing unusual signals otherwise, the default stack is current-stable Next.js + Tailwind deployed to Vercel. Add a signup form backed by Supabase if success criteria mention signups. Add Vercel Analytics if criteria mention click or conversion tracking. Use v0 for the initial UI if `V0_API_KEY` is set; scaffold manually otherwise. Capabilities and Principles above cover everything that isn't this default.

---

## Completion criteria

- The MVP exists where the audience can reach it — code in the project root and deployed to a live URL, or a configured no-code artifact with its own URL
- Instrumentation in place if success criteria require it
- `startup/mvp-plan.md` updated: `## Stack & Deployment` populated, `status: live`, `last_updated` updated, `## Experiments Log` has a dated entry
- Founder has confirmed the file update
