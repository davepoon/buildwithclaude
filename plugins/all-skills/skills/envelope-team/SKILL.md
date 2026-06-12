# Envelope Team Skill

You can design and generate `.envelope.json` team definition files — the open standard for AI agent teams. Use this skill whenever the user asks you to build, design, or generate an Envelope team.

## What is an Envelope team?

An `.envelope.json` file describes a team of AI agents: who they are, who they report to, what they can do, and what external services they can access. The file is deployed to [openenvelope.org](https://openenvelope.org), where it becomes a runnable team that can be triggered via the Envelope API, a cron schedule, or MCP clients like Claude.ai and ChatGPT.

The schema is published at `https://schema.openenvelope.org/team/v1.json` and versioned via `@openenvelope/schema` on npm.

---

## File structure

```json
{
  "$schema": "https://schema.openenvelope.org/team/v1.json",
  "name": "Support Triage Team",
  "slug": "support-triage",
  "version": "1.0.0",
  "description": "Triages incoming support tickets and routes escalations to Slack.",
  "visibility": "team",
  "category": "support",
  "requiredVariables": ["companyName"],
  "requiredSecrets": ["ZENDESK_API_KEY", "SLACK_BOT_TOKEN"],
  "metadata": { "generatedBy": "Claude Code · openenvelope.org" },
  "agents": [ ... ],
  "gates": [ ... ]
}
```

### Top-level fields

| Field | Type | Required | Description |
|---|---|---|---|
| `$schema` | string | yes | Always `https://schema.openenvelope.org/team/v1.json` |
| `name` | string | yes | Human-readable team name |
| `slug` | string | yes | URL-safe identifier, lowercase, hyphens only |
| `version` | string | yes | Semver string e.g. `"1.0.0"` |
| `description` | string | yes | What this team does |
| `visibility` | string | yes | `"public"` · `"team"` · `"private"` |
| `category` | string | no | e.g. `"support"`, `"sales"`, `"ops"`, `"finance"` |
| `requiredVariables` | string[] | no | Non-sensitive config values, interpolated into prompts via `{{varName}}` |
| `requiredSecrets` | string[] | no | API keys / tokens, stored encrypted, injected as `${SECRET_NAME}` |
| `schedule` | object | no | Cron schedule (see below) |
| `metadata` | object | no | Free-form metadata; always include `generatedBy` |
| `agents` | object[] | yes | The agent definitions (see below) |
| `gates` | object[] | no | Human-in-the-loop checkpoints (see below) |

---

## Agent definitions

Each entry in `agents` describes one agent. Agents form a hierarchy via `reportsToKey`.

```json
{
  "key": "supervisor",
  "name": "Support Supervisor",
  "role": "supervisor",
  "capabilities": ["Route tickets by urgency", "Delegate to specialist agents"],
  "model": "anthropic:claude-sonnet-4-5",
  "systemPrompt": "You are the support team supervisor at {{companyName}}. ...",
  "reportsToKey": null,
  "accessPolicy": { ... }
}
```

### Agent fields

| Field | Type | Required | Description |
|---|---|---|---|
| `key` | string | yes | Unique identifier within this file, used in `reportsToKey` references |
| `name` | string | yes | Display name |
| `role` | string | yes | Free-form role label e.g. `"supervisor"`, `"analyst"`, `"sdr"` |
| `capabilities` | string[] | yes | What this agent can do — used for delegation routing |
| `model` | string | yes | Model identifier (see models below) |
| `systemPrompt` | string | yes | The agent's instructions. Use `{{varName}}` for variables and `${SECRET_NAME}` for secrets |
| `reportsToKey` | string \| null | no | `key` of this agent's manager. Omit or set to `null` for the top-level supervisor |
| `accessPolicy` | object | no | Outbound HTTP access control (see below) |

### Hierarchy rules

- Exactly **one** agent should have no `reportsToKey` (or `reportsToKey: null`) — this is the supervisor/top agent that receives the initial task.
- All other agents reference their manager's `key` via `reportsToKey`.
- The hierarchy can be as deep as needed. Common patterns: flat (supervisor + workers), two-level (supervisor → manager → workers), functional (supervisor → domain leads → specialists).

### Available models

| Model identifier | Notes |
|---|---|
| `anthropic:claude-sonnet-4-5` | Default choice — strong reasoning, good cost |
| `anthropic:claude-sonnet-4-6` | Latest Sonnet — use for complex reasoning tasks |
| `anthropic:claude-haiku-3-5` | Fast and cheap — good for high-volume leaf agents |
| `openai:gpt-4o` | OpenAI option |
| `openai:gpt-4o-mini` | OpenAI budget option |

Use the stronger/more expensive models for supervisors and managers. Use Haiku or mini for leaf agents doing repetitive work.

### Variable and secret interpolation

- `requiredVariables` values are interpolated into `systemPrompt` via `{{varName}}` — baked in at deploy time.
- `requiredSecrets` values are injected as `${SECRET_NAME}` in prompts and HTTP headers — stored encrypted, never baked in.

Example:
```json
"systemPrompt": "You work for {{companyName}}. Use the Zendesk API at https://{{companyName}}.zendesk.com. Auth: Bearer ${ZENDESK_API_KEY}."
```

---

## Access policies

`accessPolicy` controls which outbound HTTP requests an agent is allowed to make. It is optional but strongly recommended for agents that call external APIs.

```json
"accessPolicy": {
  "accessPolicyVersion": "1",
  "rules": [
    { "host": "api.zendesk.com", "action": "allow" },
    { "host": "slack.com", "methods": ["POST"], "action": "allow", "reason": "Post to Slack channels only" },
    { "host": "*", "action": "deny", "reason": "Block all other outbound traffic" }
  ]
}
```

### Rule fields

| Field | Type | Description |
|---|---|---|
| `host` | string | Hostname to match. Use `"*"` as a catch-all |
| `action` | `"allow"` \| `"deny"` | What to do when this rule matches |
| `methods` | string[] | Optional — restrict to specific HTTP methods |
| `pathPrefix` | string | Optional — restrict to URLs starting with this path |
| `reason` | string | Optional — human-readable explanation |

Rules are evaluated in order; first match wins. Always end with a `{ "host": "*", "action": "deny" }` catch-all if you want a strict allowlist.

---

## Human-in-the-loop gates

Gates pause the team at a checkpoint and wait for a human to approve or reject before continuing.

```json
"gates": [
  {
    "name": "escalation-review",
    "type": "approval",
    "trigger": {
      "afterAgent": "escalation-analyst"
    },
    "onApprove": "continue",
    "onReject": "halt"
  }
]
```

### Gate fields

| Field | Type | Description |
|---|---|---|
| `name` | string | Unique gate name within this file |
| `type` | string | `"approval"` (human must approve/reject) |
| `trigger.afterAgent` | string | `key` of the agent that triggers the gate when it finishes |
| `onApprove` | string | What happens on approval: `"continue"` |
| `onReject` | string | What happens on rejection: `"halt"` |

Gates are resolved via the Envelope API (`POST /api/installs/:id/continue` or `/reject-gate`) or MCP tools.

---

## Cron schedules

Teams can run on a schedule without being triggered manually.

```json
"schedule": {
  "cron": "0 9 * * 1-5",
  "timezone": "America/New_York",
  "task": "Run the daily pipeline report and post a summary to Slack."
}
```

---

## Complete example — sales SDR team

```json
{
  "$schema": "https://schema.openenvelope.org/team/v1.json",
  "name": "Outbound SDR Team",
  "slug": "outbound-sdr",
  "version": "1.0.0",
  "description": "An SDR manager oversees two outbound SDRs who work leads in HubSpot, plus a RevOps analyst who tracks pipeline metrics.",
  "visibility": "team",
  "category": "sales",
  "requiredVariables": ["companyName"],
  "requiredSecrets": ["HUBSPOT_API_KEY"],
  "metadata": { "generatedBy": "Claude Code · openenvelope.org" },
  "agents": [
    {
      "key": "sdr-manager",
      "name": "SDR Manager",
      "role": "manager",
      "capabilities": ["Assign leads to SDRs", "Review outreach quality", "Monitor pipeline metrics"],
      "model": "anthropic:claude-sonnet-4-5",
      "systemPrompt": "You manage the outbound SDR team at {{companyName}}. Delegate lead outreach to your SDRs and review their work before submission.",
      "accessPolicy": {
        "accessPolicyVersion": "1",
        "rules": [
          { "host": "api.hubapi.com", "action": "allow" },
          { "host": "*", "action": "deny" }
        ]
      }
    },
    {
      "key": "sdr-1",
      "name": "SDR — Inbound Leads",
      "role": "sdr",
      "capabilities": ["Work inbound HubSpot leads", "Write personalised outreach emails"],
      "model": "anthropic:claude-haiku-3-5",
      "systemPrompt": "You are an SDR at {{companyName}}. Fetch inbound leads from HubSpot using ${HUBSPOT_API_KEY} and draft personalised outreach.",
      "reportsToKey": "sdr-manager",
      "accessPolicy": {
        "accessPolicyVersion": "1",
        "rules": [
          { "host": "api.hubapi.com", "action": "allow" },
          { "host": "*", "action": "deny" }
        ]
      }
    },
    {
      "key": "sdr-2",
      "name": "SDR — Outbound Prospecting",
      "role": "sdr",
      "capabilities": ["Identify outbound prospects", "Enrich contact data", "Log activities in HubSpot"],
      "model": "anthropic:claude-haiku-3-5",
      "systemPrompt": "You are an outbound SDR at {{companyName}}. Research and qualify prospects, then log your findings in HubSpot.",
      "reportsToKey": "sdr-manager",
      "accessPolicy": {
        "accessPolicyVersion": "1",
        "rules": [
          { "host": "api.hubapi.com", "action": "allow" },
          { "host": "*", "action": "deny" }
        ]
      }
    },
    {
      "key": "revops-analyst",
      "name": "RevOps Analyst",
      "role": "analyst",
      "capabilities": ["Pull pipeline metrics from HubSpot", "Summarise deal velocity and conversion rates"],
      "model": "anthropic:claude-haiku-3-5",
      "systemPrompt": "You are the RevOps analyst at {{companyName}}. Query HubSpot for pipeline metrics and produce a concise summary.",
      "reportsToKey": "sdr-manager",
      "accessPolicy": {
        "accessPolicyVersion": "1",
        "rules": [
          { "host": "api.hubapi.com", "action": "allow" },
          { "host": "*", "action": "deny" }
        ]
      }
    }
  ]
}
```

---

## Validation

To validate a generated file before deploying:

```sh
npx @openenvelope/schema validate ./my-team.envelope.json
```

Or in a TypeScript project:

```ts
import { validate } from "@openenvelope/schema";

const result = validate(myDefinition);
if (!result.ok) console.error(result.errors);
```

---

## Deploying

Once you have a valid `.envelope.json`:

1. **UI**: Go to [openenvelope.org](https://openenvelope.org), sign in, click **New team**, and upload the file.
2. **API**: `POST /api/templates` with the file contents, then `POST /api/installs` to deploy it. See [openenvelope.org/api-docs](https://openenvelope.org/api-docs) for full reference.
3. **MCP**: If you have an Envelope API key, use the `run_team` tool via Claude.ai or ChatGPT. See [openenvelope.org/mcp](https://openenvelope.org/mcp).

---

## Tips for generating good team definitions

- **Start with the hierarchy**: who is the supervisor, who are the managers, who are the leaf workers?
- **Write specific system prompts**: vague prompts produce vague agents. Include the agent's exact scope, what it should and shouldn't do, and how it should communicate results to its manager.
- **Scope access policies tightly**: only allow the hosts each agent actually calls. A catch-all deny rule at the end is good practice.
- **Name secrets clearly**: `ZENDESK_API_KEY` not `API_KEY`. The deployer sees these names when setting up the team.
- **Use variables for anything org-specific**: company name, support email, Slack channel — anything that changes per deployment belongs in `requiredVariables`.
- **Add gates for high-stakes steps**: if an agent is about to send emails, post to social, or make purchases, put a gate before it.
