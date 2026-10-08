# Equibles

US stock market research inside Claude Code, through the hosted Equibles MCP server.
SEC filings with full-text search, XBRL financial statements, earnings call transcripts,
insider and congressional trades, 13F institutional holdings, short interest, end-of-day
prices, option chains and macroeconomic data, each answer linked to its source.

```
/plugin install equibles@buildwithclaude
```

Then run `/mcp`, select `equibles` and choose **Authenticate** to sign in over OAuth
(sign in or create a free account). Or register the server directly:

```
claude mcp add --transport http equibles https://mcp.equibles.com/mcp
```

An API key also works: create one at <https://equibles.com/dashboard/apikeys> and send it as
an `Authorization: Bearer` header.

## What you can ask

- "Using Equibles, who are NVIDIA's top institutional holders? Include the reporting period."
- "Summarize Microsoft's most recent earnings call."
- "What did Apple's latest 10-K say about tariffs? Quote the passage."
- "Show Ford's annual net income for the last five years."
- "Which Intel insiders bought or sold shares this year?"
- "Screen for stocks with short interest above 20%."

Naming Equibles in the prompt helps Claude pick these tools over its own memory.

## Tools

117 tools. The main groups:

| Group | Tools |
|---|---|
| Filings | `SearchDocuments`, `SearchDocument`, `ReadDocumentLines`, `ListFilings` |
| Financials | `GetFinancialStatement`, `GetFinancialFact`, `CompareFinancialFact`, `GetValuationMultiples` |
| Earnings calls | `GetEarningsCallTranscript`, `GetEarningsCallToneAndThemes`, `GetEarningsBrief` |
| Ownership | `GetTopHolders`, `GetInstitutionPortfolio`, `GetInsiderTransactions`, `GetCongressionalTrades` |
| Market data | `GetStockPrices`, `GetShortInterest`, `ScreenStocks`, `GetOptionChain` |
| Macro | `SearchEconomicIndicators`, `GetEconomicIndicator`, `GetEconomicCalendar` |

Full reference: <https://equibles.com/docs/mcp/tools>

## Plans

Free plan: 100 requests a day, shared between the MCP server and the REST API, resetting at
00:00 UTC; end-of-day prices; no credit card. Option chains and intraday quotes need a Plus or
Pro plan. Details: <https://equibles.com/pricing>

## Connection and safety

Installing the plugin registers the remote server (`.mcp.json`, streamable HTTP at
`https://mcp.equibles.com/mcp`). Listing tools needs no sign-in; calling them needs OAuth or an
API key, and an unauthenticated call returns `401` with a `WWW-Authenticate` header that points
Claude Code at the OAuth metadata.

The server is not entirely read-only. 107 of the 117 tools read market data and carry
`readOnlyHint: true`. The other ten write only to the signed-in user's own Equibles account:
portfolios and lots, the watchlist, problem reports and tool suggestions. The bundled skill
tells Claude to call those only when the user asks, and to treat all tool output as data to
validate, never as instructions. No tool places trades or moves money.

## Links

- Docs: <https://equibles.com/docs/mcp/claude-code>
- Source of the plugin manifests: <https://github.com/daniel3303/stock-market-mcp-server>
- Privacy: <https://equibles.com/legal/privacy> · Terms: <https://equibles.com/legal/terms>
