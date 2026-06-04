---
slug: one-command-deploys
title: "/release: my one-command release ritual"
excerpt: A slash command that updates the changelog, bumps the version, and refreshes the docs in one pass. It is unreasonably satisfying.
author:
  name: Riley Asante
  handle: rileya
  avatarHue: 18
category: Commands
target:
  name: release
  kind: command
  href: /command/release
platforms:
  - Claude Code
cover: brown
date: May 7, 2026
readTime: 4
pullQuote: Make it boring enough that you trust it half asleep. Releases are exactly the place you want boring.
---

Cutting a release used to be a checklist taped to my monitor. Now it is [/release](/command/release) and a sip of coffee.

The command does the dull but load-bearing parts in order: it reads the commits since the last tag, writes a changelog entry, bumps the version, and updates the docs to match. None of those steps are clever on their own. The win is that they happen together, every time, in the same order, so the changelog never drifts from what actually shipped.

## What it runs

A [slash command](/commands) is just a markdown file describing the steps. The release flow is essentially:

```bash
git log $(git describe --tags --abbrev=0)..HEAD --pretty='- %s'  # changelog source
npm version minor --no-git-tag-version                            # bump
# then: prepend the entry to CHANGELOG.md, refresh README badges, open the PR
```

What sold me was that it reads in thirty seconds. There is no hidden machinery to audit on a Friday afternoon. When I want to change how the changelog is grouped, I edit a sentence, not a script.

I keep it deliberately small. It does not deploy, it does not touch infra, it does not page anyone. It prepares the release and stops, which is the part I was always fumbling by hand. If you want to write your own, the [share-your-story walkthrough](/stories/how-to-share-your-story) shows the same author-it-in-markdown flow, and the [command docs](https://docs.claude.com/en/docs/claude-code) cover the frontmatter. The rule that has served me best: make it boring enough that you trust it half asleep.
