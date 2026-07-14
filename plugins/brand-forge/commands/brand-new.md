---
name: brand-new
description: Create a new visual brand profile via guided Q&A, optionally bootstrapping colors and fonts from an existing website, logo, or brand-guidelines PDF.
argument-hint: [brand slug] [optional: URL / logo path / PDF path to import from]
---

# /brand-new

Create a versioned visual brand profile in the user's repo. Zero-permission unless
the user asks to import from a URL (that one step is opt-in network use).

## Steps

1. **Pick a location.** Single brand → `brand/`. Multiple brands → `brands/<slug>/`.
   Ask for the slug if not given.
2. **Seed from the starter.** Copy `templates/brand/` (`color-system.json`,
   `typography.json`, `visual-identity.md`) into the target directory.
3. **Optional import.** If the user supplied a website URL, logo file, or brand PDF,
   extract palette + fonts (Plan 4 wires `lib/extract-brand.mjs`; until then, read
   the material and fill the fields by hand). If a source is unreachable or a PDF has
   no embedded fonts, fall back to Q&A for the missing fields.
4. **Guided Q&A** to fill the rest: brand name, three personality adjectives, tone,
   imagery style, colors (if not imported), heading/body fonts, do/don't rules.
5. **Validate** with `lib/brand.mjs` → `validateProfile`; fix any flagged field
   (e.g. non-hex color, missing font family).
6. **Set active.** Write the slug to `brand/.active`.
7. **Confirm** by running `/brand-status` so the user sees the loaded kit.

## Font policy
If the user has a licensed font file, place it in the brand folder. If a font isn't
available locally, record a free/Google-font fallback in `typography.json` and tell
the user it's a substitution — never silently mismatch.
