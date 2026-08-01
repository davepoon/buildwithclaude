---
name: hexanon-x402-apis
category: ai-agents
description: Pay-per-call access to the Hexanon family of eight x402 APIs for autonomous agents — no signup, no API keys, USDC on Base. Covers US/Canada vehicle & VIN intelligence (Vindex), e-commerce demand signals (Demandex), Polymarket whale intelligence (OrcaTrace), GitHub trending-repo digests (gitBeacon), narrative intelligence (Signalis), Moltbook community digests (Moltalyzer), x402 seller conformance scanning (x402lint), and Polymarket weather-market signals (Isocast).
---

# Hexanon x402 APIs

Eight independently operated, pay-per-call HTTP APIs that an agent can call directly with USDC micropayments over [x402](https://x402.org) on Base — no accounts, no API keys. Probe any paid route unauthenticated to get a machine-readable HTTP 402 challenge, pay with an x402 client, and retry. Responses are only charged when the work succeeds (`charged: true`).

All endpoint guidance an agent needs is inlined below (snapshot: 2026-08-01). Each origin also publishes a machine-readable `openapi.json` as its reference spec if you need parameter details.

## When to Use This Skill

- Vehicle / VIN due diligence for a US or Canada used car (decode, recalls, known issues, pre-purchase report) — **Vindex**, `api.vindexapi.dev`
- Finding market gaps and product-demand signals — what buyers want but can't find — **Demandex**, `api.demandex.dev`
- Polymarket intelligence: whale positioning, signals, resolving-soon markets, track records — **OrcaTrace**, `api.orcatrace.dev`
- Developer-ecosystem intelligence: trending GitHub repositories and momentum — **gitBeacon**, `api.gitbeacon.dev`
- Narrative and content intelligence: emerging narratives, pulse content, intelligence briefs — **Signalis**, `api.signalis.dev`
- Moltbook community intelligence: digests and a Viral Advisor that scores/rewrites posts — **Moltalyzer**, `api.moltalyzer.xyz`
- Checking whether an x402 API origin conforms to what x402scan, Bazaar and agent buyers require — **x402lint**, `api.x402lint.dev`
- Polymarket weather-market bucket-transition signals — **Isocast**, `api.isocast.dev`

## Endpoints (snapshot 2026-08-01)

Every product exposes free sample/index routes, so an agent can preview response shapes before paying. Prices below are USDC on Base (eip155:8453); the live 402 challenge on each route is always the exact price at call time.

### Vindex — vehicle & VIN intelligence (`https://api.vindexapi.dev`)

| Method | Path | Price | What you get |
|---|---|---|---|
| GET | /v1/sample/decode | free | Sample VIN decode (fixed sample vehicle) |
| GET | /v1/decode?vin= | $0.01 | Normalized NHTSA vPIC VIN decode |
| GET | /v1/recalls?vin= | $0.01 | Merged US (NHTSA) + Canada (Transport Canada) recalls |
| GET | /v1/known-issues?vin= | $0.05 | LLM-clustered named failure modes with verified ODI citations |
| GET | /v1/purchase-costs | $0.02 | Itemized US + Canada used-vehicle closing costs (country=CA\|US) |
| GET | /v1/prepurchase?vin= | $0.25 | Whole-job pre-purchase report: decode + recalls + known issues + costs |

### Demandex — e-commerce demand signals (`https://api.demandex.dev`)

| Method | Path | Price | What you get |
|---|---|---|---|
| GET | /v1/categories | free | Category index |
| GET | /v1/sample/opportunity | free | Sample opportunity card |
| GET | /v1/opportunities/trending | $0.01 | Trending demand opportunities (teaser) |
| GET | /v1/opportunities?category= | $0.02 | Opportunities in a category |
| GET | /v1/opportunity?id= | $0.05 | Full opportunity card |
| POST | /v1/gauge | $0.03 | Demand verdict for a product idea (cached corpus) |
| GET | /v1/brief | $0.25 | Whole-job demand brief: trending + top opportunities + landscape |

### OrcaTrace — Polymarket whale intelligence (`https://api.orcatrace.dev`)

| Method | Path | Price | What you get |
|---|---|---|---|
| GET | /v1/pulse | free | Top-3 movers brief |
| GET | /v1/track-record | free | Whale-calibration scorecard |
| GET | /v1/signal | $0.01 | One Polymarket feed item |
| GET | /v1/resolving | $0.02 | Markets resolving soon |
| GET | /v1/whales | $0.05 | Whale calibration table |
| GET | /v1/digest | $0.10 | Polymarket Intelligence Digest |
| GET | /v1/research?market= | $1.00 | Single-market deep-dive research |

### gitBeacon — GitHub trending intelligence (`https://api.gitbeacon.dev`)

| Method | Path | Price | What you get |
|---|---|---|---|
| GET | /v1/digests/latest | free | Latest GitHub digest |
| GET | /v1/repos | $0.01 | Top trending repos |
| GET | /v1/digests | $0.05 | Historical GitHub digests |

### Signalis — narrative intelligence (`https://api.signalis.dev`)

| Method | Path | Price | What you get |
|---|---|---|---|
| GET | /v1/intelligence/latest | free | Latest Master Intelligence digest |
| GET | /v1/pulse/narratives | $0.01 | Active AI-business narratives |
| GET | /v1/pulse/content/recent | $0.02 | Raw recent content items |
| GET | /v1/intelligence/history | $0.03 | Historical master digests |

### Moltalyzer — Moltbook community intelligence (`https://api.moltalyzer.xyz`)

| Method | Path | Price | What you get |
|---|---|---|---|
| GET | /api/moltbook/digests/latest | free | Latest Moltbook digest |
| GET | /api/moltbook/digests | $0.02 | Historical Moltbook digests |
| POST | /api/moltbook/advisor | $0.05 | Viral Advisor: scores/rewrites a post |

### x402lint — x402 seller conformance (`https://api.x402lint.dev`)

| Method | Path | Price | What you get |
|---|---|---|---|
| GET | /v1/checks | free | Full check catalog |
| GET | /v1/directory | free | Graded directory of scanned x402 origins |
| GET | /v1/status?url= | free | Scan freshness + grade summary for an origin |
| POST | /v1/scan | $0.15 | Full 25-check conformance scan with A–F grade |
| GET | /v1/report?url= | $0.02 | Cached full report |

### Isocast — Polymarket weather-market signals (`https://api.isocast.dev`)

| Method | Path | Price | What you get |
|---|---|---|---|
| GET | /v1/cities | free | All active cities |
| GET | /v1/sample | free | Promo signal (shape demo) |
| GET | /v1/spot?city= | $0.01 | Latest-signal snapshot for a city |
| POST | /v1/subscribe | $0.01–$7.00 | Prepay the next N signals for a city (bundle) |

## How Payment Works

1. **Probe a paid route unauthenticated** — the API answers `HTTP 402` with an `accepts` block naming the exact price, asset (USDC), network (Base) and pay-to address.
2. **Pay and retry** using a pinned x402 client library in your own code, e.g. [`@x402/fetch`](https://www.npmjs.com/package/@x402/fetch) (`npm install @x402/fetch @x402/evm viem` at a pinned version and wrap `fetch` with your wallet signer). Avoid piping URLs through unpinned, runtime-installed CLI tools.
3. **Wallet setup is a human step**: fund a Base (eip155:8453) wallet with USDC and provision its key to your agent before enabling paid calls. Free routes need no wallet.

## Example

**User**: "Decode this VIN and tell me about recalls."

**Output**:
```
1. GET https://api.vindexapi.dev/v1/decode?vin=<VIN>  -> HTTP 402 challenge
2. Pay via x402 client (USDC on Base) and retry -> normalized NHTSA vPIC decode
3. GET https://api.vindexapi.dev/v1/recalls?vin=<VIN> -> merged US (NHTSA) + Canada recalls
```

## Tips

- Try the free sample/index routes first to see response shapes before spending anything.
- Prices in this document are a reviewed snapshot; the 402 challenge on each route is always the exact, current price — your x402 client sees it before paying, so a stale snapshot can never overcharge you.
- Each origin's `openapi.json` is its machine-readable reference spec for parameters and response schemas.
- Conformance or directory listing does not imply endorsement. These are eight separate APIs under the Hexanon family ([hexanon.dev](https://hexanon.dev)).
