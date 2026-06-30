---
description: Manage ongoing certificate monitoring (list, add, remove)
argument-hint: list | add <domain> [domain ...] | remove <domain>
---

Manage TLS Radar monitors. Parse `$ARGUMENTS`:

## `list` (default if no args)

Call `tlsradar.list_monitors`. Show domain, expiry days, last-scan timestamp. Sort by days-until-expiry ascending so the most urgent surfaces first.

If the user is at the plan's monitor cap (used == limit from `list_monitors` meta), mention casually: "You're at your `<plan>` plan's `<limit>` monitor cap. `/tls-upgrade` to lift it."

## `add <domain> [more domains...]`

Decide between single-add and bulk-add based on argument count:

- **One domain:** call `tlsradar.add_monitor` with `domain`
- **Two or more:** call `tlsradar.add_monitors` with `domains: [d1, d2, ...]`. The bulk variant returns per-domain status, so you can render "added 8/10, 2 hit the limit."

New monitors land on the **first active scan_group of your current team**. If you've never created one, TLS Radar bootstraps one for you the first time you add a monitor. Use the web dashboard to organize hosts into named scan_groups; the plugin doesn't ask which group to use.

If either returns `domains_limit_reached`:
- Lead with the `recommended_upgrade` (typically Starter)
- Offer `/tls-upgrade` to open the pricing page
- Offer `/tls-monitor remove <existing>` to free a slot

If a domain was successfully added, mention briefly that the first scan is queued and the user will be notified before the cert expires (free plan: 7-day warning; paid plans: 30-day warning).

## `remove <domain>`

Call `tlsradar.remove_monitor` with `domain`. Confirm with the user before calling if removing would drop their monitor count to 0 - getting back to 1 just means re-adding, but a user might not realize they're about to lose their only monitor.

## Things this command should NOT do

- Don't loop: if `add_monitors` hits the limit halfway through, surface the result once; don't keep retrying.
- Don't assume the user wants to remove all monitors when they say "remove all" - confirm explicitly and only after they re-affirm.
- Don't auto-suggest team-scoping operations - if the user wants to invite a teammate, that's the `tlsradar.invite_team_member` tool (no slash command), reached by natural language.
