---
name: brand-make
description: Generate an on-brand asset (logo, social template, doc template, or AI marketing graphic) for the active brand and save it to output/.
argument-hint: <asset description, e.g. "wordmark logo" or "instagram story announcing our launch">
---

# /brand-make

The hero command. Turn a plain-language request into a finished, on-brand asset.

## Steps

1. **Resolve the active brand.** Read `brand/.active` (or the single `brand/` dir)
   via `lib/brand.mjs` → `resolveActive`. If none exists, tell the user to run
   `/brand-new` and stop.
2. **Load + validate** the profile with `loadProfile` / `validateProfile`. If
   validation fails, report the offending field and stop.
3. **Route by asset type** (rule of thumb: text/geometry → vector; photographic →
   raster, which is opt-in):
   - logo / wordmark / monogram / favicon → **generate-logo** skill.
   - social post / story / banner / OG card / thumbnail → **generate-social** skill.
   - letterhead / slide / one-pager → **generate-doc-template** skill.
   - hero image / ad creative / background / texture / photo → **generate-graphic**
     skill (opt-in raster: needs `BRAND_FORGE_RASTER=1` + an API key; if unset, say so
     and offer a vector alternative).
4. **Consider `art-director`** for anything ambiguous or multi-asset — have it
   propose the asset set and composition before generating.
5. **Generate** by calling the routed skill, writing files under `output/` (SVG for
   vector assets; PNG for raster graphics, optionally with an SVG overlay).
6. **Enforce** with the `visual-guardian` subagent (palette, contrast, clear-space,
   type). Apply fixes or surface flags.
7. **Report** the saved paths and show a short preview/description of each asset.

Never auto-post or upload. Output is local files the user reviews.
