---
name: cleanup
description: Reclaim disk space and prune branches left behind by AI coding agents - merged or abandoned git worktrees, merged branches, stale build artifacts (node_modules, .venv, target), old archives and backups, package caches, and old agent session logs. Use when the user runs /cleanup, says the disk is full, or asks to clean up worktrees, branches, or storage.
category: development-code
license: MIT
---

# Cleanup

Free disk space and prune branches with one scan, one confirmation, and one apply. Every deletion goes through `scripts/agent_cleanup.py` in this skill's directory. Right before acting, it re-checks each git item, artifact folder, archive and the trash, and skips anything that changed since the scan.

## 1. Scope

Choose what to scan:

- **This repo** (default): run from inside it with no `--root`. The scan covers this repo, the agent worktree folders (Codex, Cursor, Conductor, Vibe Kanban), package caches, agent logs and the trash.
- **Whole machine**: the user says disk full, all projects, or everything. Add `--root <dir>` for each folder that holds their projects. Look for the usual ones (`~/code`, `~/dev`, `~/src`, `~/projects`, `~/repos`, `~/Developer`, `~/Documents/*`). If none of them exist, ask the user.

Narrow with `--only git,artifacts,archives,caches,agents,trash` when the user asks for one kind, e.g. "just branches" → `--only git`. Add `--remote` only when the user wants merged branches deleted on `origin` too.

Done when the scan command is chosen.

## 2. Scan

```
python3 <skill-dir>/scripts/agent_cleanup.py scan --fetch [--root DIR ...] [--only ...] [--remote]
```

The scan is read-only, apart from `--fetch` updating remote-tracking refs. It prints numbered items in four classes and saves the plan:

- `REMOVE`: merged into the base branch, regenerable, or a worktree whose directory is already gone (unregistering it keeps its branch).
- `NEEDS-DECISION`: holds something unique (uncommitted or ignored files, unmerged or unpushed commits, build output, archives, old logs).
- `KEEP-ACTIVE` and `SKIP`: open PRs, recent work, long-lived branches, the main checkout, locked or rebasing worktrees, anything a running process is inside, unmounted drives. Never act on these.

`--help` lists the thresholds (`--stale-days`, `--keep-days`, `--min-size`).

Done when the plan is printed with its reclaimable total.

## 3. One confirmation

Ask once, using your multi-select question tool if you have one, otherwise a single message, then wait for the answer:

- **REMOVE**, pre-selected, one line per item: id, size, path and note. When there are many, group lines by kind (worktrees, branches, artifacts, caches) and keep each id visible. Say that caches re-download on demand and artifacts come back on the next install or build.
- **Each NEEDS-DECISION item** on its own line, unselected: path, size, and what is unique in it (the note). Agent logs and archives cannot be recovered once deleted.
- **Remote branches**, if `--remote` was used, as a separate question: deleting them affects everyone using the repo.

KEEP-ACTIVE and SKIP get one summary line so the user knows they were seen.

Done when the user has answered.

## 4. Apply

Pass exactly the ids the user picked:

```
python3 <skill-dir>/scripts/agent_cleanup.py apply 1 2 5 9-14
```

Add `--remote` only when the picked ids include remote branches the user approved in their own question. `apply --recommended` takes every REMOVE item; use it only when the user approved all of them and nothing else.

`apply` prints one line per item: done, skipped (changed since the scan, gone, or now in use), refused, or failed with git's reason. Report each one as printed. Leave skipped and refused items in place; the next scan classifies them again. If the plan is more than 24 hours old, `apply` refuses it: scan again and confirm again.

`git worktree remove` refuses a worktree with uncommitted changes. Add `--force` only for ids where the user explicitly accepted losing those changes. A detached worktree's unique commits are saved under `refs/agent-cleanup/` before removal.

Done when every picked id has a result line.

## 5. Report

Tell the user:

- how much space was freed;
- what was removed;
- what was left and why;
- for each `agent-data` item, the agent's built-in retention setting named in its note, so the logs stop piling up.

Every action is logged to `~/.local/state/agent-cleanup/history.jsonl`.
