---
description: List and filter recent MiniMax-H3 video-generation tasks.
category: integration-sync
argument-hint: "[--page-num N] [--page-size N] [filters] [--region global|cn]"
allowed-tools: Bash
---

# List H3 Videos

List MiniMax-H3 v2 tasks from the recent task window and apply any filters the
user provides.

## Supported options

- <code>--page-num N</code> and <code>--page-size N</code> control pagination.
  Page numbers start at 1.
- <code>--status</code> accepts queued, running, succeeded, failed, cancelled, or
  expired.
- <code>--task-id ID</code> may be repeated and maps to
  <code>filter.task_ids</code>.
- <code>--model MiniMax-H3</code> maps to <code>filter.model</code>.
- <code>--task-type TYPE</code> maps to <code>filter.task_type</code>.
- <code>--region global|cn</code> selects https://api.minimax.io or
  https://api.minimaxi.com.

Use <code>--data-urlencode</code> for every supplied filter. Do not include empty
filters. The API only lists tasks from its recent task window; report
<code>items</code> and <code>total</code> from the response.

## Request

~~~bash
# Set BASE_URL from --region before running this request.
curl -fsS -G "$BASE_URL/v2/query/video_generation" \
  -H "Authorization: Bearer $MINIMAX_API_KEY" \
  --data-urlencode "page_num=1" \
  --data-urlencode "page_size=20" \
  --data-urlencode "filter.model=MiniMax-H3" \
  --data-urlencode "filter.status=succeeded"
~~~

For repeated task ids, send one <code>filter.task_ids</code> parameter per id.
Report each matching task's id, status, duration, resolution, ratio, usage, task
type, modality, and result URL when present.

## Response

~~~json
{
  "items": [
    {
      "id": "424010985738629",
      "model": "MiniMax-H3",
      "status": "succeeded",
      "content": { "url": "https://example.com/video.mp4" },
      "resolution": "2K",
      "duration": 5,
      "ratio": "16:9"
    }
  ],
  "total": 1
}
~~~
