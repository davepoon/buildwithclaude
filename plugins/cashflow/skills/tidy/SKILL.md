---
name: tidy
description: Triggered by "tidy up", "clean up transactions", "categorize uncategorized", "organize my transactions"
---

# Tidy Up Uncategorized Transactions

Batch-categorize uncategorized transactions by clustering similar ones and applying categories in bulk.

## Workflow

1. **Fetch uncategorized transactions.** Call the `query` MCP tool:
   ```json
   { "detail": true, "is_uncategorized": true, "period": "last_90d", "limit": 200, "sort": "-amount" }
   ```
   If `$ARGUMENTS` contains a time period (e.g. "this month", "last 30 days"), use that instead of `last_90d`.

2. **Research unknown transactions.** For transactions you can't identify from the description alone:
   - **Web search first** (if available): Search for the merchant name, any phone numbers or domains in the description, or the raw description itself. This often reveals the business behind cryptic processor names.
   - **Search the user's email** (if available): Search for the party/merchant name to find order confirmations or receipts. If that doesn't match, search for the exact dollar amount (e.g. "$47.23") to find receipts that way.

3. **Cluster by pattern.** Group the results by normalized description or party name. For each cluster, note the count and total amount.

4. **Suggest categorization.** For each cluster, propose:
   - A **category** (pick from the user's existing categories)
   - A **party** name (the clean merchant/counterparty name)

5. **Present to the user.** Show a table or list of clusters with:
   - Pattern / merchant name
   - Count of transactions
   - Total amount
   - Suggested category
   - Whether you recommend creating a rule

   Ask the user to approve, modify, or skip each cluster.

6. **Prefer rules over one-off annotations.** If a cluster has more than one transaction, or the merchant is likely to appear again (subscriptions, regular stores, utilities, etc.), create a rule rather than annotating individual transactions. Rules automatically categorize future transactions too.
   - Preview first: `admin { "entity": "rule", "action": "preview", ... }`
   - Show the preview (how many existing transactions would match)
   - If user confirms, create: `admin { "entity": "rule", "action": "create", ... }`

7. **Annotate the rest.** For truly one-off transactions where a rule wouldn't help, apply directly:
   ```json
   { "action": "categorize", "filter": { "search": "<pattern>" }, "category_name": "<approved_category>" }
   ```
   Also set the party if one was approved:
   ```json
   { "action": "set_party", "filter": { "search": "<pattern>" }, "party_name": "<approved_party>" }
   ```

8. **Summarize.** Report how many transactions were categorized, how many rules were created, and how many uncategorized transactions remain.

## Tone

Stick to the facts. Present findings and suggestions without judgement — no commentary on spending habits. Just clear, plain-language observations and actionable options.
