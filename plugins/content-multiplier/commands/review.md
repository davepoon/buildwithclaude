---
description: Audit existing or draft content against the brand voice, style guide, and compliance rules. Returns a scorecard and a redline.
argument-hint: "<content-file-or-text> [--brand <name>] [--locale <xx-XX>]"
---

# Review

QA any content — a draft, a competitor-inspired piece, or something a teammate wrote — against your brand rules before it ships.

Arguments: `$ARGUMENTS`

## Workflow

1. **Parse args.** Identify the content to review and any `--brand` / `--locale`.
2. **Load** the applicable brand profile (with locale overrides if given).
3. **Delegate** to the `brand-guardian` subagent to produce the **scorecard** (Voice / Style / Compliance = pass|fix per asset).
4. **Produce a redline.** For every `fix`, show the original text, the problem (which rule it breaks), and the corrected version inline.
5. **Summarize.** Give an overall pass/needs-work verdict and the top 3 things to fix first.

Read-only with respect to the user's content — propose changes, don't silently rewrite files. Never access the network.
