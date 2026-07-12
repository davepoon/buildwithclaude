---
description: Create or update your brand profile (voice, messaging, style, compliance) that all content generation respects.
argument-hint: "[--brand <name>] [--locale <xx-XX>] [path-to-example-content ...]"
---

# Brand Setup

You are setting up a **brand profile** for the content-multiplier plugin. The profile lives in the user's repo at `content/brand/` (default brand) or `content/brands/<name>/` when `--brand <name>` is given; per-market overrides go in `.../locales/<xx-XX>/` when `--locale` is given.

Arguments: `$ARGUMENTS`

## Steps

1. Determine the target directory from any `--brand` / `--locale` flags (default `content/brand/`). Create it if needed.
2. Copy the four starter templates from this plugin's `templates/brand/` into the target directory if they don't already exist: `brand-voice.md`, `messaging.md`, `style-guide.md`, `compliance.md`. **Never overwrite** an existing profile file without confirming.
3. Choose a mode:
   - **Interview mode** (default when no example files are given): ask the user a short, focused set of questions — target audience, 3-5 personality adjectives, tone, words they love and words to avoid, main competitors, and any must-have disclaimers. Ask them a few at a time, not one giant wall.
   - **Learn-from-examples mode** (when the user passes paths to 3-8 existing on-brand pieces): read those files and infer voice, vocabulary, sentence rhythm, formatting, and recurring phrases.
4. Fill in every section of the four files based on the answers/examples. Keep entries concrete and specific — no empty `<!-- -->` placeholders left behind.
5. Run a **self-audit**: re-read the filled profile and flag any gaps, contradictions, or vague entries. Report them to the user and offer to fix.
6. Summarize what you created and tell the user they can commit `content/brand/` to share it with their whole team.

Never fetch anything from the network. Only read files the user explicitly provides.
