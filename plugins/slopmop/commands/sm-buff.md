---
description: Triage pull request CI results and review feedback with slop-mop
argument-hint: <pr-number>
allowed-tools: Bash(sm:*)
---

# /slopmop:sm-buff

Triage CI results and review feedback for a pull request.

Usage: Run `sm buff <PR_NUMBER>` after CI completes or review feedback lands.

1. Run `sm buff <PR_NUMBER>`.
2. Summarize what passed, what failed, and what needs attention.
3. Propose a concrete remediation plan for each actionable item.

This converts raw feedback into your next set of tasks. Never mark a failing check as resolved without actually fixing it.

**Prerequisite:** `sm` must be installed. If `command not found`, suggest:
```bash
pipx install slopmop[all]
```
