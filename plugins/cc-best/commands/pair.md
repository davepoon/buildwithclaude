---
description: Pair programming mode — step-by-step collaboration with 5 confirmation checkpoints for learning and sensitive operations
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

# /pair — Pair Programming Mode

## Overview

Collaborative development mode where Claude confirms each significant step with the user. Ideal for learning, code review, and sensitive operations.

## 5 Confirmation Checkpoints

| Checkpoint         | Example                                   |
| ------------------ | ----------------------------------------- |
| Understanding      | "I understand you need X. Correct?"       |
| Design choice      | "Option A or B? I recommend A because..." |
| Destructive action | "About to delete X. Confirm?"             |
| External call      | "Will call production API. Proceed?"      |
| Commit             | "Commit message: '...'. OK?"              |

## Safe Autonomy

Even in pair mode, Claude can freely:

- Read files and search code
- Run tests
- Format code
- Analyze errors

## Learning Mode

```
/pair --learn "teach me unit testing"
```

Claude explains every step in detail, providing context and rationale.
