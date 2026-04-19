---
name: ops-projects
description: "Portfolio dashboard for all GSD-tracked projects. Scans ~/Projects and ~/gsd-workspaces for .planning/ directories, shows phase status, git state, blockers, and next actions for every project. Run /ops projects to see the full portfolio."
argument-hint: "[project-alias|--sync|--refresh]"
allowed-tools:
  - Bash
  - Read
  - Grep
  - Glob
  - WebFetch
  - AskUserQuestion
effort: low
maxTurns: 20
disallowedTools:
  - Edit
  - Write
  - NotebookEdit
---

## Runtime Context

Before rendering, load:
1. **Preferences**: `cat ${OPS_DATA_DIR:-$HOME/.claude/plugins/data/ops-ops-marketplace}/preferences.json` — read `owner`, `timezone`
2. **Daemon health**: `cat ${OPS_DATA_DIR}/daemon-health.json` — show service status in dashboard footer
3. **GSD registry**: `cat ${OPS_DATA_DIR}/registry.json` — primary project index (updated by daemon twice daily + on-demand with --sync)


# OPS ► PROJECTS — GSD Portfolio Dashboard

## Quick commands

```bash
# Refresh registry data on demand
bash ${CLAUDE_PLUGIN_ROOT}/scripts/ops-gsd-registry-sync.sh

# Show registry contents
cat ${OPS_DATA_DIR}/registry.json

# Show health summary
cat ${OPS_DATA_DIR}/cache/projects_health.json
```

## Data flow

```
~/Projects/              ~/gsd-workspaces/
    │                          │
    ▼                          ▼
 [project]/.planning/    [project]/.planning/
    │                          │
    ├── HANDOFF.json           ├── HANDOFF.json     ← active-phase projects
    ├── STATE.md               ├── MILESTONES.md
    ├── ROADMAP.md             └── STATE.md
    └── MILESTONES.md
              │
              ▼  ops-gsd-registry-sync.sh (daemon: 6am + 6pm)
                    │
                    ▼
              ${OPS_DATA_DIR}/
                  ├── registry.json          ← all projects, sorted by priority
                  └── cache/
                        └── projects_health.json  ← health summary
                              │
                              ▼  ops-projects skill reads this
```

---

## Dashboard output

Build the dashboard from `${OPS_DATA_DIR}/cache/projects_health.json` (fall back to `${OPS_DATA_DIR}/registry.json` if missing). Show:

```
╔══════════════════════════════════════════════════════════════╗
║  OPS ► PROJECTS          [owner]    [date]    [daemon status] ║
╠══════════════════════════════════════════════════════════════╣
║  GSD Portfolio — 23 projects                                 ║
║                                                              ║
║  🟢 EXECUTING (3)                                           ║
║    my-webapp            Phase 12  [executing]   branch: main  0 dirty ║
║    my-plugin            Phase 16  [executing]   branch: main  2 dirty ║
║    my-saas-app          Phase 39  [executing]   branch: dev   0 dirty ║
║                                                              ║
║  🟡 PAUSED (4)                                              ║
║    my-project-a         Phase 08  [paused]      branch: feat  1 dirty ║
║    my-project-b         Phase 3   [verifying]   branch: main  0 dirty ║
║    ...                                                          ║
║                                                              ║
║  🔴 BLOCKED (1)                                             ║
║    my-ecommerce         Phase 7   [await-UAT]   branch: prod  0 dirty ║
║                                                              ║
║  ⚪ IDLE / UNTRACKED (15)                                    ║
║    my-side-project      Phase 1   [complete]    branch: main  0 dirty ║
║    my-other-app         —         —              branch: dev  3 dirty ║
║    ...                                                          ║
╠══════════════════════════════════════════════════════════════╣
║  ⚡ Services: message-listener ● | inbox-digest ⏱ 2h | gsd-registry ⏱ 12h ║
╚══════════════════════════════════════════════════════════════╝
```

### Status indicators (from `status` field, case-insensitive)
- **executing** → 🟢
- **paused / verifying / phase_complete** → 🟡
- **human / uat / blocked / pending** → 🔴
- **empty status + has phase** → ⚪ (idle)
- **no phase, no status** → ⚪ (untracked/no GSD)

### Columns per project: ALIAS | PHASE | STATUS | BRANCH | DIRTY | NEXT ACTION

---

## Project deep-dive

If `$ARGUMENTS` contains a project alias, find it in the registry and show:

```
╔══════════════════════════════════════════════════════════════╗
║  PROJECT — [alias]                                           ║
╠══════════════════════════════════════════════════════════════╣
║  Path:      ~/Projects/[alias]/                              ║
║  Phase:     [phase]  Status: [status]                       ║
║  Milestone: [milestone name]                                ║
║  Branch:    [branch]   Dirty: [N]  Unpushed: [N]            ║
║  Blockers:  [N]                                            ║
║  Next:      [next_action text]                              ║
║                                                              ║
║  GSD files: ✓ ROADMAP  ✓ MILESTONES  [HAS_HANDOFF] STATE   ║
╚══════════════════════════════════════════════════════════════╝

Actions:
  [1] Open project directory
  [2] Continue GSD (/gsd-next [alias])
  [3] Git: branch / status / log
  [4] Run /ops projects (back to portfolio)
```

Present numbered actions and let the user pick by typing the number or action name.

---

## --sync flag

If `--sync` or `--refresh` is passed, run the registry sync script first, then display the updated dashboard:

```bash
bash ${CLAUDE_PLUGIN_ROOT}/scripts/ops-gsd-registry-sync.sh 2>&1
```

Show "Refreshing..." while running, then present the full updated dashboard.

---

## Error states

- If `registry.json` is missing/empty: show a one-shot sync prompt
  ```
  No project registry found. Run /ops projects --sync to build it.
  ```
- If daemon health shows `action_needed`: surface that in a warning banner

---

## CLI reference (for manual use)

| Command | What it does |
|---------|-------------|
| `/ops projects` | Show full portfolio |
| `/ops projects [alias]` | Deep-dive on one project |
| `/ops projects --sync` | Force-refresh registry + show dashboard |
| `/ops:setup registry` | Open registry setup (future) |
