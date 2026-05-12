---
description: Auto-advance the slop-mop workflow loop for this repository
allowed-tools: Bash(sm:*)
---

# /slopmop:sm-sail

Auto-advance the slop-mop workflow loop for this repository.

1. Run `sm sail`.
2. It reads the workflow state and runs the next obvious verb — swab, scour, or buff.
3. Fix whatever it reports, then run `sm sail` again.
4. Repeat until the PR lands.

This is the "do the next thing" command. Use it when you're not sure whether to swab, scour, or buff. For surgical work on a specific gate or PR thread, use the individual verbs directly.

**First time in a repo?** If `sm sail` reports no workflow state, the repo hasn't been onboarded yet. Run `sm refit --start` to begin.

**Prerequisite:** `sm` must be installed. If `command not found`, suggest:
```bash
pipx install slopmop[all]
```
