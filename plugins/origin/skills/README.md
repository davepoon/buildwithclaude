# Origin Skills

Claude Code workflow skills installed by the Origin plugin.

These skills keep the daily interface short:

```text
/init        verify setup end-to-end
/help        one-screen reference
/brief       load session context
/capture     save one durable memory
/recall      search local memory
/distill     refresh wiki pages
/review captures|revisions   power-user deep audit; daily flow is /brief
/forget      delete a memory by ID
/handoff     end-of-session debrief
/debrief     alias for /handoff
```

The skills do not store data themselves. They guide Claude Code to use the local `origin-mcp` tools, which talk to the Origin daemon on `127.0.0.1:7878`.

## Files

| Skill | Purpose |
| --- | --- |
| `init` | End-to-end setup verifier (daemon + MCP + round-trip). |
| `help` | One-screen quick reference of the 10 verbs and the daily flow. |
| `brief` | Load working context at session start or topic shifts. |
| `capture` | Save one durable memory: decision, lesson, gotcha, preference, fact, or correction. |
| `recall` | Query Origin for focused context. |
| `distill` | Refresh wiki pages from accumulated memories. |
| `review` | Power-user deep audit of pending surfaces (captures, revisions). Daily flow handled by `/brief`. |
| `forget` | Delete a memory by ID. |
| `handoff` | End-session capture for decisions, lessons, gotchas, and open threads. |
| `debrief` | Alias for `handoff` — symmetric with `brief`. |

Plugin metadata lives in [`.claude-plugin`](../.claude-plugin/README.md).
