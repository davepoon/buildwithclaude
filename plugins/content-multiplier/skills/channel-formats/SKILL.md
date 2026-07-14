---
name: channel-formats
description: Use when adapting content for a specific marketing channel. Provides format, length, structure, and best-practice specs for LinkedIn, X threads, newsletters, Instagram, YouTube, short-video scripts, and blog posts.
---

# Channel Formats

Every channel has its own container: length, structure, and conventions. When you draft a derivative, read that channel's spec and follow it exactly — then apply the `brand-voice` skill on top. Format is the container; brand voice is the content.

## Use when

- Drafting or reformatting any asset for a specific channel in `/multiply` or `/campaign`.
- Re-fitting localized content to a channel's limits after transcreation.

## Decision guide

1. **Identify the channel** by its canonical ID (below). The ID is also the output filename (`linkedin.md`, `x-thread.md`, …).
2. **Read that channel's spec** in `channels/<id>.md` — it has Format, Length, Structure, Do, and Avoid.
3. **Draft to the spec**, then run the `brand-voice` self-check.
4. **Check the count.** Enforce the character/word limit for that channel; for localized copy, re-fit after transcreation because text expands or contracts across languages.

## Channels (canonical IDs)

- `linkedin` — professional single post → [channels/linkedin.md](channels/linkedin.md)
- `x-thread` — multi-tweet thread → [channels/x-thread.md](channels/x-thread.md)
- `newsletter` — email newsletter section → [channels/newsletter.md](channels/newsletter.md)
- `instagram` — caption + hashtags → [channels/instagram.md](channels/instagram.md)
- `youtube` — description + timestamped chapters → [channels/youtube.md](channels/youtube.md)
- `short-video` — TikTok/Reels/Shorts script → [channels/short-video.md](channels/short-video.md)
- `blog` — short post or excerpt → [channels/blog.md](channels/blog.md)

## References

- **[references/worked-examples.md](references/worked-examples.md)** — one source turned into a fully drafted asset per channel, so you can see each spec applied end to end.
- **[references/adaptation-rules.md](references/adaptation-rules.md)** — how to carry one core message across channels without repeating yourself, hook patterns, CTA-per-channel guidance, hashtag and length discipline, and common mistakes.
