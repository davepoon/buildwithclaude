---
name: feraterra-arena
category: finance
description: "Query FeraTerra / Arena Exchange central limit order books, Spot/Perpetual/FormulaPerp/SpreadBook markets, Gladiator leaderboards, Keccak-256 + secp256k1 ledger tips, and stateless Eigen-SPAN order margin previews via hosted Streamable HTTP MCP (https://mcp.feraterra.app/mcp) or Python feraterra-sdk."
license: MIT
---

# FeraTerra / Arena Exchange

Query live crypto central limit order books (Spot, Linear Perpetuals, Formula Perpetuals, Bounded Claims, and Perp-Spot Basis `SpreadBook`s), verify signed WAL state roots, and run zero-mutation pre-trade Eigen-SPAN margin simulations through the FeraTerra MCP server or zero-dependency Python SDK (`feraterra-sdk`).

## Setup

### Option 1: Hosted Read-Only MCP Server (Zero Install)

Public market metadata, L2/L3 order books, OHLCV candles, Gladiator Leaderboard rankings, and cryptographic ledger-tip checks work immediately over Streamable HTTP with no API key:

```bash
claude mcp add --transport http feraterra https://mcp.feraterra.app/mcp
```

Or in `.mcp.json`:

```json
{
  "mcpServers": {
    "feraterra": {
      "type": "http",
      "url": "https://mcp.feraterra.app/mcp"
    }
  }
}
```

### Option 2: Local Testnet `stdio` MCP Server (`feraterra-sdk`)

For account-scoped pre-trade margin simulations (`arena_preview_order`), portfolio inspection, or Base Sepolia testnet (`https://testnet.feraterra.app`, `chain_id=84532`) onboarding with explicit notional caps, run the MIT-licensed package (`https://github.com/FeraTerra/feraterra-sdk`):

```bash
claude mcp add feraterra-testnet -- uvx feraterra-sdk --testnet --read-only
```

Remove `--read-only` and pass `--max-order-notional-usd 5000` only when the user explicitly authorizes testnet trading.

## Tools

Public read-only tools available on `https://mcp.feraterra.app/mcp` without credentials:

- `arena_health_and_manifest` - daemon health, `wal_seq`, double-entry conservation status, and protocol manifest
- `arena_list_markets` - active `spot`, `perp`, `formula_perp`, `bounded_claim`, and `spread_book` instruments with USD mark prices and best bid/ask
- `arena_get_orderbook` - live L2/L3 order book snapshot by unified symbol (`BTC/USD:USD`), native symbol (`BTC-USD-PERP`), or `market_id` (`depth` `1..200`)
- `arena_get_trades_and_candles` - recent fills and `tick`, `1s`, or `1m` OHLCV candles (`limit` `1..240`)
- `arena_get_leaderboard` - Gladiator Leaderboard ranked by `equity`, `pnl`, `streak`, `volume`, or `roi`
- `arena_verify_ledger_tip` - verifies the `ARENA_LEDGER_TIP_V2_1` `Keccak-256` + `secp256k1` operator signature on `GET /ledger/tip` (pass `expected_operator_address` to pin operator identity)

Account-scoped read-only tools (require an authenticated local `feraterra-sdk --testnet` session):

- `arena_preview_order` - stateless dry-run order simulation (`POST /order/preview`) returning estimated fill, fee, and pre-/post-trade Eigen-SPAN initial margin (`post_imr_micro`, `post_free_margin_micro`) with zero WAL mutation
- `arena_get_account_portfolio` - USD margin, Spot balances, open positions, IMR/MMR, drawdown stop, and resting orders
- `arena_get_withdrawals_and_escape_proof` - withdrawal vouchers and `ARENA_ESCAPE_LEAF_V1_4` Merkle emergency escape proof verification

## When to Use This Skill

- "Show the active perpetual and basis spread markets on FeraTerra with their current bid/ask spreads."
- "Fetch top 20 levels of the BTC-USD-PERP order book and recent 1m candles."
- "Verify FeraTerra's current WAL state root and operator signature."
- "Simulate the initial margin impact of a 0.05 BTC post-only buy order at $60,000 on Base Sepolia testnet."

## How to Use

1. Call `arena_list_markets` first if you need exact symbols, `market_id`, or tick/lot bounds.
2. Query `arena_get_orderbook`, `arena_get_trades_and_candles`, or `arena_get_leaderboard`, and report the returned `wal_seq` alongside formatted USD prices.
3. Keep fixed-point scales exact when reading raw integer fields or writing `feraterra_sdk` code: `1 tick = $0.01 USD`, `1 lot = 1e-4` base asset (`0.0001`), and `1 micro = 1e-6 USD`.
4. Before any mutating testnet call, run `arena_preview_order` and show the user the symbol, side, size, price, and `post_imr_micro` for confirmation.

## Example

**User**: "Check active markets on FeraTerra and verify the current ledger tip."

**Output**: Calls `arena_list_markets` (`active_only: true`) and `arena_verify_ledger_tip`, reporting active Spot, Perpetual, FormulaPerp, and Basis Spread markets with USD mark prices, best bid/offer, current `wal_seq`, `state_root`, and `signature_verified` status.

## Tips

- Calling `arena_preview_order` against the unauthenticated public HTTP endpoint returns `auth_required: true` (`HTTP 401`) because cross-margin impact depends on an account's portfolio; use local `uvx feraterra-sdk --testnet --read-only` with session credentials for previews.
- Machine-readable protocol docs and OpenAPI `3.1.0` schema are served at `https://testnet.feraterra.app/llms.txt` and `https://testnet.feraterra.app/openapi.json`.
- Never place private keys or API secrets in prompts, command arguments, or tracked files.
