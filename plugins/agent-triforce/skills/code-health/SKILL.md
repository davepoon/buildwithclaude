---
name: code-health
category: quality-security
description: Scans the codebase for dead code, tech debt, outdated dependencies, and code quality issues. Delegates to the Centinela (QA) agent.
---

# Code Health

Runs a comprehensive code health scan using the Centinela (QA) agent.

## When to Use This Skill

- Periodic codebase hygiene check
- Before a release to ensure no dead code or unresolved debt
- After a large refactoring to verify cleanliness
- When onboarding to understand current code quality

## What This Skill Does

1. Runs the SIGN IN checklist
2. Scans for dead code (unused imports, variables, functions, commented-out blocks, unreachable code)
3. Checks for outdated and vulnerable dependencies
4. Detects code smells (long functions, deep nesting, duplication)
5. Audits TODO/FIXME comments for issue references
6. Runs the Scan Complete checklist (TIME OUT)
7. Writes findings to `docs/reviews/code-health-{date}.md`
8. Prepares findings handoff to Dev agent

## How to Use

### Basic Usage

```
/code-health
```

## Example

**User**: `/code-health`

**Output**: A code health report at `docs/reviews/code-health-2026-02-23.md` with:
- Dead code findings (verified, not false positives)
- Dependency status and vulnerabilities
- Code smell inventory
- TODO/FIXME audit
- Prioritized findings: Critical > Warning > Suggestion

## Tips

- Scans all source directories, not just `src/` — includes `tests/` and config files
- Previous scan findings are compared to track recurring issues
- Findings are verified to avoid false positives from dynamic imports or plugins
