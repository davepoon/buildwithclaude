---
slug: hook-that-saved-my-prod
title: The hook that stopped a DELETE without a WHERE
excerpt: A blocking hook is annoying, until it catches a TRUNCATE you meant to run on staging. Why I keep sql-bulk-delete-warn on every machine.
author:
  name: Marcus Tenny
  handle: marcust
  avatarHue: 8
target:
  name: sql-bulk-delete-warn
  kind: hook
  href: /hook/sql-bulk-delete-warn
category: Hooks
platforms:
  - Claude Code
cover: purple
date: Apr 24, 2026
readTime: 5
pullQuote: The interruption is the feature. A guardrail that fires once a year earns its keep on that day.
---

A blocking hook is the most annoying piece of infrastructure I own. It is also the reason a production table still has its rows. The hook is [sql-bulk-delete-warn](/hook/sql-bulk-delete-warn), and all it does is watch for destructive SQL. That turned out to be exactly enough.

The way it works is unglamorous. It runs as a [PreToolUse hook](https://docs.claude.com/en/docs/claude-code/hooks) on shell commands, and when it sees a `DELETE`, `UPDATE`, or `TRUNCATE` going out through `psql`, `mysql`, `sqlite3`, or `sqlcmd`, it checks for a row-count safeguard like a `WHERE` or a `LIMIT`. If there is not one, it stops and makes you look at what you just asked for.

## Wiring it up

A PreToolUse hook is a matcher plus a command. The skeleton in `settings.json` looks like this:

```json
{
  "hooks": {
    "PreToolUse": [
      {
        "matcher": "Bash",
        "hooks": [
          { "type": "command", "command": "sql-bulk-delete-warn" }
        ]
      }
    ]
  }
}
```

The guard reads the proposed command, and a bare `TRUNCATE users` exits non-zero with a message while `DELETE FROM users WHERE id = $1` sails through. The morning it caught a `TRUNCATE` with no qualifier, headed at the wrong connection, I stopped thinking of it as friction.

What I like is that it is pattern based, not a model in the loop. It is deterministic, it is fast, and it cannot be talked out of its opinion by a confident agent. The agent can write a very assured destructive query. The hook does not care how confident anyone is.

If formatting noise is your problem rather than footguns, the [linter-fatigue story](/stories/hooks-killed-my-linter-fatigue) covers a quieter PostToolUse hook. Both live in the [hooks directory](/hooks), and the source is in [the repo](https://github.com/davepoon/buildwithclaude).
