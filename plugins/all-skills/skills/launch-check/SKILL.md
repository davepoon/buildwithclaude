---
name: launch-check
description: Passive pre-launch report card for a live URL of an app or site built with AI (Lovable, Bolt, Replit, Cursor, v0, Claude). Scores security (secret keys visible in the page JavaScript, Supabase service_role keys, open Supabase or Firebase tables with --owner-check, security headers, HTTPS, cookies), phone design at 375 px, Google and AI search, and speed, then writes a "fix this first" list. Use when the user asks "is my app safe to launch", "did I leak my API key", "is my Supabase open", or wants a pre-launch checklist.
category: security
license: MIT
---

# Launch Check

`scripts/launch_check.py` (Python standard library; Playwright optional) loads a live URL the way a visitor's browser
does, scans what it downloaded, runs the two bundled audits (`scripts/polish_audit.py` for phone design,
`scripts/geo_audit.py` for search) and prints one report card. Run the tool and explain what it found; do not judge
the site by reading it. Source (MIT): https://github.com/Ces107/agent-forge/tree/main/skills/launch-check

## When to Use This Skill

- The user asks whether an app or site is ready or safe to launch, or wants a pre-launch checklist.
- The user asks whether an API key (Stripe, OpenAI, Anthropic, AWS, Supabase service_role) leaked into the frontend.
- The user asks whether their Supabase or Firebase database can be read by anyone.
- Not for authenticated flows, API fuzzing or penetration testing.

## What This Skill Does

1. Finds Python 3.9+ (`python3 --version`, then `python --version`, then `py -3 --version` on Windows) as `<PY>`;
   `<DIR>` is the folder that holds this SKILL.md.
2. Runs `<PY> "<DIR>/scripts/launch_check.py" <url> --report launch-report.html`.
3. Scores four areas 0-100 with PASS (80+) / WARN (50-79) / FAIL (under 50), and an overall score (security 40 %,
   the other three 20 % each; any exposed secret or open table caps it at 39).
4. Gives a verdict (NOT READY, ALMOST READY, READY TO LAUNCH) and a prioritized fix list, plus a one-page HTML report.

Options:

- `--owner-check`: only when the user confirms they own the site. If the page contains a Supabase URL with its public
  anon key (or a Firebase databaseURL), it lists which tables exist and reads at most 1 row per table (GET only, at
  most 20 tables, never writes; row contents are never printed or saved).
- `--repo .`: also scan the local project for committed `.env` files and secrets in tracked files.
- `--prompt`: only the fix list, as a prompt for the AI that built the app. `--json`: everything.
- `--skip phone,search,speed`: faster partial run. `--fail-under 80`: exit 1 below this score.
- Phone design and page-load metrics need Playwright (`<PY> -m pip install playwright`, then
  `<PY> -m playwright install chromium`). Ask the user before installing; without it those checks are skipped.

## How to Use

### Basic Usage

```
Is my app ready to launch? https://my-app.example
```

```bash
python3 scripts/launch_check.py https://my-app.example --report launch-report.html
```

### Database check (site owner only)

```bash
python3 scripts/launch_check.py https://my-app.example --owner-check --prompt
```

## Example

**User**: "Did I leak anything? https://my-app.example"

**Output**:
```
SCORE 30/100  NOT READY: 5 things to fix before you launch
FAIL  Security                0  Anyone can see your Stripe secret key in your website's code (+7 more)
WARN  Phone design           77  The page is wider than a phone screen (+4 more)
FIX THIS FIRST
 1. HIGH   Anyone can see your Stripe secret key in your website's code
              in /assets/index-4f9c2a.js   value sk_l...(50 chars)
```

Then: an exposed secret key is already public, so move the call server-side, keep the key in a server environment
variable and rotate it in the provider dashboard. For an open table, enable Row Level Security or database rules and
re-run with `--owner-check`. Paste the `--prompt` output into the AI that built the app, redeploy, re-run.

## What It Fetches

Only the URL the user passes and that site's public files: the page, its same-site scripts, links on the home page,
`/favicon.ico`, `robots.txt`, `sitemap.xml`, `llms.txt`, and up to 5 same-site pages for the search check. With
`--owner-check`, also the Supabase project or Firebase database that page references, read-only. It never probes
hidden paths such as `/.env` or `/admin`, never writes to any server, and sends nothing anywhere else (no telemetry,
no third-party API). Secrets are cut to their first 4 characters in all output.

## Tips

- Exit code 0 = ready, 1 = findings, 2 = bad URL or the site could not be loaded. HTTP 403 usually means bot
  protection: run it on a preview URL.
- A Supabase anon key or a Firebase web key in the page is normal (INFO/LOW); safety depends on Row Level Security
  and key restrictions, which `--owner-check` tests.
- A good score means these common launch mistakes were not found, not that the app is secure: no login flows, no API
  fuzzing, no server-side auth checks. Scripts served from another host are not scanned.
