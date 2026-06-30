---
description: Verify the TLS Radar plugin's connection and configuration
---

Run a health check on the plugin's MCP backend and report the status. This is for users who installed the plugin and something isn't working - give them a concrete picture instead of "it just doesn't work."

The plugin talks to a single MCP server (`tlsradar`); certificate issuance is proxied through it to Beacon, so there's no second connection or token to check.

## What to check, in order

### 1. TLS Radar reachability (public tools)

Call `tlsradar.scan_domain` with `domain=example.com` to verify the public MCP endpoint responds.

- **Success:** "✓ TLS Radar MCP is reachable (public tools work)"
- **Connection error:** "✗ Can't reach tlsradar.com - check the TLSRADAR_BASE_URL environment variable and your network"

### 2. TLS Radar authentication

Call `tlsradar.get_account` (requires auth).

- **Success:** "✓ Authenticated as `<email>` (`<plan>` plan, `<used>/<limit>` monitors used)"
- **401 / unauthorized:** "✗ Not connected. Run `/mcp`, pick the `tlsradar` server, and approve OAuth in your browser. (Scanning and cert issuance still work without this.)"
- **Other error:** report it verbatim.

### 3. Certificate issuance path (proxy → Beacon)

Call `tlsradar.get_certificate_status` with a deliberately non-existent `order_id` like `health-check-probe`. This proxies through to Beacon without creating anything.

- **Returns an "order not found" (or similar) error WITHOUT `structuredContent.degraded`:** "✓ Certificate issuance is reachable" (Beacon answered - it just doesn't know that order)
- **Returns `structuredContent.degraded: true` (the proxy's graceful-degradation response):** "⚠ The certificate backend is briefly unavailable - `/tls-cert` will fail right now. This is server-side and transient; try again in a minute."
- **Connection error:** covered by check 1 (same server).

### 4. Environment

Report:
- `TLSRADAR_BASE_URL`: its value or "(default: https://tlsradar.com)"
- `~/.config/tlsradar/install_id` (the anonymous usage id the scan/cert commands pass as `client_id`): "present (anonymous usage id active)" if the file exists, else "(absent - attribution off; harmless)". The id lives only in this file - the plugin uses no env var or header for it.

## Output format

Render as a checklist with ✓/✗/⚠ markers. If everything is green, end with: "All systems go. You can run any of the `/tls-*` commands."

If anything is red or yellow, end with: "Run the specific command that's failing for a detailed error, or open an issue at https://github.com/TLS-Radar/tlsradar-claude-plugin/issues"

## Things this command should NOT do

- Don't try to fix problems - only report them.
- Don't expose any bearer tokens or auth headers in the output.
- Don't make more than 3 MCP calls total.
