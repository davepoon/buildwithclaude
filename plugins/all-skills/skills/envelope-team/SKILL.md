---
name: envelope-team
category: ai-agents
description: Design and generate .envelope.json AI agent team definitions — the open standard for multi-agent teams with hierarchy, access policies, human-in-the-loop gates, and cron schedules.
---

# Envelope Team

Design and generate `.envelope.json` AI agent team definition files — the open standard for building and deploying multi-agent teams on [Envelope](https://openenvelope.org).

## When to Use This Skill

- User asks to build, design, or generate an Envelope team
- User describes a workflow that could be automated by a team of AI agents
- User wants to create a `.envelope.json` file for deployment
- User needs help with agent hierarchy, access policies, or gates

## What This Skill Does

1. Takes a natural-language description of the team's purpose
2. Designs the agent hierarchy (supervisor → managers → workers)
3. Generates a schema-valid `.envelope.json` file
4. Includes access policies, variables, secrets, and gates as appropriate
5. Explains any schema concepts the user asks about

## How to Use

### Basic Usage

```
Build me an Envelope team for customer support triage — one supervisor,
two agents that read Zendesk tickets, and a Slack notifier for escalations.
```

```
Create an Envelope team definition for outbound sales — an SDR manager
overseeing two SDRs who work HubSpot leads and a RevOps analyst.
```

### With human-in-the-loop gates

```
Build an Envelope team that drafts marketing emails and pauses for
human approval before sending.
```

## Example

**User**: "Build me an Envelope team for content moderation — a supervisor and two reviewer agents that check posts against community guidelines."

**Output**:

```json
{
  "$schema": "https://schema.openenvelope.org/team/v1.json",
  "name": "Content Moderation Team",
  "slug": "content-moderation",
  "version": "1.0.0",
  "description": "A supervisor and two reviewer agents that check posts against community guidelines.",
  "visibility": "team",
  "category": "ops",
  "requiredVariables": ["companyName"],
  "requiredSecrets": ["MODERATION_API_KEY"],
  "metadata": { "generatedBy": "Claude Code · openenvelope.org" },
  "agents": [
    {
      "key": "supervisor",
      "name": "Moderation Supervisor",
      "role": "supervisor",
      "capabilities": ["Route content to reviewer agents", "Aggregate decisions", "Escalate edge cases"],
      "model": "anthropic:claude-sonnet-4-5",
      "systemPrompt": "You supervise the content moderation team at {{companyName}}. Delegate each item to a reviewer and consolidate their verdicts."
    },
    {
      "key": "policy-reviewer",
      "name": "Policy Reviewer",
      "role": "reviewer",
      "capabilities": ["Check content against community guidelines", "Flag policy violations"],
      "model": "anthropic:claude-haiku-3-5",
      "systemPrompt": "You review content for policy violations at {{companyName}}. Return a verdict of approve, flag, or remove with a reason.",
      "reportsToKey": "supervisor",
      "accessPolicy": {
        "accessPolicyVersion": "1",
        "rules": [
          { "host": "api.moderation-service.com", "action": "allow" },
          { "host": "*", "action": "deny" }
        ]
      }
    },
    {
      "key": "spam-reviewer",
      "name": "Spam Reviewer",
      "role": "reviewer",
      "capabilities": ["Detect spam, bot activity, and duplicate content"],
      "model": "anthropic:claude-haiku-3-5",
      "systemPrompt": "You detect spam and bot activity at {{companyName}}. Return a verdict of approve, flag, or remove with a confidence score.",
      "reportsToKey": "supervisor"
    }
  ]
}
```

## Schema Reference

### Top-level fields

| Field | Required | Description |
|---|---|---|
| `$schema` | yes | Always `https://schema.openenvelope.org/team/v1.json` |
| `name` | yes | Human-readable team name |
| `slug` | yes | URL-safe, lowercase, hyphens only |
| `version` | yes | Semver e.g. `"1.0.0"` |
| `description` | yes | What this team does |
| `visibility` | yes | `"public"` · `"team"` · `"private"` |
| `requiredVariables` | no | Non-sensitive config, interpolated via `{{varName}}` |
| `requiredSecrets` | no | API keys, stored encrypted, injected as `${SECRET_NAME}` |
| `schedule` | no | Cron schedule `{ cron, timezone, task }` |
| `agents` | yes | Agent definitions |
| `gates` | no | Human-in-the-loop checkpoints |

### Agent fields

| Field | Required | Description |
|---|---|---|
| `key` | yes | Unique identifier within this file |
| `name` | yes | Display name |
| `role` | yes | Free-form e.g. `"supervisor"`, `"analyst"`, `"sdr"` |
| `capabilities` | yes | What this agent can do — used for delegation routing |
| `model` | yes | e.g. `anthropic:claude-sonnet-4-5`, `anthropic:claude-haiku-3-5` |
| `systemPrompt` | yes | Agent instructions. Use `{{varName}}` and `${SECRET_NAME}` |
| `reportsToKey` | no | `key` of manager agent. Omit for the top-level supervisor |
| `accessPolicy` | no | Outbound HTTP allowlist |

### Hierarchy rule

Exactly one agent should have no `reportsToKey` — this is the supervisor that receives the initial task. All others reference their manager's `key`.

### Access policy

```json
"accessPolicy": {
  "accessPolicyVersion": "1",
  "rules": [
    { "host": "api.example.com", "action": "allow" },
    { "host": "*", "action": "deny" }
  ]
}
```

### Human-in-the-loop gates

```json
"gates": [
  {
    "name": "approval-check",
    "type": "approval",
    "trigger": { "afterAgent": "drafter" },
    "onApprove": "continue",
    "onReject": "halt"
  }
]
```

## Tips

- Use `anthropic:claude-sonnet-4-5` for supervisors and managers; `anthropic:claude-haiku-3-5` for leaf agents doing repetitive work
- Put anything org-specific (company name, support email, Slack channel) in `requiredVariables`
- End access policy rules with `{ "host": "*", "action": "deny" }` for a strict allowlist
- Add gates before any agent that sends emails, posts publicly, or makes purchases
- Validate before deploying: `npx @openenvelope/schema validate ./team.envelope.json`

## Links

- [openenvelope.org](https://openenvelope.org) — deploy and run teams
- [schema.openenvelope.org/team/v1.json](https://schema.openenvelope.org/team/v1.json) — JSON schema
- [npmjs.com/package/@openenvelope/schema](https://www.npmjs.com/package/@openenvelope/schema) — TypeScript types + validator
- [openenvelope.org/mcp](https://openenvelope.org/mcp) — run teams via MCP from Claude.ai or ChatGPT
