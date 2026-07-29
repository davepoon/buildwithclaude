---
description: Poll a MiniMax video-generation task by task id and report its status and file id.
category: integration-sync
argument-hint: <task_id> [--region global|cn]
allowed-tools: Bash
---

# Query Video Generation (MiniMax-Hailuo)

Check the status of a previously submitted video-generation task. When the task
finishes, the response carries the `file_id` needed to download the video.

## Instructions

1. Read the `task_id` from `$ARGUMENTS` (required).
2. Choose the endpoint host by region:
   - `global` (default): `https://api.minimax.io/v1/query/video_generation`
   - `cn`: `https://api.minimaxi.com/v1/query/video_generation`
3. Authenticate with a Bearer token from the `MINIMAX_API_KEY` environment variable.
4. Send a GET request with the `task_id` query parameter.
5. Report `status`; when it indicates success, surface the `file_id` and hand it to
   `/minimax-video:download-video`. Also check `base_resp.status_code == 0`.

## Request

```bash
# region=global -> https://api.minimax.io ; region=cn -> https://api.minimaxi.com
curl -sS -G "https://api.minimax.io/v1/query/video_generation" \
  -H "Authorization: Bearer $MINIMAX_API_KEY" \
  --data-urlencode "task_id=176843928495123"
```

## Response

```json
{
  "task_id": "176843928495123",
  "status": "Success",
  "file_id": "205258526306433",
  "base_resp": { "status_code": 0, "status_msg": "success" }
}
```

Pass the returned `file_id` to `/minimax-video:download-video`.
