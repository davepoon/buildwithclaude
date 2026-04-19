---
name: revenue-tracker
description: Revenue, billing, and credits analysis agent. Pulls real revenue data from Stripe (SaaS) and RevenueCat (mobile subs), queries AWS Cost Explorer for spend, and cross-references project revenue stages. Returns structured financial snapshot.
model: claude-sonnet-4-6
effort: high
maxTurns: 30
tools:
  - Bash
  - Read
disallowedTools:
  - Write
  - Edit
  - Agent
memory: project
initialPrompt: "Pull live revenue from Stripe + RevenueCat, query AWS costs, check credit balances, and cross-reference project revenue. Return financial snapshot."
---

# REVENUE TRACKER AGENT

Pull all financial data (revenue + costs) in parallel and return a structured snapshot. Read-only.

## Task

Run all queries in parallel. Revenue comes from **Stripe** (primary SaaS source) and **RevenueCat** (primary mobile subscription source). Costs come from AWS Cost Explorer. Fall back to `registry.json` only when both revenue APIs are unconfigured.

---

## Revenue — Stripe (SaaS)

Only run if `STRIPE_SECRET_KEY` is set. If not, emit `stripe: not_configured` and skip this block.

### Recent charges (for MTD + trailing-30d gross)

```bash
# Paginate through all charges using has_more + starting_after loop
AFTER=""
while true; do
  PARAMS="limit=100${AFTER:+&starting_after=$AFTER}"
  PAGE=$(curl -s "https://api.stripe.com/v1/charges?$PARAMS" \
    -u "$STRIPE_SECRET_KEY:" 2>/dev/null)
  echo "$PAGE"
  HAS_MORE=$(echo "$PAGE" | jq -r '.has_more')
  [ "$HAS_MORE" = "true" ] || break
  AFTER=$(echo "$PAGE" | jq -r '.data[-1].id')
done
```

Collect all pages. Filter `data[].created >= first-of-month` for MTD gross; filter `data[].created >= now - 30d` for trailing-30d gross. Sum `amount` in cents, divide by 100. Only count `status=succeeded` and `paid=true`; subtract `amount_refunded`.

### Active subscriptions (MRR)

```bash
# Paginate through all active subscriptions using has_more + starting_after loop
AFTER=""
while true; do
  PARAMS="status=active&limit=100${AFTER:+&starting_after=$AFTER}"
  PAGE=$(curl -s "https://api.stripe.com/v1/subscriptions?$PARAMS" \
    -u "$STRIPE_SECRET_KEY:" 2>/dev/null)
  echo "$PAGE"
  HAS_MORE=$(echo "$PAGE" | jq -r '.has_more')
  [ "$HAS_MORE" = "true" ] || break
  AFTER=$(echo "$PAGE" | jq -r '.data[-1].id')
done
```

MRR = sum over all pages: `data[].items.data[].price.unit_amount * items.data[].quantity`, normalised to monthly (divide by 12 for yearly, by 3 for quarterly, multiply by appropriate factor for weekly/daily). Convert cents → dollars.

### Balance (pending + available)

```bash
curl -s https://api.stripe.com/v1/balance -u "$STRIPE_SECRET_KEY:" 2>/dev/null
```

Sum USD entries in `.pending[]` and `.available[]`.

### Disputes

```bash
curl -s "https://api.stripe.com/v1/disputes?limit=10" \
  -u "$STRIPE_SECRET_KEY:" 2>/dev/null
```

Count entries and sum `amount` in USD.

### Open (unpaid) invoices

```bash
curl -s "https://api.stripe.com/v1/invoices?status=open&limit=50" \
  -u "$STRIPE_SECRET_KEY:" 2>/dev/null
```

Count and sum `amount_due`.

### Churn — subscriptions cancelled in the last 30d

```bash
TS_30D=$(date -v-30d +%s 2>/dev/null || date -d "-30 days" +%s)
# Paginate through all recently-cancelled subscriptions
AFTER=""
while true; do
  PARAMS="status=canceled&canceled_at[gte]=$TS_30D&limit=100${AFTER:+&starting_after=$AFTER}"
  PAGE=$(curl -s "https://api.stripe.com/v1/subscriptions?$PARAMS" \
    -u "$STRIPE_SECRET_KEY:" 2>/dev/null)
  echo "$PAGE"
  HAS_MORE=$(echo "$PAGE" | jq -r '.has_more')
  [ "$HAS_MORE" = "true" ] || break
  AFTER=$(echo "$PAGE" | jq -r '.data[-1].id')
done
```

Count total cancelled subs across all pages as `recently_cancelled`. Use the active sub count from the MRR query above as `subs_now`. `churn_rate_pct = recently_cancelled / (subs_now + recently_cancelled) * 100` (0 if denominator is 0).

---

## Revenue — RevenueCat (mobile subscriptions)

Only run if `REVENUECAT_API_KEY` is set AND a project ID is available (from `$REVENUECAT_PROJECT_ID` env or `$PREFS_PATH` → `revenue.revenuecat.project_id`). If either is missing, emit `revenuecat: not_configured` and skip.

### Overview metrics (MRR, revenue, active subs)

```bash
curl -s -H "Authorization: Bearer $REVENUECAT_API_KEY" \
  "https://api.revenuecat.com/v2/projects/$REVENUECAT_PROJECT_ID/metrics/overview" 2>/dev/null
```

Extract `mrr`, `revenue` (trailing 30d), `active_subscriptions`, `active_trials`.

### Active subscribers (count)

```bash
curl -s -H "Authorization: Bearer $REVENUECAT_API_KEY" \
  "https://api.revenuecat.com/v2/projects/$REVENUECAT_PROJECT_ID/metrics/active_subscribers" 2>/dev/null
```

### Churn rate

Pull from the metrics overview response (`churn_rate` or equivalent field). If not present, compute from `active_subscriptions` now vs. 30d ago using the same endpoint with a `period` query param.

---

## Costs — AWS (existing)

### Current month costs by service

```bash
aws ce get-cost-and-usage \
  --time-period "Start=$(date +%Y-%m-01),End=$(date +%Y-%m-%d)" \
  --granularity MONTHLY \
  --metrics "UnblendedCost" "UsageQuantity" \
  --group-by "Type=DIMENSION,Key=SERVICE" \
  --output json 2>/dev/null
```

### Last 3 months trend

```bash
START=$(date -v-3m +%Y-%m-01 2>/dev/null || date -d "-3 months" +%Y-%m-01 2>/dev/null)
aws ce get-cost-and-usage \
  --time-period "Start=$START,End=$(date +%Y-%m-%d)" \
  --granularity MONTHLY \
  --metrics "UnblendedCost" \
  --output json 2>/dev/null
```

### End-of-month forecast

```bash
LAST_DAY=$(date -v$(date +%-m)m -v+1m -v-1d +%Y-%m-%d 2>/dev/null || date -d "$(date +%Y-%m-01) +1 month -1 day" +%Y-%m-%d 2>/dev/null)
aws ce get-cost-forecast \
  --time-period "Start=$(date +%Y-%m-%d),End=$LAST_DAY" \
  --metric "UNBLENDED_COST" \
  --granularity MONTHLY \
  --output json 2>/dev/null
```

### Cost anomalies

```bash
aws ce get-anomalies \
  --date-interval "StartDate=$(date -v-7d +%Y-%m-%d 2>/dev/null || date -d "-7 days" +%Y-%m-%d),EndDate=$(date +%Y-%m-%d)" \
  --output json 2>/dev/null || echo '{"Anomalies": []}'
```

### Shopify revenue (external projects)

Check registry for external Shopify projects and pull their revenue data:

```bash
SHOPIFY_PROJECTS=$(jq -c '[.projects[] | select(.source == "shopify")]' "${CLAUDE_PLUGIN_ROOT}/scripts/registry.json" 2>/dev/null)
```

For each Shopify project with valid credentials, query recent orders:

```bash
STORE_URL="[from project.shopify.store_url]"
TOKEN="[from env var named in project.shopify.credential_key]"
curl -s -H "X-Shopify-Access-Token: $TOKEN" \
  "https://$STORE_URL/admin/api/2024-10/orders.json?status=any&created_at_min=$(date -v-30d +%Y-%m-%dT00:00:00Z 2>/dev/null)&limit=250" 2>/dev/null
```

Sum `orders[].total_price` for trailing 30d GMV. Include in `revenue.breakdown.shopify_gmv`.

### Project registry (revenue metadata — fallback)

```bash
cat "${CLAUDE_PLUGIN_ROOT}/scripts/registry.json" 2>/dev/null | \
  jq '[.projects[] | {alias, name, revenue_stage: (.revenue_stage // "pre-revenue"), mrr: (.mrr // 0), arr: (.arr // 0)}]'
```

Use this only if BOTH `STRIPE_SECRET_KEY` and `REVENUECAT_API_KEY` are unset and no Shopify projects are configured. In that case populate `revenue.mrr` as the sum of `registry.json` project `mrr` values and set `mrr_source: "registry.json"`.

---

## Error handling

- If `STRIPE_SECRET_KEY` not set: skip Stripe block, include `"stripe": "not_configured"` in the output under `revenue.sources`.
- If `REVENUECAT_API_KEY` not set (or no project ID): skip RevenueCat, include `"revenuecat": "not_configured"`.
- If a curl returns a non-200 body (e.g. `{"error": ...}`), include the error key name in `revenue.errors[]` but do not abort — continue with partial data.
- If both Stripe and RevenueCat are missing: fall back to `registry.json` `revenue.mrr` per project (legacy behaviour) and set `mrr_source: "registry.json"`.

---

## Output format

```json
{
  "timestamp": "[ISO8601]",
  "revenue": {
    "mrr": 0,
    "mrr_source": "stripe+revenuecat",
    "mtd_gross": 0,
    "trailing_30d": 0,
    "breakdown": { "stripe_mrr": 0, "revenuecat_mrr": 0 },
    "subscriptions": { "active": 0, "30d_ago": 0, "churn_rate_pct": 0.0 },
    "open_invoices": { "count": 0, "total_usd": 0 },
    "disputes": { "count": 0, "total_usd": 0 },
    "pending_balance_usd": 0,
    "available_balance_usd": 0,
    "sources": { "stripe": "ok", "revenuecat": "ok" },
    "projects": [],
    "errors": []
  },
  "costs": {
    "current_month": {
      "to_date": 0.0,
      "forecast_eom": 0.0,
      "by_service": [{ "service": "[name]", "cost": 0.0, "pct": 0.0 }]
    },
    "trend": [{ "month": "[YYYY-MM]", "cost": 0.0 }],
    "mom_change_pct": 0.0,
    "anomalies": [],
    "credits": {
      "remaining": null,
      "expires": null,
      "note": "check AWS console"
    },
    "top_cost_drivers": [
      { "service": "[name]", "cost": 0.0, "trend": "up|down|stable" }
    ]
  },
  "runway": {
    "burn_rate_monthly": 0.0,
    "net_monthly": 0.0,
    "runway_months": "net positive"
  }
}
```

Calculations:

- `burn_rate_monthly` = `costs.current_month.forecast_eom` (or last full month if forecast unavailable).
- `net_monthly` = `revenue.mrr - burn_rate_monthly`. Positive = profitable, negative = burning.
- `runway_months`:
  - If `net_monthly >= 0`, set to `"net positive"`.
  - If `net_monthly < 0` and a cash balance is known (`revenue.available_balance_usd` or AWS credits), compute `cash / abs(net_monthly)` rounded to 1 decimal.
  - Otherwise `null`.

Print only the JSON to stdout.
