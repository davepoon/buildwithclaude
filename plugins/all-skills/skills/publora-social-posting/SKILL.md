---
name: publora-social-posting
description: "Draft, schedule and publish social posts through Publora (hosted MCP): LinkedIn, X, Instagram, Threads, TikTok, YouTube, Facebook Pages, Bluesky, Mastodon and Telegram. Use when the user wants to post or schedule to one or several networks, check connected accounts, attach images or video, or read post statistics. Check the platform rules below before composing."
category: social-media
license: MIT
---

# Social Posting via Publora

One post, many networks. Publora takes a single draft, sends it to every connected account you
choose, and rejects input a platform would refuse before anything is published.

## Setup

Hosted MCP server, nothing to install:

```bash
claude mcp add --transport http publora https://mcp.publora.com/mcp
```

On the first tool call Claude Code opens the Publora sign-in in your browser (OAuth), so no key
goes into the config. Create a free account at [publora.com](https://publora.com) and connect your
social accounts in the [Publora dashboard](https://app.publora.com/dashboard).

No OAuth in your client? Use an API key from
[app.publora.com/dashboard/api](https://app.publora.com/dashboard/api) with the REST API at
`https://api.publora.com/api/v1` (header `x-publora-key`). Docs: [docs.publora.com](https://docs.publora.com).

## Workflow

1. `account_context`: plan, monthly quota and how far ahead you can schedule. Call it before a
   batch and again after any quota or feature error.
2. `list_connections`: connected accounts with their `platformId` (for example
   `linkedin-ABC123`). Copy IDs exactly; never build one by hand.
3. Check the platform rules below, then `create_post` with `content` and `platforms`:
   - no `scheduledTime` and no `publishNow`: saved as a draft;
   - `scheduledTime` in ISO 8601 with `Z` or an explicit offset: scheduled;
   - `publishNow: true`: published right away.
4. Media: pass public https links in `mediaUrls`, or for a local file run
   `get_upload_url` → HTTP PUT the bytes → `complete_media`.
5. Change a draft or scheduled post with `update_post` (keep the same `postGroupId`); check the
   result with `get_post`.
6. Statistics for Instagram, Threads, Mastodon and Bluesky: `post_stats` (pass the `postedId`
   from `get_post` or `list_posts`) and `profile_stats` for followers and post counts.

Show the user the draft and agree the time and timezone before scheduling or publishing.

## Platform rules

| Platform | Text limit | Media | Watch out for |
|---|---|---|---|
| LinkedIn | 3,000 chars (210 before "see more") | up to 10 images, or 1 video (MP4), or a PDF | no mixing images with video or documents |
| X | 280 chars, longer text becomes a thread | up to 4 images, video up to 140 s | not on the free plan |
| Instagram | 2,200 chars | required: image, 2-10 image carousel, Reel or Story | Business account only, no text-only posts |
| Threads | 500 chars per part | carousel 2-20 images, video up to 5 min | 1 hashtag per post, no editing after posting |
| TikTok | 2,200 chars | required: video or image carousel | set `viewerSetting` explicitly (default is public), video at 23+ FPS |
| YouTube | title 100, description 5,000 | required: one video | `privacy` public, unlisted or private |
| Facebook | long posts allowed | up to 10 images or a video | Pages only, not personal profiles |
| Bluesky | 300 chars | up to 4 images (2 MB each), video up to 3 min | needs an app password; alt text cannot be set via API |
| Mastodon | 500 chars | images or video | |
| Telegram | 4,096 chars | up to 10 images per group | channel ID or `t.me/c/...` link, not an invite link; no mixing images and video |

Per-platform options go in `platformSettings` (for example `{"youtube": {"privacy": "unlisted"}}`).
The schema is strict: a mistyped platform or key returns a validation error instead of being
ignored. Pinterest can be connected but not published to.

## Examples

```
Schedule this to LinkedIn and Bluesky for Tuesday 9:00 Berlin time:
"We shipped dark mode. Settings → Appearance."
```

```
Post this video to TikTok and as an unlisted YouTube video, title "Release 2.4 walkthrough".
```

```
How did my last three Threads posts do?
```

## Errors

- Quota or feature error: call `account_context`, tell the user what is blocked and show the
  upgrade link only if upgrading would help.
- Validation error: fix the input (length, media type, platform setting) and retry.
- Unclear whether a post went out: check `get_post` before sending it again.
