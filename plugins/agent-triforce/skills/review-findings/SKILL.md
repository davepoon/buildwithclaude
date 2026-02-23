---
name: review-findings
category: workflow-orchestration
description: Addresses and fixes findings from a QA code review. Reads the review report, fixes critical and warning issues, and prepares for re-verification. Delegates to the Forja (Dev) agent.
---

# Review Findings

Addresses and fixes QA findings using the Forja (Dev) agent.

## When to Use This Skill

- After receiving a code review from Centinela (QA)
- When a review report has findings that need to be addressed
- Fixing critical and warning issues before re-verification

## What This Skill Does

1. Runs the SIGN IN checklist
2. Reads the review report and understands each finding's root cause
3. Plans fix order: Critical first, then Warnings
4. Implements fixes with updated tests for each finding
5. Scans for dead code after all fixes
6. Runs Implementation Complete and Pre-Delivery checklists (TIME OUT)
7. Verifies every Critical finding addressed, every Warning addressed or deferred with justification
8. Prepares a fix report for QA re-verification

## How to Use

### Basic Usage

```
/review-findings
```

### With Specific Review

```
/review-findings docs/reviews/user-auth-review.md
```

## Example

**User**: `/review-findings docs/reviews/webhook-system-review.md`

**Output**:
- All Critical findings fixed with tests
- All Warning findings fixed or explicitly deferred with justification
- Fix report documenting what was changed and why
- Ready for QA re-verification

## Tips

- If no review is specified, the most recent review in `docs/reviews/` is used
- The agent understands root causes before writing any fix
- Conflicting fixes are identified and planned around during the pre-fix phase
