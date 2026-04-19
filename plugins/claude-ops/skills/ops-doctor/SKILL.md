---
name: ops-doctor
description: Health check and auto-repair for the ops plugin. Diagnoses manifest errors, broken permissions, invalid configs, stale caches, and missing files — then spawns an agent to fix everything automatically.
argument-hint: "[--check-only|--verbose]"
allowed-tools:
  - Bash
  - Read
  - Grep
  - Glob
  - Agent
  - AskUserQuestion
  - WebSearch
  - WebFetch
  - TeamCreate
  - SendMessage
effort: medium
maxTurns: 30
---

## Runtime Context

Before diagnosing, load:
1. **Preferences**: `cat ${CLAUDE_PLUGIN_DATA_DIR:-$HOME/.claude/plugins/data/ops-ops-marketplace}/preferences.json` — check all configured channels and services
2. **Daemon health**: `cat ${CLAUDE_PLUGIN_DATA_DIR}/daemon-health.json` — primary diagnostic input
3. **Secrets**: Verify secret resolution chain works: Doppler MCP → env → Doppler CLI → password manager


# OPS ► DOCTOR

## CLI/API Reference

### ops-doctor bin script

| Command | Usage | Output |
|---------|-------|--------|
| `${CLAUDE_PLUGIN_ROOT}/bin/ops-doctor` | Run full health diagnostics | JSON with `errors`, `warnings`, `tools`, `env_vars`, `registry` |
| `${CLAUDE_PLUGIN_ROOT}/bin/ops-doctor 2>/dev/null \|\| echo '{"errors":["diagnostic_script_failed"]}'` | Run with fallback | JSON or error sentinel |

### Key files read by diagnostics

| File | Purpose |
|------|---------|
| `${CLAUDE_PLUGIN_DATA_DIR}/daemon-health.json` | Primary daemon health input |
| `${CLAUDE_PLUGIN_DATA_DIR}/preferences.json` | Configured channels and services |
| `${CLAUDE_PLUGIN_ROOT}/.claude-plugin/plugin.json` | Plugin manifest validation |
| `${CLAUDE_PLUGIN_ROOT}/scripts/registry.json` | Project registry validation |

---

## Phase 1 — Run diagnostics

Run the diagnostic script to get a full health report:

```!
${CLAUDE_PLUGIN_ROOT}/bin/ops-doctor 2>/dev/null || echo '{"errors":["diagnostic_script_failed"],"warnings":[]}'
```

Parse the JSON output. Display a summary:

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 OPS ► DOCTOR — [timestamp]
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

 Plugin:     [version] at [plugin_root]
 Skills:     [count] defined
 Agents:     [count] defined
 Bin scripts:[count] available

 ERRORS      [count]
 [list each error with description]

 WARNINGS    [count]
 [list each warning with description]

 TOOLS
 [table of CLI tool availability]

 ENV VARS
 [table of env var status]

 Registry:   [status] ([project_count] projects)
 Preferences:[status]
 Cache:      [versions list]
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

## Agent Teams support

If `CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1` is set, use **Agent Teams** when multiple independent fix categories are identified (e.g., manifest issues + permission issues + registry issues). This enables:
- Fix agents work in parallel on different issue categories without stepping on each other
- You can prioritize: "fix manifest errors first, then permissions"
- Agents share context so a manifest fix can inform the registry repair

**Team setup** (only when flag is enabled, multiple issue categories):
```
TeamCreate("doctor-fixers")
Agent(team_name="doctor-fixers", name="fix-manifest", subagent_type="ops:doctor-agent", ...)
Agent(team_name="doctor-fixers", name="fix-permissions", subagent_type="ops:doctor-agent", ...)
Agent(team_name="doctor-fixers", name="fix-registry", subagent_type="ops:doctor-agent", ...)
```

If the flag is NOT set or only one issue category exists, use a single `doctor-agent` subagent.

## Phase 2 — Decision

If `$ARGUMENTS` contains `--check-only`: stop here, display results only.

If there are **errors or warnings**:

Display: "Found [N] issues. Spawning doctor agent to auto-fix..."

Then spawn the doctor agent (or Agent Team — see above):

```
Agent({
  subagent_type: "ops:doctor-agent",
  prompt: "Fix the following ops plugin issues.\n\nDIAGNOSTIC_JSON: [paste full JSON]\nPLUGIN_ROOT: ${CLAUDE_PLUGIN_ROOT}\nCACHE_DIR: ~/.claude/plugins/cache/ops-marketplace/ops\n\nFix all errors and warnings. Re-run diagnostics after to verify.",
  description: "Fix ops plugin issues"
})
```

If there are **no errors and no warnings**:

Display: "All checks passed. Plugin is healthy."

## Phase 3 — Post-fix verification

After the agent completes, re-run diagnostics:

```!
${CLAUDE_PLUGIN_ROOT}/bin/ops-doctor 2>/dev/null
```

Display updated results. If errors remain, report them to the user with manual fix instructions.

---

## Native tool usage

### WebSearch — known issue lookup

When diagnostics find errors, use `WebSearch` to check if the issue is a known Claude Code plugin bug, MCP server issue, or configuration problem. Include links to relevant GitHub issues or docs.

### WebFetch — MCP health check

For MCP servers that appear disconnected, use `WebFetch` to test their underlying APIs directly (e.g., `https://api.linear.app/graphql` with a simple query) to distinguish between "MCP broken" and "API down".
