---
description: Retrieve the download URL for a finished MiniMax video by file id and save the file.
category: integration-sync
argument-hint: <file_id> [output_path] [--region global|cn]
allowed-tools: Bash
---

# Download Video (MiniMax-Hailuo)

Resolve a finished video's `file_id` (returned by `/minimax-video:query-video`) into
a download URL and save the file locally.

## Instructions

1. Read the `file_id` from `$ARGUMENTS` (required); an optional second token is the
   output path (default `./minimax-video.mp4`).
2. Choose the endpoint host by region:
   - `global` (default): `https://api.minimax.io/v1/files/retrieve`
   - `cn`: `https://api.minimaxi.com/v1/files/retrieve`
3. Authenticate with a Bearer token from the `MINIMAX_API_KEY` environment variable.
4. GET the file metadata with the `file_id` query parameter, read the download URL
   from `file.download_url`, then fetch that URL to the output path.
5. Check `base_resp.status_code == 0` before downloading.

## Request

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
