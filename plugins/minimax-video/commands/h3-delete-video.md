---
description: Cancel a queued MiniMax-H3 task or delete a terminal task record.
category: integration-sync
argument-hint: <task_id> [--region global|cn]
allowed-tools: Bash
---

# Delete H3 Video Task

Cancel or delete one MiniMax-H3 v2 task by its <code>task_id</code>.

## Instructions

1. Read the required <code>task_id</code> from <code>$ARGUMENTS</code> and select
   the host from <code>--region</code>: global uses https://api.minimax.io; cn
   uses https://api.minimaxi.com.
2. Send an authenticated DELETE request to /v2/video_generation/{task_id}.
3. A queued task is cancelled. A succeeded, failed, or expired task record is
   deleted. Requests for running or cancelled tasks are rejected by the API;
   report that response without retrying a different operation.
4. Report <code>task_id</code>, <code>action</code>, and the resulting
   <code>status</code> from the response.

## Request

~~~bash
# Set BASE_URL from --region before running this request.
curl -fsS -X DELETE "$BASE_URL/v2/video_generation/$TASK_ID" \
  -H "Authorization: Bearer $MINIMAX_API_KEY"
~~~

## Response

~~~json
{
  "task_id": "424010985738629",
  "action": "cancel",
  "status": "cancelled"
}
~~~
