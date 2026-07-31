# minimax-video

Generate multimodal videos with **MiniMax-H3** directly from Claude Code. This
plugin provides a v2 flow for creation and task management across the global and
China API hosts, while retaining the existing v1 commands for compatibility.

## Commands

### H3 v2 commands

| Command | Operation | Method and path |
| --- | --- | --- |
| /minimax-video:h3-create-video | Create a multimodal H3 task | POST /v2/video_generation |
| /minimax-video:h3-query-video | Query one H3 task | GET /v2/query/video_generation/{task_id} |
| /minimax-video:h3-list-videos | List and filter H3 tasks | GET /v2/query/video_generation |
| /minimax-video:h3-delete-video | Cancel or delete an H3 task | DELETE /v2/video_generation/{task_id} |

### Existing v1 commands

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

## H3 v2 endpoints

| Region | Base URL | Docs |
| --- | --- | --- |
| Global | https://api.minimax.io | https://platform.minimax.io/docs/api-reference/video-generation-v2-create |
| China | https://api.minimaxi.com | https://platform.minimaxi.com/docs/api-reference/video-generation-v2-create |

The H3 create command uses /v2/video_generation, query uses
/v2/query/video_generation/{task_id}, list uses /v2/query/video_generation,
and delete uses /v2/video_generation/{task_id}. The China request may include
the regional <code>aigc_watermark</code> boolean; omit that field for the global endpoint.

## H3 v2 input rules

- <code>model</code> must be MiniMax-H3.
- Every request must contain one non-empty <code>text</code> item, up to 7000 characters.
- Supported content types are <code>text</code>, <code>image_url</code>, <code>video_url</code>, and <code>audio_url</code>.
- Supported roles are <code>first_frame</code>, <code>last_frame</code>, <code>reference_image</code>,
  <code>reference_video</code>, and <code>reference_audio</code>.
- Frame roles and reference roles are mutually exclusive. A reference audio item
  requires at least one reference image or reference video.
- <code>resolution</code> must be 2K; <code>duration</code> must be an integer from 4 through 15.
- The request body must not exceed 64 MB. Use public URLs or platform file URLs
  for large media instead of embedding large Base64 payloads.
- Text-only requests use a concrete ratio. Frame requests use adaptive; reference
  requests may use adaptive or a supported concrete ratio.

## H3 model

The H3 v2 commands use MiniMax-H3 as the default and only supported v2 model.

## Existing v1 models

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

The base_resp status check above applies to the existing v1 responses. H3 v2
creation succeeds when the response contains task_id; use the H3 query command
to read task status and output.

## H3 v2 flow

1. /minimax-video:h3-create-video "a neon koi in a rainy alley" returns a task_id.
2. /minimax-video:h3-query-video task_id polls until the task succeeds and returns task.content.url.
3. /minimax-video:download-video task.content.url ./clip.mp4 downloads the time-limited H3 result URL.
4. Use /minimax-video:h3-list-videos to review recent tasks or /minimax-video:h3-delete-video to cancel or remove one.

## Typical flow

1. `/minimax-video:text-to-video "a neon koi in a rainy alley"` → returns a `task_id`.
2. `/minimax-video:query-video <task_id>` → poll until status is success, read `file_id`.
3. `/minimax-video:download-video <file_id> ./clip.mp4` → resolve and save the video.
