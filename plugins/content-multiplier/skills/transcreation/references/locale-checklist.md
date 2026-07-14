# Per-Locale Checklist and Failure Modes

Run this for each target locale, and watch for the mistakes that most often ship broken localized content.

## Per-locale checklist

Do this once per locale, per asset:

1. **Load overrides.** Read `content/brand/locales/<xx-XX>/` (or the named brand's locales dir). Apply on top of the base profile. Locale wins where it speaks; base fills the rest.
2. **Set register.** Choose formality/honorifics from the persona and locale rules (see the transcreation guide's formality table). Note the choice.
3. **Transcreate the message.** Rework idioms, humor, metaphors, and cultural references into native equivalents. Keep the effect.
4. **Localize specifics.** Units, currency (value + format), dates, number separators, names, examples.
5. **Protect the glossary.** Keep do-not-translate terms verbatim; use a sanctioned translation only if the brand supplies one.
6. **Handle the script.** RTL flow for Arabic/Hebrew; CJK spacing and contraction.
7. **Re-fit to the channel.** Re-count against the channel spec; trim or expand to fit, keeping the hook above the fold.
8. **Re-check compliance.** Read the locale's `compliance.md`. Confirm approved claims still apply here, no prohibited terms crept in, and every required disclaimer for this market is present.
9. **Back-translation (if requested).** Emit the literal back-translation plus an adaptation note per asset.
10. **Guard.** Hand localized assets to the brand-guardian using *that locale's* rules.

## Failure modes to avoid

**Literal idioms.** The single most common failure. "Hit it out of the park," "low-hanging fruit," "move the needle," "no-brainer" — none survive word-for-word. Always swap for a native equivalent or drop them.

**Broken glossary terms.** Translating a product name or tagline. "Northwind Analytics" must stay "Northwind Analytics" in every language unless the brand sanctions a translation. Check the glossary before you touch a proper noun.

**Compliance carried across a border.** A claim approved in the source market may be prohibited in the target market — financial, health, and superlative claims especially. Never assume the base `compliance.md` covers the new country. Read the locale's compliance file, and if a required disclaimer differs, use the local one.

**Wrong register.** Using du/tú where the market and persona expect Sie/usted (or vice versa) reads as unprofessional or oddly stiff. Decide register explicitly; don't default to informal because the English used "you."

**Overflowed channel limits.** Expansion languages blow past character limits. A LinkedIn hook or email subject that fit in English can push the payoff below the fold in German. Re-count every asset after transcreation.

**Untranslated fragments.** Leaving stray source-language words ("Learn more," a CTA, a UI label) inside otherwise-localized copy. Sweep the whole asset — including CTAs, subjects, hashtags, and on-screen cues.

**Machine-literal currency and dates.** "$29" rendered as "29 $" with US formatting, or an FX-converted price nobody would actually charge. Use the local symbol, placement, separators, and the brand's real local price if given.

**CJK spacing and separators.** Inserting Western spaces between CJK words, or leaving `1,000.50` unconverted where the locale uses `1.000,50`. Small, but they mark the copy as foreign.

**RTL layout errors.** Reversing Latin brand names inside Arabic/Hebrew text, or misplacing punctuation and numerals in RTL flow.

## When something can't be adapted

If a source line has no native equivalent and no graceful rework — a pun, a culture-locked reference, a claim that's prohibited in this market — do not force a literal rendering. Replace it with an on-brand line that carries the same intent, or drop it, and flag the change in the adaptation note so the approver knows. A confusing literal translation is worse than a clean, faithful rewrite.
