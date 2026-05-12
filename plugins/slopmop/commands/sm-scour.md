---
description: Run slop-mop's comprehensive pre-PR sweep for this repository
allowed-tools: Bash(sm:*)
---

# /slopmop:sm-scour

Run slop-mop's comprehensive pre-PR sweep for this repository.

1. Run `sm scour`.
2. Summarize every issue found — these are the things that would compound if left unchecked.
3. Propose concrete fixes for each.

Only open or update a PR when `sm scour` reports a clean run.

**Prerequisite:** `sm` must be installed. If `command not found`, suggest:
```bash
pipx install slopmop[all]
```
