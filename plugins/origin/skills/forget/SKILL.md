---
name: forget
description: >
  Delete a memory from Origin by ID. Destructive and cannot be undone —
  prefer `/capture` with `supersedes` for corrections. Invoked as
  `/forget <source_id>`.
argument-hint: "<source_id>"
allowed-tools: ["Bash", "mcp__plugin_origin_origin__forget", "mcp__plugin_origin_origin__recall"]
---

# /forget

Permanently delete a memory by its `source_id`.

## How to invoke

You need the `source_id`. If the user did not provide it, call
`/recall` first to find the matching memory and confirm with the
user before deleting.

```
forget(memory_id="<source_id>")
```

## When to use

- User says "forget this", "delete that", "that's wrong, remove it".
- User explicitly identifies a memory by ID.

## When NOT to use

- For corrections, prefer storing a new memory with `supersedes` pointing
  at the old one. That preserves history. Use `/capture` with the
  `supersedes` arg instead.
- Bulk deletions — call `/review` first, confirm with the user,
  then delete one at a time.

## Safety

Deletion is destructive. Always confirm with the user before calling forget,
unless the user has already given an explicit, unambiguous instruction in
the same turn (e.g. they pasted the ID and said "delete this").

## Auto-commit ~/.origin/

If the deletion removed a page md (daemon archives the page and
KnowledgeWriter unlinks the file), snapshot the change. Defensive —
silent skip if `git` missing, `~/.origin/` not a repo, or no diff.

```
Bash: git -C ~/.origin add -A && \
      git -C ~/.origin -c user.name=Origin -c user.email=daemon@origin.local \
          commit --quiet -m "forget: <source_id>" 2>/dev/null || \
      (sleep 1 && git -C ~/.origin add -A && \
       git -C ~/.origin -c user.name=Origin -c user.email=daemon@origin.local \
           commit --quiet -m "forget: <source_id>" 2>/dev/null) || true
```

The retry handles index.lock races — the daemon may be writing to
`~/.origin/` at the same moment (auto-commit from captures). One-second
wait is enough for the daemon to release the lock.
