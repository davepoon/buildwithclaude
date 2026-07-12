# Transcreation Guide

The working detail behind the transcreation skill: what "adapt, don't translate" looks like in practice, how to set formality per locale, how to convert specifics, how to protect the do-not-translate glossary, and how to emit a back-translation.

## Translation vs. transcreation

Translation maps words. Transcreation maps *effect*. The goal is that a native reader feels what the source reader felt — even if the literal wording is unrecognizable.

**Example — an English idiom into German.**

- Source: "We knocked it out of the park."
- Literal translation: *"Wir haben es aus dem Park geschlagen."* — meaningless; baseball isn't the reference frame.
- Transcreation: *"Das war ein Volltreffer."* ("That was a bullseye.") — keeps the "we nailed it" effect with a native idiom.

**Example — a pun that can't survive.**

- Source (headline): "Lettuce turnip the beet." (playful food puns)
- There is no equivalent pun in most languages. Transcreate to a native playful line that fits the tone (e.g. a locale-appropriate food idiom or wordplay), or drop the pun and keep the energy. Never ship the literal words — they read as broken.

**Rule of thumb:** if a literal rendering would confuse or amuse-for-the-wrong-reason a native reader, rework it.

## Formality and honorifics by locale

Register is a brand decision, not a default. Pick based on the persona and the locale's brand rules.

| Locale | Formal | Informal | Default for B2B unless brand says otherwise |
| --- | --- | --- | --- |
| German (de-DE) | Sie | du | Sie — switch to du only if the brand voice is deliberately casual |
| Japanese (ja-JP) | keigo (敬語) / desu-masu | plain form | Polite desu-masu at minimum; keigo for formal/customer-facing |
| Spanish (es-ES / es-MX) | usted | tú | Varies by market and brand — es-MX often warmer; check locale rules |
| French (fr-FR) | vous | tu | vous for B2B |
| Korean (ko-KR) | 합쇼체/해요체 (polite) | 반말 | Polite forms; never 반말 in marketing |

If the base brand voice is "warm and casual" but the locale convention is formal, the **locale override** decides. Read `locales/<xx-XX>/brand-voice.md` — if it sets the register, follow it; if it's silent, follow the market convention above and note the choice.

## Localize the specifics

Convert everything a native reader would expect in their own conventions:

| Element | Convert |
| --- | --- |
| Units | miles→km, °F→°C, lb→kg, in→cm |
| Currency | Convert *and* reformat: `$1,000` → `1.000 €` (de) or `¥150,000` (ja). Use realistic local pricing if the brand provides it, not a raw FX conversion of a US price. |
| Dates | `07/08/2026` → `08.07.2026` (de), `2026年7月8日` (ja) |
| Numbers | Decimal/thousands separators: `1,000.50` → `1.000,50` (de) |
| Names / examples | Swap US names, cities, sports, and holidays for locally resonant ones |
| Phone / address formats | Local formats if present |

Currency especially: never just translate "$29/month" to "29 €/month" — the number should reflect what the product actually costs in that market if the brand tells you, and always use the local symbol, placement, and separators.

## Protect the do-not-translate glossary

Some strings must survive untouched: product names, trademarks, and taglines. Translating them breaks recognition and can break trademark protection.

- Check `style-guide.md` → "Product & Trademark Names" for the exact strings and casing.
- Keep them verbatim inside translated sentences: *"Mit Northwind Analytics treffen Sie bessere Entscheidungen."* — "Northwind Analytics" is not translated.
- Exception: if the brand supplies a **sanctioned** translation for a market, use that one. Otherwise, leave it.
- Casing and ™/® carry across languages unchanged.

## Scripts and direction

- **RTL (Arabic, Hebrew):** the text runs right-to-left; ensure punctuation, numerals, and any Latin-script glossary terms sit correctly within RTL flow. Don't reverse do-not-translate Latin brand names.
- **CJK (Chinese, Japanese, Korean):** no spaces between words; don't insert Western spacing. Line breaks and character counts behave differently — CJK usually contracts vs. English, so re-check you haven't left a hook that's now too short to land.

## Re-fit to the channel

After adapting the message, the length has changed. German and Finnish expand (often 20–35% longer); CJK contracts. Bring every asset back inside its channel's character/word limit from the `channel-formats` skill — especially the parts that must sit above a fold (LinkedIn hook, X tweet 1, email subject, short-video first line).

## Back-translation (on request)

When `--back-translation` is set, help a non-native approver sign off by producing, per asset:

1. **The transcreated copy** (what will ship).
2. **A literal back-translation** into the source language — deliberately literal, so the approver sees what the target text actually says.
3. **A short adaptation note** — 1–3 lines explaining any choices that aren't obvious: idioms swapped, register chosen, examples localized, claims adjusted for the market's compliance.

Example note: *"Replaced the baseball idiom with 'Volltreffer' (bullseye); used Sie throughout per de-DE brand override; converted $29 to the local list price of 29 €; kept 'Northwind Analytics' untranslated per glossary."*
