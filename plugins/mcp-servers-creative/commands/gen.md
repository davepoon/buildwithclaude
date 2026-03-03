---
description: Quick image generation — skip conversation, go straight to image
category: design-experience
argument-hint: <prompt>
---

# Quick Generate

Generate an image immediately from the user's description.

1. Look at the user's prompt: `$ARGUMENTS`
2. If the prompt is very short (under 10 words), call enhance_prompt first
3. If already detailed (10+ words), use it directly
4. Delegate to the image-generator agent
5. Show a brief one-line creative comment about the generation

Do NOT ask for confirmation, suggest alternatives, or give lengthy explanations.
