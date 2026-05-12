# slopmop

Slop-mop adds quality-gate rails for AI-assisted codebases. It gives Claude Code a skill and slash commands for the refit onboarding flow, the swab/scour/buff/sail maintenance loop, and barnacle friction reporting.

## Install

```text
/plugin marketplace add davepoon/buildwithclaude
/plugin install slopmop@buildwithclaude
```

The slop-mop CLI is required on the user's machine:

```bash
pipx install slopmop[all]
```

## What It Provides

- `/slopmop:sm-refit` for onboarding an existing repository into quality-gated maintenance.
- `/slopmop:sm-sail` for running the next obvious slop-mop workflow step.
- `/slopmop:sm-swab` for fast local validation during development.
- `/slopmop:sm-scour` for comprehensive pre-PR checks.
- `/slopmop:sm-buff` for CI and PR feedback triage.
- `/slopmop:sm-barnacle` for reporting slop-mop tooling friction.

Repository: https://github.com/ScienceIsNeato/slop-mop
