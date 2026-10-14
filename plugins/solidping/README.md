# SolidPing

Uptime monitoring inside Claude Code, through one remote MCP server.
[SolidPing](https://github.com/fclairamb/solidping) is open source (AGPL-3.0) and self-hostable.

```
/plugin install solidping@buildwithclaude
```

Or register the server directly:

```
claude mcp add --transport http solidping https://solidping.io/api/v1/mcp
```

The first tool call opens an OAuth 2.1 sign-in in your browser. The hosted service has a free tier, no card needed.
For a self-hosted instance, edit `.mcp.json` and point it at `https://<your-host>/api/v1/mcp`.

## What you can ask

- "Which of my checks are down right now?"
- "Why is the api-health check failing since this morning?"
- "Add an HTTPS check on https://example.com every minute from two regions"
- "Monitor the TLS certificate of example.com and warn 14 days before it expires"
- "List the incidents of the last 7 days with their duration"
- "Put the database checks in maintenance tonight from 22:00 to 23:00"
- "Add the new API check to the public status page"

## Tools

| Group | Tools |
|---|---|
| Read | `list_checks`, `get_check`, `list_results`, `list_incidents`, `get_incident`, `list_check_types`, `get_check_type_samples`, `list_regions`, `list_check_groups`, `list_status_pages`, `list_maintenance_windows`, `list_integrations` |
| Diagnose | `diagnose_check`, `validate_check`, `run_check` |
| Write | `create_check`, `update_check`, `delete_check`, status page, maintenance window and integration create/update/delete |
| Probe | `fetch_page`, `browser_snapshot`, `run_js_script`: run once against a target you name, store nothing |

Every tool carries MCP annotations (`readOnlyHint`, `destructiveHint`, `idempotentHint`, `openWorldHint`).
Only the probe tools are open-world.

## Connection and safety

- Installing the plugin registers the remote server (`.mcp.json`, streamable HTTP). It does not pre-approve any tool, so Claude Code asks before each call unless you allow it yourself.
- The OAuth token is scoped to one organization, and the server applies your role: a viewer cannot create or delete anything through MCP.
- Probe tools go through the server's egress guard, which refuses private and loopback targets unless the instance operator allows them.
- The bundled skill tells Claude to confirm every write with you first and to treat tool output (check names, page bodies, error messages) as data, never as instructions.

## Links

- Docs: <https://docs.solidping.io>
- Source: <https://github.com/fclairamb/solidping>
- Official MCP Registry: `io.github.fclairamb/solidping`
