---
name: atlas-cloud-media
category: media-content
description: Discover Atlas Cloud image and video models, inspect their live schemas, and submit one confirmed media generation request with bounded GET polling. Use when integrating Atlas Cloud media APIs or generating images and videos without hard-coding stale model parameters.
allowed-tools: Bash(python3 *)
---

# Atlas Cloud Media

Use the bundled scripts/atlas_media.py CLI to discover current Atlas Cloud
models, inspect a model's live request schema, and run asynchronous image or
video generation.

## When to Use This Skill

- The user wants to find an available Atlas Cloud image or video model.
- An integration needs the current model ID, input fields, endpoint, or price.
- The user wants one explicitly confirmed media generation request.
- An asynchronous Atlas Cloud task needs bounded status polling.

## Setup

Set the API key in the environment. Never pass it as a CLI argument or commit it
to a repository.

~~~bash
export ATLASCLOUD_API_KEY="your-api-key"
~~~

ATLASCLOUD_BASE_URL may point to a compatible deployment. It defaults to
https://api.atlascloud.ai.

## Workflow

### 1. Discover current models

~~~bash
python3 scripts/atlas_media.py models --type Image --query flux
python3 scripts/atlas_media.py models --type Video --query seedance
~~~

Treat model availability and prices as live data. Run discovery immediately
before choosing a model.

### 2. Inspect the exact schema

~~~bash
python3 scripts/atlas_media.py describe black-forest-labs/flux-schnell
~~~

The command resolves the model's current schema URL and reports the required
fields, property definitions, submission endpoint, result endpoint, and catalog
price data. Build the payload from this output instead of copying an old
example.

### 3. Prepare parameters in a file

~~~json
{
  "prompt": "A clean product photograph on a neutral background",
  "size": "1024*1024",
  "num_images": 1
}
~~~

Do not include model; the CLI inserts the selected model ID after validation.

### 4. Confirm cost and generate once

~~~bash
python3 scripts/atlas_media.py generate \
  black-forest-labs/flux-schnell \
  --params-file request.json \
  --confirm-paid
~~~

The --confirm-paid flag is mandatory. The CLI sends exactly one generation POST
and does not retry it. It polls only the schema-defined GET result endpoint,
with a fixed interval and maximum poll count.

Use stdin when a temporary file is unnecessary:

~~~bash
printf '%s' '{"prompt":"A geometric app icon"}' | \
  python3 scripts/atlas_media.py generate \
    black-forest-labs/flux-schnell \
    --params-file - \
    --confirm-paid
~~~

## Safety Rules

- Keep ATLASCLOUD_API_KEY server-side and out of logs, prompts, screenshots,
  browser code, mobile apps, and committed files.
- Never retry a generation POST automatically. If submission fails, report the
  error and require a new explicit confirmation before another paid request.
- Poll only with GET and stop at --max-polls.
- Validate the live schema again when changing models.
- Download returned media URLs before they expire when persistent storage is
  required.
- Require human review for sensitive, regulated, or high-impact content.

## Output

Commands write structured JSON to stdout. Successful generation output includes
the prediction ID, final status, generated URLs, model ID, and the endpoints
resolved from the live schema.
