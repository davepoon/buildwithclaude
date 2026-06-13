---
name: hermes-tweet
description: Use Hermes Tweet when a Claude Code workflow needs a source-aware handoff to Hermes Agent for X/Twitter research, account context, monitoring, or approval-gated actions through the native Hermes Agent plugin.
category: social-media
license: MIT
requires:
  env: [XQUIK_API_KEY]
  bins: [hermes]
---

# Hermes Tweet

Hermes Tweet is a native Hermes Agent plugin for X/Twitter automation through Xquik. Use this skill when the user specifically wants Claude Code to prepare or operate a Hermes Agent workflow with Hermes Tweet installed.

GitHub: [Xquik-dev/hermes-tweet](https://github.com/Xquik-dev/hermes-tweet)

## When to Use This Skill

- The user asks for a Hermes Agent X/Twitter plugin, Hermes social listening, or Hermes-backed X automation.
- The workflow needs tweet or profile research inside Hermes Agent before drafting code, docs, releases, or launch messaging.
- The user wants read-first monitoring, support triage, giveaway auditing, or campaign context through Hermes Agent.
- The user explicitly wants controlled X/Twitter actions through Hermes Agent with an approval gate.

Do not use this skill for generic X/Twitter API work, social publishing platforms, or Rube MCP workflows. Use those dedicated skills instead when Hermes Agent is not part of the request.

## Setup

Install and enable the plugin in Hermes Agent:

```bash
hermes plugins install Xquik-dev/hermes-tweet --enable
hermes plugins list
```

Hermes prompts for `XQUIK_API_KEY` during interactive installation. For non-interactive, desktop gateway, or CI-style sessions, set the environment variable on the host that runs Hermes plugin tools:

```bash
export XQUIK_API_KEY="xq_YOUR_KEY_HERE"
export HERMES_TWEET_ENABLE_ACTIONS="false"
```

Keep `HERMES_TWEET_ENABLE_ACTIONS=false` for research, monitoring, audits, and unattended sessions. Set it to `true` only for an explicit user-approved session that needs posting, DMs, follows, media changes, monitors, or webhooks.

## Operating Pattern

1. Confirm `hermes plugins list` shows `hermes-tweet` as installed and enabled.
2. Start with `tweet_explore` for no-network orientation and available-workflow guidance.
3. Use read-only `tweet_read` workflows for search, tweet lookup, account context, threads, replies, monitors, or audits.
4. Before any action workflow, restate the exact intended action and require explicit user approval.
5. Enable `HERMES_TWEET_ENABLE_ACTIONS=true` only for the approved action session, then set it back to `false`.
6. Never print API keys, session material, cookies, private account data, or hidden runtime details.

## Example Prompts

```text
Use Hermes Tweet in Hermes Agent to research replies to this launch post, then summarize common support issues.
```

```text
Prepare a read-only Hermes Tweet workflow for monitoring mentions of this release keyword.
```

```text
After I approve the final text, use Hermes Tweet through Hermes Agent to publish the post.
```

## Troubleshooting

- If only `tweet_explore` is available, configure `XQUIK_API_KEY` and restart the Hermes session or gateway.
- If read tools work but action tools are missing, confirm `HERMES_TWEET_ENABLE_ACTIONS=true` for that approved session.
- If Hermes reports the plugin as installed but not enabled, run `hermes plugins enable hermes-tweet`.
- If Desktop connects to a remote gateway, set the environment variables on the gateway host, not only on the desktop client.
