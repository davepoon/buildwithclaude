---
name: gsd-pause-work
description: "Create context handoff when pausing work mid-phase"
allowed-tools:
  - Read
  - Write
  - Bash
---



<objective>
Create `.continue-here.md` handoff file to preserve complete work state across sessions.

Routes to the pause-work workflow which handles:
- Current phase detection from recent files
- Complete state gathering (position, completed work, remaining work, decisions, blockers)
- Handoff file creation with all context sections
- Git commit as WIP
- Resume instructions
</objective>
<purpose>
Create structured `.planning/HANDOFF.json` and `.continue-here.md` handoff files to preserve complete work state across sessions. The JSON provides machine-readable state for `/gsd-resume-work`; the markdown provides human-readable context.
</purpose>

<required_reading>
Read the skill content below before starting.
</required_reading>

<process>

<step name="detect">
## Context Detection

Determine what kind of work is being paused and set the handoff destination accordingly:

```bash
# Check for active phase
phase=$(( ls -lt .planning/phases/*/PLAN.md 2>/dev/null || true ) | head -1 | grep -oP 'phases/\K[^/]+' || true)

# Check for active spike
spike=$(( ls -lt .planning/spikes/*/SPIKE.md .planning/spikes/*/DESIGN.md 2>/dev/null || true ) | head -1 | grep -oP 'spikes/\K[^/]+' || true)

# Check for active deliberation
deliberation=$(ls .planning/deliberations/*.md 2>/dev/null | head -1 || true)
```

- **Phase work**: active phase directory → handoff to `.planning/phases/XX-name/.continue-here.md`
- **Spike work**: active spike directory or spike-related files (no active phase) → handoff to `.planning/spikes/SPIKE-NNN/.continue-here.md` (create directory if needed)
- **Deliberation work**: active deliberation file (no phase/spike) → handoff to `.planning/deliberations/.continue-here.md`
- **Research work**: research notes exist but no phase/spike/deliberation → handoff to `.planning/.continue-here.md`
- **Default**: no detectable context → handoff to `.planning/.continue-here.md`, note the ambiguity in `<current_state>`

If phase is detected, proceed with phase handoff path. Otherwise use the first matching non-phase path above.
</step>

<step name="gather">
**Collect complete state for handoff:**

1. **Current position**: Which phase, which plan, which task
2. **Work completed**: What got done this session
3. **Work remaining**: What's left in current plan/phase
4. **Decisions made**: Key decisions and rationale
5. **Blockers/issues**: Anything stuck
6. **Human actions pending**: Things that need manual intervention (MCP setup, API keys, approvals, manual testing)
7. **Background processes**: Any running servers/watchers that were part of the workflow
8. **Files modified**: What's changed but not committed
9. **Blocking constraints**: Anti-patterns or methodological failures encountered during this session that a resuming agent MUST be aware of before proceeding. Only include items discovered through actual failure — not warnings or predictions. Assign each constraint a `severity`:
   - `blocking` — The resuming agent MUST demonstrate understanding before proceeding. The discuss-phase and execute-phase workflows will enforce a mandatory understanding check.
   - `advisory` — Important context but does not gate resumption.

Ask user for clarifications if needed via conversational questions.

**Also inspect SUMMARY.md files for false completions:**
```bash
# Check for placeholder content in existing summaries
grep -l "To be filled\|placeholder\|TBD" .planning/phases/*/*.md 2>/dev/null || true
```
Report any summaries with placeholder content as incomplete items.
</step>

<step name="write_structured">
**Write structured handoff to `.planning/HANDOFF.json` using the shared checkpoint command:**

The shared `checkpoint` command in `gsd-tools.cjs` generates the base HANDOFF.json with state gathered from STATE.md, the current phase directory, and live git output (status + recent log). This is the same function the PreCompact hook uses, so manual pause and auto-compact checkpoints always produce the identical 19-field schema (D-01, D-10, D-12).

Step 1 -- generate the base HANDOFF.json:

```bash
node "$GSD_TOOLS" checkpoint --source manual-pause
```

This writes `.planning/HANDOFF.json` with `source: "manual-pause"`, `status: "paused"`, `version: "1.0"`, and auto-populates:
- `phase`, `phase_name`, `phase_dir` from STATE.md frontmatter
- `plan`, `task`, `total_tasks` from STATE.md "Current Position"
- `completed_tasks` / `remaining_tasks` from the PLAN.md / SUMMARY.md pairs in the phase directory + recent git log
- `uncommitted_files` from a fresh `git status --porcelain` (D-03 -- always live)
- `decisions` from STATE.md "Accumulated Context > Decisions"
- `context_notes` from STATE.md body + recent commits
- `next_action` from STATE.md "Current Position > Status"

Step 2 -- enrich with conversation-only context. The checkpoint command cannot see the active conversation, so the skill merges in fields that only the pausing agent knows about (from the `gather` step):

```bash
# Read the generated base
cat .planning/HANDOFF.json
```

Using the Read + Write tools, update these fields in-place with data from the gather step:

- `completed_tasks`: Replace or augment with the per-task list you collected in `gather` (include commit short hashes and in-progress notes from the current session, not just what STATE.md knew).
- `remaining_tasks`: Replace with the specific remaining tasks you identified, including any new ones discovered this session.
- `blockers`: Append entries the conversation uncovered. Each entry follows `{"description": "...", "type": "technical|human_action|external", "workaround": "..."}`.
- `human_actions_pending`: Append entries for manual steps the resuming agent must perform before continuing. Each entry follows `{"action": "...", "context": "...", "blocking": true|false}`.
- `decisions`: Append session-scoped decisions (rationale + phase). These are on top of anything the checkpoint command already parsed from STATE.md.
- `context_notes`: Append your mental-state and approach notes to the auto-generated context string. Do not overwrite -- preserve the STATE.md-derived context.
- `next_action`: Override with the specific first action you want the resuming agent to take (from gather step). Fall back to the checkpoint-generated value if there's nothing session-specific to say.

Leave every other field untouched: `version`, `timestamp`, `source`, `partial`, `phase*`, `plan`, `task`, `total_tasks`, `status`, and `uncommitted_files` are all produced correctly by the shared function and must not be hand-edited.

After merging, write the updated HANDOFF.json back to `.planning/HANDOFF.json`. The final object keeps the exact 19-field schema that `/gsd-resume-work` expects (per D-11, resume treats manual-pause and auto-compact HANDOFF files identically).
</step>

<step name="write">
**Write handoff to the path determined in the detect step** (e.g. `.planning/phases/XX-name/.continue-here.md`, `.planning/spikes/SPIKE-NNN/.continue-here.md`, or `.planning/.continue-here.md`):

```markdown
---
context: [phase|spike|deliberation|research|default]
phase: XX-name
task: 3
total_tasks: 7
status: in_progress
last_updated: [timestamp from current-timestamp]
---

# BLOCKING CONSTRAINTS — Read Before Anything Else

> These are not suggestions. Each constraint below was discovered through failure.
> Acknowledge each one explicitly before proceeding.

- [ ] CONSTRAINT: [name] — [what it is] — [structural mitigation required]

**Do not proceed until all boxes are checked.**

_If no constraints have been identified yet, remove this section._

## Critical Anti-Patterns

| Pattern | Description | Severity | Prevention Mechanism |
|---------|-------------|----------|---------------------|
| [pattern name] | [what it is and how it manifested] | blocking | [structural step that prevents recurrence — not acknowledgment] |
| [pattern name] | [what it is and how it manifested] | advisory | [guidance for avoiding it] |

**Severity values:** `blocking` — resuming agent must pass understanding check before proceeding. `advisory` — important context, does not gate resumption.

_Remove rows that do not apply. The discuss-phase and execute-phase workflows parse this table and enforce a mandatory understanding check for any `blocking` rows._

<current_state>
[Where exactly are we? Immediate context]
</current_state>

<completed_work>

Completed Tasks:
- Task 1: [name] - Done
- Task 2: [name] - Done
- Task 3: [name] - In progress, [what's done]
</completed_work>

<remaining_work>

- Task 3: [what's left]
- Task 4: Not started
- Task 5: Not started
</remaining_work>

<decisions_made>

- Decided to use [X] because [reason]
- Chose [approach] over [alternative] because [reason]
</decisions_made>

<blockers>
- [Blocker 1]: [status/workaround]
</blockers>

## Required Reading (in order)
<!-- List documents the resuming agent must read before acting -->
1. [document] — [why it matters]
1. `.planning/METHODOLOGY.md` (if it exists) — project analytical lenses; apply before any assumption analysis

## Critical Anti-Patterns (do NOT repeat these)
<!-- Mistakes discovered this session that must be structurally avoided -->
- [ANTI-PATTERN]: [what it is] → [structural mitigation]

## Infrastructure State
<!-- Running services, external state, environment specifics -->
- [service/env]: [current state]

## Pre-Execution Critique Required
<!-- Fill in ONLY if pausing between design and execution (e.g. spike design done, not yet run) -->
- Design artifact: [path]
- Critique focus: [key questions the critic should probe]
- Gate: Do NOT begin execution until critique is complete and design is revised

<context>
[Mental state, what were you thinking, the plan]
</context>

<next_action>
Start with: [specific first action when resuming]
</next_action>
```

Be specific enough for a fresh Claude to understand immediately.

Use `current-timestamp` for last_updated field. You can use init todos (which provides timestamps) or call directly:
```bash
timestamp=$(node "$GSD_TOOLS" current-timestamp full --raw)
```
</step>

<step name="commit">
```bash
node "$GSD_TOOLS" commit "wip: [context-name] paused at [X]/[Y]" --files [handoff-path] .planning/HANDOFF.json
```
</step>

<step name="confirm">
```
✓ Handoff created:
  - .planning/HANDOFF.json (structured, machine-readable)
  - [handoff-path] (human-readable)

Current state:

- Context: [phase|spike|deliberation|research]
- Location: [XX-name or SPIKE-NNN]
- Task: [X] of [Y]
- Status: [in_progress/blocked]
- Blockers: [count] ({human_actions_pending count} need human action)
- Committed as WIP

To resume: /gsd-resume-work

```
</step>

</process>

<success_criteria>
- [ ] Context detected (phase/spike/deliberation/research/default)
- [ ] .continue-here.md created at correct path for detected context
- [ ] Required Reading, Anti-Patterns, and Infrastructure State sections filled
- [ ] Pre-Execution Critique section filled if pausing between design and execution
- [ ] Committed as WIP
- [ ] User knows location and how to resume
</success_criteria>
