# GCF Proxy

Wraps any MCP server with GCF encoding. Zero code changes. Token savings on every tool call.

## Skills

- `/gcf-proxy:setup <server>` — Wrap an MCP server with gcf-proxy. Preserves original config for easy revert.
- `/gcf-proxy:stats` — Show token savings for the current session.

## Hooks

- **SessionStart** — Clears stats file for a fresh session.
- **Stop** — Reports calls rewritten, % saved, and tokens saved.

## Links

- [gcf-proxy](https://github.com/blackwell-systems/gcf-proxy)
- [Benchmarks](https://gcformat.com/guide/benchmarks.html)
- [Playground](https://gcformat.com/playground.html)
