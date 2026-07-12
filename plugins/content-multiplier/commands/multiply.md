---
description: Turn one source into ready-to-paste, on-brand content for every channel (and optionally every market). The hero command.
argument-hint: "<source-file-or-text> [--channels a,b,c] [--brand <name>] [--locales xx-XX,yy-YY]"
---

# Multiply

Turn a single source into a full set of on-brand, channel-specific derivatives. Reads only what the user provides; writes files; never posts anything.

Arguments: `$ARGUMENTS`

## Workflow

1. **Parse args.** Identify the source (a file path or inline text), and optional flags: `--channels` (default: linkedin, x-thread, newsletter, instagram, short-video), `--brand <name>` (default brand), `--locales xx-XX,...` (default: none).
2. **Load the brand profile** using the `brand-voice` skill (from `content/brand/` or the named brand). If none exists, suggest `/brand-setup` and offer sensible defaults.
3. **Plan.** Delegate to the `strategist` subagent with the source + selected channels. It returns a **derivative plan** (channel × angle × persona × key message).
4. **Confirm the plan with the user.** Show the plan and ask them to approve, trim, or adjust before drafting. Do NOT generate everything unprompted.
5. **Draft each derivative.** For each approved row, apply the `channel-formats` skill (that channel's spec) plus the `brand-voice` skill to write the asset.
6. **Localize (if `--locales` set).** For each target locale, apply the `transcreation` skill to adapt selected assets to that market.
7. **Guard.** Delegate all drafts to the `brand-guardian` subagent. Apply its corrections; if anything is `fix`, revise and re-check.
8. **Write output.** Create `content/output/<campaign-slug>/` (slug from the source title + a short suffix). Write one file per asset: `<channel>.md`, and `<locale>/<channel>.md` for localized versions.
9. **Write `index.md`** in that folder: a dashboard table `Asset | Channel | Locale | Persona | Chars | Compliance | Notes`, one row per file, plus a one-line summary and next-steps (copy/paste or schedule).

Output is copy-paste / schedule-ready. Never auto-post. Never access the network.
