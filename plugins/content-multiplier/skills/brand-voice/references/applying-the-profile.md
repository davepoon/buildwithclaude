# Applying the Brand Profile

This is the working detail behind the brand-voice skill: how to load the profile, how each field turns into a writing decision, a worked rewrite, and the self-check to run before you return anything.

## 1. Load the profile

Resolve the active directory in this order:

1. If a brand was named (`--brand acme`), use `content/brands/acme/`. Otherwise use `content/brand/`.
2. If a locale is in play (`--locale de-DE` or a `--locales` target), also load `.../locales/de-DE/`.
3. Read every file present: `brand-voice.md`, `messaging.md`, `style-guide.md`, `compliance.md`.

**Precedence:** a locale file overrides the base file *of the same name*, field by field. Read the base file first, then apply the locale file on top. If `content/brand/style-guide.md` bans "cheap" and `locales/de-DE/style-guide.md` says nothing about it, the ban still holds; if the locale file redefines product casing, the locale wins for that market.

If no profile directory exists at all, stop and tell the user to run `/brand-setup`. Offer to proceed with neutral defaults for this run, but say plainly that the output won't be tuned to their voice.

## 2. Map each field to a writing decision

| Profile field | What it changes in the draft |
| --- | --- |
| Personality (adjectives) | The overall register. "Warm, plain-spoken" → contractions, second person, short sentences. "Authoritative, precise" → fuller sentences, fewer contractions, evidence up front. |
| Tone (by context) | Shift within a piece. A launch post leans confident; a support/apology note leans direct and accountable. Pick the tone row that matches the asset's purpose. |
| Voice do's | Positive constraints to satisfy every time — e.g. "lead with the benefit," "use 'you'," "one idea per post." |
| Voice don'ts | Hard stops — e.g. "no emoji in B2B posts," "never open with a rhetorical question." |
| Signature phrases | Prefer these when they fit naturally. Don't cram them in; overuse reads as a tic. |
| Words to avoid | Never use them. Find a plain synonym. |
| Positioning / value props | Frame the piece around the relevant value prop for the persona. Lead with it. |
| Personas | Choose the one the strategist assigned; write to their pains and what they care about. |
| Key messages | Every asset should reinforce at least one. Name it to yourself before drafting. |
| Boilerplate | Use the approved wording verbatim for "about us" lines. Don't paraphrase it. |
| Formatting rules | AP vs. other style, Oxford comma, headline case, punctuation limits — apply mechanically. |
| Glossary / terminology | Swap off-brand terms for preferred ones ("customers," not "users," if specified). |
| Product & trademark casing | Exact casing and ™/® usage. Never abbreviate a product name unless the guide allows it. |
| Banned words | Never use them, in any channel. |
| Inclusive language | Apply the required substitutions and constructions. |
| Compliance (all fields) | Only approved claims; no prohibited terms; every required disclaimer present; regulated-language rules satisfied. This is enforced downstream by the brand-guardian — get it right the first time. |

## 3. Worked example: generic draft → on-brand

**Profile excerpts (fictional "Northwind" B2B analytics brand):**

- Personality: *Confident, plain-spoken, a little dry. We sound like a senior engineer who respects your time.*
- Voice do's: lead with the outcome; use "you"; short sentences.
- Words to avoid: *revolutionary, seamless, supercharge, unlock, leverage.*
- Persona: *Data Lead — drowning in dashboards nobody reads, cares about signal over vanity metrics.*
- Key message: *Fewer dashboards, better decisions.*
- Style: sentence case headlines; no exclamation points in headers.

**Generic draft (off-brand):**

> Revolutionize Your Analytics Today!
> Our seamless platform helps you unlock powerful insights and supercharge your team's productivity. Leverage cutting-edge dashboards to drive results!

**On-brand rewrite:**

> Fewer dashboards, better decisions
> You don't need forty dashboards. You need the three that change what you do next. Northwind cuts the noise so your data lead ships decisions, not screenshots.

What changed and why:

- Killed every avoid-word (revolutionize, seamless, unlock, supercharge, leverage) and the exclamation points.
- Headline is sentence case and *is* the key message.
- Opens with the outcome, addresses the Data Lead's real pain (dashboards nobody reads), uses "you."
- Dry, confident register — no hype, no filler.

## 4. Self-check before returning content

Run this pass on every asset before you hand it back:

- [ ] Does it sound like the personality and the right contextual tone?
- [ ] Every voice **do** satisfied? No voice **don't** present?
- [ ] Zero words-to-avoid and zero banned words?
- [ ] Reinforces at least one key message, framed for the assigned persona?
- [ ] Product/trademark names cased exactly; boilerplate verbatim where used?
- [ ] Only approved claims; no prohibited terms; every required disclaimer present; regulated-language rules met?
- [ ] Formatting matches the style guide (case, punctuation, comma rules)?

If any box fails, fix it before returning. When in doubt about a compliance rule you can't verify against the files, flag it rather than guessing.
