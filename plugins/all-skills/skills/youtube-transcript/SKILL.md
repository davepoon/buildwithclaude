---
name: youtube-transcript
category: research
description: Use when the user wants a YouTube video's transcript fetched, wants to summarize/analyze/quote a YouTube video by its spoken content, wants to search YouTube (globally or within a channel), wants a channel handle resolved to its channel ID, or wants the videos in a YouTube playlist.
---

# YouTube Transcript

Fetches transcripts, search results, and playlist/channel data from YouTube via the [getyoutubetranscript.com](https://getyoutubetranscript.com) REST API, so you can summarize, quote, search, or analyze a video's actual spoken content without the user having to copy-paste it in by hand. No `yt-dlp`, no headless browser, no Google Cloud API key or quota setup.

## When to Use This Skill

- User asks to get, fetch, or summarize a YouTube video's transcript
- User asks to search YouTube for videos or channels on a topic
- User wants a channel handle resolved to its channel ID, or a channel's recent or full upload history
- User wants to search inside one specific channel's videos
- User wants the contents of a YouTube playlist

## What This Skill Does

1. **Get a transcript**: fetch the full spoken text of a video plus title/author/thumbnail metadata
2. **Search YouTube**: search videos or channels, paginated
3. **Resolve and browse channels**: turn an `@handle` into a channel ID, list latest or full upload history, or search within a channel
4. **Extract playlists**: list every video in a playlist, paginated

## How to Use

### Basic Usage

```
Summarize this video: https://www.youtube.com/watch?v=VIDEO_ID
```

### Advanced Usage

```
Search MKBHD's channel for iPhone reviews and summarize what changed across models.
List every video in this playlist and group them by topic: https://www.youtube.com/playlist?list=PLAYLIST_ID
```

## Prerequisite: an API key

Every call needs a key. Get one free (100 credits, no card) at the [dashboard](https://getyoutubetranscript.com/dashboard), or the skill can create one for the user directly by email + one-time code (`POST /api/v1/signup` then `/api/v1/signup/verify`) - no dashboard visit required.

## Endpoints

Base URL: `https://getyoutubetranscript.com/api/v1`. Auth via `Authorization: Bearer <key>` or `x-api-key: <key>`.

| Endpoint | Cost | What it does |
|---|---|---|
| `GET /transcript` | 1 credit | Full transcript + title/author/thumbnail for one video |
| `GET /search` | 1 credit/page | Search YouTube for videos or channels, paginated |
| `GET /resolve` | Free | Resolve a channel handle/URL/ID to its canonical channel ID |
| `GET /channel/latest` | Free | Channel metadata + its home tab's "Latest Videos" |
| `GET /channel/videos` | 1 credit/page | Every video a channel has ever uploaded, fully paginated |
| `GET /channel/search` | 1 credit/page | Search within one channel's videos, fully paginated |
| `GET /playlist` | 1 credit/page | Every video in a playlist, fully paginated |

Only successful calls are charged - failed or rate-limited calls cost zero credits.

## Example

**User**: "Summarize this video: https://youtu.be/dQw4w9WgXcQ"

**Output**:
```
Calls GET /transcript?v=dQw4w9WgXcQ, then summarizes the returned transcript text.
```

## Tips

- The transcript is returned as one plain text block - there's no per-segment timestamp breakdown
- `get_channel_latest_videos`-equivalent (`/channel/latest`) is always free
- Use `continuation` tokens from a previous response verbatim to paginate search/channel/playlist results - don't construct them yourself

**Inspired by:** [getyoutubetranscript.com](https://getyoutubetranscript.com) - full reference at [/docs](https://getyoutubetranscript.com/docs)
