---
name: gsd:verify-work
description: Validate built features through conversational UAT
argument-hint: "[phase number, e.g., '4']"
allowed-tools:
  - Read
  - Bash
  - Glob
  - Grep
  - Edit
  - Write
  - Task
---
<objective>
Validate built features through conversational testing with persistent state.

Purpose: Confirm what Claude built actually works from user's perspective. One test at a time, plain text responses, no interrogation. When issues are found, automatically diagnose, plan fixes, and prepare for execution.

Output: {phase_num}-UAT.md tracking all test results. If issues found: diagnosed gaps, verified fix plans ready for /gsd:execute-phase
</objective>

<execution_context>
@${CLAUDE_PLUGIN_ROOT}/workflows/verify-work.md
@${CLAUDE_PLUGIN_ROOT}/templates/UAT.md
</execution_context>

<context>
Phase: $ARGUMENTS (optional)
- If provided: Test specific phase (e.g., "4")
- If not provided: Check for active sessions or prompt for phase

Context files are resolved inside the workflow (`init verify-work`) and delegated via `<files_to_read>` blocks.
</context>

<process>
Execute the verify-work workflow from @${CLAUDE_PLUGIN_ROOT}/workflows/verify-work.md end-to-end.
Preserve all workflow gates (session management, test presentation, diagnosis, fix planning, routing).
</process>

<output_format>
When this workflow concludes (verification passed or routed to gap closure), emit a Next Up continuation block following the pattern in `references/continuation-format.md`:

- Show verification status (e.g., `## ✓ Verification Passed` or `## ⚠ Gaps Found — Routing to Plan` with details)
- Emit a `## ▶ Next Up` heading with the next likely command (`/gsd:complete-milestone` if all phases verified, `/gsd:plan-phase --gaps` if gaps found, `/gsd:next` if unsure)
- Use **`` `/clear` then: ``** before the command
- Include a parenthetical: *(`/clear` is safe — `/gsd:resume-work` restores position from `HANDOFF.json` if you change your mind)*
- Add an "Also available:" section with 1-3 alternatives where relevant

Verification accumulates lots of test/UAT prose that won't help downstream; phase-end is a clean boundary for `/clear`.
</output_format>
