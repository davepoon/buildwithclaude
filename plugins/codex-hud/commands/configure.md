---
description: Configure codex-hud statusline display options (guided interactive flow)
allowed-tools: Bash(node:*), AskUserQuestion, Read
---

# Configure Codex HUD

**FIRST**: Load current display configuration:

```bash
node "${CLAUDE_PLUGIN_ROOT}/dist/index.js" configure --get --json
```

Parse the JSON to determine current values. If the output has `display` set or differs from defaults, use **Flow B (existing user)**. Otherwise use **Flow A (new user)**.

Defaults:
- `layout: "expanded"`, `showPlan: true`, `showFooter: true`, `showUsage: true`, `showWeekly: true`, `barWidth: 10`, `fallbackToWeek: true`, `language: "en"`

## Always On (not configurable)
- Codex header badge (`── Codex ──`)
- The data source (local Codex session logs at `~/.codex/sessions/`)
- Rate limit window windows themselves (5h Usage, 7d Weekly)

Advanced fields like `colors` are not yet exposed via this flow.

---

## Flow A: New User (4 Questions)

### Q1: Layout
- header: "Layout"
- question: "Choose your statusline layout:"
- multiSelect: false
- options:
  - "Expanded (Recommended)" — Each metric on its own line with progress bars
  - "Horizontal" — Usage and Weekly side-by-side on one line (saves vertical space)
  - "Compact" — Everything on a single line with `│` separators

### Q2: Preset
- header: "Preset"
- question: "Choose a starting preset:"
- multiSelect: false
- options:
  - "Full (Recommended)" — Plan badge + both bars + session footer
  - "Bars only" — Both Usage/Weekly bars, no plan badge or footer
  - "Usage only" — Only the 5h Usage bar
  - "Minimal" — Plan badge only (hides bars and footer)

### Q3: Language
- header: "Language"
- question: "Choose UI language for labels:"
- multiSelect: false
- options:
  - "English (Recommended)" — `Usage`, `Weekly`, `resets in ...`
  - "한국어" — `Usage`, `Weekly`, `리셋까지 ...`

### Q4: Bar width (optional)
- header: "Bar width"
- question: "Progress bar width (characters)?"
- multiSelect: false
- options:
  - "Default (10)"
  - "Short (6)"
  - "Wide (15)"

---

## Flow B: Existing User (4 Questions)

Build questions based on current values. Show current value in the question text.

### Q1: Layout
- header: "Layout"
- question: "Layout (current: {currentLayout})?"
- multiSelect: false
- options:
  - "Keep current"
  - "Switch to Expanded" (hide if already expanded)
  - "Switch to Horizontal" (hide if already horizontal)
  - "Switch to Compact" (hide if already compact)

### Q2: Turn Off
- header: "Turn Off"
- question: "Disable any of these? (currently enabled)"
- multiSelect: true
- options: **only items currently ON** from:
  - "Plan badge" — `showPlan` → false
  - "Session footer" — `showFooter` → false
  - "Usage bar (5h)" — `showUsage` → false
  - "Weekly bar (7d)" — `showWeekly` → false
  - "Fallback to week" — `fallbackToWeek` → false

If nothing is ON, say "Nothing to disable" and skip.

### Q3: Turn On
- header: "Turn On"
- question: "Enable any of these? (currently disabled)"
- multiSelect: true
- options: **only items currently OFF** from the same list.

If nothing is OFF, say "Nothing to enable — everything is already on" and skip.

### Q4: Language / Reset
- header: "Language/Reset"
- question: "Language or reset to defaults? (current language: {currentLanguage})"
- multiSelect: false
- options:
  - "Keep current"
  - "Switch to English" (hide if already en)
  - "Switch to 한국어" (hide if already ko)
  - "Reset to defaults"

---

## Preset Definitions

| Preset | layout | showPlan | showFooter | showUsage | showWeekly |
|--------|--------|----------|------------|-----------|------------|
| Full | expanded | true | true | true | true |
| Bars only | expanded | false | false | true | true |
| Usage only | expanded | false | false | true | false |
| Minimal | compact | true | false | false | false |

---

## Key Mapping

| UI option | CLI key | Values |
|-----------|---------|--------|
| Layout | `layout` | `expanded` / `horizontal` / `compact` |
| Plan badge | `showPlan` | `true` / `false` |
| Session footer | `showFooter` | `true` / `false` |
| Usage bar (5h) | `showUsage` | `true` / `false` |
| Weekly bar (7d) | `showWeekly` | `true` / `false` |
| Fallback to week | `fallbackToWeek` | `true` / `false` |
| Bar width | `barWidth` | `1–40` |
| Language | `language` | `en` / `ko` |

---

## Before Writing — Validate & Preview

**Guards — do NOT write if:**
- User cancels (Esc) → say "Configuration cancelled."
- No changes vs current → say "No changes — config unchanged."

**Show a summary of changes first:**

```
layout     : expanded → compact
showPlan   : true     → false
showUsage  : true     → (unchanged)
language   : en       → ko
```

**Show a mock preview** (use plain text; the user will see real ANSI after reload):

Expanded:
```
── Codex team ──
Usage   ██░░░░░░░░ 15% (resets in 4h 37m)
Weekly  █░░░░░░░░░ 3%  (resets in 6d 9h)
15 sessions | team
```

Horizontal:
```
── Codex team ──
Usage ██░░░░░░░░ 15% (4h 37m)  │  Weekly █░░░░░░░░░ 3% (6d 9h)
15 sessions | team
```

Compact:
```
Codex team │ Usage 15% (4h 37m) │ Weekly 3% (6d 9h) │ 15s
```

Ask confirmation with `AskUserQuestion`:
- header: "Confirm"
- question: "Save these changes?"
- options: `"Save"`, `"Cancel"`

---

## Write Configuration

For each changed key, run:

```bash
node "${CLAUDE_PLUGIN_ROOT}/dist/index.js" configure --set <key>=<value>
```

(batch multiple `--set` calls sequentially; each is idempotent)

For reset to defaults:

```bash
node "${CLAUDE_PLUGIN_ROOT}/dist/index.js" configure --reset
```

---

## After Writing

Say: "Configuration saved. Run `/reload-plugins` or restart Claude Code to apply."
