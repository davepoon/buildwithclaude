---
slug: claude-plus-postgres-mcp
title: Wiring Claude into Postgres with one MCP server
excerpt: I stopped pasting schemas into chat and let the agent read the database directly through the postgres MCP server. With caveats, and there are several.
author:
  name: Hana Voss
  handle: hanav
  avatarHue: 268
target:
  name: postgres-mcp
  kind: mcp-server
  href: /mcp-server/official-mcp-postgres-mcp
category: Plugins
platforms:
  - Claude Desktop
  - Agent SDK
cover: blue
coverAlt: A laptop showing lines of code on a desk
date: May 3, 2026
readTime: 8
pullQuote: The win was not query writing. It was that the agent stopped guessing my schema.
---

For about a year, every conversation that touched our database started with the same sad ritual: paste a schema into the chat window, watch the model invent a column, paste the real output, try again. The [postgres MCP server](/mcp-server/official-mcp-postgres-mcp) replaced that with a connection the agent can actually read, using the [Model Context Protocol](https://modelcontextprotocol.io) to expose the database as a set of tools.

## Connecting it

MCP servers are declared in config. For Claude Desktop or any [MCP-aware client](https://docs.claude.com/en/docs/claude-code/mcp), it is a few lines pointing at a read-only role:

```json
{
  "mcpServers": {
    "postgres": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-postgres"],
      "env": { "DATABASE_URL": "postgres://readonly@localhost:5432/app" }
    }
  }
}
```

The first thing it changed was the questions I could ask. "Which users have no orders in the last 90 days" stopped being a multi-step exercise and became a one-shot read, because the agent could introspect the foreign keys and write the join itself. The second thing it changed was my paranoia level, which went up appropriately.

## The caveats are the story

Giving an agent SQL access is the kind of power you scope carefully:

- read-only role, behind credentials that cannot see PII
- one database, not the whole cluster
- a row limit enforced at the connection layer, not in the prompt
- query logging on by default, even in local dev

None of those are optional. Treat it like any other intern with a fresh laptop: scoped permissions, an audit trail, and a quiet conversation about what is off-limits before you hand over the keys. If you want a hard stop rather than a policy, pair it with the [SQL guard hook](/stories/hook-that-saved-my-prod). More servers live in the [MCP directory](/mcp-servers), and the protocol itself is documented at [modelcontextprotocol.io](https://modelcontextprotocol.io).
