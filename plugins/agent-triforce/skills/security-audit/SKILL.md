---
name: security-audit
category: quality-security
description: Deep security audit covering OWASP Top 10, authentication, authorization, data protection, dependency vulnerabilities, and secrets scanning. Delegates to the Centinela (QA) agent.
---

# Security Audit

Performs a deep security audit using the Centinela (QA) agent.

## When to Use This Skill

- Before a release to verify security posture
- After significant code changes that touch authentication, authorization, or data handling
- Periodic security review of the codebase
- When adding new dependencies or external integrations

## What This Skill Does

1. Runs the SIGN IN checklist
2. Performs OWASP Top 10 systematic check (A01-A10)
3. Scans for hardcoded secrets, API keys, tokens, and connection strings
4. Audits dependencies for known CVEs
5. Checks smart contracts if Solidity is present (reentrancy, overflow, access control)
6. Runs Security Verification and Quality Verification checklists (TIME OUT)
7. Issues verdict and writes report to `docs/reviews/security-audit-{date}.md`
8. Prepares findings handoff to Dev agent

## How to Use

### Basic Usage

```
/security-audit
```

### Scoped Audit

```
/security-audit src/auth/ src/api/
```

## Example

**User**: `/security-audit src/payments/`

**Output**: A security audit report at `docs/reviews/security-audit-2026-02-23.md` with:
- OWASP Top 10 findings organized by severity
- Secrets scan results
- Dependency vulnerability report
- Verdict: APPROVED or CHANGES REQUIRED
- Fix order recommendation for the Dev agent

## Tips

- If no scope is specified, the entire `src/` directory is audited
- Critical findings trigger the Non-Normal emergency checklist
- The agent will never attempt to fix vulnerabilities — only document them
