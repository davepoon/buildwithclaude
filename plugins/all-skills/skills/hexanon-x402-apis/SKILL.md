---
name: hexanon-x402-apis
category: data-ai
description: Pay-per-call access to the Hexanon family of eight x402 APIs for autonomous agents — no signup, no API keys, USDC on Base. Covers US/Canada vehicle & VIN intelligence (Vindex), e-commerce demand signals (Demandex), Polymarket whale intelligence (OrcaTrace), GitHub trending-repo digests (gitBeacon), narrative intelligence (Signalis), Moltbook community digests (Moltalyzer), x402 seller conformance scanning (x402lint), and Polymarket weather-market signals (Isocast). Each origin serves a live /skill.md, /.well-known/x402, /.well-known/x402-resources.json and /openapi.json.
---

# Hexanon x402 APIs

Eight independently operated, pay-per-call HTTP APIs that an agent can call directly with USDC micropayments over [x402](https://x402.org) on Base — no accounts, no API keys. Probe any paid route unauthenticated to get a machine-readable HTTP 402 challenge, pay with any x402 client, and retry. Responses are only charged when the work succeeds (`charged: true`).

## When to Use This Skill

- Vehicle / VIN due diligence for a US or Canada used car (decode, recalls, known issues, pre-purchase report) — **Vindex**, `api.vindexapi.dev`
- Finding market gaps and product-demand signals — what buyers want but can't find — **Demandex**, `api.demandex.dev`
- Polymarket intelligence: whale positioning, signals, resolving-soon markets, track records — **OrcaTrace**, `api.orcatrace.dev`
- Developer-ecosystem intelligence: trending GitHub repositories and momentum — **gitBeacon**, `api.gitbeacon.dev`
- Narrative and content intelligence: emerging narratives, pulse content, intelligence briefs — **Signalis**, `api.signalis.dev`
- Moltbook community intelligence: digests and a Viral Advisor that scores/rewrites posts — **Moltalyzer**, `api.moltalyzer.xyz`
- Checking whether an x402 API origin conforms to what x402scan, Bazaar and agent buyers require — **x402lint**, `api.x402lint.dev`
- Polymarket weather-market bucket-transition signals — **Isocast**, `api.isocast.dev`

## What This Skill Does

1. **Points the agent at the right origin** for a task using the map above.
2. **Fetches the live skill** — each API serves its current endpoints and prices at `https://<origin>/skill.md`; fetch that before calling so prices are never stale.
3. **Probes a paid route unauthenticated** to receive the HTTP 402 challenge with its `accepts` block.
4. **Pays and retries** with an x402 client (for example `npx agentcash fetch <url>`, or `@x402/fetch`).
5. **Uses the free routes first** — every product exposes free sample/index routes and a free `/.well-known/hexanon` family catalog, so an agent can preview shapes before paying.

## How to Use

### Basic Usage

```
Fetch https://api.vindexapi.dev/skill.md, then run a pre-purchase check for VIN <VIN>.
```

```
Get the current Polymarket whale signals from OrcaTrace (api.orcatrace.dev).
```

## Example

**User**: "Decode this VIN and tell me about recalls."

**Output**:
```
1. GET https://api.vindexapi.dev/v1/decode?vin=<VIN>  -> HTTP 402 challenge
2. Pay via x402 (USDC on Base) and retry -> normalized NHTSA vPIC decode
3. GET https://api.vindexapi.dev/v1/recalls?vin=<VIN> -> merged US (NHTSA) + Canada recalls
```

## Tips

- Fund a Base (eip155:8453) wallet with USDC before calling paid routes; free sample routes need no payment.
- The live `<origin>/skill.md` and `<origin>/openapi.json` are authoritative for endpoints and prices — always prefer them over any snapshot.
- Conformance or directory listing does not imply endorsement. These are eight separate APIs under the Hexanon family (hexanon.dev).
