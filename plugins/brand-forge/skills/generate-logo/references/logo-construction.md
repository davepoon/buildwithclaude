# Logo construction reference

Guidance the `generate-logo` skill applies when building `lib/logo.mjs` output.

## Variants
- **Wordmark** — the brand name set in the heading font, with a small accent mark.
  The everyday logo; use where horizontal space allows (480×120 canvas).
- **Monogram** — one or two initials in a rounded square. Use in tight/square
  placements (avatars, app tiles). 160×160 canvas.
- **Favicon** — a single initial, 64×64, rounded. Browser tabs and small icons.

## Clear space
Reserve clear space equal to the logo's cap height (roughly the accent-mark radius)
on all sides. Never crowd the mark with other elements.

## Color
- Fill uses the brand `primary`; the accent mark uses `accent`.
- On dark backgrounds, swap to a light variant (invert fills) — a future task.
- Never recolor outside the palette; the `visual-guardian` enforces this.

## Typography
- Use the profile's `typography.heading.family`.
- If the font isn't available where the SVG is rendered, the declared fallback in
  `typography.json` applies — flag the substitution to the user.

## Accessibility
- Keep logo text and background contrast at or above the profile's `minContrast`.
- Provide `role="img"` and an `aria-label` on every SVG (the generator does this).
