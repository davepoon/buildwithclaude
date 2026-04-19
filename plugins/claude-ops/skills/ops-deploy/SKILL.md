---
name: ops-deploy
description: Deploy status across all projects. Shows ECS service versions, Vercel deployments, recent deploys, pending deploys, and CI/CD pipeline state.
argument-hint: "[project-alias|ecs|vercel|all]"
allowed-tools:
  - Bash
  - Read
  - Grep
  - Glob
  - Skill
  - Agent
  - TeamCreate
  - SendMessage
  - AskUserQuestion
  - TaskCreate
  - TaskUpdate
  - Monitor
  - WebFetch
  - mcp__claude_ai_Vercel__list_deployments
  - mcp__claude_ai_Vercel__list_projects
  - mcp__claude_ai_Vercel__get_deployment
  - mcp__claude_ai_Vercel__get_runtime_logs
  - mcp__claude_ai_Vercel__get_deployment_build_logs
effort: low
maxTurns: 20
disallowedTools:
  - Edit
  - Write
  - NotebookEdit
---

# OPS ► DEPLOY STATUS

## Runtime Context

Before executing, load available context:

1. **Preferences**: Read `${CLAUDE_PLUGIN_DATA_DIR:-$HOME/.claude/plugins/data/ops-ops-marketplace}/preferences.json`
   - `timezone` — display all deploy timestamps in the correct timezone

2. **Daemon health**: Read `${CLAUDE_PLUGIN_DATA_DIR}/daemon-health.json`
   - Check `infra-monitor` status — if not running, note that ECS data may be stale

3. **Secrets**: AWS and Vercel credentials required.
   ### Secret Resolution
   - AWS: check `$AWS_PROFILE` / `$AWS_ACCESS_KEY_ID` → `doppler secrets get AWS_ACCESS_KEY_ID --plain` → vault query cmd from prefs
   - Vercel token: check `$VERCEL_TOKEN` → `doppler secrets get VERCEL_TOKEN --plain` → vault

## CLI/API Reference

### aws CLI

| Command | Usage | Output |
|---------|-------|--------|
| `aws ecs list-clusters --output json` | All ECS clusters | `{clusterArns: [...]}` |
| `aws ecs list-services --cluster <name> --output json` | Services in cluster | `{serviceArns: [...]}` |
| `aws ecs describe-services --cluster <name> --services <arn> --output json` | Service health | `{services: [{serviceName, status, runningCount, desiredCount, pendingCount}]}` |
| `aws logs tail /ecs/<service> --since 1h --format short` | ECS logs | Log lines |

### gh CLI (GitHub)

| Command | Usage | Output |
|---------|-------|--------|
| `gh run list --repo <owner/repo> --limit 5 --json status,conclusion,name,headBranch,createdAt,databaseId` | CI runs | JSON array |
| `gh run view <id> --repo <repo> --log-failed` | Failed CI logs | Log output |
| `gh run watch <run-id> --repo <repo>` | Stream CI run | Live output (use with Monitor) |

---

## Agent Teams support

If `CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1` is set, use **Agent Teams** when checking deploy platforms in parallel. This enables:
- Agents share context and can coordinate mid-flight
- You can steer priorities in real-time
- Agents report progress as they complete

**Team setup** (only when flag is enabled):
```
TeamCreate("deploy-team")
Agent(team_name="deploy-team", name="ecs-checker", prompt="List all ECS clusters and describe service health, running/desired counts")
Agent(team_name="deploy-team", name="vercel-checker", prompt="List Vercel projects and recent deployments with status")
Agent(team_name="deploy-team", name="ci-checker", prompt="Check GitHub Actions runs across all registered repos for failures")
```

If the flag is NOT set, use standard fire-and-forget subagents.

## Phase 1 — Gather deploy data in parallel

### ECS services (all clusters)

```bash
${CLAUDE_PLUGIN_ROOT}/bin/ops-infra 2>/dev/null || \
aws ecs list-clusters --output json 2>/dev/null
```

### ECS service details

```bash
for cluster in $(aws ecs list-clusters --output json 2>/dev/null | jq -r '.clusterArns[]'); do
  cluster_name=$(basename "$cluster")
  aws ecs list-services --cluster "$cluster_name" --output json 2>/dev/null | \
    jq -r '.serviceArns[]' | while read svc; do
    aws ecs describe-services --cluster "$cluster_name" --services "$svc" \
      --output json 2>/dev/null | jq '.services[] | {name: .serviceName, desired: .desiredCount, running: .runningCount, pending: .pendingCount, image: (.taskDefinition // "unknown"), status: .status}'
  done
done
```

### Recent GitHub Actions runs (registry-driven)

```bash
REGISTRY="${CLAUDE_PLUGIN_ROOT}/scripts/registry.json"
[ -f "$REGISTRY" ] || REGISTRY="${CLAUDE_PLUGIN_ROOT}/scripts/registry.example.json"
for repo in $(jq -r '.projects[] | select(.gsd == true) | .repos[]' "$REGISTRY" 2>/dev/null); do
  echo "=== $repo ==="
  gh run list --repo "$repo" --limit 5 --json status,conclusion,name,headBranch,createdAt,databaseId 2>/dev/null
done
```

### Vercel deployments

Use `mcp__claude_ai_Vercel__list_projects` then `mcp__claude_ai_Vercel__list_deployments` for each project (limit 5 per project).

---

## Phase 2 — Render dashboard

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 OPS ► DEPLOY STATUS — [timestamp]
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

ECS SERVICES
 CLUSTER    SERVICE         D/R/P   STATUS   LAST DEPLOY
 ─────────────────────────────────────────────────────
 [cluster]  [service]       [x/x/x] ACTIVE   [time ago]
 ...

VERCEL DEPLOYMENTS
 PROJECT     ENV        STATUS    COMMIT    DEPLOYED
 ─────────────────────────────────────────────────────
 [project]   production  READY    [sha]     [time ago]
 ...

CI/CD PIPELINE
 REPO              BRANCH   WORKFLOW        STATUS    AGE
 ─────────────────────────────────────────────────────
 example-api       main     Deploy API      ✓ success  2h
 example-web       dev      Build            ✗ failure  1h
 ...

PENDING DEPLOYS (branch ready, not yet deployed)
 [repo] [branch] [PR#] [CI status] → needs merge to trigger

──────────────────────────────────────────────────────
```

After rendering, use **batched AskUserQuestion calls** (max 4 options each). Only show actions relevant to the current state (e.g., skip "View logs for failing service" if nothing is failing). If <=4 relevant actions, use a single call. If >4, batch:

AskUserQuestion call 1:
```
  [View logs for [failing service]]
  [Trigger manual deploy for [project]]
  [View build logs for [failing CI run]]
  [More actions...]
```

AskUserQuestion call 2 (only if "More actions..."):
```
  [Check Vercel [project] runtime logs]
  [Open GitHub Actions for [repo]]
  [Back to dashboard]
```

---

## Deep-dive by project

If `$ARGUMENTS` has a project alias, show only that project's deploy info + last 10 CI runs + option to view logs.

For failing deploys: offer to view logs via `mcp__claude_ai_Vercel__get_deployment_build_logs` or ECS CloudWatch logs.

**If user selects manual deploy (option b)**, confirm with `AskUserQuestion` before triggering:

```
Trigger deploy for [project]:
  Environment: [production/staging]
  Branch: [branch]
  Last commit: [sha] — [message]

  [Deploy now]  [View diff since last deploy first]  [Cancel]
```

**If user selects to view logs**, show the logs and use `AskUserQuestion`:
```
  [Dispatch fix agent for this failure]  [Redeploy]  [Back to dashboard]
```

---

## Native tool usage

### Monitor — live deploy streaming

When watching a deploy in progress, use `Monitor` to stream logs:
```
Monitor(command: "gh run watch <run-id> --repo <repo>")
```
For ECS deploys: `Monitor(command: "aws ecs wait services-stable --cluster <cluster> --services <service>")`

### Tasks — deploy tracking

Use `TaskCreate` per project being deployed. Update with `TaskUpdate` as deploys succeed/fail.

### WebFetch — Vercel fallback

When Vercel MCP tools are unavailable, use `WebFetch` with the Vercel API directly:
```
WebFetch(url: "https://api.vercel.com/v6/deployments?projectId=<id>&limit=5", headers: {"Authorization": "Bearer $VERCEL_TOKEN"})
```
