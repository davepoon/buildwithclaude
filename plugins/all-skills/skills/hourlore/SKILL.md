---
name: hourlore
description: Research a history, mystery or business topic into a free 8–12 shot documentary storyboard preview, or render a full 5–15 minute narrated 1080p MP4 documentary with Wikimedia Commons archival photos, map animations and word-by-word captions on Hourlore. Use when the user wants to plan or produce long-form 16:9 faceless documentaries.
category: media-content
license: MIT
---

# Hourlore: narrated 5–15 minute documentary maker

Hourlore (`https://hourlore.com`) turns a single topic line into a researched, narrated 16:9 (1080p) documentary using Wikimedia Commons archival images (public domain, CC0, CC BY, CC BY-SA), animated map flights, number counter cards and word-by-word captions.

## Before you start

- Require an API key from `https://hourlore.com/account` stored in the user's `HOURLORE_API_KEY` environment variable (`hl_...`). Never ask the user to hardcode keys into source files.
- **Preview first, ask before spending credits:**
  - `create_storyboard_preview` is **free** (up to 10 previews/day per account) and returns 8–12 opening shots in ~25 seconds.
  - `create_documentary_film` holds **25 credits (5 min)**, **50 credits (10 min)**, or **75 credits (15 min)** (`5 credits = 1 minute`). Always confirm the topic, duration (`5`, `10` or `15` minutes) and narrator (`olivia` female or `owen` male) with the user before queuing a full render.
- Keep the returned `description_text` alongside any published video so Creative Commons attributions (`CC BY` / `CC BY-SA`) are preserved.

## With the MCP tools (`https://hourlore.com/mcp`)

1. Call `create_storyboard_preview` (`topic`, optional `notes`) to test the angle and show the user the opening narration and archive shots.
2. Check balance with `get_credits` if needed.
3. Once approved, call `create_documentary_film` (`topic`, `minutes`: `5 | 10 | 15`, `voice`: `olivia | owen`, optional `notes`, optional `idempotency_key`).
4. Full renders take roughly 1× the film length (~10–20 minutes). Poll `get_documentary_film` (`film_id`, optional `wait_seconds` up to 50) until `status === "completed"`, then give the user `download_url` (valid 1 hour; call `get_documentary_film` again anytime within 30 days for a fresh link) and `description_text`.
5. If the user changes their mind right after queuing, call `cancel_documentary_film` (`film_id`) while `cancelable` is `true` to refund held credits.

## Without MCP (HTTP API)

Base URL: `https://hourlore.com/api/v1` with `Authorization: Bearer $HOURLORE_API_KEY`:

- `POST /api/v1/previews` — `{ "topic": "...", "notes": "..." }`
- `POST /api/v1/films` — `{ "topic": "...", "minutes": 10, "voice": "owen", "notes": "..." }` (optional `Idempotency-Key` header)
- `GET /api/v1/films/:id` — status, `download_url` and `description_text`
- `DELETE /api/v1/films/:id` — cancel queued job and release held credits
- `GET /api/v1/credits` — `{ credits, held, credits_per_minute: 5 }`
