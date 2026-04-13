---
name: gsd-remove-phase
description: "Remove a future phase from roadmap and renumber subsequent phases"
argument-hint: "<phase-number>"
allowed-tools:
  - Read
  - Write
  - Bash
  - Glob
---


<objective>
Remove an unstarted future phase from the roadmap and renumber all subsequent phases to maintain a clean, linear sequence.

Purpose: Clean removal of work you've decided not to do, without polluting context with cancelled/deferred markers.
Output: Phase deleted, all subsequent phases renumbered, git commit as historical record.
</objective>

<!-- Workflow content (was: remove-phase.md) -->
<purpose>
Remove an unstarted future phase from the project roadmap, delete its directory, renumber all subsequent phases to maintain a clean linear sequence, and commit the change. The git commit serves as the historical record of removal.
</purpose>

<required_reading>
Read the skill content below before starting.
</required_reading>

<process>

<step name="parse_arguments">
Parse the command arguments:
- Argument is the phase number to remove (integer or decimal)
- Example: `/gsd-remove-phase 17` → phase = 17
- Example: `/gsd-remove-phase 16.1` → phase = 16.1

If no argument provided:

```
ERROR: Phase number required
Usage: /gsd-remove-phase <phase-number>
Example: /gsd-remove-phase 17
```

Exit.
</step>

<step name="init_context">
Load phase operation context:

```bash
INIT=$(node "$GSD_TOOLS" init phase-op "${target}")
if [[ "$INIT" == @file:* ]]; then INIT=$(cat "${INIT#@file:}"); fi
```

Extract: `phase_found`, `phase_dir`, `phase_number`, `commit_docs`, `roadmap_exists`.

Also read STATE.md and ROADMAP.md content for parsing current position.
</step>

<step name="validate_future_phase">
Verify the phase is a future phase (not started):

1. Compare target phase to current phase from STATE.md
2. Target must be > current phase number

If target <= current phase:

```
ERROR: Cannot remove Phase {target}

Only future phases can be removed:
- Current phase: {current}
- Phase {target} is current or completed

To abandon current work, use /gsd-pause-work instead.
```

Exit.
</step>

<step name="confirm_removal">
Present removal summary and confirm:

```
Removing Phase {target}: {Name}

This will:
- Delete: .planning/phases/{target}-{slug}/
- Renumber all subsequent phases
- Update: ROADMAP.md, STATE.md

Proceed? (y/n)
```

Wait for confirmation.
</step>

<step name="execute_removal">
**Delegate the entire removal operation to gsd-tools:**

```bash
RESULT=$(node "$GSD_TOOLS" phase remove "${target}")
```

If the phase has executed plans (SUMMARY.md files), gsd-tools will error. Use `--force` only if the user confirms:

```bash
RESULT=$(node "$GSD_TOOLS" phase remove "${target}" --force)
```

The CLI handles:
- Deleting the phase directory
- Renumbering all subsequent directories (in reverse order to avoid conflicts)
- Renaming all files inside renumbered directories (PLAN.md, SUMMARY.md, etc.)
- Updating ROADMAP.md (removing section, renumbering all phase references, updating dependencies)
- Updating STATE.md (decrementing phase count)

Extract from result: `removed`, `directory_deleted`, `renamed_directories`, `renamed_files`, `roadmap_updated`, `state_updated`.
</step>

<step name="commit">
Stage and commit the removal:

```bash
node "$GSD_TOOLS" commit "chore: remove phase {target} ({original-phase-name})" --files .planning/
```

The commit message preserves the historical record of what was removed.
</step>

<step name="completion">
Present completion summary:

```
Phase {target} ({original-name}) removed.

Changes:
- Deleted: .planning/phases/{target}-{slug}/
- Renumbered: {N} directories and {M} files
- Updated: ROADMAP.md, STATE.md
- Committed: chore: remove phase {target} ({original-name})

---

## What's Next

Would you like to:
- `/gsd-progress` — see updated roadmap status
- Continue with current phase
- Review roadmap

---
```
</step>

</process>

<anti_patterns>

- Don't remove completed phases (have SUMMARY.md files) without --force
- Don't remove current or past phases
- Don't manually renumber — use `gsd-tools phase remove` which handles all renumbering
- Don't add "removed phase" notes to STATE.md — git commit is the record
- Don't modify completed phase directories
</anti_patterns>

<success_criteria>
Phase removal is complete when:

- [ ] Target phase validated as future/unstarted
- [ ] `gsd-tools phase remove` executed successfully
- [ ] Changes committed with descriptive message
- [ ] User informed of changes
</success_criteria>


<context>
Phase: $ARGUMENTS

Roadmap and state are resolved in-workflow via `init phase-op` and targeted reads.
</context>

<process>
Execute the remove-phase workflow steps embedded above end-to-end.
Preserve all validation gates (future phase check, work check), renumbering logic, and commit.
</process>
