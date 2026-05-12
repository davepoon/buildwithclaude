---
description: Run slop-mop's fast iterative development validation loop
allowed-tools: Bash(sm:*)
---

# /slopmop:sm-swab

Run slop-mop's iterative development loop for this repository.

1. Run `sm swab`.
2. Read the output — each failing check is a gradient to descend.
3. Apply fixes for each reported issue.
4. Re-run `sm swab` until clean.

This is your inner development loop. Run it early and often — each pass reduces repo entropy. Never bypass or silence a failing check.

**Prerequisite:** `sm` must be installed. If `command not found`, suggest:
```bash
pipx install slopmop[all]
```
