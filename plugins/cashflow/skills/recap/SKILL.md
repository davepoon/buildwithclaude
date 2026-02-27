---
name: recap
description: Triggered by "monthly recap", "how did I do this month", "spending summary", "financial review", "weekly recap", "quarterly review", "year in review"
---

# Financial Recap

Generate a narrative financial review for any time period.

## Workflow

1. **Determine the period.** Parse `$ARGUMENTS` for the time span:
   - "this week", "last week" → weekly
   - "this month", "january", "jan 2025", "2025-01" → monthly (default if no argument)
   - "this quarter", "Q1", "Q1 2025" → quarterly
   - "this year", "2025", "year in review" → yearly
   - Any explicit date range works too

2. **Fetch summary data.** Call the `query` MCP tool with `compare: "prior_period"`:
   ```json
   { "period": "<detected_period>", "compare": "prior_period", "include": ["ratios", "anomalies", "accounts"] }
   ```
   (Use `start`/`end` if a specific date range was requested.)

3. **Fetch year-ago comparison.** For anything other than year-over-year, also fetch the same period from a year ago to account for seasonality:
   ```json
   { "start": "<same_period_last_year_start>", "end": "<same_period_last_year_end>", "include": ["ratios"] }
   ```
   For example, if reviewing February 2026, also fetch February 2025.

4. **Fetch recurring bills.** Call the `query` MCP tool:
   ```json
   { "recurring": true }
   ```

5. **Synthesize a narrative recap** covering:
   - **Headline numbers**: total income, total expenses, net cash flow, savings rate
   - **vs. prior period**: changes from the immediately preceding period (last week, last month, etc.)
   - **vs. same period last year**: seasonal context — note whether changes are normal for this time of year or unusual (skip this section for year-over-year recaps)
   - **Anomalies**: unusual transactions or spending spikes
   - **Recurring bills**: new, changed, or cancelled subscriptions/bills
   - **Key ratios**: any ratios returned in the summary (e.g. expense-to-income)
   - **Account balances**: current balances and changes

6. **Tone**: Stick to the facts. Report what happened without judgement — no "great job" or "you need to cut back." Just clear, plain-language observations. Skip categories with trivial amounts.
