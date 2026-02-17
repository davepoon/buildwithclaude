---
description: Autonomous iteration loop — reads progress, selects role, executes, verifies, commits, and moves to next task without waiting
allowed-tools:
  - Read
  - Write
  - Edit
  - Glob
  - Grep
  - Bash
  - TodoWrite
  - Task
  - AskUserQuestion
  - Skill
---

# /iterate — Autonomous Iteration Mode

## Overview

Enables fully autonomous development by reading `memory-bank/progress.md`, selecting the appropriate role (PM/Lead/Dev/QA), executing the task, verifying results, and immediately proceeding to the next task.

## Role Selection Logic

| Current State              | Role Selected | Action                     |
| -------------------------- | ------------- | -------------------------- |
| No requirements doc        | PM            | Requirement analysis       |
| REQ has unclear items      | Clarify       | Requirement clarification  |
| Has REQ, no design         | Lead          | Technical design           |
| Has design, frontend tasks | Designer      | UI design guidance         |
| Has tasks to implement     | Dev           | Coding implementation      |
| Code ready for check       | Verify        | Build + type + lint + test |
| Verification passed        | QA            | Functional acceptance      |

## Core Behavior

**After completing a task, immediately execute the next one. NO summarizing and waiting.**

- Task complete → Update progress.md → Read next task → **Execute immediately**

## Stop Conditions (only these)

1. User interrupts (Ctrl+C)
2. All tasks completed
3. Fatal error that cannot be auto-resolved
4. External dependency requiring user decision

## Usage

```
/iterate "implement user authentication with JWT"
/iterate  # continues from progress.md
```
