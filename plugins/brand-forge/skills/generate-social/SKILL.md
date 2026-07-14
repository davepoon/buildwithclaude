---
name: generate-social
description: Generate on-brand social-media templates (platform-sized SVGs with editable headline, subhead, and CTA zones) from the active brand profile. Use when the user asks for an Instagram post/story, an OG/social card, a YouTube thumbnail, or a banner.
---

# generate-social

Produce a platform-sized, on-brand SVG social template. Vector, zero-permission —
no keys, no network. Text lives in editable zones the user can tweak afterward.

## Inputs
- The active brand profile (via `lib/brand.mjs` → `resolveActive` + `loadProfile`).
- `headline` (required), optional `subhead` and `cta`, and a `platform`.

## Platforms
`instagram-square` (1080×1080), `instagram-story` (1080×1920), `og-card` (1200×630),
`youtube-thumb` (1280×720). Default: `instagram-square`. See
`references/platform-sizes.md`.

## Procedure
1. Resolve + load + validate the active profile. Stop with a clear message if
   validation fails.
2. Pick the platform (ask if the user didn't say; default to `instagram-square`).
3. Call the generator:

   ```js
   import { loadProfile } from '../../lib/brand.mjs';
   import { buildSocial } from '../../lib/social.mjs';
   const profile = loadProfile(activeDir);
   const { svg, platform } = buildSocial(profile, {
     platform: 'instagram-square',
     headline: 'We just raised our Series A',
     subhead: 'Building the future of…',
     cta: 'Read the story',
   });
   ```

4. Write to `output/<slug>-<platform>.svg`.
5. Hand the result to the `visual-guardian` subagent for a palette/contrast/type pass.
6. Report the saved path; describe the layout and point out the editable text zones
   (`id="headline"`, `id="subhead"`, `id="cta"`).

## Notes
- All text is HTML-escaped before entering the SVG; long headlines wrap automatically.
- Templates are vector, so they scale cleanly and never need the raster engine. For a
  photographic background behind the template, use `generate-graphic` (raster, opt-in).
