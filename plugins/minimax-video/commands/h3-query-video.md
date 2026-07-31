---
description: Query a MiniMax-H3 video task and report its status and result URL.
category: integration-sync
argument-hint: <task_id> [--region global|cn]
allowed-tools: Bash
---

# Query H3 Video

Query one MiniMax-H3 v2 task by its <code>task_id</code> and report the task
state, output metadata, usage, and result URL when available.

## Instructions

1. Read the required <code>task_id</code> from <code>$ARGUMENTS</code> and select
   the host from <code>--region</code>: global uses https://api.minimax.io; cn
   uses https://api.minimaxi.com.
2. Send an authenticated GET request to
   /v2/query/video_generation/{task_id}. The task id is a path segment, not a
   query parameter.
3. Report <code>task.id</code>, <code>task.model</code>,
   <code>task.status</code>, <code>task.error</code> when present,
   <code>task.resolution</code>, <code>task.duration</code>,
   <code>task.ratio</code>, <code>task.task_type</code>, and the
   <code>task.modality</code> and <code>task.usage</code> fields when present.
4. When <code>task.status</code> is succeeded, extract
   <code>task.content.url</code> and pass that time-limited URL to
   /minimax-video:download-video. Download it promptly; query again when the URL
   has expired.
5. Treat queued, running, failed, cancelled, and expired as distinct states. Do
   not report a task as complete unless its status is succeeded.

## Request

~~~bash
# Set BASE_URL from --region before running this request.
curl -fsS "$BASE_URL/v2/query/video_generation/$TASK_ID" \
  -H "Authorization: Bearer $MINIMAX_API_KEY"
~~~

## Response

~~~json
{
  "task": {
    "id": "424010985738629",
    "model": "MiniMax-H3",
    "status": "succeeded",
    "content": { "url": "https://example.com/video.mp4" },
    "resolution": "2K",
    "duration": 5,
    "usage": {
      "total_seconds": 5,
      "input_seconds": 0,
      "output_seconds": 5,
      "image_count": 0
    },
    "ratio": "16:9",
    "task_type": "generation"
  }
}
~~~
