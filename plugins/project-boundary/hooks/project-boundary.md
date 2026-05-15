---
name: project-boundary
description: Block destructive commands and file operations outside the project directory
category: security
event: PreToolUse
matcher: Bash
language: bash
version: 1.10.0
---

# project-boundary

Security hook that blocks destructive commands and file operations outside the project directory.

## Event Configuration

- **Event Type**: `PreToolUse`
- **Tool Matcher**: `Bash`
- **Category**: security

## What it blocks

### Always blocked
- `git push --force`, `git reset --hard`, `git checkout .`, `git clean -f`
- `DROP TABLE`, `TRUNCATE TABLE`, `rails db:drop`, `rake db:drop`
- `mkfs.*`, `dd if=`
- `bash -c`, `sh -c`, `eval`, piping to `sh`/`bash`
- `xargs` with destructive commands

### Blocked outside project
- `rm`, `mv`, `cp`, `ln`, `chmod`, `chown`
- `>` / `>>` redirects, `tee`
- `curl -o`, `wget -O`
- `find -delete` / `find -exec rm`

## Environment Variables

- `CLAUDE_PROJECT_DIR` — project root (falls back to `pwd`)
- `CLAUDE_PLUGIN_ROOT` — set automatically by Claude Code

## Requirements

- bash
- jq

## Implementation

See `guard.sh` in the same directory.
