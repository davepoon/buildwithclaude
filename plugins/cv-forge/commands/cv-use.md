---
name: cv-use
description: List the available résumé templates and switch which one renders the active résumé.
argument-hint: [template slug to activate, e.g. classic-ats]
---

# /cv-use

Switch the active template for the current résumé.

## Steps

1. **List templates.** Enumerate the directories under
   `"${CLAUDE_PLUGIN_ROOT}/templates/"`, excluding `_shared` (that one holds
   the renderer, not a template — `render-core.js`). Each remaining directory
   name is a template slug; each must contain a `template.html`. In Plan 1
   that's just `classic-ats` — the fuller gallery (`modern`, `minimal`,
   `academic`) and a rendered preview (`output/gallery.html`) arrive in
   Plan 2. Show the current active slug (line 1 of `cv/.active`, if present).

2. **If a slug was given**, verify it matches one of the listed template
   directories. If not, list the valid slugs and stop without changing
   anything.

3. **If no `cv/.active` exists yet**, tell the user to run `/cv-new` first
   (it creates the résumé and sets the initial template) and stop.

4. **Set active.** Rewrite only **line 1** of `cv/.active` to the new slug,
   preserving lines 2 (display name) and 3 (headline) exactly as they were.

5. **Re-render.** Run `/cv-make` so the output file reflects the newly
   selected template.

Note: this switches the template for the one active résumé. Managing several
résumés side by side (`resumes/<slug>/`) is Plan 2, not built here.
