---
description: Wrap an existing MCP server with gcf-proxy to reduce token costs by 71%. Provide the server name from your MCP config.
---

# GCF Proxy Setup

The user wants to wrap an MCP server with gcf-proxy to reduce token costs.

## What to do

1. Read the user's MCP configuration (`.mcp.json` in the project or `~/.claude.json`) to find the target server.
2. If `$ARGUMENTS` is provided, find the server matching that name.
3. Create a new entry that wraps the original server with gcf-proxy:
   - Keep the original server entry (renamed with a `-raw` suffix, disabled) so the user can revert.
   - The new entry prepends gcf-proxy before the original command: `npx -y @blackwell-systems/gcf-proxy@latest --stats-file /tmp/gcf-proxy-stats.json <original-command> <original-args>`
4. Show the user what changed and explain the expected savings (71% fewer tokens on tool responses).

## Example

If the user has:
```json
{
  "mcpServers": {
    "github": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-github"]
    }
  }
}
```

Transform it to:
```json
{
  "mcpServers": {
    "github": {
      "command": "npx",
      "args": ["-y", "@blackwell-systems/gcf-proxy@latest", "--stats-file", "/tmp/gcf-proxy-stats.json", "npx", "-y", "@modelcontextprotocol/server-github"]
    },
    "github-raw": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-github"],
      "disabled": true
    }
  }
}
```

## Important
- Do NOT use `--` between gcf-proxy and the server command. gcf-proxy takes the server command directly as positional arguments.
- Always preserve the original server config so the user can revert.
- If the server already uses gcf-proxy, tell the user it's already wrapped.
- Environment variables from the original config must be preserved.
