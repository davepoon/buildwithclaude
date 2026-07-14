# Brand Voice: Edge Cases

What to do when the profile is incomplete, self-contradictory, spread across locales and brands, or in tension with the source. Handle these explicitly instead of quietly guessing.

## No profile at all

`content/brand/` (or the named brand dir) doesn't exist.

- Stop before drafting. Tell the user to run `/brand-setup`.
- Offer to proceed for this run with neutral, professional defaults, and say clearly the output won't be tuned to their voice.
- Do not invent a voice and present it as theirs.

## Partial or placeholder profile

Files exist but some sections are empty or still contain template comments (`<!-- ... -->`).

- Apply the sections that are filled.
- For empty sections, fall back to safe defaults (plain, professional) and **note in your handoff** which sections were empty so the user can fill them.
- Never treat a leftover `<!-- example -->` comment as a real rule.

## Two files disagree

Example: `brand-voice.md` says "use emoji sparingly" but `style-guide.md` says "no emoji in B2B posts."

- The **more specific / more restrictive** rule wins. "No emoji in B2B" beats "emoji sparingly" for a B2B asset.
- **Compliance always wins over voice.** If following the voice would require a prohibited claim or drop a required disclaimer, compliance takes precedence — every time.
- If the conflict is genuine and you can't resolve it by specificity, flag it to the user rather than picking silently.

## Locale overrides

A locale file (`locales/de-DE/style-guide.md`) exists alongside the base.

- Read base first, then apply the locale file field by field on top.
- Only overridden fields change; everything the locale file omits inherits from the base.
- Compliance can differ by market — a claim approved in one country may be prohibited in another. Re-check the locale's `compliance.md` before finalizing localized content.

## Multiple brands

The user runs more than one brand (`--brand acme`, `--brand northwind`).

- Everything reads and writes under `content/brands/<name>/`, not `content/brand/`.
- Never mix rules across brands. Load only the named brand's files.
- If `--brand` is given but that directory doesn't exist, treat it as "no profile" and point the user to `/brand-setup --brand <name>`.

## The source fights the brand

The source material makes a claim the brand can't make, or uses a banned word, or pushes a persona the brand doesn't serve.

- The brand profile wins over the source. Rework the claim to an approved one, or drop it and note why.
- If a banned/avoid word is *in a direct quote you must preserve*, keep the quote but don't adopt the word in your own copy; if compliance prohibits the term outright, flag it — a prohibited term isn't rescued by quotation.
- If the source's angle only lands for a persona the brand doesn't target, say so and propose an on-brand angle instead of forcing it.

## A rule would produce bad copy

Occasionally a literal rule reads awkwardly in a specific spot (e.g. a signature phrase jammed where it doesn't fit).

- Do's and signature phrases are preferences, not mandates on every line — apply them where they land naturally, skip them where they don't.
- Don'ts, banned words, and compliance rules are **not** flexible. Never break those for style.
- If you believe a hard rule is actively hurting the content, follow it and note the tension for the user — don't override it on your own judgment.
