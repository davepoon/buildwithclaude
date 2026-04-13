---
name: gsd-insert-phase
description: "Insert urgent work as decimal phase (e.g., 72.1) between existing phases"
argument-hint: "<after> <description>"
allowed-tools:
  - Read
  - Write
  - Bash
---



<objective>
Insert a decimal phase for urgent work discovered mid-milestone that must be completed between existing integer phases.

Uses decimal numbering (72.1, 72.2, etc.) to preserve the logical sequence of planned phases while accommodating urgent insertions.

Purpose: Handle urgent work discovered during execution without renumbering entire roadmap.
</objective>

<!-- Workflow content (was: insert-phase.md) -->
<purpose>
Insert a decimal phase for urgent work discovered mid-milestone between existing integer phases. Uses decimal numbering (72.1, 72.2, etc.) to preserve the logical sequence of planned phases while accommodating urgent insertions without renumbering the entire roadmap.
</purpose>

<required_reading>
Read the skill content below before starting.
</required_reading>

<process>

<step name="parse_arguments">
Parse the command arguments:
- First argument: integer phase number to insert after
- Remaining arguments: phase description

Example: `/gsd-insert-phase 72 Fix critical auth bug`
-> after = 72
-> description = "Fix critical auth bug"

If arguments missing:

```
ERROR: Both phase number and description required
Usage: /gsd-insert-phase <after> <description>
Example: /gsd-insert-phase 72 Fix critical auth bug
```

Exit.

Validate first argument is an integer.
</step>

<step name="init_context">
Load phase operation context:

```bash
INIT=$(node "$GSD_TOOLS" init phase-op "${after_phase}")
if [[ "$INIT" == @file:* ]]; then INIT=$(cat "${INIT#@file:}"); fi
```

Check `roadmap_exists` from init JSON. If false:
```
ERROR: No roadmap found (.planning/ROADMAP.md)
```
Exit.
</step>

<step name="insert_phase">
**Delegate the phase insertion to gsd-tools:**

```bash
RESULT=$(node "$GSD_TOOLS" phase insert "${after_phase}" "${description}")
```

The CLI handles:
- Verifying target phase exists in ROADMAP.md
- Calculating next decimal phase number (checking existing decimals on disk)
- Generating slug from description
- Creating the phase directory (`.planning/phases/{N.M}-{slug}/`)
- Inserting the phase entry into ROADMAP.md after the target phase with (INSERTED) marker

Extract from result: `phase_number`, `after_phase`, `name`, `slug`, `directory`.
</step>

<step name="update_project_state">
Update STATE.md to reflect the inserted phase:

1. Read `.planning/STATE.md`
2. Under "## Accumulated Context" → "### Roadmap Evolution" add entry:
   ```
   - Phase {decimal_phase} inserted after Phase {after_phase}: {description} (URGENT)
   ```

If "Roadmap Evolution" section doesn't exist, create it.
</step>

<step name="completion">
Present completion summary:

```
Phase {decimal_phase} inserted after Phase {after_phase}:
- Description: {description}
- Directory: .planning/phases/{decimal-phase}-{slug}/
- Status: Not planned yet
- Marker: (INSERTED) - indicates urgent work

Roadmap updated: .planning/ROADMAP.md
Project state updated: .planning/STATE.md

---

## Next Up

**Phase {decimal_phase}: {description}** -- urgent insertion

`/clear` then:

`/gsd-plan-phase {decimal_phase}`

---

**Also available:**
- Review insertion impact: Check if Phase {next_integer} dependencies still make sense
- Review roadmap

---
```
</step>

</process>

<anti_patterns>

- Don't use this for planned work at end of milestone (use /gsd-add-phase)
- Don't insert before Phase 1 (decimal 0.1 makes no sense)
- Don't renumber existing phases
- Don't modify the target phase content
- Don't create plans yet (that's /gsd-plan-phase)
- Don't commit changes (user decides when to commit)
</anti_patterns>

<success_criteria>
Phase insertion is complete when:

- [ ] `gsd-tools phase insert` executed successfully
- [ ] Phase directory created
- [ ] Roadmap updated with new phase entry (includes "(INSERTED)" marker)
- [ ] STATE.md updated with roadmap evolution note
- [ ] User informed of next steps and dependency implications
</success_criteria>


<context>
Arguments: $ARGUMENTS (format: <after-phase-number> <description>)

Roadmap and state are resolved in-workflow via `init phase-op` and targeted tool calls.
</context>

<process>
Execute the insert-phase workflow steps embedded above end-to-end.
Preserve all validation gates (argument parsing, phase verification, decimal calculation, roadmap updates).
</process>
