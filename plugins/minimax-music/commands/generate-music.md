---
description: Generate MiniMax music from a prompt or lyrics and save the returned audio.
category: integration-sync
argument-hint: <prompt> [--lyrics text] [--model music-3.0] [--format mp3|wav|pcm] [--response url|hex] [--instrumental] [--region global|cn] [--output path]
allowed-tools: Bash
---

# Generate Music (MiniMax)

Generate music synchronously and save the resulting audio.

## Instructions

1. Parse `$ARGUMENTS`. Use the free text as `prompt`; accept optional `--lyrics`,
   `--model`, `--format`, `--response`, `--instrumental`, `--region`, and
   `--output` values.
2. Select the endpoint from `--region`:
   - `global` (default): `https://api.minimax.io/v1/music_generation`
   - `cn`: `https://api.minimaxi.com/v1/music_generation`
3. Read the Bearer token from `MINIMAX_API_KEY`. Never print the token.
4. Default `model` to `music-3.0`. Accepted generation models are `music-3.0`,
   `music-2.6`, `music-3.0-free`, and `music-2.6-free`.
5. Build an application/json request with `model`, `prompt`, `lyrics`, `stream:
   false`, `output_format`, `audio_setting`, `lyrics_optimizer`, and
   `is_instrumental`. The audio format may be `mp3`, `wav`, or `pcm`. For the
   China endpoint, include `aigc_watermark` only when explicitly requested.
6. POST the request and check `base_resp.status_code == 0`.
7. Read `data.status`: `1` means processing and `2` means completed. Because the
   API is synchronous, report a non-completed response instead of polling a
   separate endpoint.
8. On completion, read `data.audio`. For `output_format: url`, download the URL
   promptly because it expires after 24 hours. For `output_format: hex`, decode
   it with `xxd -r -p` into the requested output path.

## Request

```bash
# region=global -> api.minimax.io; region=cn -> api.minimaxi.com
curl -sS -X POST "https://api.minimax.io/v1/music_generation" \
  -H "Authorization: Bearer $MINIMAX_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "music-3.0",
    "prompt": "Warm cinematic strings that build toward a hopeful finale",
    "lyrics": "",
    "stream": false,
    "output_format": "url",
    "audio_setting": { "format": "mp3" },
    "lyrics_optimizer": true,
    "is_instrumental": true
  }'
```

## Response

```json
{
  "data": {
    "status": 2,
    "audio": "https://example.invalid/generated-music.mp3"
  },
  "base_resp": { "status_code": 0, "status_msg": "success" }
}
```
