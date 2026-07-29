# minimax-video

Generate videos with **MiniMax-Hailuo-2.3** directly from Claude Code. This plugin
adds slash commands that wrap the MiniMax video-generation REST API, covering the
full asynchronous flow — create a task, poll its status, and download the result —
across both the global and China API hosts.

## Commands

| Command | Operation | Method & path |
| --- | --- | --- |
| `/minimax-video:text-to-video` | Create a task from a text prompt | `POST /v1/video_generation` |
| `/minimax-video:image-to-video` | Create a task from a first-frame image | `POST /v1/video_generation` |
| `/minimax-video:query-video` | Poll a task's status and read its `file_id` | `GET /v1/query/video_generation` |
| `/minimax-video:download-video` | Resolve a `file_id` to a download URL | `GET /v1/files/retrieve` |

## Endpoints

| Region | Base URL | Docs |
| --- | --- | --- |
| Global | `https://api.minimax.io` | https://platform.minimax.io/docs/api-reference/api-overview |
| China | `https://api.minimaxi.com` | https://platform.minimaxi.com/docs/api-reference/api-overview |

Each command takes an optional `--region global|cn` flag (default `global`) that
selects the matching host.

## Models

Default: `MiniMax-Hailuo-2.3`. Also accepted: `MiniMax-Hailuo-2.3-Fast`,
`MiniMax-Hailuo-02`, `T2V-01-Director`, `T2V-01`, `I2V-01-Director`, `I2V-01-live`,
`I2V-01`.

## Authentication

Set your API key before running the commands:

```bash
export MINIMAX_API_KEY="your-key"
```

Every request sends `Authorization: Bearer $MINIMAX_API_KEY`. A response is
successful when `base_resp.status_code` is `0`.

## Typical flow

1. `/minimax-video:text-to-video "a neon koi in a rainy alley"` → returns a `task_id`.
2. `/minimax-video:query-video <task_id>` → poll until status is success, read `file_id`.
3. `/minimax-video:download-video <file_id> ./clip.mp4` → resolve and save the video.
