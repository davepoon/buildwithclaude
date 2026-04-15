---
name: sosa-governance
description: "Real-time SOSA governance enforcement — apply supervision policies, trust gradients, and capability boundaries to AI agent actions as they execute."
category: quality-security
---

# SOSA Governance Engine

Runtime enforcement layer for the SOSA framework. Intercepts agent actions and applies governance rules before execution.

## Capabilities

- Trust gradient: first-time actions get full confirmation, repeat actions are expedited
- Capability boundaries: restrict what each skill/agent can access
- Policy enforcement: block dangerous patterns (hardcoded secrets, unbounded actions)
- Audit trail: log all governance decisions for review

## Setup

No API keys required. Install from `MSApps-Mobile/claude-plugins` marketplace.
