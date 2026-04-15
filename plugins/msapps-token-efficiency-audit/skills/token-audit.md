---
name: token-audit
description: "Audit Claude plugins and skills for token waste — check description bloat, skill body length, unused MCP connectors, duplicate data, and context overhead. Typical savings: 20-50%."
category: quality-security
---

# Token Efficiency Audit

Finds and fixes token waste across your Claude plugin ecosystem. Based on the SOSA O6 pattern catalog.

## What It Audits

- **O6a Description bloat:** SKILL.md descriptions over 80 words
- **O6b Body bloat:** Skill bodies over 400 lines
- **O6c System overhead:** MCP connectors with 50+ unused tools
- **O6d Scheduled waste:** Overlapping scheduled tasks
- **O6e Data duplication:** Shared rules duplicated across skills

## Output

Ranked list of optimization opportunities with estimated token savings per fix.

## Setup

No API keys required. Install from `MSApps-Mobile/claude-plugins` marketplace.
