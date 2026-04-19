---
name: ops-settings
description: Post-setup credential manager. Shows current integration status (configured/missing/expired) and lets you update individual credentials without re-running the full setup wizard. Runs a smoke test after each update.
argument-hint: "[integration-name] [--status]"
allowed-tools:
  - Bash
  - Read
  - Write
  - Edit
  - AskUserQuestion
effort: low
maxTurns: 20
---

## Runtime Context

```!
PREFS="${CLAUDE_PLUGIN_DATA_DIR:-$HOME/.claude/plugins/data/ops-ops-marketplace}/preferences.json"
cat "$PREFS" 2>/dev/null || echo '{}'
```

# OPS ► SETTINGS

Manage credentials and integration config after initial setup.

## Parse arguments

- `--status` or empty → show full credential status dashboard
- `<integration-name>` → jump directly to updating that integration (e.g. `/ops:settings stripe`)
- `--status <integration-name>` → show status of one integration only

## Credential Status Dashboard

Read `preferences.json`. For each known integration, check whether the key exists and is non-empty. Also probe liveness where possible.

Display as a table:

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 OPS ► SETTINGS — Integration Status
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

 Integration         Status        Last Updated
 ─────────────────── ────────────  ─────────────
 GitHub (gh cli)     ✅ active     (always active if gh auth status)
 Stripe              ✅ configured  2026-04-14
 RevenueCat          ✅ configured  2026-04-14
 Telegram            ✅ configured  2026-04-13
 Slack               ⚠️  missing    —
 Linear              ✅ configured  2026-04-11
 Sentry              ⚠️  missing    —
 AWS                 ✅ active     (always active if aws sts works)
 Shopify             ⚠️  missing    —
 Klaviyo             ⚠️  missing    —
 Meta Ads            ⚠️  missing    —
 GA4                 ⚠️  missing    —
 ElevenLabs          ⚠️  missing    —
 Datadog             ⚠️  missing    —
 New Relic           ⚠️  missing    —
 ...

 ✅ N configured   ⚠️ N missing
──────────────────────────────────────────────────────
```

## Probe liveness

For integrations with a cheap health check, run it to distinguish "configured but expired" from "configured and active":

| Integration | Probe | Active signal |
|-------------|-------|---------------|
| Stripe | `curl -s -o /dev/null -w "%{http_code}" -u "${stripe_key}:" https://api.stripe.com/v1/balance` | 200 |
| GitHub | `gh auth status 2>&1` | "Logged in" |
| AWS | `aws sts get-caller-identity --output text 2>/dev/null` | exits 0 |
| Linear | `cat "$PREFS" | jq -r .linear_team` | non-empty |
| Doppler MCP | Check if DOPPLER_TOKEN is set and valid | Token present and MCP server responds |

Show `🔴 expired` if probe fails for a previously-configured key.

## Update an integration

When a specific integration is selected (via argument or user pick from dashboard):

1. Show current value (masked): `sk_live_••••••••••••••••` (last 4 chars visible)
2. Use AskUserQuestion to confirm the update action:
   ```
   [Enter new value]  [Test current value]  [Clear this credential]  [Back to dashboard]
   ```
3. For "Enter new value": prompt with `AskUserQuestion` text input
4. Write new value to `preferences.json` via `jq` update:
   ```bash
   tmp=$(mktemp)
   jq --arg v "$NEW_VALUE" --arg k "$KEY_NAME" '.[$k] = $v' "$PREFS" > "$tmp" && mv "$tmp" "$PREFS"
   ```
5. Run smoke test immediately after update (see Smoke Tests section)
6. Report: `✅ Stripe key updated — smoke test passed` or `⚠️ Key saved but smoke test failed: <reason>`

## Smoke Tests

| Integration | Smoke test command |
|-------------|-------------------|
| Stripe | `curl -s -u "${new_key}:" https://api.stripe.com/v1/balance \| jq .object` → must be "balance" |
| RevenueCat | `curl -s -H "Authorization: Bearer ${new_key}" "https://api.revenuecat.com/v2/projects" \| jq '.items \| length'` → non-zero |
| Telegram | `node ${CLAUDE_PLUGIN_ROOT}/telegram-server/index.js --health 2>&1` → "healthy" |
| Slack | `curl -s -H "Authorization: Bearer ${new_token}" https://slack.com/api/auth.test \| jq .ok` → true |
| Shopify | `curl -s -H "X-Shopify-Access-Token: ${new_token}" "https://${store_url}/admin/api/2024-01/shop.json" \| jq .shop.name` → non-null |
| Klaviyo | `curl -s -H "Authorization: Klaviyo-API-Key ${new_key}" https://a.klaviyo.com/api/accounts/ \| jq '.data[0].id'` → non-null |
| Datadog | `curl -s -H "DD-API-KEY: ${new_key}" https://api.datadoghq.com/api/v1/validate \| jq .valid` → true |
| New Relic | `curl -s -H "Api-Key: ${new_key}" https://api.newrelic.com/v2/applications.json \| jq '.applications | length'` → numeric |
| Doppler MCP | `npx -y @dopplerhq/mcp-server --help 2>&1` with DOPPLER_TOKEN set | exits 0 |

## CLI/API Reference

| Command | Purpose |
|---------|---------|
| `cat "$PREFS" \| jq 'keys'` | List all configured keys |
| `jq --arg v "$V" --arg k "$K" '.[$k] = $v' "$PREFS"` | Update a single key |
| `gh auth status` | Verify GitHub CLI auth |
| `aws sts get-caller-identity` | Verify AWS auth |
