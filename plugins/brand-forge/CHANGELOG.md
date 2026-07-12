# Changelog

## [0.5.0] — 2026-07-12
PNG export (Plan 5).

### Added
- `lib/rasterize.mjs` — SVG→PNG with a pluggable backend; optional `sharp` if present,
  otherwise a clear pointer to OS-native tools. Backend is injectable → unit-tested
  without `sharp`.
- `/brand-export` command documenting the flow and the `qlmanage`/Chrome/`rsvg-convert`
  fallbacks; logo + graphic skills now point to it.

### Note
`sharp` stays an optional dependency — the plugin runs and its full suite passes
without it. No binary PNGs are committed; export is on demand.

## [0.4.0] — 2026-07-12
Raster engine (Plan 4) — opt-in, off by default.

### Added
- Brand-aware prompt builder `lib/raster.mjs`.
- Provider-agnostic image client `lib/genimage.mjs` (gemini default, openai alternate)
  — the only networked module; retry+backoff, atomic writes, header-based auth,
  injectable `fetch`/`sleep` (fully unit-tested against stubs, no live calls).
- Vector-over-raster compositor `lib/composite.mjs` (logo + caption overlay, no `sharp`).
- `generate-graphic` skill (+ prompting reference); `/brand-make` routes marketing
  graphics behind the `BRAND_FORGE_RASTER` + API-key gate.
- Northwind raster mockup (`examples/northwind/output/graphic-hero.svg`).

## [0.3.0] — 2026-07-12
Doc/deck templates (Plan 3).

### Added
- Shared `wrapText` helper in `lib/svg.mjs`, reused by social + doc generators.
- Document templates `lib/doctpl.mjs` (`letterhead`, `slide`, `one-pager`) with
  editable title/subtitle/body zones.
- `generate-doc-template` skill (+ layout-grids reference); `/brand-make` now routes docs.
- Northwind letterhead + slide examples.

## [0.2.0] — 2026-07-12
Social templates (Plan 2).

### Added
- Shared SVG helpers `lib/svg.mjs` (`esc`, `initials`), reused by the logo generator.
- Platform-sized social templates `lib/social.mjs` (`instagram-square`,
  `instagram-story`, `og-card`, `youtube-thumb`) with editable headline/subhead/CTA zones.
- `generate-social` skill (+ platform-sizes reference); `/brand-make` now routes social.
- Northwind social template example (`examples/northwind/output/social-instagram-square.svg`).

## [0.1.0] — 2026-07-12
Vector core foundation (Plan 1).

### Added
- Plugin manifest, MIT license, zero-runtime-dependency package.
- Brand profiles: load/validate/resolve (`lib/brand.mjs`), starter `templates/brand/`.
- JSON path reader `lib/field.mjs` (library + CLI).
- Reusable session context emitters `lib/context/*` (extensionless) and a gated SessionStart hook.
- SVG logo generator `lib/logo.mjs` (wordmark, monogram, favicon).
- Commands: `/brand-new`, `/brand-use`, `/brand-status`, `/brand-make`.
- Skill: `generate-logo` (+ construction reference).
- Subagents: `art-director`, `visual-guardian`.
- Worked example `examples/northwind/` and `assets/how-it-works.svg`.

### Not yet
- Social templates (Plan 2), doc/deck templates (Plan 2), raster engine (Plan 4),
  PNG export via optional `sharp` (Plan 5).
