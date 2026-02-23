# Agent Triforce

A multi-agent development system with three specialized agents — Prometeo (PM), Forja (Dev), and Centinela (QA) — coordinated through a checklist methodology based on *The Checklist Manifesto* (Atul Gawande) and Boeing's checklist engineering (Daniel Boorman).

## Features

- **3 Specialized Agents**: Product Manager, Developer/Architect, QA/Security Auditor
- **6 Skills**: Feature spec, implementation, security audit, code health, release check, review findings
- **24 Checklists**: DO-CONFIRM and READ-DO checklists across all agents (117 items total)
- **WHO Surgical Safety Model**: Three mandatory pause points (SIGN IN / TIME OUT / SIGN OUT) on every invocation
- **Structured Handoff Protocols**: 6 defined communication paths between agents
- **Persistent Agent Memory**: Cross-session context retention per agent
- **Auto-generated HTML Dashboard**: Visual overview of system status

## Installation

### Plugin Marketplace (Recommended)

```
/plugin marketplace add ArtemioPadilla/agent-triforce
/plugin install agent-triforce@agent-triforce
```

### Manual Installation

Add to your `.claude/settings.json`:

```json
{
  "plugins": ["https://github.com/ArtemioPadilla/agent-triforce"]
}
```

## Agents

| Agent | Role | Specialization |
|-------|------|----------------|
| **Prometeo** (PM) | Product Manager | Feature specs, user stories, business logic, prioritization, roadmap |
| **Forja** (Dev) | Developer/Architect | Architecture, implementation, testing, infrastructure, documentation |
| **Centinela** (QA) | QA/Security Auditor | Code review, security audit, compliance, dead code detection, release gates |

## Skills

| Skill | Agent | Description |
|-------|-------|-------------|
| `/feature-spec` | Prometeo | Create a complete product feature specification |
| `/implement-feature` | Forja | Implement a feature from its specification |
| `/review-findings` | Forja | Fix findings from a QA code review |
| `/security-audit` | Centinela | Deep security audit (OWASP Top 10, dependencies, secrets) |
| `/code-health` | Centinela | Scan for dead code, tech debt, outdated dependencies |
| `/release-check` | Centinela | Pre-release verification and quality gate |

## Workflow

```
PM  → SIGN IN → spec → TIME OUT → SIGN OUT
  → Dev → SIGN IN → implement → TIME OUT → TIME OUT → SIGN OUT
    → QA  → SIGN IN → audit → TIME OUT → SIGN OUT
      → Dev → SIGN IN → fix → TIME OUT → SIGN OUT
        → QA  → SIGN IN → re-verify → SIGN OUT
```

## Checklist Methodology

Every agent invocation follows three mandatory pause points:

1. **SIGN IN** (DO-CONFIRM): Identity, role, task, concerns, memory review
2. **TIME OUT** (varies): Mid-workflow verification — stop, run checklist, fix failures
3. **SIGN OUT** (DO-CONFIRM): Update memory, confirm deliverables, prepare handoff

Checklists follow Boorman's design rules:
- 5-9 killer items only (focused on steps most dangerous to skip)
- Under 60 seconds to complete
- Simple, exact wording — each item is a concrete, verifiable action
- Field-tested and updated based on actual failures

## Links

- **Repository**: [github.com/ArtemioPadilla/agent-triforce](https://github.com/ArtemioPadilla/agent-triforce)

## License

MIT
