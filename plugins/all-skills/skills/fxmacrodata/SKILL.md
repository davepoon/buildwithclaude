---
name: fxmacrodata
category: finance
description: "Look up official macroeconomic releases, central-bank policy rates, release calendars and FX rates for 22 currencies through the FXMacroData MCP server. Use for questions about CPI, GDP, jobs data, rate decisions, bond yields or what data is due next, when the answer should come from the published number rather than news coverage. Remote server at https://mcp.fxmacrodata.com/mcp; USD works without a key."
---

# FXMacroData

Official-source macro and FX data via the FXMacroData MCP server: indicator histories, latest prints, scheduled releases, policy rates and FX rates for AUD, BRL, CAD, CHF, CNH, CNY, DKK, EUR, GBP, HUF, ILS, JPY, KRW, MYR, NGN, NOK, NZD, PEN, SEK, THB, TWD and USD.

## Setup

The server is remote (Streamable HTTP), so there is nothing to install. USD data works without an API key: each release becomes readable 15 minutes after publication and covers the most recent 90 days, with a fair-use allowance of about 100 requests a day. Other currencies, FX rates, real-time releases and full history need a key from [FXMacroData](https://fxmacrodata.com/subscribe?utm_source=github&utm_medium=referral&utm_campaign=buildwithclaude&utm_content=skill).

Without a key:

```bash
claude mcp add --transport http fxmacrodata https://mcp.fxmacrodata.com/mcp
```

With a key, set `FXMACRODATA_API_KEY` in your environment and send it as a bearer token:

```bash
claude mcp add --transport http fxmacrodata https://mcp.fxmacrodata.com/mcp --header "Authorization: Bearer ${FXMACRODATA_API_KEY}"
```

Or in `.mcp.json`:

```json
{
  "mcpServers": {
    "fxmacrodata": {
      "type": "http",
      "url": "https://mcp.fxmacrodata.com/mcp",
      "headers": {
        "Authorization": "Bearer ${FXMACRODATA_API_KEY}"
      }
    }
  }
}
```

Full tool reference: [MCP server docs](https://fxmacrodata.com/documentation/mcp-server?utm_source=github&utm_medium=referral&utm_campaign=buildwithclaude&utm_content=skill).

## Tools

- `data_catalogue` - the indicator slugs available for a currency, with coverage dates. Call it first; slugs differ by currency
- `indicator_query` - latest value and history for one indicator, each row with its release timestamp and the official source URL
- `latest_announcements` - the most recent print of every indicator for a currency
- `release_calendar` - scheduled releases, with confirmed times where the publisher has announced them
- `forex` - FX rate history for a pair (key required)
- `rate_differentials` and `rate_curve` - policy-rate gaps between two currencies and government yield curves
- `cot_data`, `commodities`, `market_sessions` - CFTC positioning, metals and energy prices, and which FX sessions are open

The server also exposes multi-step research tools (`macro_briefing_task`, `pair_intel_task` and others) that this skill does not cover.

## When to Use

- "What did US CPI print this morning, and how does it compare with last month?"
- "When is the next ECB decision?"
- "Show the RBA cash rate over the last two years"
- "What US data is due this week?"

Any question where the answer is a published statistic or a scheduled release.

## How to Use

1. Call `data_catalogue` for the currency to get the exact indicator slug (for example `inflation`, `core_inflation`, `policy_rate`, `unemployment`).
2. Use `indicator_query` with that slug for the latest print and history, or `release_calendar` for what is coming up.
3. Report the value with its period, release time and the publisher (for example "Bureau of Labor Statistics, via FXMacroData"), and link the `source_url`.
4. Keep released values and forecasts apart. Released prints come from `indicator_query`; forecasts are a separate tool and are labelled with how they were produced.

**User**: "Has the Fed moved rates this year?"

**Output**: the policy-rate history for USD since January with each decision date, the current level, and the date of the next scheduled decision from the calendar.

## Tips

- A `subscription_required` result means the data exists but needs a key. Say so plainly and answer the USD equivalent if that helps; do not describe it as missing.
- If a USD result reports a withheld release, the number has been published and will be readable within 15 minutes.
- Keep calls narrow: one currency and indicator per call, and use `limit` on history.
- If the server isn't configured, tell the user to add it with the command above.
