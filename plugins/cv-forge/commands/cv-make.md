---
name: cv-make
description: Render the active résumé through the active template into a self-contained HTML file, ready to open and Save as PDF.
---

# /cv-make

Turn `resume.json` into a finished, ATS-friendly résumé. No Node at any point
— a `sh` splice builds the HTML, and the browser (yours, via Save as PDF) does
the actual rendering.

## Steps

1. **Resolve the active résumé.** Read `resume.json` from the repo root. If
   it's missing, tell the user to run `/cv-new` and stop.

2. **Resolve the active template.** Read line 1 of `cv/.active` for the
   template slug (e.g. `classic-ats`). If `cv/.active` doesn't exist, default
   to `classic-ats` and mention that `/cv-new` normally sets this. Confirm the
   template exists at `"${CLAUDE_PLUGIN_ROOT}/templates/<slug>/template.html"`
   — if not, list the available slugs under `templates/*/` and stop.

3. **Validate `resume.json` against the schema.** Read
   `${CLAUDE_PLUGIN_ROOT}/schema/json-resume.schema.json` and check the file the same way `/cv-new`
   does: `basics` and `basics.name` are required; `basics.email` (if present)
   must look like an email; every `work[]` needs `name` + `position`; every
   `education[]` needs `institution`; every `skills[]` needs `name`. **Stop
   and report the exact bad field** (e.g. `education[0].institution is
   required`) rather than rendering a broken résumé — don't guess or silently
   drop the offending entry.

4. **Splice the render.** Run the literal splice script — pure `sh` + `awk`,
   no Node, no network:

   ```bash
   mkdir -p output
   slug="<kebab-case-of-basics.name>"   # Claude computes this, e.g. "Alex Rivera" -> "alex-rivera"
   sh "${CLAUDE_PLUGIN_ROOT}/lib/render.sh" \
     "${CLAUDE_PLUGIN_ROOT}/templates/<slug-of-template>/template.html" \
     "${CLAUDE_PLUGIN_ROOT}/templates/_shared/render-core.js" \
     resume.json > "output/resume-${slug}.html"
   ```

   This inlines the shared renderer and the résumé JSON straight into the
   template's two markers (`/*__RENDER_CORE__*/`, `/*__RESUME_DATA__*/`),
   producing one **self-contained** HTML file — no external `<script src>` or
   `<link>`, so it opens correctly from disk with no server. If `sh` isn't
   available for some reason, splice the same three pieces with your file
   tools instead: read the template, replace each marker line with the full
   contents of the corresponding file, and write the result — same output,
   same no-Node guarantee.

5. **Report the saved path** (`output/resume-<slug>.html`) and tell the user
   exactly what to do next:
   - Open the file in a browser (double-click it, or `open
     output/resume-<slug>.html` on macOS).
   - Use the browser's **Print → Save as PDF** (or `Cmd/Ctrl+P` → destination
     "Save as PDF"). The page's `@page`/print CSS is already tuned for
     US Letter with safe margins and no forced page breaks inside an entry.

6. **Why this is ATS-safe.** The rendered HTML is real, selectable text (no
   images, no canvas) laid out with plain CSS — the PDF a browser produces
   from it keeps that as a real text layer, so applicant tracking systems can
   parse it the same way a human reader can. There's nothing in this pipeline
   that rasterizes text into pixels.

If the user wants a different template, point them at `/cv-use` and re-run
`/cv-make` afterward.
