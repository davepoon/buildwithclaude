---
name: dexpaprika-api
category: analytics
description: "Access DeFi data from DexPaprika: token prices, liquidity pools, OHLCV, transactions across 34+ blockchains and 30M+ pools. Free, no API key needed. Install MCP: add https://mcp.dexpaprika.com/sse as SSE server, or install plugin: /plugin marketplace add coinpaprika/claude-marketplace"
---

# DexPaprika API

Access DeFi data across 34+ blockchains, 30M+ liquidity pools, and 28M+ tokens via the DexPaprika MCP server.

## Setup

Add the MCP server to your Claude Code config:

```json
{
  "mcpServers": {
    "dexpaprika": {
      "url": "https://mcp.dexpaprika.com/sse"
    }
  }
}
```

Or install the full plugin (includes agent + 4 skills):
```
/plugin marketplace add coinpaprika/claude-marketplace
/plugin install dexpaprika@coinpaprika-plugins
```

## Available MCP Tools (14)

- `getCapabilities` — Server capabilities, workflow examples, network synonyms
- `getNetworks` — List 34+ supported blockchains
- `getStats` — Platform-wide statistics
- `getNetworkDexes` — DEXes on a network
- `getNetworkPools` — Top pools (sortable by volume, price, txns)
- `getNetworkPoolsFilter` — Filter pools by volume, txns, creation date
- `getDexPools` — Pools for a specific DEX
- `getPoolDetails` — Pool details (tokens, volume, liquidity)
- `getPoolOHLCV` — Historical price candles (1m to 24h intervals)
- `getPoolTransactions` — Recent swaps and trades
- `getTokenDetails` — Token price, liquidity, metrics
- `getTokenPools` — All pools containing a token
- `getTokenMultiPrices` — Batch prices for up to 10 tokens
- `search` — Search tokens, pools, DEXes across all networks

## Common Network IDs

`ethereum`, `solana`, `bsc`, `polygon`, `arbitrum`, `base`, `avalanche`, `optimism`, `sui`, `ton`, `tron`

## Rate Limits

- Free: 10,000 requests/day, no API key needed
- Docs: https://docs.dexpaprika.com
- Streaming: https://streaming.dexpaprika.com (real-time SSE, ~1s updates)
