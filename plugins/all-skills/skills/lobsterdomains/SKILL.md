---
name: lobsterdomains
category: ecommerce
description: Register ICANN domains with crypto payments (USDC/USDT/ETH/BTC) via API — built for AI agents
---

# LobsterDomains

Register .com, .xyz, .org and 1000+ ICANN domains with cryptocurrency payments via a simple REST API. Built for AI agents to acquire domains fully autonomously.

## When to Use This Skill

- User wants to check if a domain name is available
- User wants to register a domain programmatically without browser interaction
- User wants to pay for domain registration with crypto (USDC/USDT/ETH/BTC)

## What This Skill Does

1. Checks domain availability and live pricing
2. Accepts on-chain payment (USDC/USDT on Ethereum, Arbitrum, Base, or Optimism)
3. Registers the domain and returns DNS management credentials

## Usage

```bash
# Check availability
curl "https://lobsterdomains.xyz/api/v1/domains/check?domain=example.com" \
  -H "Authorization: Bearer $LOBSTERDOMAINS_API_KEY"

# Register after payment
curl -X POST https://lobsterdomains.xyz/api/v1/domains/register \
  -H "Authorization: Bearer $LOBSTERDOMAINS_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"domain":"example.com","tx_hash":"0x...","contact":{"name":"...","email":"..."}}'
```

## Setup

Generate an API key at https://lobsterdomains.xyz/api-keys (requires Ethereum wallet auth).

## Links

- Website: https://lobsterdomains.xyz
- ClawHub: https://clawhub.ai/esokullu/lobsterdomains
- Full docs: https://lobsterdomains.xyz/skills.md
