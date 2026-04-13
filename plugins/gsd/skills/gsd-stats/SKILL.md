---
name: gsd-stats
description: "Display project statistics — phases, plans, requirements, git metrics, and timeline"
allowed-tools:
  - Read
  - Bash
---


<objective>
Display comprehensive project statistics including phase progress, plan execution metrics, requirements completion, git history stats, and project timeline.
</objective>

<!-- Workflow content (was: stats.md) -->
<purpose>
Display comprehensive project statistics including phases, plans, requirements, git metrics, and timeline.
</purpose>

<required_reading>
Read the skill content below before starting.
</required_reading>

<process>

<step name="gather_stats">
Gather project statistics:

```bash
STATS=$(node "$GSD_TOOLS" stats json)
if [[ "$STATS" == @file:* ]]; then STATS=$(cat "${STATS#@file:}"); fi
```

Extract fields from JSON: `milestone_version`, `milestone_name`, `phases`, `phases_completed`, `phases_total`, `total_plans`, `total_summaries`, `percent`, `plan_percent`, `requirements_total`, `requirements_complete`, `git_commits`, `git_first_commit_date`, `last_activity`.
</step>

<step name="present_stats">
Present to the user with this format:

```
# 📊 Project Statistics — {milestone_version} {milestone_name}

## Progress
[████████░░] X/Y phases (Z%)

## Plans
X/Y plans complete (Z%)

## Phases
| Phase | Name | Plans | Completed | Status |
|-------|------|-------|-----------|--------|
| ...   | ...  | ...   | ...       | ...    |

## Requirements
✅ X/Y requirements complete

## Git
- **Commits:** N
- **Started:** YYYY-MM-DD
- **Last activity:** YYYY-MM-DD

## Timeline
- **Project age:** N days
```

If no `.planning/` directory exists, inform the user to run `/gsd-new-project` first.
</step>

</process>

<success_criteria>
- [ ] Statistics gathered from project state
- [ ] Results formatted clearly
- [ ] Displayed to user
</success_criteria>


<process>
Execute the stats workflow steps embedded above end-to-end.
</process>
