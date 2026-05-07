---
name: gsd:mvp-phase
description: Plan an MVP-mode phase — captures an "As a / I want to / So that" user story, runs SPIDR splitting, then delegates to plan-phase
argument-hint: "<phase> [--force] [--text]"
agent: gsd-planner
allowed-tools:
  - Read
  - Write
  - Bash
  - Glob
  - Grep
  - Task
  - AskUserQuestion
  - WebFetch
  - mcp__context7__*
---
<objective>
Guide the user through MVP-mode planning for a phase. Prompts for an "As a / I want to / So that" user story, runs SPIDR splitting check on the story, writes the result to ROADMAP.md, and delegates to `/gsd:plan-phase` (which auto-detects MVP via the roadmap mode field).

**Orchestrator role:** Parse phase argument, validate phase, gather user story, run SPIDR check, persist mode + story to ROADMAP.md, then route to plan-phase.
</objective>

<execution_context>
@${CLAUDE_PLUGIN_ROOT}/workflows/mvp-phase.md
@${CLAUDE_PLUGIN_ROOT}/references/user-story-template.md
@${CLAUDE_PLUGIN_ROOT}/references/spidr-splitting.md
@${CLAUDE_PLUGIN_ROOT}/references/planner-mvp-mode.md
</execution_context>

<runtime_note>
**Copilot (VS Code):** Use `vscode_askquestions` wherever this workflow calls `AskUserQuestion`. They are equivalent — `vscode_askquestions` is the VS Code Copilot implementation of the same interactive question API.

**TEXT_MODE fallback:** Set TEXT_MODE=true if `--text` is present in `$ARGUMENTS` OR `text_mode` from init JSON is true. When TEXT_MODE is active, replace every AskUserQuestion call with a plain-text numbered list and ask the user to type their choice number.
</runtime_note>

<context>
Phase number: $ARGUMENTS (required — integer or decimal like `2.1`)

**Flags:**
- `--force` — Allow operating on `in_progress` / `completed` phases
- `--text` — Use plain-text numbered lists instead of TUI menus
</context>

<process>
Execute the mvp-phase workflow from @${CLAUDE_PLUGIN_ROOT}/workflows/mvp-phase.md end-to-end.
Preserve all workflow gates (phase validation, user-story prompt, SPIDR check, ROADMAP.md persistence, delegation to plan-phase).
</process>

<output_format>
When MVP planning concludes (user story written, ROADMAP.md updated, plan-phase delegated), emit a Next Up continuation block following the pattern in `references/continuation-format.md`:

- Show MVP-planning status (e.g., `## ✓ Phase N MVP-Planned — vertical slice captured`)
- Emit a `## ▶ Next Up` heading with `/gsd:execute-phase N` (TDD execution)
- Use **`` `/clear` then: ``** before the command
- Include a parenthetical: *(`/clear` is safe — `/gsd:resume-work` restores position from `HANDOFF.json` if you change your mind)*

MVP planning is a deliberate slice-of-the-cake exercise; clearing context before execution keeps TDD focused on the captured story rather than the planning conversation.
</output_format>
