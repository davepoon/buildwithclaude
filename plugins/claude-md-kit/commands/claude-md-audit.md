---
description: Grade this repo's CLAUDE.md / AGENTS.md (0–100) and return a worst-first fix list
argument-hint: "[optional: path to the rules file if not at repo root]"
---

Audit this repository's agent rules file (`CLAUDE.md`, or `AGENTS.md` if that's what
exists; the user may pass an explicit path in arguments). If neither exists, say so and
suggest `/claude-md-new`, then stop.

Read the rules file AND spot-check it against reality: open the manifests/CI configs it
references (or should reference) and verify the commands it lists actually exist. A rules
file that lies is worse than none. Grading standards live in
`${CLAUDE_PLUGIN_ROOT}/FIELD-GUIDE.md` — read it before scoring.

## Rubric — score each, then sum (0–100)

1. **Commands (0–25).** Exact run / test / single-test / lint / build commands present
   and REAL (verified against package.json scripts, Makefile, CI, etc.). Deduct for
   missing single-test invocation, wrong or invented commands.
2. **Map of the repo (0–20).** Says where things live and where new code should go —
   specific paths, not descriptions. Deduct for anything an agent could only learn by
   asking.
3. **Non-obvious conventions (0–20).** The rules a new hire would have to be told:
   invariants, footguns, "we do X here, not Y", what NOT to touch. Deduct for generic
   advice ("write tests", "follow best practices") — each wish-list line is negative
   signal.
4. **Verification loop (0–15).** Tells the agent how to prove a change works (run tests
   and read output, curl the endpoint, screenshot) — not just typecheck.
5. **Terseness & altitude (0–10).** Imperative bullets, no prose padding, ~30–80 lines.
   Deduct for paragraphs of philosophy or duplicated README content.
6. **Freshness (0–10).** References match the current tree (paths exist, scripts still
   in package.json, stack versions not stale).

## Output format

- **Score: N/100** with the six sub-scores on one line each.
- **Worst-first fixes:** numbered list; each item = the problem, why it costs agent
  performance, and the concrete replacement text (write the actual lines, ready to
  paste).
- **Verified-command check:** table of every command in the file → found-in /
  not-found.
- Offer to apply the fixes directly if the user wants.
