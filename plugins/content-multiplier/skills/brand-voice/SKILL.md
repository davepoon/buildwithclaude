---
name: brand-voice
description: Use when writing, editing, or reviewing any marketing content so it matches the team's brand profile. Explains how to load and apply the brand-voice, messaging, style-guide, and compliance files.
---

# Brand Voice

Content you produce for this team must sound like *them*, not like generic AI. Before writing or reviewing anything, load the active brand profile and apply it.

## Use when

- Drafting any asset in `/multiply`, `/campaign`, or `/localize`.
- Auditing content in `/review`.
- Any time you write or edit marketing copy and a brand profile might exist.

## Decision guide

1. **Locate the active profile.** Default `content/brand/`; `content/brands/<name>/` if a brand was named; plus `locales/<xx-XX>/` overrides. Locale files override the base file of the same name.
2. **No profile found?** Tell the user to run `/brand-setup`, and offer to proceed with sensible defaults for this run only.
3. **Profile found?** Read all four files, apply them while drafting, and run the self-check before returning anything.

## The four files, at a glance

- `brand-voice.md` — personality, tone, do's/don'ts, signature phrases, words to avoid.
- `messaging.md` — positioning, value props, personas, key messages, boilerplate.
- `style-guide.md` — formatting, glossary, product/trademark casing, banned words, inclusive language.
- `compliance.md` — approved claims, prohibited terms, required disclaimers, regulated language.

## References

- **[references/applying-the-profile.md](references/applying-the-profile.md)** — how to load the files, precedence rules, how each field maps to a writing decision, a worked before/after rewrite, and the self-check to run before returning content.
- **[references/edge-cases.md](references/edge-cases.md)** — missing/partial profiles, conflicts between files, locale overrides, multi-brand setups, and what to do when a rule and the source collide.
