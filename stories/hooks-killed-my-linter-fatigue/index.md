---
slug: hooks-killed-my-linter-fatigue
title: Hooks killed my linter fatigue
excerpt: A PostToolUse hook that formats every file the agent writes, by file type, before I ever see it. Plus the three rules I follow before reaching for a hook.
author:
  name: Sasha Lindgren
  handle: sashal
  avatarHue: 142
target:
  name: smart-formatting
  kind: hook
  href: /hook/smart-formatting
category: Hooks
platforms:
  - Claude Code
cover: green
date: May 15, 2026
readTime: 5
pullQuote: If you correct the same thing twice in one session, that is the hook telling you it wants to exist.
---

I used to get a tiny dopamine hit every time I corrected a missed semicolon. Then I realized I was getting that hit fifty times a day and it was just frustration in a cape.

The fix was [smart-formatting](/hook/smart-formatting), a PostToolUse hook that runs the right formatter for each file the agent writes. It picks the tool by file type, so a `.ts` file gets Prettier and a `.py` file gets the Python formatter, and I stop being the human glue between an agent and a linter.

## How it dispatches

The hook fires after a write, reads the path of the touched file, and routes by extension:

```bash
case "$file" in
  *.ts|*.tsx|*.js|*.jsx) npx prettier --write "$file" ;;
  *.py)                  ruff format "$file" ;;
  *.go)                  gofmt -w "$file" ;;
  *.rs)                  rustfmt "$file" ;;
esac
```

It is not a clever hook. It is a chore-doer. The cleverness was admitting that nothing about formatting requires my attention.

## Three rules before reaching for a hook

1. It has to be deterministic. No model in the loop, or you have built a slot machine.
2. It has to be fast. Under 300ms, or it becomes a tax on every single write.
3. It has to be silent. A successful format produces no output. You only hear from it when something breaks.

Hooks are one of the quietest wins in [Claude Code](https://docs.claude.com/en/docs/claude-code/hooks). If you want one that protects you rather than tidies up, the [SQL guard story](/stories/hook-that-saved-my-prod) is the other end of the spectrum. Both, and a couple dozen more, are in the [hooks directory](/hooks).
