---
name: kavel-image-studio
category: media-content
description: Turn a photo into a specific AI look (new hairstyle, collectible figurine, royal pet portrait, wedding photo, 90s yearbook, sticker, HD restore) or a photo into a dance video, using Kavel (www.kavel.ai). Use when the user wants to restyle/transform a photo, asks "how do I make an AI X from my photo", or wants a photorealistic image edit that keeps the same face. Gives the right tool, a model-tuned prompt, and the generate link.
---

# Kavel Image Studio

Help the user get a specific AI photo/video effect from [Kavel](https://www.kavel.ai). Kavel's generators are identity-preserving image-to-image edits (keep the same face/pose) plus photo-to-video.

## How to use this skill

1. **Match the goal to a tool** from the catalog below (or browse `https://www.kavel.ai`).
2. **Give the tuned prompt.** Start from the tool's recipe and weave in the user's specifics.
3. **Hand off the link.** Give the tool URL and tell the user to upload their photo and generate. Free-tier models let them generate without paying.

If the Kavel MCP server (`kavel-mcp`) is installed, prefer its tools (`list_kavel_tools`, `build_kavel_prompt`, `open_in_kavel`) — they return live URLs.

## Tool catalog

All tools keep the same face/subject. Most need one clear, well-lit photo.

| Goal | Tool | URL |
|---|---|---|
| New hairstyle | AI Hairstyle Changer | https://www.kavel.ai/image/ai-hairstyle-changer |
| Change outfit | AI Outfit Generator | https://www.kavel.ai/image/ai-outfit-generator |
| Collectible figurine | AI Figurine Generator | https://www.kavel.ai/image/ai-figurine-generator |
| Polished selfie | AI Selfie Generator | https://www.kavel.ai/image/ai-selfie-generator |
| Athletic build | AI Muscle Generator | https://www.kavel.ai/image/ai-muscle-generator |
| Die-cut sticker | AI Sticker Generator | https://www.kavel.ai/image/ai-sticker-generator |
| Retro instant print | AI Polaroid Generator | https://www.kavel.ai/image/ai-polaroid-generator |
| Royal pet painting | AI Pet Portrait Generator | https://www.kavel.ai/image/ai-pet-portrait-generator |
| 90s class portrait | 90s Yearbook Photos | https://www.kavel.ai/image/90s-yearbook-photos |
| Wedding portrait | AI Wedding Photo Generator | https://www.kavel.ai/image/ai-wedding-photo-generator |
| Holiday card | AI Christmas Card Generator | https://www.kavel.ai/image/ai-christmas-card-generator |
| Cinematic birthday | AI Birthday Photoshoot Generator | https://www.kavel.ai/image/ai-birthday-photoshoot-generator |
| Sharpen a blurry photo | HD Photo Converter | https://www.kavel.ai/image/hd-photo-converter |
| Photo → dance video | AI Dance Video Generator | https://www.kavel.ai/video/ai-dance-video-generator |

## Prompt recipes

Give the base recipe, then append the user's details.

- **Figurine:** "Turn the person into a cute collectible vinyl designer figurine on a small round display base, glossy finish, keeping the same face and pose. Studio product-shot lighting, photorealistic render."
- **Pet portrait:** "Turn the animal into a majestic Renaissance royal oil painting — ornate red velvet coat with gold embroidery and a lace collar, dramatic lighting, gilded frame. Keep the same breed, face, and pose."
- **Wedding:** "Elegant wedding photograph of the same couple — white lace gown with a bouquet and a fitted black tuxedo, sunlit venue with a floral arch and golden-hour bokeh. Keep both faces and the pose."
- **90s yearbook:** "Cheesy 1990s high-school yearbook portrait — mottled blue laser backdrop, soft-focus glow, feathered nineties hair, faded scanned-print colour. Keep the same face."
- **HD restore:** "Restore and upscale into a crisp HD picture — remove blur, noise, and compression artefacts, recover sharp texture and clean edges, correct washed-out colour. Keep the exact same person, pose, and background."

Recipe rule: always keep the same face/subject, describe style + lighting concretely, and end with "photorealistic" for realistic looks.

## Guardrails

- Only edit photos the user has rights to. Decline realistic edits of identifiable people without consent, and any sexual, deceptive, or defamatory use.
- Don't promise exact output quality — results vary by input photo.
