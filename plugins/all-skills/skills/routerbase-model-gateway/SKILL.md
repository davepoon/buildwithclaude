---
name: routerbase-model-gateway
category: ai-ml
description: Integrate and route AI model requests through RouterBase. Use when migrating OpenAI-compatible clients, choosing model IDs, configuring fallbacks, or building chat, image, video, audio, speech, and embedding workflows.
---

# RouterBase Model Gateway

Use [routerbase](https://routerbase.com/) as an OpenAI-compatible model gateway for chat, image, video, audio, speech, and embedding workloads. This skill helps agents migrate existing SDK clients, keep credentials private, choose model IDs, and document safe fallback behavior.

## When to Use This Skill

- The user wants to migrate an OpenAI SDK or OpenAI-compatible integration to RouterBase.
- The user needs a model routing plan across cost, latency, quality, context length, streaming, tool calling, JSON mode, or vision requirements.
- The user is adding chat, image, video, audio, speech, or embedding calls to an application.
- The user is debugging RouterBase auth, endpoint, model ID, streaming, media, or payload issues.
- The user needs documentation or a smoke-test checklist for a RouterBase integration.

## What This Skill Does

1. Detects the target stack and where the AI provider client should live.
2. Configures the base URL as `https://routerbase.com/v1`.
3. Uses `ROUTERBASE_API_KEY` as a server-side secret.
4. Preserves OpenAI-compatible request shapes unless a selected model requires a specific option.
5. Produces a primary and fallback model plan with validation steps.
6. Separates synchronous chat/image flows from asynchronous video or audio jobs.

## How to Use

### Basic Usage

```
Use routerbase-model-gateway to migrate this OpenAI chat integration to RouterBase.
```

```
Use routerbase-model-gateway to design a fallback model plan for low-latency support chat.
```

```
Use routerbase-model-gateway to add image and video generation with safe polling and storage.
```

## Integration Pattern

Prefer the user's existing OpenAI-compatible SDK. Change the base URL, store the API key in environment configuration, and keep request payloads standard.

```js
import OpenAI from "openai";

const client = new OpenAI({
  apiKey: process.env.ROUTERBASE_API_KEY,
  baseURL: process.env.ROUTERBASE_BASE_URL || "https://routerbase.com/v1",
});

const response = await client.chat.completions.create({
  model: "google/gemini-2.5-flash",
  messages: [{ role: "user", content: "Write one sentence about model routing." }],
});
```

## Routing Plan Format

When recommending models, return a table like this:

```markdown
| Use case | Primary model | Fallback model | Reason | Validation |
| --- | --- | --- | --- | --- |
| Support chat | model-id | model-id | Low latency and tool support | Run fixture prompts and compare output shape |
```

Treat model IDs, pricing, and availability as live data. If a live catalog check is not possible, mark examples clearly and tell the user what must be verified before production.

## Debug Checklist

- Authentication: missing `ROUTERBASE_API_KEY`, wrong environment, or server-side secret not loaded.
- Endpoint: missing `/v1`, wrong media endpoint, or client still pointing at another provider.
- Model ID: unavailable, misspelled, disabled for the account, or unsupported for the requested modality.
- Request shape: unsupported field, invalid content part, invalid tool schema, or model-specific parameter mismatch.
- Streaming: client does not consume Server-Sent Events or SDK chunks correctly.
- JSON mode: missing `response_format` or no downstream schema validation.
- Async media: task ID not persisted, polling has no timeout, or generated media is not stored before temporary URLs expire.

## Guardrails

- Never paste, infer, print, or log real API keys.
- Never put RouterBase keys in browser code, mobile apps, screenshots, or public repositories.
- Do not retry authentication, invalid model, validation, or policy errors blindly.
- Do not claim example model IDs, pricing, or availability are permanent facts.
- Validate model-specific support for streaming, tool calling, JSON mode, vision, context length, media size, and async behavior.
- Require human review for high-impact medical, legal, financial, safety, security, or compliance use cases.

## Output

Return:

1. The target endpoint or base URL.
2. Required environment variables.
3. Files to change or create.
4. A minimal request example.
5. A model routing table.
6. Fallback and retry behavior.
7. Validation or smoke-test steps.
8. Remaining assumptions that must be checked against live RouterBase docs or account access.
