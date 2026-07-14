---
name: generate-resume
description: Render a JSON Resume file through an HTML template into a self-contained, ATS-friendly document ready for the browser's Save-as-PDF. Use when the user asks to render, build, generate, or export their résumé/CV.
---

# generate-resume

Turn `resume.json` into a finished résumé file. Pure `sh` + `awk` splice, zero
Node, zero network — the browser does the actual rendering when the user
prints to PDF. This is the mechanism `/cv-make` drives; use it directly if
you're asked to render outside that command's flow (e.g. from `/cv-tailor` in
a later plan).

## Inputs
- The active résumé: `resume.json` at the repo root, valid against
  `${CLAUDE_PLUGIN_ROOT}/schema/json-resume.schema.json` (see the validation checklist in
  `commands/cv-new.md` — `basics.name` required, etc.). Stop and report the
  bad field rather than rendering invalid data.
- The active template slug: line 1 of `cv/.active` (default `classic-ats` if
  unset). Its `template.html` lives at
  `"${CLAUDE_PLUGIN_ROOT}/templates/<slug>/template.html"`.
- The shared renderer: `"${CLAUDE_PLUGIN_ROOT}/templates/_shared/render-core.js"`
  — one `renderResume(resume) -> htmlString` function plus its helpers
  (`escapeHtml`, `formatDate`, `dateRange`, per-section renderers). Every
  template reuses this same file; a template only supplies its own CSS shell.

## Procedure
1. Resolve and validate the inputs above.
2. **Splice** the three pieces into one file with the literal splice script:

   ```bash
   mkdir -p output
   sh "${CLAUDE_PLUGIN_ROOT}/lib/render.sh" \
     "${CLAUDE_PLUGIN_ROOT}/templates/<slug>/template.html" \
     "${CLAUDE_PLUGIN_ROOT}/templates/_shared/render-core.js" \
     resume.json > "output/resume-<slug-of-name>.html"
   ```

   See `references/render-pipeline.md` for exactly how the splice works, the
   two markers it fills, and why the result must stay self-contained.
3. Write the result to `output/resume-<slug-of-name>.html` (kebab-case the
   person's name, e.g. "Alex Rivera" → `alex-rivera`).
4. Report the saved path and hand the user the render contract: **open the
   file in a browser, then Print → Save as PDF.** The browser is the renderer;
   this skill only assembles the HTML it renders.

## Notes
- Never write partial output. If the splice or a downstream step fails, don't
  leave a half-written file in `output/`.
- The output file must open correctly directly from disk (`file://`) with no
  server and no additional requests — that's what "self-contained" means here.
- This skill never produces a PDF itself. PDF generation via a headless
  browser/OS tool is optional and out of scope for Plan 1 (see Plan 5 in the
  project plan); the guaranteed, zero-dependency path is always the user's own
  browser doing Save as PDF.
