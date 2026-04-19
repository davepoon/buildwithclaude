---
name: ops-revenue
description: Revenue and costs tracker. AWS spend via aws ce, credits tracker, project revenue stages. Shows burn rate, runway estimate, credits expiring.
argument-hint: "[costs|revenue|credits|runway|all]"
allowed-tools:
  - Bash
  - Read
  - Grep
  - Glob
  - Skill
  - AskUserQuestion
  - WebFetch
  - Write
effort: low
maxTurns: 20
disallowedTools:
  - Edit
  - NotebookEdit
---

# OPS ► REVENUE & COSTS

## Runtime Context

Before executing, load available context:

1. **Preferences**: Read `${CLAUDE_PLUGIN_DATA_DIR:-$HOME/.claude/plugins/data/ops-ops-marketplace}/preferences.json`
   - `timezone` — display all timestamps correctly

2. **Daemon health**: Read `${CLAUDE_PLUGIN_DATA_DIR}/daemon-health.json`
   - If `action_needed` is not null → surface it before the cost report

3. **Secrets**: AWS Cost Explorer requires credentials.
   ### Secret Resolution
   - AWS: check `$AWS_PROFILE` / `$AWS_ACCESS_KEY_ID` → `doppler secrets get AWS_ACCESS_KEY_ID --plain` → vault query cmd from prefs
   - If no credentials available, report "AWS costs unavailable — credentials not configured" and show only the revenue pipeline from registry

## CLI/API Reference

### aws CLI (Cost Explorer)

| Command | Usage | Output |
|---------|-------|--------|
| `aws ce get-cost-and-usage --time-period Start=<YYYY-MM-DD>,End=<YYYY-MM-DD> --granularity MONTHLY --metrics "UnblendedCost" --group-by "Type=DIMENSION,Key=SERVICE" --output json` | Cost by service | Cost JSON |
| `aws ce get-cost-and-usage --time-period Start=<YYYY-MM-DD>,End=<YYYY-MM-DD> --granularity MONTHLY --metrics "UnblendedCost" --output json` | Total cost | Cost JSON |
| `aws ce get-cost-forecast --time-period Start=<YYYY-MM-DD>,End=<YYYY-MM-DD> --metric "UNBLENDED_COST" --granularity MONTHLY --output json` | End-of-month forecast | Forecast JSON |
| `aws ce list-savings-plans-purchase-recommendation --output json` | Savings plan recommendations | JSON |

---

## Phase 1 — Gather financial data in parallel

### AWS costs (current month)

```bash
aws ce get-cost-and-usage \
  --time-period "Start=$(date +%Y-%m-01),End=$(date +%Y-%m-%d)" \
  --granularity MONTHLY \
  --metrics "UnblendedCost" \
  --group-by "Type=DIMENSION,Key=SERVICE" \
  --output json 2>/dev/null
```

### AWS costs (last 3 months trend)

```bash
aws ce get-cost-and-usage \
  --time-period "Start=$(date -v-3m +%Y-%m-01 2>/dev/null || date -d '3 months ago' +%Y-%m-01),End=$(date +%Y-%m-%d)" \
  --granularity MONTHLY \
  --metrics "UnblendedCost" \
  --output json 2>/dev/null
```

### AWS credits remaining

```bash
aws ce list-savings-plans-purchase-recommendation --output json 2>/dev/null || echo '{}'
aws ce get-credits --output json 2>/dev/null || echo "credits API unavailable"
```

### AWS cost forecast (end of month)

```bash
aws ce get-cost-forecast \
  --time-period "Start=$(date +%Y-%m-%d),End=$(date +%Y-%m-28)" \
  --metric "UNBLENDED_COST" \
  --granularity MONTHLY \
  --output json 2>/dev/null
```

### Project registry (revenue stage)

```bash
cat "${CLAUDE_PLUGIN_ROOT}/scripts/registry.json" 2>/dev/null | jq '[.projects[] | {alias, name, stage: (.revenue_stage // .revenue.stage // "pre-revenue"), mrr: (.mrr // 0), source: (.source // "git"), type: (.type // "repo")}]'
```

### External project revenue (Shopify, custom SaaS)

```!
${CLAUDE_PLUGIN_ROOT}/bin/ops-external 2>/dev/null || echo '[]'
```

For Shopify projects showing `status: "healthy"`, pull GMV via Shopify Admin API:

```bash
# For each Shopify project in registry with valid credentials:
STORE_URL="[from project.shopify.store_url]"
TOKEN="[from env var named in project.shopify.credential_key]"
curl -s -H "X-Shopify-Access-Token: $TOKEN" \
  "https://$STORE_URL/admin/api/2024-10/orders.json?status=any&created_at_min=$(date -v-30d +%Y-%m-%dT00:00:00Z 2>/dev/null)&limit=250" 2>/dev/null
```

Include Shopify GMV in the revenue pipeline table with source=shopify.

---

## Phase 2 — Render dashboard

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 OPS ► REVENUE & COSTS — [month]
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

AWS SPEND
 This month to date:  $[X]
 Forecast (EOM):      $[X]
 Last month:          $[X]
 MoM change:          [+/-X%]

 Top services:
 [service]  $[X]  ([%] of total)
 [service]  $[X]
 ...

CREDITS
 AWS credits remaining:  $[X]
 Expires:                [date]
 Burn rate at current:   [N months remaining]

REVENUE PIPELINE
 PROJECT        SOURCE     STAGE           MRR/GMV    STATUS
 ──────────────────────────────────────────────────────────────
 [project]      git        [stage]         $[X]       [status]
 [project]      shopify    [stage]         $[X] GMV   [status]
 [project]      custom     [stage]         $[X]       [status]
 ...
 ──────────────────────────────────────────────────────────────
 TOTAL MRR                                 $[X]
 TOTAL SHOPIFY GMV (30d)                   $[X]

RUNWAY ESTIMATE
 Monthly burn (AWS):  $[X]
 Total MRR:           $[X]
 Net burn:            $[X/month]
 Credits cover:       [N months]
 Cash runway:         [depends on external data]

──────────────────────────────────────────────────────
```

Use **batched AskUserQuestion calls** (max 4 options each):

AskUserQuestion call 1:
```
  [Drill into AWS costs by service]
  [Show cost anomalies (spike detection)]
  [Export cost report]
  [More...]
```

AskUserQuestion call 2 (only if "More..."):
```
  [Update project revenue stage]
  [Set budget alert]
```

---

## Route by `$ARGUMENTS`

| Argument | Action                       |
| -------- | ---------------------------- |
| costs    | Show only AWS cost breakdown |
| credits  | Show only credits and expiry |
| revenue  | Show only revenue pipeline   |
| runway   | Calculate and show runway    |
| (empty)  | Show full dashboard          |

Use AskUserQuestion after the dashboard for next action.

---

## Native tool usage

### WebFetch — billing API fallback

When `aws ce` commands fail or return incomplete data, use `WebFetch` to query the AWS Cost Explorer API directly. Also useful for fetching Stripe/billing provider data if configured.

### Write — export reports

When user selects "Export cost report" (option c), use `Write` to save the report as a dated file:
```
Write(file_path: "/tmp/ops-revenue-[date].md", content: "[formatted report]")
```
