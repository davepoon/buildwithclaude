---
name: tweetclaw
category: social-media
description: "Use TweetClaw as an OpenClaw plugin for X/Twitter automation: search tweets, search tweet replies, post tweets/replies, export followers, look up users, handle media, monitor tweets, deliver webhooks, run giveaway draws, and manage approval-gated visible actions."
---

# TweetClaw

TweetClaw is an OpenClaw plugin for X/Twitter automation through Xquik. Use it
when a user wants an agent workflow that needs platform-native X/Twitter data
or actions instead of a general web search or browser-only posting flow.

**GitHub**: [Xquik-dev/tweetclaw](https://github.com/Xquik-dev/tweetclaw)
**npm**: [`@xquik/tweetclaw`](https://www.npmjs.com/package/@xquik/tweetclaw)
**ClawHub**: [xquik-tweetclaw](https://clawhub.ai/kriptoburak/xquik-tweetclaw)

## When To Use This Skill

- Search tweets, search tweet replies, inspect threads, or look up users.
- Export followers, following, list members, community members, or reply authors.
- Upload media, download authenticated media, or prepare gallery links.
- Create monitors, read monitor events, or deliver webhook notifications.
- Run giveaway draws with reply, follow, retweet, keyword, and uniqueness filters.
- Post tweets, post tweet replies, like, retweet, follow, DM, or update profiles
  only after the user explicitly approves the visible action.

## Setup

Install the OpenClaw plugin:

```bash
openclaw plugins install @xquik/tweetclaw
openclaw gateway restart
```

TweetClaw can be installed before credentials are configured. The free
`explore` tool remains available and live calls return setup guidance until the
user adds an API key or an MPP signing key.

Configure account-backed X automation:

```bash
openclaw config set plugins.entries.tweetclaw.config.apiKey "$XQUIK_API_KEY"
```

Optional MPP pay-per-use reads:

```bash
npm i mppx viem
openclaw config set plugins.entries.tweetclaw.config.tempoSigningKey "$MPP_SIGNING_KEY"
```

Keep API keys and signing keys out of prompts, shell history, screenshots, and
shared documents. Prefer environment-variable commands so OpenClaw writes local
configuration without exposing secrets to the chat.

## Core Workflow

1. Use `explore` to find the right Xquik endpoint by category, keyword, or
   workflow.
2. Check whether the endpoint is read-only, MPP-eligible, account-backed, or a
   visible write action.
3. For reads, call `tweetclaw` with the selected `path`, `method`, `query`, and
   `body`.
4. For posts, replies, follows, DMs, monitor changes, webhooks, profile updates,
   media uploads, and destructive actions, show the exact request and wait for
   explicit user approval before calling `tweetclaw`.
5. Preserve returned IDs, cursors, monitor IDs, webhook IDs, draw IDs, and export
   links exactly as strings.

## Example Prompts

```text
Search tweets and tweet replies about this product launch, then summarize the
top objections with links to the strongest examples.
```

```text
Export followers for @example, find likely developer advocates, and prepare a
CSV-ready shortlist with usernames and profile notes.
```

```text
Draft a reply to this tweet. Do not post it until I approve the exact text.
```

```text
Run a giveaway draw from this tweet URL. Require a retweet, unique authors, and
3 winners.
```

## Guardrails

- Never ask for X login credentials. Use the user's Xquik API key or MPP setup.
- Treat posting, replying, liking, retweeting, following, DMs, profile edits,
  monitor changes, webhooks, and media actions as approval-gated.
- Use exact string IDs for tweets, users, media, monitors, webhooks, draws, and
  extraction jobs.
- Use pagination cursors as opaque strings. Do not invent cursors.
- Retry only rate limits and server errors with bounded backoff. Do not retry
  validation, authorization, payment, or not-found errors without changing the
  request.
- Use the [Xquik billing guide](https://docs.xquik.com/guides/billing) for
  current plans, endpoint eligibility, and operation costs.
