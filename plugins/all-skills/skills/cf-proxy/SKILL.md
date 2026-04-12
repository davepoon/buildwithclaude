---
name: cf-proxy
category: infrastructure-operations
description: Deploy a free VLESS proxy/VPN node on Cloudflare Pages using edgetunnel. Automates code download, UUID generation, Pages deployment, free domain registration (DNSExit), DNS configuration, custom domain binding, and client setup for Shadowrocket/v2rayN/Clash. Uses Cloudflare Pages (not Workers) because Pages supports CNAME-based custom domains from any DNS provider, avoiding the need to host DNS on Cloudflare.
---

# Cloudflare Proxy (cf-proxy)

Deploy a free VLESS proxy node on Cloudflare Pages + edgetunnel, with WebSocket over TLS through Cloudflare's global CDN.

## When to Use This Skill

- Setting up a free proxy/VPN node on Cloudflare
- Deploying edgetunnel to Cloudflare Workers or Pages
- Building a VLESS/Trojan/Shadowsocks proxy on Cloudflare's free tier
- Configuring a custom domain for a Cloudflare proxy to bypass SNI blocking
- Managing, updating, or troubleshooting an existing Cloudflare proxy node
- Registering a free domain for proxy use

## What This Skill Does

1. **Downloads edgetunnel** — fetches the worker code from GitHub (cmliu/edgetunnel, 30k+ stars)
2. **Generates credentials** — creates UUID for VLESS authentication and admin password
3. **Deploys to Cloudflare Pages** — not Workers, because Pages supports CNAME-based custom domains
4. **Registers a free domain** — via DNSExit (free 2-year second-level domains like `*.linkpc.net`)
5. **Configures DNS** — creates CNAME record pointing subdomain to `*.pages.dev`
6. **Binds custom domain** — attaches the domain to the Cloudflare Pages project
7. **Verifies and configures** — tests the node and provides client configuration

## How to Use

### Basic Usage

```
Help me set up a free Cloudflare proxy node
```

```
/cf-proxy
```

### With Specific Requirements

```
Deploy a VLESS proxy on Cloudflare using my domain example.com
```

```
Fix my Cloudflare proxy — Shadowrocket can't connect
```

## Architecture

```
Client (Shadowrocket / v2rayN / Clash)
  ↓ VLESS over WebSocket over TLS (port 443)
Custom Domain (CNAME → *.pages.dev)
  ↓
Cloudflare CDN (global edge)
  ↓
Cloudflare Pages Function (edgetunnel _worker.js)
  ↓ TCP outbound
Target Website
```

### Why Pages Instead of Workers?

- `workers.dev` domains are blocked at the TLS SNI layer by some firewalls
- Workers custom domains require DNS hosted on Cloudflare — not viable for free domains
- **Pages supports CNAME-based custom domains** from any DNS provider — the key advantage

## Cloudflare Free Tier Limits

| Resource | Free Quota | Impact on Proxy |
|----------|-----------|----------------|
| Requests | 100,000/day | WebSocket connection = 1 request; messages free |
| Bandwidth | **Unlimited** | No egress fees — biggest advantage |
| CPU time | 10 ms/request | Proxy is I/O-bound, typically <3ms |
| Memory | 128 MB/isolate | Sufficient |

## Known Limitations

- **No UDP** — only TCP over WebSocket; cannot proxy games, VoIP
- **Speed varies** — 5-50 Mbps depending on CDN routing; not for low-latency use
- **100K daily request cap** — sufficient for daily browsing; heavy use may hit limit
- **Custom domain SNI may be blocked** — domain rotation may be needed

## Example

**User**: "帮我搭建一个 Cloudflare 代理节点"

**Output**: Skill walks through the full 7-phase setup interactively — collecting Cloudflare credentials, generating config, deploying to Pages, registering a free domain if needed, configuring DNS, binding the custom domain, and providing the final VLESS connection URI for the user's proxy client.

## Tips

- Always use a **subdomain** for CNAME records (e.g., `vless.example.com`), never the root domain — a root CNAME destroys the zone's SOA/NS records
- The admin panel at `https://your-domain/<admin-password>` provides ready-to-scan QR codes for mobile clients
- If speed is insufficient, try different Cloudflare CDN IP addresses as the proxy endpoint
- Keep usage low-profile for personal use to avoid Cloudflare ToS issues

## Requirements

- Node.js 18+
- GitHub CLI (`gh`)
- Cloudflare account (free tier)
- A domain (free via DNSExit, or bring your own)

## Source

- GitHub: https://github.com/LewisLiu007/cf-proxy
- Install: `npx skills add LewisLiu007/cf-proxy`
