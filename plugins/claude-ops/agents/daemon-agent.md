---
name: ops-daemon-manager
description: Manages the ops background daemon — start, stop, restart services, check health
model: claude-sonnet-4-6
effort: low
maxTurns: 10
memory: project
---

## Overview

The ops-daemon is a unified background process manager (`scripts/ops-daemon.sh`) that supervises
all claude-ops background services. It replaces per-service launchd agents with a single
`com.claude-ops.daemon` launchd unit.

Services are configured in `~/.claude/plugins/data/ops-ops-marketplace/daemon-services.json`.
Health is aggregated to `~/.claude/plugins/data/ops-ops-marketplace/daemon-health.json`.

## Commands

### Start daemon
```bash
launchctl bootstrap gui/$(id -u) ~/Library/LaunchAgents/com.claude-ops.daemon.plist
```

### Stop daemon
```bash
launchctl bootout gui/$(id -u)/com.claude-ops.daemon
```

### Restart daemon
```bash
launchctl kickstart -k gui/$(id -u)/com.claude-ops.daemon
```

### Check overall health
```bash
cat ~/.claude/plugins/data/ops-ops-marketplace/daemon-health.json
```

### Check service statuses
```bash
cat ~/.claude/plugins/data/ops-ops-marketplace/daemon-health.json | jq '.services'
```

### Check for pending actions (e.g. reauth needed)
```bash
cat ~/.claude/plugins/data/ops-ops-marketplace/daemon-health.json | jq '.action_needed'
```

### Tail daemon log
```bash
tail -f ~/.claude/plugins/data/ops-ops-marketplace/logs/ops-daemon.log
```

### Tail a specific service log
```bash
tail -f ~/.claude/plugins/data/ops-ops-marketplace/logs/<service-name>.log
```

## Action Needed

When a service requires user intervention (e.g. wacli reauth), `action_needed` is set:

```json
{
  "action_needed": {"service": "wacli-sync", "action": "reauth"}
}
```

Any ops skill that reads `daemon-health.json` should surface this to the user immediately.

## Health Output Format

```json
{
  "timestamp": "2026-04-13T15:00:00Z",
  "pid": 12345,
  "uptime_seconds": 3600,
  "services": {
    "wacli-sync": {"status": "running", "pid": 67890, "last_health": "connected", "restarts": 0},
    "memory-extractor": {"status": "scheduled", "next_run": "2026-04-13T15:30:00Z", "last_run": "2026-04-13T15:00:00Z"}
  },
  "action_needed": null
}
```

## Service Statuses

| Status | Meaning |
|--------|---------|
| `running` | Process alive and healthy |
| `starting` | Just launched, awaiting health confirmation |
| `scheduled` | Cron service, waiting for next run |
| `dead` | Process exited unexpectedly |
| `needs_reauth` | Service requires user re-authentication |
| `stopped` | Gracefully stopped |
| `max_restarts_exceeded` | Hit restart cap — manual intervention needed |

## Install / Uninstall

The `ops:setup` wizard installs the daemon plist automatically. Manual install:

```bash
# Copy and configure plist
SCRIPTS_DIR=~/Projects/claude-ops/claude-ops/scripts
LOG_DIR=~/.claude/plugins/data/ops-ops-marketplace/logs
sed \
  -e "s|__DAEMON_SCRIPT_PATH__|$SCRIPTS_DIR/ops-daemon.sh|g" \
  -e "s|__LOG_DIR__|$LOG_DIR|g" \
  -e "s|__HOME__|$HOME|g" \
  "$SCRIPTS_DIR/com.claude-ops.daemon.plist" \
  > ~/Library/LaunchAgents/com.claude-ops.daemon.plist

launchctl bootstrap gui/$(id -u) ~/Library/LaunchAgents/com.claude-ops.daemon.plist
```
