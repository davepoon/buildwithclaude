---
description: Transcreate existing content into one or more languages/markets, honoring per-locale brand and compliance rules.
argument-hint: "<content-file-or-text> --locales xx-XX,yy-YY [--brand <name>] [--back-translation]"
---

# Localize

Adapt existing marketing content to other markets using transcreation (not literal translation). Reads only provided content; writes files; no network.

Arguments: `$ARGUMENTS`

## Workflow

1. **Parse args.** Identify the source content and required `--locales`; note `--brand` and whether `--back-translation` was requested.
2. **Load** the base brand profile and, for each locale, any `content/brand/locales/<xx-XX>/` (or branded) overrides.
3. **Transcreate.** For each locale, apply the `transcreation` skill: adapt message, tone, idioms, formality, units/currency, and channel character limits; never translate the do-not-translate glossary terms.
4. **Guard.** Send each localized asset to the `brand-guardian` subagent using that locale's rules (compliance can differ by market); apply corrections.
5. **Back-translation (if `--back-translation`).** For each localized asset, also produce a literal back-translation plus a short note on adaptation choices, for approver sign-off.
6. **Write output** to `content/output/<slug>/<locale>/…` mirroring the source filenames, plus an `index.md` listing each locale, asset, compliance status, and (if requested) a link to its back-translation.

Never auto-post. Never access the network.
