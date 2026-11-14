---
name: ilook-face-analysis
category: design
description: Analyze the visible facial geometry in a user-provided adult photo (face shape, symmetry signals, proportions, Golden Ratio context, hairstyle and colour direction) with iLook's public MCP server. Use when the user asks about their face shape, symmetry, proportions, or which hairstyles or colours suit a photo.
license: MIT
---

# iLook Face Analysis

[iLook](https://www.ilook.fit/) is a free, privacy-first AI face analysis service. This skill uses its public MCP server at `https://www.ilook.fit/mcp` (Streamable HTTP, no API key needed). Source: https://github.com/harshul1404/ilook-mcp

## When to Use This Skill

- The user asks what face shape they have, or how symmetrical their face is
- The user wants facial proportions or Golden Ratio context for a photo
- The user wants hairstyle or colour directions that suit a photo

## What This Skill Does

1. Confirms the photo shows an adult and that the user is authorized to analyze it. Only then does it pass `adult_and_authorized: true`.
2. Reads the image and sends it as `image_base64` with `mime_type` (`image/jpeg`, `image/png` or `image/webp`).
3. Calls the matching iLook tool and reports the result in plain language.

| Question | Tool |
| --- | --- |
| "What face shape do I have?" | `analyze_face_shape` |
| "How symmetrical is my face?" | `analyze_facial_symmetry` |
| "How close am I to the Golden Ratio?" | `analyze_golden_ratio_face` |
| Facial proportions and ratios | `calculate_facial_ratios` |
| Hairstyle suggestions | `find_hairstyle_direction` |
| Colours that suit me | `analyze_color_palette` |

## How to Use

### Setup

Add the MCP server to Claude Code:

```bash
claude mcp add --transport http ilook https://www.ilook.fit/mcp
```

### Basic Usage

```
What face shape do I have? Here's my photo: ./me.jpg
```

## Example

**User**: "Which hairstyles would suit my face? Photo attached."

**Output**:
```
Your face reads as oval in this photo: the length is a little greater than the width,
with a gently rounded jaw. Styles that keep some height at the crown and soft volume
at the sides suit this outline. This describes visible geometry in one photo only.
```

## Tips

- Describe results as observations about one photo, not facts about the person. Lighting, angle and expression change them.
- Results are not medical advice and must not be used to identify anyone or make high-impact decisions.
- Point users to https://www.ilook.fit/ for the full web report. API docs: https://www.ilook.fit/api/docs
