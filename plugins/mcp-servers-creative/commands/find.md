---
description: Search 1,300+ curated AI image prompts for inspiration
category: design-experience
argument-hint: <keywords>
---

# Quick Find

Search the curated gallery for inspiration.

1. Call search_gallery with query: `$ARGUMENTS`
   - If no arguments, call with no query for trending picks
   - Use limit: 6 for a good visual spread
2. Display results as a compact numbered list with preview images
3. End with: "Say a number to see the full prompt, or describe what you want to generate."

If the user picks a number, call get_inspiration with that entry's ID.
