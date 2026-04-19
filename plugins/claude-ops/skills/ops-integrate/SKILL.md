---
name: ops-integrate
description: Add any SaaS API as a first-class integration. Provide the service name — ops-integrate discovers auth patterns, tests connectivity, and registers the API in your partner registry so it's available to other skills.
argument-hint: "<service-name> [--url <base-url>] [--auth bearer|api-key|basic|oauth2] [--list]"
allowed-tools:
  - Bash
  - Read
  - Write
  - Edit
  - AskUserQuestion
  - WebSearch
effort: low
maxTurns: 25
---

## Runtime Context

```bash
PREFS="${CLAUDE_PLUGIN_DATA_DIR:-$HOME/.claude/plugins/data/ops-ops-marketplace}/preferences.json"
PARTNER_REGISTRY=$(jq '.partner_registry // {}' "$PREFS" 2>/dev/null || echo '{}')
```

Parse `$ARGUMENTS`:
- Contains `--list` → run **List registered integrations** then exit
- Otherwise → run **Onboarding flow** with the service name as first positional argument

# OPS ► INTEGRATE

## List registered integrations (`--list`)

```bash
jq -r '.partner_registry // {} | to_entries[] | "\(.key): \(.value.base_url) [\(.value.auth_type)]"' "$PREFS" 2>/dev/null
```

Display as a table:

```
Registered integrations:
  hubspot       https://api.hubapi.com          [bearer]
  stripe        https://api.stripe.com          [bearer]
  sendgrid      https://api.sendgrid.com        [api-key]
```

If no integrations registered: `No integrations registered yet. Run /ops:integrate <service-name> to add one.`

## Onboarding flow (5 steps)

### Step 1 — Discover API details

If `--url` not provided, use WebSearch to find:
- Official API docs URL
- Base API URL
- Authentication pattern (bearer token / api-key header / basic auth / oauth2)
- API key generation URL (where the user gets credentials)
- Health/test endpoint (e.g., /healthz, /v1/ping, /me)

### Step 2 — Confirm with user

Present findings via AskUserQuestion (≤4 options):

```
Found: <service-name> API — Base URL: <url> — Auth: <auth-type>
[Looks correct — continue]  [Change base URL]  [Change auth type]  [Cancel]
```

If "Change base URL": AskUserQuestion with free-text input for the new URL.
If "Change auth type": AskUserQuestion (≤4 options): `[bearer]  [api-key]  [basic]  [oauth2]`

### Step 3 — Collect credential

```
Paste your <service-name> <auth-type> credential (it will be stored locally only)
[Paste now]  [Configure later]
```

If "Paste now": collect credential via AskUserQuestion free-text. Derive key name: `<lowercase_service_name>_api_key`

Write to preferences.json via atomic tmpfile swap:
```bash
tmp=$(mktemp)
jq --arg k "$KEY_NAME" --arg v "$CREDENTIAL" '.[$k] = $v' "$PREFS" > "$tmp" && mv "$tmp" "$PREFS"
```

### Step 4 — Health check

Curl the health/test endpoint with the credential:

```bash
# Bearer token
curl -sf -o /dev/null -w "%{http_code}" \
  -H "Authorization: Bearer ${CREDENTIAL}" \
  "${BASE_URL}${HEALTH_ENDPOINT}"

# API key header (X-Api-Key)
curl -sf -o /dev/null -w "%{http_code}" \
  -H "X-Api-Key: ${CREDENTIAL}" \
  "${BASE_URL}${HEALTH_ENDPOINT}"

# Basic auth
curl -sf -o /dev/null -w "%{http_code}" \
  -u "${CREDENTIAL}:" \
  "${BASE_URL}${HEALTH_ENDPOINT}"
```

Report: ✅ if HTTP 200-299, ⚠️ with status code otherwise. If credential not yet configured, skip health check and report `⬜ health check skipped — credential not configured`.

### Step 5 — Register in partner registry

```bash
tmp=$(mktemp)
jq --arg name "${SERVICE_NAME}" \
   --arg url "${BASE_URL}" \
   --arg auth "${AUTH_TYPE}" \
   --arg key_name "${KEY_NAME}" \
   --arg health "${HEALTH_ENDPOINT}" \
   '.partner_registry[$name] = {base_url: $url, auth_type: $auth, credential_key: $key_name, health_endpoint: $health, added: (now | todate)}' \
   "$PREFS" > "$tmp" && mv "$tmp" "$PREFS"
```

Confirmation output:

```
✅ <service-name> registered in partner registry
   Auth: <auth-type>
   Health: <base-url><health-endpoint>
   Credential key: <key-name>

   Access via: jq '.partner_registry["<service-name>"]' $PREFS
```

## CLI/API Reference

```bash
# List all registered integrations
jq '.partner_registry' "${CLAUDE_PLUGIN_DATA_DIR:-$HOME/.claude/plugins/data/ops-ops-marketplace}/preferences.json"

# Look up a specific integration
jq '.partner_registry["hubspot"]' "$PREFS"

# Read a credential for a registered integration
jq -r ".$KEY_NAME" "$PREFS"

# Remove an integration from the registry
jq 'del(.partner_registry["<service-name>"])' "$PREFS" > tmp && mv tmp "$PREFS"
```
