---
name: gsd:resume-work
description: Resume work from previous session with full context restoration
allowed-tools:
  - Read
  - Bash
  - Write
  - AskUserQuestion
  - SlashCommand
---

<objective>
Restore complete project context from a previous session — handling both manual pause (from `/gsd:pause-work`) and auto-compact (from the PreCompact hook) handoffs identically.
</objective>

<process>

1. **Detect handoff state.**
   Check for `.planning/HANDOFF.json` via Read tool. If missing, the session has no handoff — announce "No handoff found" and proceed to normal `/gsd:progress` routing.

2. **Load STATE.md.**
   Read `.planning/STATE.md` to restore the big-picture project position. If missing, reconstruct from `.planning/ROADMAP.md` and the latest phase directory's SUMMARY.md files; if reconstruction fails, surface the error and stop.

3. **Read the handoff.**
   Parse `.planning/HANDOFF.json`. Extract phase, plan, task, status, source, uncommitted_files, decisions, context_notes, next_action. Per HANDOFF schema, all fields are always present (empty arrays / null for unset).

4. **Present project status.**
   Emit a compact status block covering:
   - Milestone + percent complete (from STATE.md frontmatter `progress.percent`).
   - Current phase name and number.
   - Plan / task position from the handoff.
   - Handoff source (manual-pause vs auto-compact) and timestamp.
   - Top 3 decisions and any blockers from the handoff.
   - Uncommitted files summary.
   - The `next_action` string verbatim — it's the resumption hint.

5. **Route to the next action.**
   Offer 1-3 concrete options based on handoff state. Common patterns:
   - If task was mid-execute: offer `/gsd:execute-phase` with the current phase.
   - If phase is at plan boundary: offer `/gsd:plan-phase` or `/gsd:execute-phase` for the next phase.
   - If there are uncommitted files that look in-progress: call attention to them before offering continuation.

6. **Clean up the handoff (LIFE-01).**
   After routing — once steps 1-5 have completed without error — remove the handoff file:

   ```bash
   node "${CLAUDE_PLUGIN_ROOT:-$HOME/.claude/plugins/cache/gsd-plugin/current}/bin/gsd-tools.cjs" checkpoint --clear
   ```

   If the command is unavailable for any reason, fall back to direct removal:
   ```bash
   rm -f .planning/HANDOFF.json
   ```

   Do not abort the resume if cleanup fails — it's hygiene, not correctness. The next session's SessionStart will overwrite a stale handoff anyway (per D-05 from Phase 4: latest snapshot wins).

</process>

<rules>
- Step 6 runs **last**, after all context is loaded and the user has been shown status. A failed/aborted resume (steps 1-5 error out) leaves HANDOFF.json on disk for recovery (per D-08).
- If `HANDOFF.json` is absent in step 1, skip everything — don't attempt to clean up what isn't there. `checkpoint --clear` is idempotent but unnecessary work.
- The skill is the single owner of HANDOFF.json deletion. The SessionStart hook must NOT delete — it only detects (per D-10).
</rules>
