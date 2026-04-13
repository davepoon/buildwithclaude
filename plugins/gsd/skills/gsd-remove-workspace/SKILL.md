---
name: gsd-remove-workspace
description: "Remove a GSD workspace and clean up worktrees"
argument-hint: "<workspace-name>"
allowed-tools:
  - Bash
  - Read
  - AskUserQuestion
---


<context>
**Arguments:**
- `<workspace-name>` (required) — Name of the workspace to remove
</context>

<objective>
Remove a workspace directory after confirmation. For worktree strategy, runs `git worktree remove` for each member repo first. Refuses if any repo has uncommitted changes.
</objective>

<!-- Workflow content (was: remove-workspace.md) -->
<purpose>
Remove a GSD workspace, cleaning up git worktrees and deleting the workspace directory.
</purpose>

<required_reading>
Read the skill content below before starting.
</required_reading>

<process>

## 1. Setup

Extract workspace name from $ARGUMENTS.

```bash
INIT=$(node "$GSD_TOOLS" init remove-workspace "$WORKSPACE_NAME")
if [[ "$INIT" == @file:* ]]; then INIT=$(cat "${INIT#@file:}"); fi
```

Parse JSON for: `workspace_name`, `workspace_path`, `has_manifest`, `strategy`, `repos`, `repo_count`, `dirty_repos`, `has_dirty_repos`.

**If no workspace name provided:**

First run `/gsd-list-workspaces` to show available workspaces, then ask:

Use AskUserQuestion:
- header: "Remove Workspace"
- question: "Which workspace do you want to remove?"
- requireAnswer: true

Re-run init with the provided name.

## 2. Safety Checks

**If `has_dirty_repos` is true:**

```
Cannot remove workspace "$WORKSPACE_NAME" — the following repos have uncommitted changes:

  - repo1
  - repo2

Commit or stash changes in these repos before removing the workspace:
  cd $WORKSPACE_PATH/repo1
  git stash   # or git commit
```

Exit. Do NOT proceed.

## 3. Confirm Removal

Use AskUserQuestion:
- header: "Confirm Removal"
- question: "Remove workspace '$WORKSPACE_NAME' at $WORKSPACE_PATH? This will delete all files in the workspace directory. Type the workspace name to confirm:"
- requireAnswer: true

**If answer does not match `$WORKSPACE_NAME`:** Exit with "Removal cancelled."

## 4. Clean Up Worktrees

**If strategy is `worktree`:**

For each repo in the workspace:

```bash
cd "$SOURCE_REPO_PATH"
git worktree remove "$WORKSPACE_PATH/$REPO_NAME" 2>&1 || true
```

If `git worktree remove` fails, warn but continue:
```
Warning: Could not remove worktree for $REPO_NAME — source repo may have been moved or deleted.
```

## 5. Delete Workspace Directory

```bash
rm -rf "$WORKSPACE_PATH"
```

## 6. Report

```
Workspace "$WORKSPACE_NAME" removed.

  Path: $WORKSPACE_PATH (deleted)
  Repos: $REPO_COUNT worktrees cleaned up
```

</process>


<process>
Execute the remove-workspace workflow steps embedded above end-to-end.
</process>
