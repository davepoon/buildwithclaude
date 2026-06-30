---
description: Open TLS Radar pricing or upgrade your plan
argument-hint: "[plan: starter | pro | business]"
allowed-tools: Bash(open*)
---

Open TLS Radar's pricing page in the user's browser. This is the explicit funnel command - users who want more monitors, Slack alerts, or vulnerability scanning use this to compare and choose.

## Behavior

If `$ARGUMENTS` is a known plan tier (`starter`, `pro`, or `business`), open that tier's page directly:
- `open 'https://tlsradar.com/pricing?source=plugin&utm_content=cli_upgrade&plan=<tier>'`

If `$ARGUMENTS` is empty or anything else, open the main pricing page:
- `open 'https://tlsradar.com/pricing?source=plugin&utm_content=cli_upgrade'`

After opening, briefly orient the user on the tiers. **Do not quote exact prices or feature counts from memory** - they change, and stale numbers read as false advertising. If the user is already connected, prefer live values from `tlsradar.get_account` (but don't trigger an auth prompt just for this). Otherwise keep it general and let the page you just opened carry the current, exact numbers:

- **Starter** (plans start around $10/mo) - the usual first upgrade: more monitors, more frequent checks, and vulnerability scanning.
- **Pro** - for larger portfolios: many more monitors and advanced analytics.
- **Business** - teams and high scale: Slack & webhook alerts, custom schedules, revocation monitoring.

Point the user to the open pricing page for the exact prices, monitor counts, and alert quotas. End with a one-liner about what stays the same on every plan: REST API, Claude Code plugin, and email notifications.

## Why this command exists

Most upgrade prompts in the plugin are reactive - when a user hits a limit, the 402 response includes upgrade options. This command is the proactive path: a user who just wants to evaluate plans without hitting an error.

## Things this command should NOT do

- Don't try to charge the user or collect payment info - that's the web app's job.
- Don't push a specific tier unless the user named it. Lead with the user's likely next-tier (Starter for free users, Pro for Starter, etc.) but don't insist.
- Don't recite exact prices/quotas from memory - they go stale. Use live `tlsradar.get_account` data or defer to the pricing page.
- Don't run `tlsradar.get_account` if it would prompt for auth - the goal here is friction-free upgrade browsing.
