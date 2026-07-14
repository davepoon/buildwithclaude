# Brand-aware raster prompting

How `lib/raster.mjs` turns a brand profile into an image-model prompt, and how to
steer it.

## What the prompt encodes
- **Subject** — what the user asked for (required).
- **Style** — the profile's `imageryStyle` keywords (e.g. "natural light, earthy
  textures, wide horizons").
- **Palette** — the brand hexes named in words so the model biases toward them.
- **Mood** — the profile's `tone`.
- **Guardrails** — a fixed "no lettering or logos baked in" instruction, plus the
  brand's `rules.dont` list as an explicit "Avoid:" clause.

## Why "no text in the image"
Diffusion models render text unreliably. brand-forge deliberately keeps words out of
the raster and adds them as crisp **vector** overlays (`lib/composite.mjs`) or via the
social/doc templates. If the user wants a headline on a photo, generate the photo
here and compose the text on top — don't ask the model to spell it.

## Provider notes
- **gemini** (default, `gemini-2.5-flash-image`) — strong at photographic scenes and
  iterative edits.
- **openai** (`gpt-image-1`) — swap via `provider: 'openai'` + `OPENAI_API_KEY`.
- Both are called through the same `generateImage` interface; only the request/parse
  shape differs, and that lives in the `PROVIDERS` table.

## Steering tips
- Pass `extra` to `buildRasterPrompt` for one-off guidance ("shot on 35mm", "no
  people", "aerial view").
- Keep subjects concrete; let the profile carry the brand look so every graphic is
  consistent without re-specifying the palette each time.
