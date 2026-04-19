---
name: ops
description: Business operations command center. Routes to the right ops command based on what you need — briefing, inbox, fires, projects, comms, triage, linear, revenue, deploy, or yolo mode.
argument-hint: "[command] [args]"
allowed-tools:
  - Bash
  - Read
  - Grep
  - Glob
  - Skill
  - Agent
  - TeamCreate
  - SendMessage
effort: medium
maxTurns: 20
---

## Runtime Context

Before routing, load:
1. **Preferences**: `cat ${CLAUDE_PLUGIN_DATA_DIR:-$HOME/.claude/plugins/data/ops-ops-marketplace}/preferences.json` — read configured channels to determine available commands
2. **Daemon health**: `cat ${CLAUDE_PLUGIN_DATA_DIR}/daemon-health.json` — if `action_needed`, surface before routing


# OPS — Business Command Center

Route `$ARGUMENTS` to the correct ops skill:

| Input                                         | Route to                |
| --------------------------------------------- | ----------------------- |
| (empty), dash, home, hq                       | `/ops:ops-dash`         |
| go, morning, briefing                         | `/ops-go`               |
| setup, configure, init, install               | `/ops:setup $ARGUMENTS` |
| inbox, unread, messages                       | `/ops-inbox`            |
| comms, send, whatsapp, email, slack, telegram | `/ops-comms $ARGUMENTS` |
| fires, incidents, down, sentry                | `/ops-fires`            |
| projects, dashboard                           | `/ops-projects`         |
| status, health-status                         | `/ops:ops-status`       |
| next, priority, what                          | `/ops-next`             |
| triage, issues                                | `/ops-triage`           |
| linear, sprint, board                         | `/ops-linear`           |
| revenue, money, mrr, costs                    | `/ops-revenue`          |
| deploy, ship                                  | `/ops-deploy`           |
| merge, prs, ship-prs                          | `/ops-merge $ARGUMENTS` |
| marketing, email, klaviyo, ads, meta, seo, campaigns | `/ops:ops-marketing $ARGUMENTS` |
| ecom, shop, shopify, store, orders, inventory | `/ops:ops-ecom $ARGUMENTS` |
| voice, call, tts, transcribe, phone           | `/ops:ops-voice $ARGUMENTS` |
| yolo                                          | `/ops-yolo`             |
| doctor, health, fix, diagnose                 | `/ops:ops-doctor`       |
| monitor, apm, alerts, datadog, newrelic, otel | `/ops:ops-monitor $ARGUMENTS` |
| settings, credentials, creds, config, reconfigure | `/ops:ops-settings $ARGUMENTS` |
| integrate, connect, add-api, saas, partner    | `/ops:ops-integrate $ARGUMENTS` |
| speedup, clean, optimize, cleanup             | `/ops:ops-speedup`      |
| orchestrate, subagents, agents, dispatch, run | `/ops:ops-orchestrate $ARGUMENTS` |

If `$ARGUMENTS` is empty, launch the interactive dashboard: invoke `/ops:ops-dash` directly.

## Agent Teams support

If `CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1` is set, use **Agent Teams** when building dashboard sections in parallel. This enables:
- Agents share context and can coordinate mid-flight
- You can steer priorities in real-time
- Agents report progress as they complete

**Team setup** (only when flag is enabled):
```
TeamCreate("ops-team")
Agent(team_name="ops-team", name="daily-ops", prompt="Gather fires, inbox, and unread comms status")
Agent(team_name="ops-team", name="engineering", prompt="Gather PRs, CI status, and deploy state")
Agent(team_name="ops-team", name="business", prompt="Gather revenue, Linear sprint, and project progress")
Agent(team_name="ops-team", name="automation", prompt="Check cron jobs, daemon health, and scheduled tasks")
```

If the flag is NOT set, use standard fire-and-forget subagents.

## CLI/API Reference

This skill is a router only — it does not call CLI tools directly. All tool usage is delegated to the target skill after routing. See the referenced skill's `## CLI/API Reference` section for details.
