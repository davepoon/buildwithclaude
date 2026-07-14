---
name: generate-doc-template
description: Generate on-brand document and deck templates (letterhead, slide, one-pager) as SVG from the active brand profile, with editable title/subtitle/body zones. Use when the user asks for a letterhead, a slide/deck master, or a branded one-pager.
---

# generate-doc-template

Produce a branded, print- or screen-ready document template as SVG. Vector,
zero-permission — no keys, no network. Content lives in editable zones.

## Inputs
- The active brand profile (via `lib/brand.mjs` → `resolveActive` + `loadProfile`).
- `title` (usually required), optional `subtitle` and `body`, and a `kind`.

## Kinds
`letterhead` (816×1056, US-Letter portrait), `slide` (1280×720, 16:9), `one-pager`
(816×1056). Default: `letterhead`. See `references/layout-grids.md`.

## Procedure
1. Resolve + load + validate the active profile. Stop with a clear message if
   validation fails.
2. Pick the kind (ask if unclear; default `letterhead`).
3. Call the generator:

   ```js
   import { loadProfile } from '../../lib/brand.mjs';
   import { buildDoc } from '../../lib/doctpl.mjs';
   const profile = loadProfile(activeDir);
   const { svg, kind } = buildDoc(profile, {
     kind: 'letterhead',
     title: 'Offer of Employment',
     body: 'Dear candidate, we are delighted to…',
   });
   ```

4. Write to `output/<slug>-<kind>.svg`.
5. Hand the result to the `visual-guardian` subagent for a palette/contrast/type pass.
6. Report the saved path; point out the editable zones (`id="title"`,
   `id="subtitle"`, `id="body"`). A letterhead with no `body` ships with placeholder
   content rules the user can replace.

## Notes
- All text is HTML-escaped; long titles and body copy wrap automatically.
- Vector output scales cleanly and is print-safe; convert to PDF/PNG downstream
  (PNG export is Plan 5, optional `sharp`).
