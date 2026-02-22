---
name: agent-analytics
description: "Analytics your AI agent can actually use. Track, analyze, run A/B experiments, and optimize across all your projects via CLI. Includes a growth playbook so your agent knows HOW to grow, not just what to track."
category: analytics
requires:
  env: [AGENT_ANALYTICS_API_KEY]
  bins: [npx]
---

# Agent Analytics — Analytics your agent can actually use

You are adding analytics tracking using Agent Analytics — the analytics platform your AI agent can actually use. Built for developers who ship lots of projects and want their AI agent to track, analyze, experiment, and optimize across all of them.

**Website:** [agentanalytics.sh](https://agentanalytics.sh)
**GitHub:** [Agent-Analytics/agent-analytics](https://github.com/Agent-Analytics/agent-analytics)
**Docs:** [docs.agentanalytics.sh](https://docs.agentanalytics.sh)

## When to Use This Skill

- User wants to add analytics tracking to a website or app
- User wants to check how their projects are doing (traffic, conversions, engagement)
- User wants to run A/B experiments on headlines, CTAs, or flows
- User wants funnel analysis, retention cohorts, or traffic breakdowns
- User asks "how's my site doing?" or "are people visiting?"

## Philosophy

You are NOT Mixpanel. Don't track everything. Track only what answers: **"Is this project alive and growing?"**

For a typical site, that's 3-5 custom events max on top of automatic page views.

## First-time setup

**Get an API key:** Sign up at [agentanalytics.sh](https://agentanalytics.sh) and generate a key from the dashboard. Alternatively, self-host the open-source version from [GitHub](https://github.com/Agent-Analytics/agent-analytics).

If the project doesn't have tracking yet:

```bash
# 1. Login (one time — uses your API key)
npx @agent-analytics/cli login --token aak_YOUR_API_KEY

# 2. Create the project (returns a project write token)
npx @agent-analytics/cli create my-site --domain https://mysite.com

# 3. Add the snippet using the returned token
# 4. Deploy, click around, verify:
npx @agent-analytics/cli events my-site
```

The `create` command returns a **project write token** — use it as `data-token` in the snippet. This is separate from your API key (which is for reading/querying).

## Step 1: Add the tracking snippet

The `create` command returns a tracking snippet with your project token — add it before `</body>`. It auto-tracks `page_view` events with path, referrer, browser, OS, device, screen size, and UTM params. You do NOT need to add custom page_view events.

## Step 1b: Discover existing events (existing projects)

If tracking is already set up, check what events and property keys are already in use so you match the naming:

```bash
npx @agent-analytics/cli properties-received PROJECT_NAME
```

## Step 2: Add custom events to important actions

Use `onclick` handlers on the elements that matter:

```html
<a href="..." onclick="window.aa?.track('EVENT_NAME', {id: 'ELEMENT_ID'})">
```

### Standard events for 80% of SaaS sites

Pick the ones that apply. Most sites need 2-4:

| Event | When to fire | Properties |
|-------|-------------|------------|
| `cta_click` | User clicks a call-to-action button | `id` (which button) |
| `signup` | User creates an account | `method` (github/google/email) |
| `login` | User returns and logs in | `method` |
| `feature_used` | User engages with a core feature | `feature` (which one) |
| `checkout` | User starts a payment flow | `plan` (free/pro/etc) |
| `error` | Something went wrong visibly | `message`, `page` |

### What NOT to track
- Every link or button (too noisy)
- Scroll depth (not actionable)
- Form field interactions (too granular)
- Footer links (low signal)

### Property naming rules

- Use `snake_case`: `hero_get_started` not `heroGetStarted`
- The `id` property identifies WHICH element: short, descriptive
- Name IDs as `section_action`: `hero_signup`, `pricing_pro`, `nav_dashboard`

## Step 2b: Run A/B experiments

Experiments let you test which variant of a page element converts better. The full lifecycle is API-driven — no dashboard UI needed.

### Creating an experiment

```bash
npx @agent-analytics/cli experiments create my-site \
  --name signup_cta --variants control,new_cta --goal signup
```

### Implementing variants

**Declarative (recommended):** Use `data-aa-experiment` and `data-aa-variant-{key}` HTML attributes. Original content is the control. The tracker swaps text for assigned variants automatically.

```html
<h1 data-aa-experiment="signup_cta" data-aa-variant-new_cta="Start Free Trial">Sign Up</h1>
```

**Programmatic (complex cases):** Use `window.aa?.experiment(name, variants)` — deterministic, same user always gets same variant.

### Checking results

```bash
npx @agent-analytics/cli experiments get exp_abc123
```

Returns Bayesian `probability_best`, `lift`, and a `recommendation`. The system needs ~100 exposures per variant before results are significant.

## Step 3: Test immediately

After adding tracking, verify it works:

```bash
# Click around, then check:
npx @agent-analytics/cli events PROJECT_NAME
# Events appear within seconds.
```

## CLI Reference

All commands use `npx @agent-analytics/cli`:

```bash
# Setup
login --token aak_YOUR_KEY           # Save API key (one time)
projects                              # List all projects
create my-site --domain https://...   # Create project

# Real-time
live                                  # Live TUI dashboard across ALL projects
live my-site                          # Live view for one project

# Analytics
stats my-site --days 7                # Overview: events, users, daily trends
insights my-site --period 7d          # Period-over-period comparison
breakdown my-site --property path --event page_view --limit 10  # Top pages/referrers/UTM
pages my-site --type entry            # Landing page performance & bounce rates
sessions-dist my-site                 # Session engagement histogram
heatmap my-site                       # Peak hours & busiest days
events my-site --days 30              # Raw event log
sessions my-site                      # Individual session records
properties my-site                    # Discover event names & property keys
funnel my-site --steps "page_view,signup,purchase"  # Funnel drop-off
retention my-site --period week --cohorts 8         # Cohort retention

# A/B experiments
experiments list my-site
experiments create my-site --name signup_cta --variants control,new_cta --goal signup
experiments get exp_abc123
experiments complete exp_abc123 --winner new_cta
```

## Which endpoint for which question

| User asks | Call | Why |
|-----------|------|-----|
| "How's my site doing?" | `insights` + `breakdown` + `pages` (parallel) | Full weekly picture |
| "Is anyone visiting right now?" | `live` | Real-time visitors across all projects |
| "What are my top pages?" | `breakdown --property path --event page_view` | Ranked page list |
| "Where's my traffic coming from?" | `breakdown --property referrer --event page_view` | Referrer sources |
| "Are people actually engaging?" | `sessions-dist` | Bounce vs engaged split |
| "When should I deploy?" | `heatmap` | Find low-traffic windows |
| "Where do users drop off?" | `funnel --steps "page_view,signup,purchase"` | Step-by-step conversion |
| "Are users coming back?" | `retention --period week --cohorts 8` | Cohort retention |
| "Which CTA converts better?" | `experiments create` + `experiments get` | A/B test lifecycle |

For any "how is X doing" question, **always call `insights` first** — it's the single most useful endpoint.

## Examples

Track custom events via `window.aa?.track()`:

```js
window.aa?.track('cta_click', {id: 'hero_get_started'});
window.aa?.track('signup', {method: 'github'});
window.aa?.track('feature_used', {feature: 'create_project'});
window.aa?.track('checkout', {plan: 'pro'});
```

## What this skill does NOT do

- No GUI dashboards — your agent IS the dashboard (or use `live` for a real-time TUI)
- No user management or billing
- No PII stored — IP addresses are not logged or retained. Privacy-first by design
