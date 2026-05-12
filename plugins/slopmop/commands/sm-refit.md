---
description: Run slop-mop's one-time repository onboarding remediation rail
allowed-tools: Bash(sm:*)
---

# /slopmop:sm-refit

Run slop-mop's one-time onboarding remediation rail for this repository.

1. For an existing repo that has not been remediated, start with `sm refit --start`.
2. Fix the current gate or blocker it reports.
3. Run `sm refit --iterate` to resume the stored plan.
4. Repeat until the plan is complete, then run `sm refit --finish`.

This is step 0 for inherited or already-messy repositories. Let refit own the
structured remediation plan and commits; use the swab/scour/buff loop after the
repo has entered maintenance.

**Prerequisite:** `sm` must be installed. If `command not found`, suggest:
```bash
pipx install slopmop[all]
```