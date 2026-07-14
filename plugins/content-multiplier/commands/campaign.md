---
description: Turn a campaign brief into a coordinated multi-channel content set plus a posting calendar.
argument-hint: "<brief-file-or-text> [--channels a,b,c] [--weeks N] [--brand <name>] [--locales xx-XX,...]"
---

# Campaign

Plan and produce a whole campaign from a brief: many coordinated pieces plus a calendar that sequences them.

Arguments: `$ARGUMENTS`

## Workflow

1. **Parse args.** Read the brief (goal, audience, offer, dates), plus `--channels`, `--weeks` (default 2), `--brand`, `--locales`.
2. **Load** the brand profile via the `brand-voice` skill.
3. **Plan.** Delegate to the `strategist` subagent to turn the brief into a campaign arc: themes per week, and a **derivative plan** of assets across the selected channels reinforcing the key messages. Show it and get confirmation.
4. **Draft** each asset with the `channel-formats` + `brand-voice` skills; localize with `transcreation` if `--locales` set.
5. **Guard** all assets with the `brand-guardian` subagent; apply fixes.
6. **Write output** to `content/output/<campaign-slug>/` with per-asset files, and a **`calendar.md`**: a table `Date/Slot | Channel | Asset | Theme | Status` spread across the `--weeks`. Include `index.md` as in `/multiply`.

Never auto-post or schedule to real platforms — the calendar is a plan the user executes. Never access the network.
