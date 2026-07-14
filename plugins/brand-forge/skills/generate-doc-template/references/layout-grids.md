# Document layout grids

Sizes and layout `lib/doctpl.mjs` ships, and when to use each.

| Kind         | Size (px)   | Use for |
|--------------|-------------|---------|
| `letterhead` | 816 × 1056  | Letters, offers, formal correspondence (US Letter @96dpi) |
| `slide`      | 1280 × 720  | Deck title/section slides, 16:9 presentations |
| `one-pager`  | 816 × 1056  | Product/exec one-pagers with a header band |

## Shared grid
- Outer margin = `W * 0.09` on all sides; keep content inside it.
- Heading font for the brand mark and title; body font for subtitle and body copy.
- Accent color is used sparingly: a rule under the header and a footer tick.

## Per-kind layout
- **letterhead** — brand mark top-left + accent rule; title; body (or placeholder
  content rules when empty); footer rule + `brand · contact` line.
- **one-pager** — a `primary` header band with the brand mark, then title + body.
- **slide** — a left accent bar, small brand mark, large centered-left title,
  optional subtitle, and a short accent footer tick.

## Editable zones
`id="title"`, `id="subtitle"`, `id="body"` wrap their text; edit the SVG or
regenerate with new `title`/`subtitle`/`body` values.

## Extending
Add a kind by extending `DOC_KINDS` in `lib/doctpl.mjs` with `{ w, h }`; portrait
kinds reuse the letterhead layout branch, slide uses the 16:9 branch.
