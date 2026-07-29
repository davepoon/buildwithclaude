---
description: Create a MiniMax-Hailuo-2.3 video-generation task from a text prompt and return its task id.
category: integration-sync
argument-hint: <prompt> [--model MiniMax-Hailuo-2.3] [--duration 6] [--resolution 1080P] [--region global|cn]
allowed-tools: Bash
---

# Text to Video (MiniMax-Hailuo)

Submit a text prompt to the MiniMax video-generation endpoint and return the
`task_id` that identifies the asynchronous job. Follow up with `/minimax-video:query-video`
to poll status and `/minimax-video:download-video` to fetch the result.

## Instructions

1. Read the user's prompt from `$ARGUMENTS`. Choose the endpoint host by region:
   - `global` (default): `https://api.minimax.io/v1/video_generation`
   - `cn`: `https://api.minimaxi.com/v1/video_generation`
2. Authenticate with a Bearer token from the `MINIMAX_API_KEY` environment variable.
3. Default `model` to `MiniMax-Hailuo-2.3`. Other accepted models: `MiniMax-Hailuo-2.3-Fast`,
   `MiniMax-Hailuo-02`, `T2V-01-Director`, `T2V-01`.
4. `model` and `prompt` are required. Optional fields: `prompt_optimizer`,
   `fast_pretreatment`, `duration`, `resolution`, `callback_url`.
5. POST the request, then report the `task_id` from the response (also check
   `base_resp.status_code`, where `0` means success).

## Request

```bash
# region=global -> https://api.minimax.io ; region=cn -> https://api.minimaxi.com
curl -sS -X POST "https://api.minimax.io/v1/video_generation" \
  -H "Authorization: Bearer $MINIMAX_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "MiniMax-Hailuo-2.3",
    "prompt": "A neon koi swimming through a rainy Tokyo alley at night",
    "prompt_optimizer": true,
    "fast_pretreatment": false,
    "duration": 6,
    "resolution": "1080P"
  }'
```

## Response

```json
{
  "task_id": "176843928495123",
  "base_resp": { "status_code": 0, "status_msg": "success" }
}
```

Pass the returned `task_id` to `/minimax-video:query-video`.
