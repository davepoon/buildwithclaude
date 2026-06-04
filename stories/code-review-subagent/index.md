---
slug: code-review-subagent
title: The code-review subagent that catches what I miss
excerpt: A subagent I invoke the moment I finish writing code. It reviews for quality, security, and maintainability, and it is blunt in the way a good reviewer is.
author:
  name: Dre Achebe
  handle: dre
  avatarHue: 312
target:
  name: code-reviewer
  kind: subagent
  href: /subagent/code-reviewer
category: Subagents
platforms:
  - Claude Code
  - Agent SDK
cover: purple
date: May 11, 2026
readTime: 6
pullQuote: It comes in cold, with no sunk cost in believing the code is good.
---

The most-used thing on my machine is not a fancy generator. It is a review specialist. The [code-reviewer](/subagent/code-reviewer) subagent has one job, and it does it the moment I stop typing: read what just changed and tell me what is wrong before anyone else has to.

## Why a subagent, not a prompt

The separation is the point. A [subagent](/subagents) runs with its own focused system prompt and a fresh context, so it is not the same conversation that just wrote the code and is therefore quietly invested in believing the code is good. It comes in cold, looks for the three things that actually bite, and reports without the sunk-cost bias. The definition is small:

```md
---
name: code-reviewer
description: Expert code review specialist. Proactively reviews code for quality, security, and maintainability. Use immediately after writing or modifying code.
tools: Read, Grep, Bash
---

You are a senior reviewer. Read the diff, then report only what matters:
correctness bugs, security issues, and maintainability traps. Lead with the
highest-severity finding. If the code is fine, say so in one line.
```

That `description` is what makes it fire on its own. Claude reads it and invokes the subagent right after a write, instead of waiting for me to remember to ask. The discipline of reviewing while the change is still warm is the whole trick. A review you run a day later competes with the urge to just ship.

It has not replaced human review. It has made human review better. By the time a teammate opens the PR, the obvious stuff is gone, and they spend their attention on the things only a person catches. I run it alongside the [webapp-testing skill](/stories/webapp-testing-skill), one checking the code and one checking the behavior. There are reviewers for other angles in the [subagents directory](/subagents), and the proactive-invocation pattern is in the [subagent docs](https://docs.claude.com/en/docs/claude-code/sub-agents).
