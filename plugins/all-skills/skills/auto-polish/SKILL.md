---
name: auto-polish
category: design
description: "Mandatory final phase for every new UI/frontend build (feature, page, component, redesign, full app) — runs automatically, without the user asking. Mini-addons (<~30 changed lines) only on demand via /auto-polish. Runs a dynamic multi-agent workflow with fixed amplification stages 5x → 10x → +3x and design judges in between, including a resource inventory (which installed skills/MCPs are still unused?), sign-off from every angle (desktop, mobile, code, video for animations) — local first, then live after shipping. Triggers (DE+EN): feature finished, polish phase, 'auto-polish', 'polish das', 'maximal geiler machen', 'showcase level', 'design steigern'."
---

# auto-polish — Factorial design amplification as a self-review end phase

Origin: a real production session (2026-07-24). The brief, verbatim in spirit: make it 5x better,
look at it, then 10x better in every conceivable way, look again, then calculate what one more
3x jump would take — and ALWAYS check which installed skills/MCPs are still unused.

## When (binding)

- **Automatically** as the LAST phase once a new UI feature, page/component, redesign or app is
  functionally complete and build-green — the user must NOT have to ask.
- **On demand** (`/auto-polish [area]`) for mini-addons (<~30 changed lines), bugfixes, copy tweaks.
- No skipping for cost reasons without asking — "always" was an explicit user decision.

### Invocation (`/auto-polish [area]`) — the argument is OPTIONAL

**Without an argument** the skill starts dynamically: target = the most recently built/changed
UI of the session (session context, else `git diff`/recent commits on UI files). No UI target
determinable → one short question instead of guessing.

**With an argument** it names an APP AREA in user language (e.g. `Leaderboard`, `Shift plan`,
`Task wizard`) — not a file path. Flow:
1. **Resolve:** area → target file(s) via grep (route/sidebar label/component name);
   ambiguous or >3 candidates → a read-only explore agent, NEVER guess.
2. Briefly state the resolved files + 1-line scope (only ask back if the match is ambiguous,
   otherwise start right away).
3. Launch the dynamic workflow with those files as the FILE parameter (schema below).

## Flow: Workflow tool with exactly 5 phases — each with its OWN focus (fixed, no open end)

`Workflow` with phases and role dramaturgy (goal: the sweet spot, not maximum decoration):

| Phase | Role | Focus |
|---|---|---|
| Stage 5x | **Maximalist** | Build substance: layers, light, proportion, motion foundation |
| Judge 1 | **Critic** | Hardest audit of ALL dimensions incl. **copy** (button labels! titles, microcopy: word choice, tone, length, seductiveness) + resource inventory + **second opinion from an external model (e.g. Codex CLI)** |
| Stage 10x | **Amplifier** | Judge feedback in full + copy fixes + further amplification in every conceivable way |
| Judge 2 | **Minimalist** | "What is TOO MUCH? Would removing it make it stronger?" — every ingredient must justify itself; kitsch/endless loops/redundant words go on the cut list; sweet-spot diagnosis |
| Stage +3x | **Sweet-spot finisher** | Final 3 amplifications AND all removals — end state: elegant restraint |

Executors/judges always with an explicit strong model (never inherit the orchestrator model blindly).

### External second opinion (cost-disciplined, no blind adding)

- **Judge 1 gets exactly ONE second opinion** from an external model (e.g. `codex` CLI via Bash):
  input = the target file(s) as code **+ the current stage screenshot as an image** (`codex -i <shot>.png`
  or your CLI's image attachment; no image support → describe the screenshot briefly in words)
  + the concrete question ("critique design + copy, what's missing, what's too much?") —
  never the whole repo, never multiple rounds. CLI missing/failing → skip and declare it.
- **A multi-model council only on a genuine stalemate** (judges fundamentally contradict each
  other) — otherwise no committee theater; cost efficiency wins.
- This file is meant to be fine-tuned continuously in use — keep changes lean, don't bolt on.

### Builder stages (5x / 10x / +3x)

- Work ONLY on the target files (+ a throwaway harness). Functionality/handlers/positioning
  untouched, no new dependencies, project-wide token files (e.g. a global index.css) untouched.
- **Done means done:** a stage only ends with build exit 0 — half stages are forbidden.
- Stage +3x implements Judge 2's feedback AND removes what was flagged as kitsch
  (premium = restraint in the right place; endless loops at rest are slop).

### Sign-off gates per stage (every angle, local first)

1. **Build:** project build (e.g. `npm run build`) exit 0 — proof in the agent output.
2. **Desktop render:** screenshot 1280×800 via harness (throwaway `verify-*.html` + dev server on
   a free port + `npx playwright screenshot`; install chromium on demand).
3. **Mobile render:** same harness at `--viewport-size=390,844`.
4. **Motion/video:** as soon as the stage contains animation: record a short interaction with
   Playwright `recordVideo` (.webm) and analyze it — preferably with a video-analysis MCP,
   fallback: a frame series (3–5 screenshots across the animation). Static screenshots alone
   prove NOTHING about motion.
5. **Code angle:** short review inside the judge: reduced-motion guard, no emojis,
   transform/opacity only, timer cleanup, a11y labels.

### Judge duties (both rounds)

- Score 1–10 + the most impactful CONCRETE amplifications (directly actionable, no platitudes).
- **Copy audit is a mandatory dimension:** button labels, titles, sublines — does every phrase
  land, does the CTA text seduce the click, is every word necessary? Copy findings count like
  design findings.
- **Resource inventory (MANDATORY, basis for calculating the next jump):** which installed
  design skills and connected MCPs are relevant for THIS target and NOT yet exhausted?
  For each unused resource: state concretely what it would contribute — derive the next
  amplification jump from that.
- Judge 2 additionally: "What has become excessive/kitsch and must be rolled back?"
- Judges evaluate screenshots/videos first (vision), code second.

## Wrap-up (main session, not the workflow)

1. The workflow NEVER commits/pushes — the main session inspects the final screenshots
   (+ video verdict) ITSELF, diff-reviews against the rules, then commits/ships per project doctrine.
2. **Live sign-off:** after deploying, open the live URL in a real browser and actually look at /
   interact with the polished area — passing locally ≠ done; the live proof belongs in the final answer.
3. Harness leftovers are deleted (git status clean), screenshots live in a scratch directory.
4. Declare open items (e.g. final iPhone/WebKit sign-off for mobile-critical projects).
