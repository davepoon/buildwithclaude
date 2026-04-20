---
name: sosa-audit
description: "Audit plugins and skills against the SOSA governance framework — check Supervised, Orchestrated, Secured, Agents compliance and generate remediation reports."
category: quality-security
---

# SOSA Compliance Auditor

Scans installed Claude plugins and skills against the SOSA (Supervised, Orchestrated, Secured, Agents) governance methodology.

## What It Checks

- **Supervised:** High-impact actions require human confirmation
- **Orchestrated:** Plan-Act-Verify workflows, structured outputs
- **Secured:** No hardcoded credentials, pinned versions, injection scanning
- **Agents:** Clear role boundaries, declared tool manifests, memory models

## Output

Generates a compliance report with pass/fail per pillar and specific remediation steps.

## Setup

No API keys required. Install from `MSApps-Mobile/claude-plugins` marketplace.
