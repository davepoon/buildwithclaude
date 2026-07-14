---
name: transcreation
description: Use when adapting marketing content into another language or market. Does transcreation (adapt the message, tone, and cultural references) rather than literal translation, honoring per-locale brand rules and a do-not-translate glossary.
---

# Transcreation

Marketing content must be **transcreated**, not translated. Preserve intent, brand voice, and emotional impact; rework the wording so it feels native to the target market.

## Use when

- Any asset in `/multiply` or `/campaign` has `--locales` set.
- Running `/localize` on existing content.
- Adapting copy for a market with its own brand or compliance overrides.

## Decision guide

1. **Load the market's rules.** Read base brand files, then any `locales/<xx-XX>/` overrides — they win for that market.
2. **Adapt, don't translate.** Rework idioms, humor, and references into locale-equivalents. Keep the *effect*, not the *words*.
3. **Set register.** Choose the correct formality/honorifics for the persona and locale (Sie/du, keigo, tú/usted).
4. **Localize specifics.** Convert units, currency, dates, number formats, names, and examples.
5. **Protect the glossary.** Never translate do-not-translate terms (product names, trademarks, taglines) unless the brand supplies a sanctioned translation. Check `style-guide.md` → "Product & Trademark Names."
6. **Re-fit to the channel.** Text expands/contracts across languages — bring each asset back within its channel's limits.
7. **Re-check compliance.** Disclaimers and prohibited terms can differ by country. Verify the locale's `compliance.md`.
8. **Handle scripts.** Correct RTL (Arabic, Hebrew) and CJK spacing.

When asked, also emit a **back-translation** plus a note on adaptation choices, so a non-native approver can sign off.

## References

- **[references/transcreation-guide.md](references/transcreation-guide.md)** — worked before/after transcreations, formality-by-locale guidance, glossary handling, unit/currency/date conversion tables, RTL and CJK notes, and how to produce a back-translation.
- **[references/locale-checklist.md](references/locale-checklist.md)** — a step-by-step per-locale checklist and the common failure modes (literal idioms, broken glossary terms, compliance carried across a border, overflowed channel limits).
