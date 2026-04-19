---
name: ops-speedup
description: Cross-platform, hardware-adaptive system optimizer. Auto-detects macOS / Linux / WSL / Windows (MINGW/Cygwin/MSYS2) and CPU/RAM/disk/GPU profile, then picks the right cleanup strategy. Scans reclaimable disk space, memory pressure, runaway processes, startup bloat, network issues. CleanMyMac built into Claude Code.
argument-hint: "[scan|clean|deep|auto]"
allowed-tools:
  - Bash
  - Read
  - Grep
  - Glob
  - AskUserQuestion
effort: low
maxTurns: 30
---

## Runtime Context

Before scanning, load:
1. **Preferences**: `cat ${CLAUDE_PLUGIN_DATA_DIR:-$HOME/.claude/plugins/data/ops-ops-marketplace}/preferences.json` — read `timezone` for timestamps

# OPS > SPEEDUP — System Optimizer

## Architecture

The `bin/ops-speedup` binary is the single source of truth for probes AND actions. This skill's job is to:
1. Call the binary with the right flags based on user intent
2. Parse the JSON
3. Present a health score + cleanup report
4. Confirm destructive actions per plugin Rule 5
5. Invoke the binary's clean/deep/aggressive modes to execute

## CLI Reference — `bin/ops-speedup`

| Command | Purpose | Side effects |
|---------|---------|--------------|
| `ops-speedup` | Visual banner + hardware summary | None |
| `ops-speedup --json` | Quick JSON diagnostics (disk/mem/net only) | None |
| `ops-speedup --scan` | Full parallel probe: disk + mem + CPU hogs + power hogs + GPU/ANE + startup | None |
| `ops-speedup --clean` | Safe cleanup: caches, tmp, logs, demote daemons, DNS flush, kernel tune | Non-destructive |
| `ops-speedup --deep` | `--clean` + Trash, DerivedData, simulators, animation cuts, launch-agent kill | Removes files |
| `ops-speedup --aggressive` | `--deep` + unload launch agents, docker `--volumes`, stale `node_modules` (>14d), TCP BBR | Potentially breaking — confirm first |

All modes:
- Auto-detect OS (macOS / Linux / WSL / Windows) and dispatch OS-specific ops
- Idempotent — skip DerivedData/Metro/journal if last run was <1h ago
- Write telemetry to `~/.ops-speedup/history.jsonl`
- Only raise kernel tuning parameters, never lower
- Protected processes list blocks killing of shells, IDEs, daemons

## OS-specific capabilities

| Capability | macOS | Linux | WSL | Windows |
|------------|-------|-------|-----|---------|
| Disk reclaimable scan | ✓ | ✓ | ✓ | limited |
| Memory + swap | ✓ | ✓ | ✓ | limited |
| CPU hog kill | ✓ | ✓ | ✓ | — |
| Power/Energy Impact | ✓ (`top -stats power`) | ✓ (`powertop`) | — | — |
| GPU/Neural Engine | ✓ (`powermetrics`) | ✓ (`nvidia-smi`) | — | — |
| Launch agent offenders | ✓ | — | — | — |
| systemd unit masking | — | ✓ | ✓ | — |
| E-core demotion | ✓ (`taskpolicy -b`) | ✓ (`renice`+`ionice`) | ✓ | — |
| UI animation cuts | ✓ | — | — | — |
| Kernel tune (vnodes/somaxconn) | ✓ | ✓ | ✓ | — |
| TCP BBR | — | ✓ (aggressive) | ✓ (aggressive) | — |
| DNS flush | ✓ (dscacheutil) | ✓ (resolved) | ✓ (via Windows) | — |
| Memory purge | ✓ (`purge`) | ✓ (drop_caches) | ✓ | — |
| Stale build dir prune (>14d) | ✓ | ✓ | ✓ | — |

## Phase 1 — Visual header

```!
${CLAUDE_PLUGIN_ROOT}/bin/ops-speedup 2>/dev/null || echo "SCAN_FAILED"
```

## Phase 2 — Full diagnostic scan (parallel, all probes)

```!
${CLAUDE_PLUGIN_ROOT}/bin/ops-speedup --scan 2>/dev/null || echo '{}'
```

The binary already runs all probes in parallel. Do NOT add additional serial probe calls from this skill — they will duplicate work that's already in the JSON output.

## Phase 3 — Health score + cleanup report

Parse the JSON and render:

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 OPS > SYSTEM SPEEDUP — [os] [os_version] [chip]
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

 HEALTH SCORE: [0-100] / 100  [████████░░ 80%]

 DISK                                    RECLAIMABLE
 ────────────────────────────────────────────────────
 brew cache          [N] MB              ✓ safe
 npm cache           [N] MB              ✓ safe
 pnpm cache          [N] MB              ✓ safe
 Xcode DerivedData   [N] MB              ✓ safe
 Xcode DeviceSupport [N] MB              ✓ safe
 Docker reclaimable  [N] MB              ✓ safe
 Metal shader cache  [N] MB              ✓ safe
 Trash               [N] MB              ✓ safe
 Logs                [N] MB              ✓ safe
 Downloads           [N] MB              ⚠ review
 Caches (general)    [N] MB              ⚠ review
 /tmp                [N] MB              ✓ safe
 apt/journal         [N] MB              ✓ safe (linux)
 ────────────────────────────────────────────────────
 TOTAL RECLAIMABLE:  [N] GB

 MEMORY
 ────────────────────────────────────────────────────
 Pressure:    [N]% free    Swap: [N] MB    Free: [N] MB

 NETWORK
 ────────────────────────────────────────────────────
 Interface:   [iface]      DNS: [N]ms

 STARTUP
 ────────────────────────────────────────────────────
 Login items:   [N]              (macOS)
 Launch agents: [N]              (macOS)
 Failed units:  [N]              (Linux)
 Enabled units: [N]              (Linux)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

**Health score calculation:**
- Start at 100
- Disk > 90% used: -20
- Disk > 80% used: -10
- RAM pressure < 20% free: -15
- RAM pressure < 40% free: -5
- Swap > 1GB: -10
- DNS > 100ms: -5
- > 10 launch agents (macOS) or > 3 failed systemd units (Linux): -5
- > 5GB reclaimable: -10
- > 10GB reclaimable: -20

## Phase 4 — Present cleanup choice (max 4 options per AskUserQuestion)

AskUserQuestion call 1 — Cleanup scope:
```
  [Quick — caches, tmp, logs, DNS flush (~[N] GB)]
  [Deep — + Trash, DerivedData, simulators, animation cuts (~[N] GB)]
  [Aggressive — + launch-agent unload, stale node_modules, docker volumes (~[N] GB)]
  [More options...]
```

AskUserQuestion call 2 (only if "More options..."):
```
  [Custom — pick categories]
  [Memory — kill top RAM hogs]
  [Startup / Network / Skip...]
```

AskUserQuestion call 3 (only if "Startup / Network / Skip..."):
```
  [Startup — review & disable launch agents / systemd units]
  [Network — flush DNS, tune TCP, BBR (aggressive)]
  [Skip — just show the report]
```

## Phase 5 — Confirm destructive actions per Rule 5

Per plugin Rule 5, destructive actions require explicit per-action confirmation. Before running `--aggressive`:

```
About to run AGGRESSIVE cleanup. Each item is destructive:

  • Unload launch agents: [list]
  • Docker volume prune (may delete unmounted volumes): [N] MB
  • Stale node_modules (>14 days): [list of paths]
  • TCP congestion control → BBR (Linux only)

  [Proceed with all]  [Pick categories]  [Cancel]
```

If "Pick categories", batch per Rule 1 (max 4 options per `AskUserQuestion`).

## Phase 6 — Execute

Invoke the binary directly — it handles OS detection and dispatch:

```bash
# Quick clean
${CLAUDE_PLUGIN_ROOT}/bin/ops-speedup --clean

# Deep clean
${CLAUDE_PLUGIN_ROOT}/bin/ops-speedup --deep

# Aggressive (after confirmation)
${CLAUDE_PLUGIN_ROOT}/bin/ops-speedup --aggressive
```

**Memory hog killing (option 5 from Phase 4):**

Top processes are already in the scan JSON (`cpu_hogs` / `power_hogs`). Present them in paginated `AskUserQuestion` calls (max 3 processes + `[More...]` per page, final page has `[Kill selected]` + `[Skip]`).

**NEVER kill**: kernel_task, launchd, WindowServer, loginwindow, Finder, Dock, systemd, init, shells (bash/zsh/fish), tmux, IDE processes (Cursor/Comet/Code), Claude, node, python, Xcode. The binary's PROTECTED_RE regex blocks these automatically.

## Phase 7 — Results

After cleanup, re-scan and diff:

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 OPS > CLEANUP COMPLETE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 Reclaimed:  [N] GB
 Disk free:  [before] GB → [after] GB
 RAM free:   [before] MB → [after] MB
 Swap:       [before] MB → [after] MB
 Health:     [before]/100 → [after]/100
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

History: ~/.ops-speedup/history.jsonl
```

If user came from `/ops:dash`, offer `b) Back to dashboard`.

## Mode shortcuts

If `$ARGUMENTS` is:
- `scan` or empty — Phase 1-3 only (report, no cleanup)
- `clean` — run `ops-speedup --clean` automatically (safe)
- `deep` — run `ops-speedup --deep` automatically (after 1 confirmation)
- `auto` — run `ops-speedup --clean` automatically, print results
- `aggressive` — run `ops-speedup --aggressive` after per-item confirmations

## Trend analysis

`~/.ops-speedup/history.jsonl` is append-only. For trend questions ("is my disk filling up?", "is swap growing over time?"), read + graph:

```bash
tail -30 ~/.ops-speedup/history.jsonl | jq -r '[.ts, .ram_free_mb, .swap_mb, .disk_pct] | @tsv'
```
