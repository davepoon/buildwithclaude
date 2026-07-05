# TLS Radar plugin for Claude Code & Cowork

[![MIT License](https://img.shields.io/badge/license-MIT-blue.svg)](./LICENSE)
[![Claude Code plugin](https://img.shields.io/badge/Claude%20Code-plugin-7c3aed)](https://github.com/TLS-Radar/tlsradar-claude-plugin)
[![smithery badge](https://smithery.ai/badge/slmusayev/tls-radar)](https://smithery.ai/servers/slmusayev/tls-radar)

Run SSL/TLS scans, issue free Let's Encrypt certificates, and manage cert monitoring from inside Claude Code or Claude Cowork - through a single MCP server, with nothing to configure.

Independent monitoring from a vendor that doesn't sell certificates - built for the 90-day-cert era, where manual renewal tracking is already finished.

![Installing the plugin and issuing a free cert with /tls-cert](https://raw.githubusercontent.com/TLS-Radar/tlsradar-claude-plugin/main/docs/demo.gif)

```
# Public - no account, no setup
/tls-scan example.com                       # free SSL/TLS scan
/tls-cert mydomain.dev                      # free 90-day Let's Encrypt cert (private key stays local)
/tls-renew mydomain.dev                     # renew a cert

# Connect once for monitoring (OAuth via /mcp)
/mcp                                        # built-in Claude Code OAuth flow
/tls-monitor add api.foo.io                 # one or many: /tls-monitor add a.com b.com c.com
/tls-monitor list
/tls-monitor remove api.foo.io
/tls-diagnose                               # health check (use when something's off)
/tls-upgrade                                # open pricing page
```

> **See real output before installing:** [sample scan report](https://tlsradar.com/scan/7yeRj83mGGhcuhe5rSbXZg)

Other actions - "what's expiring soon," "scan history for X," "what plan am I on," "export/import my monitors," "invite a teammate" - just ask in plain language; the plugin's skill routes them to the right tool. No slash command needed.

## How it works

Claude Code's MCP client talks to **one** remote server:

- `tlsradar.com/api/v1/mcp`

Certificate issuance is **proxied through that server** to the Let's Encrypt backend (Beacon), so there's a single connection and a single auth model - no second server, no token to paste into your shell.

- **Public tools** (`scan`, `create_certificate`, `check_certificate_propagation`, `finalize_certificate`, `get_certificate_status`, `renew_certificate`) work with no account.
- **Authenticated tools** (monitoring, plan info, export/import, team) use Claude Code's built-in OAuth 2.0 + PKCE. Run `/mcp` once, pick the `tlsradar` server, approve in the browser; the token is managed by Claude Code.

When you run `/mcp`, Claude Code fetches `tlsradar.com/.well-known/oauth-authorization-server` (RFC 8414), dynamically registers as a public client (RFC 7591), opens the browser for consent (PKCE / RFC 7636), and includes the token on subsequent requests automatically.

### Certificates keep your private key local

`/tls-cert` generates the key + CSR on **your** machine with `openssl` and sends only the CSR. The private key never leaves your computer and no passphrase is ever typed into the chat. If you want a `.p12` bundle (e.g. for Windows/Java import), the plugin packages it locally too.

You choose how to prove control of the domain, and the plugin remembers your choice (in `~/.config/tlsradar/config.json`):

- **`dns-01`** - you add a TXT record by hand (works anywhere).
- **`dns-01-cloudflare` / `dns-01-route53`** - the plugin sets the TXT record for you via the provider API, reading your token from the local environment (`CLOUDFLARE_API_TOKEN`, or your configured `aws` CLI). Those credentials stay on your machine - they're never sent to TLS Radar or Beacon.
- **`http-01`** - serve a file on `http://yourdomain` (port 80); issues the apex only.

When a cert is issued, TLS Radar emails you about ongoing monitoring - the cert → monitoring handoff is fully automatic and server-side.

### Works in Claude Code and Cowork

This is a standard plugin, so it runs in both **Claude Code** and **Claude Cowork**. Scanning, certificate issuance, and monitoring all work in either client: the tools come from one MCP server, and the certificate flow runs `openssl` plus a bundled helper script locally (both clients can run local commands and the bundled script via `${CLAUDE_PLUGIN_ROOT}`). Connecting for monitoring uses your client's built-in OAuth - `/mcp` in Claude Code, or the equivalent connect step in Cowork.

### Use in Claude.ai (custom connector)

You don't need Claude Code to scan and monitor from Claude. TLS Radar is a standard **remote** MCP server, so you can add it as a **custom connector** in the Claude.ai apps (web, desktop, mobile) on any plan - Free included (Free allows one connector).

1. Open **Settings → Connectors** (Team/Enterprise: **Organization settings → Connectors**, Owner only).
2. Click **Add custom connector**.
3. Paste the connector URL: `https://tlsradar.com/api/v1/mcp/connect`
4. Save, then **sign in to TLS Radar** when the OAuth prompt appears (the connector is an authenticated surface - sign-in connects your account once, then scanning and monitoring both work).

Then just ask in plain language - "scan example.com", "what certs are expiring soon", "monitor api.foo.io". There are no slash commands in Claude.ai; the tool descriptions route your request.

> **No account? Use Claude Code instead.** The anonymous, no-signup scanning and free cert issuance live in the Claude Code plugin (below), which talks to the public `…/api/v1/mcp` endpoint. The Claude.ai connector requires a one-time sign-in because hosted connectors must authenticate.

> **Certificate issuance stays a Claude Code / Cowork feature.** `/tls-cert` generates your private key locally with `openssl`, which the Claude.ai apps can't do (no local shell). In a connector you get scanning and monitoring; to issue a Let's Encrypt cert with the key staying on your machine, use the plugin in Claude Code/Cowork, or the web form at [beacon.tlsradar.com](https://beacon.tlsradar.com).

## Install

In Claude Code, add the marketplace and install - two commands, no clone, no paths:

```
/plugin marketplace add TLS-Radar/tlsradar-claude-plugin
/plugin install tlsradar@tlsradar
```

(Or browse it in the `/plugin` menu after adding the marketplace.) In **Claude Cowork**, add it from the plugin catalog (search "TLS Radar"). That's it - scanning and cert issuance work immediately. Run `/mcp` (or Cowork's connect step) when you want monitoring.

<details>
<summary>Manual install (no marketplace)</summary>

```bash
git clone https://github.com/TLS-Radar/tlsradar-claude-plugin ~/.claude/plugins/tlsradar
```
</details>

## Free plan limits

- **1 monitor** included free
- **1 alert per month**, delivered at 7 days before expiry
- Unlimited free scans (rate-limited)
- Free Let's Encrypt issuance
- REST API access on every plan, including Free

When you hit the monitor limit, the tool's response includes the recommended upgrade and a pricing URL.

## Configuration

Nothing is required. Optional environment variables:

- `TLSRADAR_BASE_URL` - override the TLS Radar URL (default `https://tlsradar.com`). Useful for staging/self-host.

**Anonymous usage id.** The first time you run a scan or cert command, the plugin mints a random id at `~/.config/tlsradar/install_id` and passes it (as a `client_id` argument) so anonymous usage can be attributed to one install. It identifies an install, not a person. The plugin **runs no startup hook, does not modify your shell config, and sends no tracking header** - the id travels only as that argument, read from the local file.

  **To opt out:** `rm ~/.config/tlsradar/install_id`. With the file gone, no id is sent.

## Privacy & security

- This plugin ships **no tokens or credentials** - there's nothing secret in this repo. See [`SECURITY.md`](./SECURITY.md).
- The OAuth token is managed by Claude Code's MCP client, not by this plugin.
- Certificate private keys are generated locally and never sent to any server.
- DNS-provider credentials (`CLOUDFLARE_API_TOKEN`, AWS CLI) are read from your local environment and never sent to TLS Radar or Beacon.
- An anonymous install id is sent for usage attribution, passed as a tool argument read from `~/.config/tlsradar/install_id` (see Configuration to opt out). The plugin modifies no shell files and sends no tracking header. It identifies an install, not a person.
- To revoke access: `https://tlsradar.com/oauth/authorized_applications` or remove the MCP server in `/mcp`.
- Access tokens expire in 2 hours; refresh tokens rotate on use, capped at 90 days.

## Layout

```
.
├── README.md                        # this file
├── CLAUDE.md                        # architecture / funnel / contracts (humans + AI agents)
├── CONTRIBUTING.md                  # dev loop + how to add commands
├── CHANGELOG.md                     # version history
├── SECURITY.md                      # reporting + why the plugin holds no secrets
├── LICENSE                          # MIT
├── .claude-plugin/plugin.json       # plugin manifest
├── .claude-plugin/marketplace.json  # self-hosting marketplace entry
├── .mcp.json                        # MCP server config (one remote URL)
├── commands/                        # slash commands (how to add one: CONTRIBUTING.md)
├── skills/                          # NL skill router (with its own README)
├── tools/manifest.json              # single source of truth for tool names
├── scripts/                         # CI guards + tested DNS-provider helper
└── evals/                           # tool-routing evals (prompt → expected tool)
```

## Contributing

Start with [`CONTRIBUTING.md`](./CONTRIBUTING.md) for the dev loop (all checks are offline and run with `python3`). For architecture, the funnel, contract pitfalls, and the release process, read [`CLAUDE.md`](./CLAUDE.md) - useful for both humans and AI agents. Changes are tracked in [`CHANGELOG.md`](./CHANGELOG.md).

Security reports: **security@tlsradar.com** (never a public issue) - see [`SECURITY.md`](./SECURITY.md).

## License

[MIT](./LICENSE) © TLS Radar
