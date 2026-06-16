---
description: Configure codex-hud statusline display options (guided interactive flow)
allowed-tools: Bash(node:*), AskUserQuestion, Read
---

# Configure Codex HUD

**FIRST**: Load current display configuration:

```bash
node "${CLAUDE_PLUGIN_ROOT}/dist/index.js" configure --get --json
```

Parse the JSON to determine current values. If `_configured` is `true`, use **Flow B (existing user)**. Otherwise use **Flow A (new user)**.

Defaults:
- `layout: "expanded"`, `showPlan: true`, `showFooter: true`, `showUsage: true`, `showWeekly: true`, `showModel: true`, `showContext: true`, `resetStyle: "both"`, `barWidth: 10`, `fallbackToWeek: true`, `language: "en"`

## Always On (not configurable)
- Codex header badge (`── Codex ──`)
- The data source (local Codex session logs at `~/.codex/sessions/`)
- Rate limit windows themselves (5h Usage, 7d Weekly)
- The red `⚠ LIMIT` alert when Codex reports a reached rate limit (it only appears while a limit is actually hit)

Advanced fields like `colors` are not yet exposed via this flow.

---

## Live previews (use these in the option `preview` fields)

`AskUserQuestion` options support a `preview` field that renders next to the choices. Use it so the user SEES the effect before picking. Generate previews from the real renderer (never hand-write them — they must match the code):

```bash
node "${CLAUDE_PLUGIN_ROOT}/dist/index.js" preview --set <key>=<value> [--set <key>=<value> ...]
```

- It renders representative **sample data** as plain text (no color codes), with the overrides applied **on top of the user's current saved config** — so toggles the user already has set are reflected.
- For the **Layout** question (single-select, so previews ARE supported): run it once per layout (`--set layout=expanded`, `=horizontal`, `=inline`, `=compact`) and put each result in that option's `preview`.
- `preview` is NOT supported on multiSelect questions, so the on/off toggle questions have no per-option preview — instead show a combined preview in the final confirmation step.
- Pass every override you're previewing together (e.g. when previewing layouts for an existing user who also turned off the plan badge, include `--set showPlan=false`) so the preview matches what saving would actually produce.

---

## Flow A: New User

Ask the questions below. `AskUserQuestion` allows at most 4 questions per call, so split into two rounds (e.g. Layout+Preset+Reset+Language, then Bar width) — or skip the ones the user clearly doesn't care about.

### Q1: Layout
- header: "Layout"
- question: "Choose your statusline layout:"
- multiSelect: false
- **FIRST** run `preview --set layout=expanded`, `=horizontal`, `=inline`, `=compact` and use each result as that option's `preview` field (see "Live previews" above).
- options (each WITH its generated `preview`):
  - "Expanded (Recommended)" — Each metric on its own line with progress bars
  - "Horizontal" — Header + all bars side-by-side on one metrics line + footer
  - "Inline" — Everything on ONE line WITH progress bars (claude-hud style)
  - "Compact" — Everything on one line, percentages only (no bars)

### Q2: Preset
- header: "Preset"
- question: "Choose a starting preset:"
- multiSelect: false
- Optionally attach a `preview` per preset: run `preview` with the preset's flags plus the layout chosen in Q1 (or `layout=expanded` if asking Q1+Q2 together), e.g. Bars only → `preview --set layout=expanded --set showPlan=false --set showFooter=false`.
- options:
  - "Full (Recommended)" — Plan badge + both bars + session footer
  - "Bars only" — Both Usage/Weekly bars, no plan badge or footer
  - "Usage only" — Only the 5h Usage bar
  - "Minimal" — Plan badge only (hides bars and footer)

### Q3: Reset time format (single-select → previews supported)
- header: "Reset time"
- question: "How should reset times show?"
- multiSelect: false
- Generate a `preview` per option: `preview --set resetStyle=both`, `=absolute`, `=relative` (plus the layout being used). Attach each.
- options (each WITH its preview):
  - "Both (Recommended)" — `resets 19:38 · 4h 37m` (absolute clock + time left, like Codex `/status`)
  - "Absolute" — `resets 19:38` / `resets 15:04 on 22 Jun` (clock only)
  - "Relative" — `resets in 4h 37m` (time left only)

### Q4: Language
- header: "Language"
- question: "Choose UI language for labels:"
- multiSelect: false
- options:
  - "English (Recommended)" — `Usage`, `Weekly`, `resets in ...`
  - "한국어" — `Usage`, `Weekly`, `리셋까지 ...`

### Q5: Bar width (optional)
- header: "Bar width"
- question: "Progress bar width (characters)?"
- multiSelect: false
- options:
  - "Default (10)"
  - "Short (6)"
  - "Wide (15)"

---

## Flow B: Existing User

Build questions based on current values. Show current value in the question text. Skip any question the user clearly doesn't need; `AskUserQuestion` allows 4 per call, so split into rounds if you ask more.

### Q1: Layout
- header: "Layout"
- question: "Layout (current: {currentLayout})?"
- multiSelect: false
- **FIRST** generate a `preview` for each option: for "Keep current" run `preview` with no `--set layout` (current layout), and for each "Switch to X" run `preview --set layout=X`. The user's other saved toggles are already reflected. Attach each as the option's `preview`.
- options (max 4 — show "Keep current" plus the three layouts the user is NOT on), each WITH its generated `preview`:
  - "Keep current"
  - "Switch to Expanded" (hide if already expanded)
  - "Switch to Horizontal" (hide if already horizontal)
  - "Switch to Inline" (hide if already inline)
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
  - "Model badge" — `showModel` → false
  - "Context bar" — `showContext` → false
  - "Fallback to week" — `fallbackToWeek` → false

If nothing is ON, say "Nothing to disable" and skip.

### Q3: Turn On
- header: "Turn On"
- question: "Enable any of these? (currently disabled)"
- multiSelect: true
- options: **only items currently OFF** from the same list.

If nothing is OFF, say "Nothing to enable — everything is already on" and skip.

### Q3b: Reset time format (optional, single-select → previews supported)
Ask only if the user wants to change how reset times show (current: {currentResetStyle}).
- header: "Reset time"
- question: "Reset time format (current: {currentResetStyle})?"
- multiSelect: false
- Generate a `preview` per option with the user's current layout: `preview --set resetStyle=both`, `=absolute`, `=relative`. Attach each.
- options (each WITH its preview): "Both" (`resets 19:38 · 4h 37m`, like Codex `/status`) / "Absolute" (`resets 19:38`) / "Relative" (`resets in 4h 37m`)

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

Layout always comes from Q1; presets only set the visibility flags below.

| Preset | showPlan | showFooter | showUsage | showWeekly |
|--------|----------|------------|-----------|------------|
| Full | true | true | true | true |
| Bars only | false | false | true | true |
| Usage only | false | false | true | false |
| Minimal | true | false | false | false |

---

## Key Mapping

| UI option | CLI key | Values |
|-----------|---------|--------|
| Layout | `layout` | `expanded` / `horizontal` / `inline` / `compact` |
| Plan badge | `showPlan` | `true` / `false` |
| Session footer | `showFooter` | `true` / `false` |
| Usage bar (5h) | `showUsage` | `true` / `false` |
| Weekly bar (7d) | `showWeekly` | `true` / `false` |
| Model badge | `showModel` | `true` / `false` |
| Context bar | `showContext` | `true` / `false` |
| Reset time format | `resetStyle` | `relative` / `absolute` / `both` |
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

**Show the final preview** — render it from the resolved settings so it exactly matches what will be saved (sample data, plain text; the user sees real colors after reload):

```bash
node "${CLAUDE_PLUGIN_ROOT}/dist/index.js" preview --set <key>=<value> [--set <key>=<value> ...]
```

Pass every key the user changed (layout + any toggles + language + barWidth). Show the output in a code block above the confirmation.

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

Say: "Configuration saved. The statusline picks it up at its next refresh (within ~60 seconds, or after the next assistant message) — no restart needed."
