---
name: coinpaprika-api
category: analytics
description: "Access cryptocurrency market data from CoinPaprika: prices, tickers, OHLCV, exchanges, contract lookups for 12,000+ coins and 350+ exchanges. Free tier, no API key needed. Install MCP: add https://mcp.coinpaprika.com/sse as SSE server, or install plugin: /plugin marketplace add coinpaprika/claude-marketplace"
---

# CoinPaprika API

Access cryptocurrency market data for 12,000+ coins and 350+ exchanges via the CoinPaprika MCP server.

## Setup

Add the MCP server to your Claude Code config:

```json
{
  "mcpServers": {
    "coinpaprika": {
      "url": "https://mcp.coinpaprika.com/sse"
    }
  }
}
```

Or install the full plugin (includes agent + skill):
```
/plugin marketplace add coinpaprika/claude-marketplace
/plugin install coinpaprika@coinpaprika-plugins
```

## Available MCP Tools (29)

- `getGlobal` — Total market cap, BTC dominance, 24h volume
- `getTickers` / `getTickersById` — Price, market cap, volume for coins
- `getTickersHistoricalById` — Historical price ticks
- `getCoins` / `getCoinById` — Coin details, descriptions, links, teams
- `getCoinEvents` / `getCoinExchanges` / `getCoinMarkets` — Events, exchange listings, trading pairs
- `getCoinOHLCVHistorical` / `getCoinOHLCVLatest` / `getCoinOHLCVToday` — Candlestick data
- `getExchanges` / `getExchangeByID` / `getExchangeMarkets` — Exchange data
- `getPlatforms` / `getContracts` / `getTickerByContract` / `getHistoricalTickerByContract` — Contract lookups
- `search` / `resolveId` — Find coins, exchanges, people, tags
- `priceConverter` — Convert between currencies
- `getTags` / `getTagById` / `getPeopleById` — Categories and team info
- `keyInfo` / `getMappings` / `getChangelogIDs` / `status` — Account and metadata

## Coin ID Format

Pattern: `{symbol}-{name}` lowercase. Examples: `btc-bitcoin`, `eth-ethereum`, `sol-solana`.

Use `search` or `resolveId` if unsure of the correct ID.

## Rate Limits

- Free tier: 20,000 calls/month, no API key needed
- Pro tier: higher limits via api-pro.coinpaprika.com
- Docs: https://docs.coinpaprika.com
