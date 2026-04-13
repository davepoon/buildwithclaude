---
name: gsd-list-workspaces
description: "List active GSD workspaces and their status"
allowed-tools:
  - Bash
  - Read
---


<objective>
Scan `~/gsd-workspaces/` for workspace directories containing `WORKSPACE.md` manifests. Display a summary table with name, path, repo count, strategy, and GSD project status.
</objective>

<!-- Workflow content (was: list-workspaces.md) -->
<purpose>
List all GSD workspaces found in ~/gsd-workspaces/ with their status.
</purpose>

<required_reading>
Read the skill content below before starting.
</required_reading>

<process>

## 1. Setup

```bash
INIT=$(node "$GSD_TOOLS" init list-workspaces)
if [[ "$INIT" == @file:* ]]; then INIT=$(cat "${INIT#@file:}"); fi
```

Parse JSON for: `workspace_base`, `workspaces`, `workspace_count`.

## 2. Display

**If `workspace_count` is 0:**

```
No workspaces found in ~/gsd-workspaces/

Create one with:
  /gsd-new-workspace --name my-workspace --repos repo1,repo2
```

Done.

**If workspaces exist:**

Display a table:

```
GSD Workspaces (~/gsd-workspaces/)

| Name | Repos | Strategy | GSD Project |
|------|-------|----------|-------------|
| feature-a | 3 | worktree | Yes |
| feature-b | 2 | clone | No |

Manage:
  cd ~/gsd-workspaces/<name>     # Enter a workspace
  /gsd-remove-workspace <name>   # Remove a workspace
```

For each workspace, show:
- **Name** — directory name
- **Repos** — count from init data
- **Strategy** — from WORKSPACE.md
- **GSD Project** — whether `.planning/PROJECT.md` exists (Yes/No)

</process>


<process>
Execute the list-workspaces workflow steps embedded above end-to-end.
</process>
