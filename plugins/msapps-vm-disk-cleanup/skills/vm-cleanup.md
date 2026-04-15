---
name: vm-cleanup
description: "Clean up disk space in Cowork VMs and Claude Code sandboxes — remove caches, temp files, old logs, and package manager artifacts. Fixes ENOSPC errors."
category: infrastructure-operations
---

# VM Disk Cleanup

Reclaim disk space in Claude working environments. Targets common space consumers: package manager caches, build artifacts, temp files, and old logs.

## When to Use

- Bash commands fail with "No space left on device" or ENOSPC errors
- Before heavy operations like npm install or pip install in long sessions
- Proactive cleanup during extended work sessions

## What It Cleans

- npm/pip/apt caches
- Temporary files and build artifacts
- Old log files
- Orphaned package data

## Setup

No API keys required. Install from `MSApps-Mobile/claude-plugins` marketplace.
