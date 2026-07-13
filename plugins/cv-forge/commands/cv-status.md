---
name: cv-status
description: Print the active résumé/template summary plus section counts, on demand (the same checks the SessionStart hook runs, plus a résumé content summary).
---

# /cv-status

Show the current résumé state at any time — reuses the same emitters as the
SessionStart hook, so the output matches what loads at session start, then
adds a content summary the hook doesn't print.

## Steps

1. Set `CV_FORGE_ROOT` to the plugin root (`${CLAUDE_PLUGIN_ROOT}`), matching
   the hook's environment.
2. From the repo root, run each emitter and print its output:

   ```bash
   for f in "${CLAUDE_PLUGIN_ROOT}"/lib/context/*; do bash "$f"; done
   ```

   The emitters cover: the active résumé (name, headline, template — from
   `cv/.active`), a setup nudge when nothing is configured yet, and a PDF
   preflight warning (only when the opt-in `CV_FORGE_PDF` export path is
   enabled). No network.
3. **If `resume.json` exists**, read it directly (Claude reads JSON
   natively — no Node) and report section counts, e.g.:

   ```
   resume.json: basics ✓ (name, email, summary)
     work: 2 entries · education: 1 entry · skills: 4 entries
     projects: 1 entry · publications: 1 entry
   ```

   Only list sections that are present and non-empty; omit a section line
   entirely if it's missing or an empty array.
4. **If neither `cv/.active` nor `resume.json` exists**, the setup-nudge
   emitter already told the user to run `/cv-new` — don't repeat it, just
   confirm there's nothing to summarize yet.
