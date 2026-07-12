---
name: generate-logo
description: Generate on-brand SVG logo variants (wordmark, monogram, favicon) from the active brand profile. Use when the user asks for a logo, wordmark, icon/monogram, or favicon.
---

# generate-logo

Produce scalable, editable SVG logo assets that use the brand's exact palette and
heading font. Vector, zero-permission — no keys, no network.

## Inputs
- The active brand profile (via `lib/brand.mjs` → `resolveActive` + `loadProfile`).
- The logo text (defaults to the brand `name`; ask if ambiguous).

## Procedure
1. Resolve + load + validate the active profile. Stop with a clear message if
   validation fails (e.g. a non-hex color).
2. Call the generator:

   ```js
   import { loadProfile } from '../../lib/brand.mjs';
   import { buildLogos } from '../../lib/logo.mjs';
   const profile = loadProfile(activeDir);
   const { wordmark, monogram, favicon } = buildLogos(profile, { text: 'Northwind' });
   ```

3. Write each variant to `output/`:
   - `output/<slug>-wordmark.svg`
   - `output/<slug>-monogram.svg`
   - `output/<slug>-favicon.svg`
4. Hand the results to the `visual-guardian` subagent for a palette/contrast/
   clear-space pass; apply fixes or surface flags.
5. Report the saved paths and describe each variant. If the user needs raster copies,
   point them to `/brand-export` (optional `sharp`, or an OS tool).

## References
See `references/logo-construction.md` for geometry, clear-space, and variant guidance.

## Notes
- Text is HTML-escaped before it enters the SVG.
- Logos are intentionally vector: they scale cleanly and never need the raster engine.
