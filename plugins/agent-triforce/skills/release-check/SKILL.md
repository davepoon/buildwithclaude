---
name: release-check
category: quality-security
description: Pre-release verification checklist. Validates features, tests, docs, security, and quality gates before shipping. Delegates to the Centinela (QA) agent.
---

# Release Check

Runs pre-release verification using the Centinela (QA) agent. This is the highest-stakes checklist in the system.

## When to Use This Skill

- Before any release to production
- Before tagging a version
- As a final quality gate after all features are implemented and reviewed

## What This Skill Does

1. Runs the SIGN IN checklist
2. TIME OUT 1 — Documentation and Debt Check: verifies CHANGELOG, TECH_DEBT, specs, and docs
3. TIME OUT 2 — Testing and Quality Gate: runs all tests, code health scan, quality verification
4. TIME OUT 3 — Security and Release Gate: runs security audit, security verification, release readiness
5. Writes release assessment to `docs/reviews/release-check-{version}.md`
6. Issues final verdict: READY FOR RELEASE or BLOCKED (with specific reasons)

## How to Use

### Basic Usage

```
/release-check v1.2.0
```

## Example

**User**: `/release-check v2.0.0`

**Output**: A release assessment at `docs/reviews/release-check-v2.0.0.md` with:
- Documentation completeness check
- Test results and quality gate status
- Security audit summary
- Final verdict with specific blocking reasons if any

## Tips

- This is the last line of defense before code reaches users
- A blocked release here prevents issues from reaching production
- Three TIME OUT checkpoints cover docs, quality, and security independently
