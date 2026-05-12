---
description: Report slop-mop tooling friction with a structured barnacle
allowed-tools: Bash(sm:*)
---

# /slopmop:sm-barnacle - report slop-mop tool friction

Use when `sm` itself gives invalid guidance, blocks valid work, produces
confusing output, or breaks install/upgrade/refit flow.  Do not use this for
real target-repo failures; fix those through the normal rail.

```bash
sm barnacle file \
  --title "short summary of the slop-mop friction" \
  --command "sm <verb> [flags]" \
  --expected "what should have happened" \
  --actual "what happened instead" \
  --repro-step "how to reproduce it" \
  --tried "what you already tried" \
  --workflow swab \
  --blocker-type blocking \
  --json
```

Use `--dry-run` when GitHub auth is unavailable.  The generated issue body is
written to `.slopmop/last_barnacle_issue.md`; pass `--body-file <path>` when a
specific retry artifact path matters.

The point is to improve the rail, not hide the defect.  File the barnacle, then
continue only if the friction is non-blocking.

**Prerequisite:** `sm` must be installed. If `command not found`, suggest:
```bash
pipx install slopmop[all]
```
