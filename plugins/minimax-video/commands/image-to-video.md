---
description: Create a MiniMax-Hailuo-2.3 video-generation task from a first-frame image and return its task id.
category: integration-sync
argument-hint: <first_frame_image_url_or_base64> [prompt] [--model MiniMax-Hailuo-2.3] [--region global|cn]
allowed-tools: Bash
---

# Image to Video (MiniMax-Hailuo)

Animate a still image with the MiniMax video-generation endpoint. The image is
supplied as the `first_frame_image` (a public URL or a `data:` base64 string) and
becomes the opening frame of the clip. Returns the `task_id` for polling.

## Instructions

1. Parse `$ARGUMENTS`: the first token is the `first_frame_image`; any remaining
   text is an optional `prompt` describing the motion.
2. Choose the endpoint host by region:
   - `global` (default): `https://api.minimax.io/v1/video_generation`
   - `cn`: `https://api.minimaxi.com/v1/video_generation`
3. Authenticate with a Bearer token from the `MINIMAX_API_KEY` environment variable.
4. Default `model` to `MiniMax-Hailuo-2.3`. Other accepted models: `MiniMax-Hailuo-2.3-Fast`,
   `MiniMax-Hailuo-02`, `I2V-01-Director`, `I2V-01-live`, `I2V-01`.
5. `model` and `first_frame_image` are required. Optional fields: `prompt`,
   `prompt_optimizer`, `fast_pretreatment`, `duration`, `resolution`, `callback_url`.
6. POST the request, then report the `task_id` (check `base_resp.status_code == 0`).

## Request

```bash
# region=global -> https://api.minimax.io ; region=cn -> https://api.minimaxi.com
curl -sS -X POST "https://api.minimax.io/v1/video_generation" \
  -H "Authorization: Bearer $MINIMAX_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "MiniMax-Hailuo-2.3",
    "first_frame_image": "https://example.com/first-frame.jpg",
    "prompt": "Slow push-in as the character turns toward the camera",
    "prompt_optimizer": true,
    "duration": 6,
    "resolution": "1080P"
  }'
```

## Response

```json
{
  "task_id": "176843928495987",
  "base_resp": { "status_code": 0, "status_msg": "success" }
}
```

Pass the returned `task_id` to `/minimax-video:query-video`.
