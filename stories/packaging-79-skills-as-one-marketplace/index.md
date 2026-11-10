---
slug: packaging-79-skills-as-one-marketplace
title: Packaging 79 skills as one Claude Code marketplace
excerpt: What we changed so one repo installs cleanly in Claude Code, Cursor and Codex, and why a root SKILL.md now routes to the rest.
author:
  name: Kevin Blancaflor
  handle: NexaiGuy
  avatarHue: 200
  url: https://nex-ai.be
  social: https://github.com/NexaiGuy
category: Plugins
platforms:
  - Claude Code
cover: blue
date: Nov 10, 2026
readTime: 4
---

We keep our free agent skills in one public MIT repo: 79 SKILL.md guides under `skills/`. This post covers the packaging choices, not the skills themselves.

## Six plugins instead of one big bundle
Installing 79 skills at once is noisy, so the marketplace file groups them into six plugins: dev essentials, web audits, browser extensions, compliance, finance and property, and business operations. People can add the marketplace once and install only the group they need.

```
/plugin marketplace add NexaiGuy/nex-ai-skills
```

## The same guides for Cursor and Codex
The skills are plain SKILL.md files, so the same repo also installs with the skills CLI:

```
npx skills add NexaiGuy/nex-ai-skills -a cursor
npx skills add NexaiGuy/nex-ai-skills -a codex
```

## A side effect: duplicate counts
Because each plugin carries its own copy of its skills, a naive file scan finds about 158 SKILL.md files. There are 79 unique guides; the rest is packaging. Worth knowing if a directory reports a strange number for your repo.

## A root SKILL.md as a router
Some directories only read the repository root and found nothing. On 6 November 2026 we added a root SKILL.md that lists the packs and points to the real guides. It's marked `metadata.internal: true` so tools don't treat it as a skill to run.

Repo: https://github.com/NexaiGuy/nex-ai-skills. Disclosure: I'm the author; Nex AI also sells separate paid skills, and this repo is the free part.


































