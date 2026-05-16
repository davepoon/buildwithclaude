---
name: brief
description: >
  Session-start briefing from Origin. Reads the project status file (the
  /handoff-maintained ledger of Active/Backlog work), then loads identity,
  preferences, and topic-relevant memories so the agent walks in with context.
  Surfaces any memories the daemon has flagged for human revision before the
  session uses them. Invoked as `/brief [topic]`. Call FIRST at session start,
  before any other Origin verb.
argument-hint: "[topic]"
allowed-tools: ["Bash", "mcp__plugin_origin_origin__context", "mcp__plugin_origin_origin__recall", "mcp__plugin_origin_origin__list_pending_revisions", "mcp__plugin_origin_origin__accept_revision", "mcp__plugin_origin_origin__dismiss_revision"]
---

# /brief

Pull a curated session brief from Origin. Three sources, in order:

1. **Project status file** — what `/handoff` last wrote. Authoritative for
   "what's left to do" right now.
2. **`context` MCP** — identity, preferences, topic-relevant memories.
   Background, not ledger.
3. **`list_pending_revisions`** — daemon-flagged memories awaiting review.

Status file wins on "what's next" because memories rank by topic similarity
and surface stale items alongside fresh ones; the status file is the live
ledger maintained per session.

## 1. Read project status file first

Detect project root:

```
Bash: cd_repo=$(git -C "$PWD" rev-parse --show-toplevel 2>/dev/null); echo "${cd_repo:-no-git}"
```

- If output is a path → `<project>` = basename (e.g. `origin`).
- If `no-git` → `<project>` = cwd basename.

Read `~/.origin/sessions/_status/<project>.md`:

```
Bash: cat ~/.origin/sessions/_status/<project>.md
```

If the file exists, render its `## Last session`, `## Active`, and `## Backlog`
sections verbatim at the top of the brief output, under a heading like
`Status (last session <date>)`. This is the authoritative "what's left" frame.

If the file is missing, say nothing about it. First-time projects haven't
been handed off yet.

## 2. Call context

Call the `origin` MCP server's `context` tool. If the user passed a topic
argument, pass it through. Otherwise infer scope from the working directory and
the conversation so far — don't ask the user.

```
context(topic="<args or inferred>", space=<inferred from cwd or recent turns>)
```

**Scope inference rules:**

- `topic`: if user omitted args, pass the most recent topic from the
  conversation (file or feature being discussed), or omit for a fresh
  general brief at session start.
- `space`: from cwd. `~/Repos/origin/...` → `"origin"`. Other repos → repo
  name. Outside any repo → omit. Always pass when scope is known; if
  uncertain, run `list_spaces` later (post-PR-C) or omit.

## When to use

- Session start — call BEFORE any other Origin tool.
- Major topic shift mid-session.
- User says "catch me up", "what's the background on X", "remind me about Y".
- Mid-session check-in to confirm assumptions.

## When NOT to use

- Specific factual lookup → use `/recall` (more targeted).
- Storing a new memory → use `/capture`.
- End of session → use `/handoff`.

## How to use the result

Treat the status file as the live ledger (what's next), and the `context`
memories as background (how the user thinks). When the status file says an
item is done but a memory still says it's pending, trust the status file —
memories don't auto-supersede. If you see drift, flag it inline rather than
parrot the stale memory.

Model how the user thinks. Their preferences, corrections, and past decisions
tell you how they want to be helped, not just what they already know. Don't
just look things up: adjust your behavior.

## 3. Pending revisions check

After loading context, call:

```
list_pending_revisions(limit=10)
```

If the result is empty, **say nothing**. Do not print "0 pending revisions" or any "all clear" line. The brief is already noisy enough.

If the MCP call errors, log a one-line warning and continue. Do not error out the brief.

If the result is non-empty, render a block at the end of the brief (after the context summary, before handing back to the user). The daemon returns rows already sorted by `last_modified DESC`; just slice the first three.

Each `PendingRevisionItem` carries `target_source_id`, `revision_source_id`, `revision_content`, `source_agent`, and `last_modified`. The original memory's content is **not** on this response. The block displays the proposed revision text and the target memory id; if the user wants to see the original before deciding, they can run `/recall <target_source_id>` first.

```
Pending revisions (<N> total, top 3 shown):

1. target: mem_abc123  (proposed by <source_agent or "daemon">)
   revision: "Origin uses Turso libSQL fork (libSQL-server) for vectors..."
   Action: accept (replace original) | dismiss (drop revision) | skip

2. ...
```

Inline accept/dismiss verbs map to:

- accept: `accept_revision(target_source_id="<id>")`
- dismiss: `dismiss_revision(target_source_id="<id>")`
- skip: no call; the revision stays pending for the next /brief

If `<N> > 3`, end the block with one line:

```
Run `/review revisions` to walk the rest.
```

Do not auto-action anything. The user picks per item.

Note: this block surfaces *all* pending revisions, not just this session's, because revisions are about memories you may still be using right now, regardless of when the contradiction was flagged.
