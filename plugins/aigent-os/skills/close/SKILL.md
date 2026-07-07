---
name: close
description: End-of-session memory commit — bank the session to the vault (session log, daily note, decision outcomes, honesty ledger) so the next /open resumes with full context. The structural enforcement point for session discipline.
category: project-management
trigger: /close
---

Run the aigent-OS end-of-session memory commit. No sub-agents — the AIgent does all updates inline.

---

## Step 0 — Discipline audit (HARD GATE — runs BEFORE daily note write)

Before writing anything else, audit the discipline. If any of these gates trip, the AIgent must address them before proceeding to Step 1.

### Gate A — Honesty Ledger
Scan the session for non-trivial work (any of: code edits >30 LOC, multi-file changes, completed task declarations, "shipped"/"done"/"complete"/"verified" claims).

If non-trivial work happened AND `memory/HONESTY_LEDGER.md` was NOT modified this session:
- Pause the close.
- Run `/honesty-check` for the most consequential work block.
- Append a structured entry to `memory/HONESTY_LEDGER.md` with:
  - Verified / Inferred / Guessed / Tradeoffs / Stopped short / Cost-implications / Self-rating / Resolution: OPEN.
- Then continue.

### Gate B — Trust Decay capture
Scan the session for confident-verb claims by the AIgent or any agent: "fixed", "verified", "tested", "deployed", "complete", "shipped", "ready", "running", "merged", "passing".

If any such claims were made about consequential work AND `memory/TRUST_DECAY.md` was NOT modified this session:
- Pause the close.
- Pick the 1-3 most consequential confident claims.
- Append Phase 1 entries to `memory/TRUST_DECAY.md` (Open section).
- Continue.

### Gate C — Failure Modes corpus
If `/diagnose` ran AND verified a cause this session AND `memory/FAILURE_MODES.md` was NOT modified:
- Pause.
- Append Phase 1 entry per [[concepts/Common Failure Modes]] format.
- Continue.

### Gate D — Decision aging follow-up
If during this session Will answered any decision-aging prompt (HELD / DRIFTED / REVERSED / STILL UNCLEAR) AND `memory/DECISION_OUTCOMES.md` was NOT updated with the answer:
- Pause.
- Append the outcome to the corresponding decision entry.
- Continue.

### Gate E — Drift report (Friday only)
If today is Friday, output a one-line measurement summary at the top of the orientation:
```
📊 Week measurement: {N} honesty ledger entries / {M} trust-decay captures / {P} failure modes logged / {Q} decision outcomes resolved
```
This is informational, not a gate — but if all numbers are 0 on a non-trivial week, that's signal that the discipline isn't firing and the audit gates aren't catching enough.

### Why the gates are HARD

Will explicitly cannot rely on himself remembering to invoke these skills (his words: *"all the stuff that requires discipline I will never do"*). The discipline is the principal's, but the enforcement is the framework's. /close is the structural enforcement point because it always runs at session end. Skipping the audit means the measurement substrate stays empty, which means v0.3's analyzers will have no data, which means the entire calibration claim degrades from "we measure" to "we built scaffolding and never measured."

If the AIgent tries to skip the audit and proceed straight to Step 1 — that itself is a trust-decay event. Capture it (in TRUST_DECAY.md) and then run the audit anyway.

---

## Step 0.5 — Somatic auto-integrations (v0.4.1)

Run before Step 1.

**A. Auto-digest if candidates staged.**
Read `memory/MEMORY_CANDIDATES.md`. If any rows have `status: staged`:
- Run `/digest` interactively (do NOT auto-promote — `/digest` surfaces each with promote/skip/supersede; principal decides).
- Continue once digest completes or principal defers.

**B. Auto-create context-capsule when appropriate.**
Read current body state (use cached `memory/BODY_STATE.json` from this session's `/body-check`, or compose if absent). Create a context-capsule when ANY of:
- `context_pressure >= medium`
- `delegation_open_count > 5`
- a non-trivial task shipped this session (code change, doc shipped, decision held)
- principal asks for one explicitly

Capsule write rules:
- Output to `memory/capsules/<capsule_id>.md` per `.claude/skills/context-capsule/SKILL.md` schema (frontmatter + body).
- `status: active`, `created_at: <now>`, `resolved_at: null`.
- If this session was itself a resume (BODY_STATE.json `last_capsule.status == resumed`), set `parent_capsule_id` to that capsule's id for chain lineage.

**C. Update BODY_STATE.json `last_capsule`.**
After capsule creation, edit `memory/BODY_STATE.json` `state.last_capsule` to:
```json
{ "id": "...", "path": "memory/capsules/<id>.md", "objective": "...", "status": "active", "created_at": "...", "resolved_at": null }
```
If a capsule was created and the *previous* `last_capsule.status` was `active`, demote the previous capsule's frontmatter to `status: resumed` (Edit the prior capsule file) so `/open` won't dual-offer next session.

**D. Skip if neither applies.** Empty candidates + low pressure + no shipped work = no capsule. Don't manufacture state preservation.

---

## Step 1 — Identify what changed this session

Scan the session. For each area, decide: **did anything actually change?** If no, skip it. If yes, update the relevant vault note(s).

**Vault notes to consider updating:**

| Location | Update when... |
|----------|----------------|
| `memory/SESSION_LOG.md` | ALWAYS — write new entry |
| `memory/DECISION_LOG.md` | A non-obvious decision was made with lasting impact |
| `memory/ACTIVE_PRIORITIES.md` | A priority shifted, completed, was added, or dropped |
| `memory/DELEGATION_TRACKER.md` | A delegation was opened, updated, or closed |
| `projects/*.md` | Product state changed (e.g., the product pipeline status, project stats) |
| `agents/*.md` | Agent status, scope, or capabilities changed |
| `people/*.md` | New person introduced or relationship/role changed |
| `concepts/*.md` | A concept was refined, new technique discovered, standing rule added |
| `memory/PRODUCT_STATE.md` | Only if the MOC links need updating (new product, retired product) |
| `memory/BUSINESS_CONTEXT.md` | Something material changed about a business |
| `memory/PEOPLE_AND_ROLES.md` | Only if the MOC links need updating (new person, new agent) |
| `memory/BOTTLENECK_PATTERNS.md` | A bottleneck appeared for 2nd+ time, or resolved |
| `memory/IDEA_QUEUE.md` | An idea was raised that shouldn't die |

**Typical session: 2–6 vault notes need updating. Skip everything else.**

**Creating new notes:** If the session introduced a new person, agent, project, or concept that doesn't have a vault note yet, CREATE one in the appropriate folder (people/, agents/, projects/, concepts/) with proper frontmatter, tags, and [[wikilinks]] to related notes. This is how the graph grows.

---

## Step 2 — Make the edits (read → edit, one file at a time)

For each note that needs updating:
1. Read it
2. Make the precise edit — no rewrites, no padding
3. Ensure [[wikilinks]] connect to relevant notes
4. Move on

---

## Step 3 — Write daily note

Create (or update if exists) `daily/[DATE].md` with:

```markdown
---
title: "[DATE]"
tags:
  - daily
date: [DATE]
---

# [DATE]

## Session Work
- [Bullet list of everything done, with [[wikilinks]] to every note touched]

## Decisions
- [Any decisions made, linked to relevant notes]

## Comms
- [Comms state — what was unread, what was acted on]

## Open Threads
- [Anything unresolved, linked to relevant notes]

## Links
Previous: [[YYYY-MM-DD]]
```

This is the temporal layer of the graph. Every daily note links to the people, projects, concepts, and agents involved that day.

---

## Step 4 — Write SESSION_LOG entry

Read `memory/SESSION_LOG.md`. Add at the top of Recent Sessions:

```
### [DATE] — [Session topic in 5–8 words]

**Worked on:** [One line]
**Key conclusion:** [Main decision or output]
**Next action:** [What happens next and who owns it]
**Open thread:** [Anything unresolved, or "None"]
```

Include [[wikilinks]] in the entry so /open can follow graph links to relevant context. Link to the daily note: `See [[YYYY-MM-DD]]`.

If more than 10 entries in Recent Sessions, move oldest to Archive as single lines.

---

## Step 5 — Regenerate memory heat index (silent)
Run silently so next `/open` has a fresh prioritization signal: `node "$AIGENT_VAULT/daemons/memory-heat/compute-heat.js" > /dev/null 2>&1`
Output lands at `memory/HEAT_INDEX.json`. Replaces the need for a separate weekly cron — every /close refreshes it. See `concepts/Memory Decay Doctrine.md`.

## Step 6 — Usage sync (silent)
Run silently: `bash "$AIGENT_VAULT/daemons/sync-usage.sh"`

## Step 6.5 — Temporal fact capture (silent)

Review the session for new facts worth recording. A "fact" is a concrete, verifiable assertion about the world — not an opinion or a task.

Scan the session for:
- New tool/API/service integrations ("the product now uses X")
- State changes ("operating mode changed to BUILD")
- Key decisions ("chose Vercel over Railway for the backend")
- External facts learned ("a competitor raised $1M", "launch date moved")

For each new fact, append one JSONL line to `memory/facts/facts.jsonl`:
```json
{"fact_id":"f{next_id}","subject":"...","predicate":"...","object":"...","valid_from":"YYYY-MM-DD","valid_until":null,"source":"daily/YYYY-MM-DD.md","confidence":0.9,"created_by":"aigent","superseded_by":null}
```

If a new fact contradicts an existing fact in facts.jsonl, supersede the old one:
1. Edit old fact: set `superseded_by` to new fact_id, set `valid_until` to today
2. Append new fact with updated values

If no new facts this session, skip silently. Do not force facts — only record what actually changed.

---

## Step 7 — REMINDB validation log (silent unless something to flag)

Read `$AIGENT_VAULT/memory/REMINDB_VALIDATION.md`.

Answer two questions:
1. Did the AIgent call any remindb MCP tool (`MemorySearch`, `MemoryTree`, `MemoryFetch`, `MemoryDelta`, `MemoryWrite`, `MemorySummarize`, `MemoryCompile`, `MemoryHistory`) at least once this session? Y/N
2. Were any failures observed per the failure definitions in the ledger? Y/N + one-line description if yes.

Then:
- Append one row to the per-session log table: `| YYYY-MM-DD | Y/N | Y — {description} or N | {brief notes or —} |`
- If remindb fired AND no failures: increment `Sessions logged` by 1
- If failures observed: increment `Failures observed` by 1 AND reset `Sessions logged` to 0
- If remindb did NOT fire this session: log as "not used", do not increment either counter
- Update the `Phase 2 ready` field: YES if `Sessions logged >= 5` AND `Failures observed == 0` since last clean reset, otherwise NO

Surface in commit summary ONLY if the Phase 2 ready threshold was just crossed this session: "remindb validated 5 sessions clean — phase 2 ready, will surface on next /open"

## Step 7.5 — Somatic /system-check audit (v0.5.2)

Run `bash daemons/system-check.sh`, capture exit code + any FAIL/INFO lines.

- If exit 0 (all PASS): include a one-line `✓ /system-check: 6/6 PASS` in the commit summary.
- If exit 1 (any FAIL): include the FAIL lines verbatim in the commit summary under a `⚠ /system-check FAIL` block, and surface to Will. Do NOT block /close — record and move on. The principal decides next-session whether to fix.
- If INFO lines present (e.g., daemon error log entries since last sweep): include a one-line `ℹ /system-check INFO: N daemon log entries` and offer to surface details on request.

This makes /close the natural smoke-test trigger — every session-end audits the wired Somatic stack. Catches silent breaks (e.g., a skill file deleted, a daemon syntax-broken, mirror discipline drift) before the next /open relies on them.

## Step 8 — Recompute ACTIVE_STATE (v0.7+)

After all vault writes are complete, recompute runtime state:

Run `python3 "$AIGENT_VAULT/daemons/runtime/update-active-state.py"`

This ensures the next `/open` reads fresh state. The daemon appends meaningful transitions to `STATE_EVENTS.jsonl` automatically (mode changes, objective changes).

If `reflexes.should_skill_hunt` is true in the output, note it in the commit summary.
If `reflexes.should_digest` is true, note it.

## Step 9 — Output commit summary (brief)

- Notes updated: [list with one-line description of what changed]
- Notes created: [any new vault notes added]
- Notes skipped: [list]
- Pick up next session: [one sentence on the most important open thread]

## Step 10 — Stamp the close marker

Write the current ISO timestamp to `.aigent/last-close` (create `.aigent/` if needed). This tells the next `/open` that this session was banked cleanly.

```bash
# bash / macOS / Linux
mkdir -p .aigent && date -u +%Y-%m-%dT%H:%M:%SZ > .aigent/last-close
```

```powershell
# PowerShell (Windows)
New-Item -ItemType Directory -Force .aigent | Out-Null
(Get-Date -AsUTC).ToString('yyyy-MM-ddTHH:mm:ssZ') | Set-Content .aigent\last-close
```
