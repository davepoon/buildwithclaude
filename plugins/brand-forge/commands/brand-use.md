---
name: brand-use
description: List the available brands and switch which one is active for generation.
argument-hint: [brand slug to activate]
---

# /brand-use

Switch the active brand in a multi-brand repo.

## Steps

1. **List brands** with `lib/brand.mjs` → `listBrands`. Show the current active slug
   (from `brand/.active`).
2. **If a slug was given**, verify it exists under `brands/<slug>/` (or is `brand`).
   If not, list the valid slugs and stop.
3. **Set active** by writing the slug to `brand/.active`.
4. **Confirm** by running `/brand-status` so the newly active kit is shown.

No network. Only reads/writes local profile files.
