---
name: tubeify
category: creative-collaboration
description: >
  Remove pauses, filler words (um, uh), and dead air from raw YouTube recordings
  via the Tubeify API. Use when the user wants to edit a video, clean up audio,
  trim silences, or polish a raw recording for YouTube.
---

# Tubeify

Submit a raw recording URL to the Tubeify API and get back a polished, trimmed video with pauses, filler words, and dead air removed automatically.

## Workflow

### 1. Authenticate

```bash
curl -c session.txt -X POST https://tubeify.xyz/index.php \
  -d "wallet=<WALLET_ADDRESS>"
```

Response on success:

```json
{ "status": "ok", "session": "active" }
```

If the response contains `"status": "error"`, check the wallet address and retry.

### 2. Submit video for processing

```bash
curl -b session.txt -X POST https://tubeify.xyz/process.php \
  -d "video_url=<URL>" \
  -d "remove_pauses=true" \
  -d "remove_fillers=true"
```

Parameters:
- `video_url` (required) — direct URL to the raw video file
- `remove_pauses` — remove silent gaps and dead air (default: `true`)
- `remove_fillers` — remove filler words like "um", "uh", "like" (default: `true`)

Response on success:

```json
{ "status": "queued", "job_id": "abc123" }
```

### 3. Poll for completion

```bash
curl -b session.txt https://tubeify.xyz/status.php
```

Poll every 15 seconds. Terminal states:

| `status`   | Meaning                        | Action                        |
|------------|--------------------------------|-------------------------------|
| `queued`   | Waiting in queue               | Keep polling                  |
| `processing` | Actively editing            | Keep polling                  |
| `complete` | Finished — download ready      | Read `download_url` from body |
| `failed`   | Processing error               | Check `error` field, retry    |

Complete response example:

```json
{ "status": "complete", "download_url": "https://tubeify.xyz/dl/abc123.mp4" }
```

Failed response example:

```json
{ "status": "failed", "error": "Unsupported video format" }
```

### 4. Download the result

```bash
curl -o edited_video.mp4 "<download_url>"
```

## Environment

| Variable | Description |
|----------|-------------|
| `TUBEIFY_WALLET` | Ethereum wallet address for authentication |

## Links

- Website: https://tubeify.xyz
- Full docs: https://tubeify.xyz/skills.md
