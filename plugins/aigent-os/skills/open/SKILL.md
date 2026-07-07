---
name: open
description: Boot the session — load context from vault, surface what matters
category: project-management
trigger: /open
---

# Session Open

Run this at the start of every session.

## First-Run Detection

Before running the normal protocol, check `system/00_identity.md`. If it still contains "Replace this section with context about yourself" — the system is unconfigured. Say:

> "Looks like this is your first session. Run `/setup` and I'll configure aigent-OS to know who you are, what you're working on, and how you like to operate. Takes about 5 minutes."

Do NOT run the normal /open protocol on an unconfigured system — there's nothing in the vault yet.

## Protocol

**Unbanked-session recovery (runs first, before step 1):** Check `.aigent/last-close` (if present) against the most recent daily note's Session Captures timestamps. If Session Captures exist that are NEWER than the last-close stamp — or the marker is missing entirely but Session Captures exist — the previous session was never closed. Say so plainly: "Last session wasn't banked; recovering it now." Then reconstruct a brief summary from the auto-captured Session Captures in the daily note(s) (what was worked on, files touched), append a short recovered-session entry to `memory/SESSION_LOG.md` marked `(auto-recovered)`, and continue the normal /open. Never guilt-trip the operator; recovery is silent competence, one line.

1. **Load the heat index** — `vault/memory/HEAT_INDEX.json` if it exists. Use the `hot_top_20` array as your prioritized reading list. These are the notes most live in the vault right now (weighted by session reads, backlinks, mtime, with 60-day decay). **Skip cold notes entirely** unless the current session explicitly references them. See `vault/concepts/Memory Decay Doctrine.md`. If the file is missing, fall back to reading everything in steps 2–6.
2. **Read the latest daily note** — `vault/daily/` sorted by filename descending. This is last session's context.
3. **Read the session log** — `vault/memory/SESSION_LOG.md`. Get the "Next action" and "Open threads" from the latest entry.
4. **Read active priorities** — `vault/memory/ACTIVE_PRIORITIES.md`. Current mode, Tier 1 blockers.
5. **Follow the graph** — From the daily note's open threads, read the 3-5 most relevant vault notes (projects, concepts, agents referenced). Use the heat index from step 1 to tie-break when multiple notes look equally relevant.
6. **Check delegation tracker** — `vault/memory/DELEGATION_TRACKER.md`. Anything stale or pending review?

## Protocol (additional steps, v0.2.2+)

7. **Decision aging check** — Read `vault/memory/DECISION_OUTCOMES.md` and `vault/memory/DECISION_LOG.md`. For each decision in DECISION_LOG with a date 30, 60, or 90 (±3) days ago that does NOT yet have a corresponding outcome entry in DECISION_OUTCOMES.md at that aging interval, surface it as a one-line prompt. Maximum 3 entries per session — show the 3 oldest if more are due. See [[Cost of Confidence]] for why this matters.

8. **Attention reconciliation** — Read `vault/memory/ACTIVE_PRIORITIES.md` for intended focus (Tier 1 projects). Walk the last 7 days of `vault/daily/` and count weighted project mentions per project. Compare actual attention share vs intended. If any Tier 1 project has <40% of its intended share OR any non-Tier-1 project has >20% of total attention, flag drift. See [[Attention Reconciliation]] for the doctrine.

9. **Skill gap scan (weekly)** — Check the last-modified date of `vault/memory/SKILL_GAPS.md`. If any rows have `status: open` AND were logged more than 7 days ago, surface them:
  ```
  🔧 Open skill gaps (>7d): {count}. The AIgent will run /skill-hunt on the oldest.
  ```
  Then automatically run `/skill-hunt` on the single oldest open gap. If the gap is resolved, update SKILL_GAPS.md. If no open gaps exist, skip silently.

## Output

Brief greeting, then ONLY surface:

- **Decision aging (if any due):**
  ```
  📋 Decision aged Nd: "{summary}" — HELD / DRIFTED / REVERSED / STILL UNCLEAR?
  ```
  Principal answers in one word; the answer goes to `DECISION_OUTCOMES.md` on the next turn.

- **Attention drift (if detected):**
  ```
  🎯 Attention drift (7-day window):
     {project A} — actual {N}% / intended {M}% — drift detected
     Reconcile: update ACTIVE_PRIORITIES, refocus this session, or log a legitimate reason.
  ```

- Anything stale or blocked
- Anything dropped from last session's next action
- Open threads that need attention today

If nothing needs flagging, just greet and let the principal drive.

**Do NOT output a full briefing, priority list, or session summary.** Keep it tight. The principal knows their priorities — they need to know what changed, what's stuck, and what fell through.

## Runtime State (v0.7+)

After loading vault context (steps 1-9), compute and read runtime state:

10. **Compute ACTIVE_STATE** — Run `python3 "$AIGENT_VAULT/daemons/runtime/update-active-state.py"`. This reads BODY_STATE, capsules, SESSION_LOG, DECISION_LOG, SKILL_GAPS, DELEGATION_TRACKER and computes mode, objective, pressures, reflexes, blocked items.

11. **Read ACTIVE_STATE** — Read `$AIGENT_VAULT/memory/runtime/ACTIVE_STATE.json`. Use it to orient:
    - `next_valid_action` — what to do first
    - `blocked_items` — what's stuck
    - `reflexes` that are true — surface as recommendations (e.g., "Memory backlog high, /digest recommended")
    - `mode` — if `paused`, offer capsule resume

12. **Run /reconcile (weekly)** — If today is Monday or it's been >7 days since last reconcile, run `/reconcile` silently. Surface only contradictions and drift, not a full report.
