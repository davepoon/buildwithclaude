---
description: Download an H3 result URL or resolve a v1 file id and save the video.
category: integration-sync
argument-hint: <file_id_or_url> [output_path] [--region global|cn]
allowed-tools: Bash
---

# Download Video

Download a finished video from either the time-limited `task.content.url`
returned by the H3 query command or the `file_id` returned by the v1 query
command.

## Instructions

1. Read the required `file_id_or_url` from `$ARGUMENTS`; an optional
   second token is the output path (default `./minimax-video.mp4`).
2. If the value starts with `http://` or `https://`, download it
   directly with `curl -fsSL -L`. Do not send the API key to the result URL.
   H3 result URLs are time-limited, so download promptly and query again if one
   has expired.
3. Otherwise, treat the value as a v1 `file_id` and choose the endpoint host:
   - `global` (default): `https://api.minimax.io/v1/files/retrieve`
   - `cn`: `https://api.minimaxi.com/v1/files/retrieve`
4. For a v1 file id, authenticate with a Bearer token from
   `MINIMAX_API_KEY`, GET the metadata using the `file_id` query
   parameter, and check `base_resp.status_code == 0`.
5. Read `file.download_url` from the v1 metadata response and download it
   without forwarding the API key.

## Request

For an H3 result URL:

~~~bash
curl -fsSL -L -o "./minimax-video.mp4" "$RESULT_URL"
~~~

For a v1 file id:

```bash
# region=global -> https://api.minimax.io ; region=cn -> https://api.minimaxi.com
curl -sS -G "https://api.minimax.io/v1/files/retrieve" \
  -H "Authorization: Bearer $MINIMAX_API_KEY" \
  --data-urlencode "file_id=205258526306433"

# then download the resolved URL
curl -sS -L -o "./minimax-video.mp4" "<file.download_url from the response above>"
```

## Response

```json
{
  "file": {
    "file_id": "205258526306433",
    "download_url": "https://cdn.minimax.io/.../output.mp4"
  },
  "base_resp": { "status_code": 0, "status_msg": "success" }
}
```
