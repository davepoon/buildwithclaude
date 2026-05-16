---
name: handoff
description: >
  End-of-session ritual. Captures decisions, lessons, gotchas, and open
  threads. Writes a narrative session log to ~/.origin/sessions/ and stores
  granular memories via Origin MCP. Previews any unconfirmed captures from
  the current session before closing. Invoked as `/handoff`.
allowed-tools: ["Bash", "mcp__plugin_origin_origin__capture", "mcp__plugin_origin_origin__list_pending"]
---

# /handoff

End-of-session debrief. Three artifacts each pass:

1. **Granular MCP captures** — one per decision/lesson/gotcha (DB authoritative).
2. **Session log md** — narrative thread at `~/.origin/sessions/<YYYY-MM-DD-HHmm>-<slug>.md`.
3. **Project status md + json** — current goals + last-handoff timestamp at `~/.origin/sessions/_status/`.

These are orthogonal: captures are queryable atoms, session log is the
narrative thread, status file lets the next session see where we left off.

## Steps

### 1. Detect project + last handoff time

```
Bash: cd_repo=$(git -C "$PWD" rev-parse --show-toplevel 2>/dev/null); echo "${cd_repo:-no-git}"
```

- If output is a path → use the basename as `<project>` (e.g. `origin`).
- If `no-git` → use the cwd basename. Skip git steps below; rely entirely
  on conversation context.

Read `~/.origin/sessions/_status/handoff-<project>.json` for `lastHandoff`
timestamp (ISO-8601). If file missing, default to "12 hours ago".

### 1.5 Pending-captures preview

After establishing `<lastHandoff>`, call:

```
list_pending(limit=50)
```

The MCP returns memory rows with `source_id`, `content`, `created_at`, and
other metadata. Convert `lastHandoff` (ISO-8601 string, e.g.
`2026-05-13T22:50:00Z`) to a Unix epoch seconds integer before filtering:

```
Bash: date -j -f %Y-%m-%dT%H:%M:%SZ "$lastHandoff" +%s
```

Or in your scripting language of choice (Python's `datetime.fromisoformat`,
JavaScript's `Date.parse`, etc.). Save the result as `lastHandoffEpoch`.

Then filter the response rows: keep where `row.created_at >= lastHandoffEpoch`.
These are captures this session produced that the quality gate left unconfirmed
(untrusted-source captures).

If the filtered list is empty, say nothing. Proceed to Step 2.

If non-empty, render a preview block once, before the existing capture flow:

```
Pending captures this session (<N> total, top 3 shown):

1. mem_xyz789  "..."  (untrusted source: <agent>)
2. ...

Default: proceed (captures stay pending). Opt in by running
`/review captures` before re-invoking /handoff if you want to walk them.
```

Do NOT prompt for per-item action inline. The user proceeds with /handoff
regardless; the preview is informational only.

### 2. Gather session context (parallel, only if git repo)

```
Bash: git -C <repo> log --oneline --since=<lastHandoff>
Bash: git -C <repo> status --short
Bash: git -C <repo> diff --stat HEAD~5..HEAD 2>/dev/null
Bash: git -C <repo> worktree list
```

Capture output. Use it alongside conversation history to infer what
happened. If not a git repo, skip — conversation context is the source.

### 3. Infer, do not ask

Synthesize silently from git output + conversation. Categorize each item
into user-facing groups. Each maps to a daemon `memory_type` for the
capture call:

| Display label | daemon memory_type | What belongs here |
|---|---|---|
| Decisions | `decision` | architectural choice, tool/pattern selection (with WHY) |
| Lessons | `lesson` | root cause discovered, workaround found, technical insight |
| Insights | `gotcha` | unexpected behavior, debugging discovery, sharp edge |
| Corrections | `preference` | user pushed back, corrected approach or assumption |
| Facts | `fact` | durable project/people/tool fact worth persisting |

Non-memory items (not stored, session-log only):
- **Open threads** — started but not finished, blockers.

Skip purely mechanical facts already in git (file paths, function names,
config values). The commit log preserves those.

### 4. MCP captures (one per item)

For each non-trivial item, call with the mapped `memory_type`:

```
capture(content="<one self-contained sentence with WHY>", memory_type="<decision|lesson|gotcha|preference|fact>")
```

Atomic: one decision per call. Don't merge multiple items into one
memory. The daemon dedups against existing knowledge, so re-storing
known facts is a no-op.

Only surface items to the user BEFORE storing if they meet one of these
bars:

- Contradicts an existing memory (recall returned a conflicting fact).
- Marks a critical incident, irreversible action, or production change.
- You are uncertain whether the item is durable vs transient.

Otherwise just store and report counts at the end.

### 5. Write session log

Bash heredoc to `~/.origin/sessions/<YYYY-MM-DD-HHmm>-<slug>.md`:

```markdown
# Session <YYYY-MM-DD HH:MM> — <slug>

**Project:** <project>
**Range:** <lastHandoff> → <now>

## Accomplished
- <item>

## Decisions
- <decision and rationale>

## Lessons & Gotchas
- <root cause / workaround>

## Open Threads
- <what's unfinished>

## Captures stored
- <source_id_or_brief_summary>

## Git summary
<git log --oneline output>
```

`<slug>` = kebab-case 2-4 word summary (`session-handoff-md-writer`).

### 6. Update project status

Overwrite `~/.origin/sessions/_status/<project>.md`:

```markdown
# <Project> — Current Status

## Last session (<date>)
- <accomplished bullet>

## Active
<!-- Items touched/spawned in the last 1-2 sessions. Real next-move candidates. -->
- <item> (added <YYYY-MM-DD>)
- <blocked item> (added <YYYY-MM-DD>) (gated: <trigger>)

## Backlog
<!-- Older accretion. Not gated, not picked. Promote back to Active when re-engaged. -->
- <item> (added <YYYY-MM-DD>)
```

Single file per project. New session overwrites — this is the *current*
state, not a log.

**Two sections, not one flat list:** `## Active` and `## Backlog` separate
the two types of tasks that get mixed otherwise. Active = fresh signal
worth picking next. Backlog = older parked items, kept for reference but
not in the "what next?" frame.

**Date stamp every bullet** with `(added <YYYY-MM-DD>)`. Use today's date
when adding a new item; preserve the original date when carrying an item
forward. Dates make age visible at a glance and avoid relative-time drift.

**Gated items stay inline-tagged** with `(gated: <trigger>)` — no separate
section. The tag tells the reader why it can't move yet; the bullet stays
in whichever section reflects its recency.

**Promotion / demotion rules:**
- New item this session → `## Active` with today's date
- Item in `## Active` that wasn't touched this session AND wasn't touched
  the prior session → demote to `## Backlog` (keep original date)
- Item in `## Backlog` that work resumed on → promote back to `## Active`
  (keep original date — staleness is a property of the work, not the
  bullet text)

### 7. Write timestamp

Overwrite `~/.origin/sessions/_status/handoff-<project>.json`:

```json
{
  "lastHandoff": "<ISO-8601 now>",
  "project": "<project>",
  "summary": "<one-line>"
}
```

Per-project file prevents parallel sessions from clobbering each other.

### 8. Auto-commit ~/.origin/

After writing the files above, snapshot the change so the user can `git
log` their memory's life timeline. Defensive — silent skip if `git` is
missing or `~/.origin/` is not a repo yet.

```
Bash: git -C ~/.origin add -A && \
      git -C ~/.origin -c user.name=Origin -c user.email=daemon@origin.local \
          commit --quiet -m "session: <slug>" 2>/dev/null || \
      (sleep 1 && git -C ~/.origin add -A && \
       git -C ~/.origin -c user.name=Origin -c user.email=daemon@origin.local \
           commit --quiet -m "session: <slug>" 2>/dev/null) || true
```

The retry handles index.lock races — the daemon may be writing to
`~/.origin/` at the same moment (auto-commit from captures). One-second
wait is enough for the daemon to release the lock.

### 9. Confirm

Print one summary block with captures grouped by display label:

```
Handoff stored.
  Decisions:   <N> (brief list)
  Lessons:     <N> (brief list)
  Insights:    <N> (brief list)
  Corrections: <N> (brief list)
  Facts:       <N> (brief list)
  Session:     ~/.origin/sessions/<filename>
  Status:      ~/.origin/sessions/_status/<project>.md
  Git:         <commit hash> session: <slug>
```

Show each label only if non-empty. List items as short phrases, not
full sentences — the session log has the details.

## When to use

- "Wrapping up", "let's call it", "we're done".
- Session about to close and useful state would otherwise be lost.

## When NOT to use

- Mid-flow capture during work → use `/capture` (single memory).
- Search / lookup → use `/recall`.
- One-off chat with no decisions or lessons — captures alone are enough.

## Notes on the three artifact classes

- **Memories** (MCP captures) live in the daemon DB only. Confirmation flips
  a `stability` flag — they never get exported to md.
- **Pages** are wiki-style syntheses written to `~/.origin/pages/` by the
  daemon when `/distill` runs. Citations link back to source memory ids.
- **Sessions** (this skill) live only at `~/.origin/sessions/`. They are
  the narrative axis: chronological, not topical. Browse them as a
  changelog of your work.
