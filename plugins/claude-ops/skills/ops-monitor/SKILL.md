---
name: ops-monitor
description: Unified APM and monitoring surface. Polls Datadog, New Relic, and OpenTelemetry backends for active alerts, error traces, and entity health. Use --watch for live polling every 60 seconds. Use --setup to configure monitoring credentials.
argument-hint: "[--watch] [--setup] [--backend datadog|newrelic|otel]"
allowed-tools:
  - Bash
  - Read
  - Agent
  - AskUserQuestion
  - TeamCreate
  - SendMessage
effort: low
maxTurns: 20
---

## Runtime Context

```bash
PREFS="${CLAUDE_PLUGIN_DATA_DIR:-$HOME/.claude/plugins/data/ops-ops-marketplace}/preferences.json"
DD_API_KEY=$(jq -r '.datadog_api_key // empty' "$PREFS" 2>/dev/null)
NR_API_KEY=$(jq -r '.newrelic_api_key // empty' "$PREFS" 2>/dev/null)
OTEL_ENDPOINT=$(jq -r '.otel_endpoint // empty' "$PREFS" 2>/dev/null)
```

Determine `$ARGUMENTS` mode:
- Contains `--setup` → run **Setup flow**
- Contains `--watch` → run **Watch mode**
- Otherwise → run **Default health check**

# OPS ► MONITOR

## Setup flow (`--setup`)

Ask which backends to configure:

```
Which monitoring backends would you like to configure?
[Datadog]  [New Relic]  [OpenTelemetry]  [All three]
```

For each selected backend, collect credentials via `AskUserQuestion` free-text input (one at a time, ≤4 options per call):

**Datadog:**
1. `datadog_api_key` — API Key from app.datadoghq.com/organization-settings/api-keys
2. `datadog_app_key` — Application Key from app.datadoghq.com/organization-settings/application-keys

**New Relic:**
1. `newrelic_api_key` — User API Key from one.newrelic.com/api-keys
2. `newrelic_account_id` — Numeric Account ID from New Relic admin portal

**OpenTelemetry:**
1. `otel_endpoint` — Base URL of your OTEL-compatible backend (e.g., https://otlp.grafana.net)

Write each credential to preferences.json using atomic tmpfile swap:

```bash
tmp=$(mktemp)
jq --arg k "$KEY" --arg v "$VALUE" '.[$k] = $v' "$PREFS" > "$tmp" && mv "$tmp" "$PREFS"
```

Run smoke test after saving:
- **Datadog**: `curl -sf -H "DD-API-KEY: $DD_API_KEY" -H "DD-APPLICATION-KEY: $DD_APP_KEY" "https://api.datadoghq.com/api/v1/validate"` → expect `{"valid": true}`
- **New Relic**: `curl -sf -H "Api-Key: $NR_API_KEY" "https://api.newrelic.com/graphql" -d '{"query":"{ actor { user { name } } }"}'` → expect `data.actor.user`
- **OTEL**: `curl -sf "$OTEL_ENDPOINT/healthz"` → expect HTTP 200

Report ✅ or ❌ with status for each backend.

## Agent Teams support

If `CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1` is set, use **Agent Teams** when querying multiple backends simultaneously. This enables:
- Backend probes run in parallel with shared context (e.g., Datadog agent detects latency spike → OTEL agent can correlate with traces)
- You can steer: "focus on Datadog alerts first, then cross-reference with New Relic"
- Real-time progress: agents report per-backend as results arrive

**Team setup** (only when flag is enabled, multiple backends configured):
```
TeamCreate("monitor-probes")
Agent(team_name="monitor-probes", name="datadog-probe", subagent_type="ops:monitor-agent", ...)
Agent(team_name="monitor-probes", name="newrelic-probe", subagent_type="ops:monitor-agent", ...)
Agent(team_name="monitor-probes", name="otel-probe", subagent_type="ops:monitor-agent", ...)
```

If the flag is NOT set or only one backend is configured, use a single `monitor-agent` subagent.

## Default health check (no flags)

Spawn `monitor-agent` via the Agent tool. Display the result as a formatted dashboard:

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 OPS ► MONITOR                       [<timestamp>]
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 DATADOG      ✅ healthy (0 alerts)
 NEW RELIC    🔴 2 critical entities
 OTEL         ✅ healthy
──────────────────────────────────────────────────────
 Total alerts: 2   Severity: CRITICAL
```

Status icons:
- `✅` — healthy (0 alerts / configured and reachable)
- `⚠️` — warning (warn-level alerts present)
- `🔴` — critical (critical alerts or unreachable)
- `⬜` — not configured

For each alert or critical entity, display: service name, alert name, and link to the relevant dashboard.

If no backends are configured, show a setup prompt:
```
No monitoring backends configured. Run /ops:monitor --setup to add Datadog, New Relic, or OTEL.
```

## Watch mode (`--watch`)

Poll every 60 seconds. On each tick:

```bash
while true; do
  RESULT=$(# spawn monitor-agent and capture JSON output)
  # Diff against previous tick
  # Print: timestamp, changed items only
  # 🆕 new alert: <name>
  # ✅ resolved: <name>
  sleep 60
done
```

Exit on Ctrl-C.

## `--backend` filter

If `--backend datadog|newrelic|otel` is specified, query and display only that backend.

## CLI/API Reference

| Backend     | Auth header                                    | Base URL                        | Health endpoint        |
|-------------|------------------------------------------------|---------------------------------|------------------------|
| Datadog     | `DD-API-KEY: $key` + `DD-APPLICATION-KEY: $app_key` | https://api.datadoghq.com  | /api/v1/validate       |
| New Relic   | `Api-Key: $key`                                | https://api.newrelic.com/graphql | POST GraphQL query    |
| OTEL        | varies by backend                              | `$OTEL_ENDPOINT`                | /healthz               |

```bash
# Datadog — active alerts
curl -sf \
  -H "DD-API-KEY: ${DD_API_KEY}" \
  -H "DD-APPLICATION-KEY: ${DD_APP_KEY}" \
  "https://api.datadoghq.com/api/v1/monitor?monitor_tags=*&with_downtimes=false" \
  | jq '[.[] | select(.overall_state == "Alert" or .overall_state == "Warn")]'

# New Relic — critical entities (GraphQL)
curl -sf \
  -H "Api-Key: ${NR_API_KEY}" \
  -H "Content-Type: application/json" \
  -d '{"query":"{ actor { entitySearch(queryBuilder: {alertSeverity: CRITICAL}) { results { entities { name alertSeverity entityType } } } } }"}' \
  "https://api.newrelic.com/graphql"

# OTEL — health check
curl -sf "${OTEL_ENDPOINT}/healthz"
```
