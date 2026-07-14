---
name: generate-graphic
description: Generate an on-brand marketing graphic (hero image, ad creative, background, texture) using an AI image model, optionally stamped with the brand logo and a caption. Opt-in — this is the one feature that needs an API key and network. Use for photographic/illustrative graphics, not text-heavy assets.
---

# generate-graphic

The **opt-in raster engine** — the only part of brand-forge that reaches the
network. Off by default. Everything else (logos, social, docs) stays
zero-permission; only use this when the user wants a photographic/illustrative graphic.

## Enabling (preflight)
Raster requires **both**:
- `BRAND_FORGE_RASTER=1` (explicit opt-in), and
- a provider key: `GEMINI_API_KEY` (default) or `OPENAI_API_KEY`.

If either is missing, stop and tell the user how to enable it — and offer the
vector path (`generate-social` / a template) instead, which needs neither. The
`30-preflight` context emitter surfaces this at session start.

## Procedure
1. Resolve + load + validate the active profile.
2. **Build the prompt** (no network) with `lib/raster.mjs`:

   ```js
   import { loadProfile } from '../../lib/brand.mjs';
   import { buildRasterPrompt } from '../../lib/raster.mjs';
   const profile = loadProfile(activeDir);
   const prompt = buildRasterPrompt(profile, { subject: 'a mountain trail at dawn' });
   ```

   The prompt describes the palette in words, the imagery style, and the tone, and
   turns the brand's don't-rules into an "Avoid:" clause. Warn if the user asked for
   literal text in the image — route text-heavy work to the vector engine instead.
3. **Generate** with `lib/genimage.mjs` (the network call):

   ```js
   import { generateImage } from '../../lib/genimage.mjs';
   await generateImage({ prompt, outPath: 'output/northwind-hero.png', provider: 'gemini' });
   ```

   Provider is swappable (`gemini` → `openai`); the key is read from the env var and
   sent in a header, never the URL. Failures retry with backoff and never leave a
   half-written file.
4. **Optionally composite** the brand logo + caption over the raster with
   `lib/composite.mjs` → an SVG overlay referencing the PNG (`imageHref`). No raster
   library needed.
5. Hand the result to the `visual-guardian` for a palette/legibility pass.
6. Report the saved path(s).

## Notes
- Never auto-post. Output is local files the user reviews.
- Cost + latency live here; the vector engines don't call any API.
- To flatten a composited SVG overlay to a single PNG, use `/brand-export`.
