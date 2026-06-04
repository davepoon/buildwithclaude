---
description: Open the Build with Claude contribution guide for writing a community story
category: miscellaneous
---

# Share Your Story

Walks you through contributing a community story to [buildwithclaude.com/stories](https://buildwithclaude.com/stories).

## Description

A community story on Build with Claude is a short post about something you built — a plugin, a skill, a hook, a subagent, a command, or an MCP server — and what you learned shipping it. Posts live as markdown files in the repo and ship automatically on merge.

## Usage

`share-your-story`

## What this command does

Run this command to get the canonical instructions for writing a story:

1. **File location**: create your post at `stories/<your-slug>/index.md` at the repo root. The folder name becomes your URL — `/stories/<your-slug>` — and must match the `slug` field in your frontmatter exactly. Allowed characters: lowercase letters, numbers, dashes, underscores; up to 80 characters. Optionally drop a `cover.png` (or `.jpg` / `.webp` / `.svg`) next to `index.md` to override the default palette wallpaper.

2. **Frontmatter**: every story needs `slug`, `title`, `excerpt`, `author` (name + handle + avatarHue), `target` (the plugin/skill/etc. you're writing about), `category` (Plugins / Skills / Subagents / Commands / Hooks), `platforms`, `cover` (brown / blue / green / purple — used as fallback wallpaper), `date`, and `readTime`. Optional fields: `featured: true` makes you eligible for the homepage strip, `pinned: true` puts you in the editor's-pick slot at the top of `/stories`, `pullQuote: "…"` renders an italic blockquote after paragraph 2, `coverAlt: "…"` sets the alt text for your cover image.

3. **Body**: 3–5 short paragraphs is the sweet spot. The article view auto-renders a drop cap on paragraph 1; if you set `pullQuote` in frontmatter, it renders as an italic blockquote after paragraph 2.

4. **Preview locally**: `cd web-ui && npm run dev`, then visit `http://localhost:3000/stories/<your-slug>`.

5. **PR flow**:
   ```bash
   gh repo fork davepoon/buildwithclaude --clone
   git checkout -b story/<your-slug>
   # write your story
   npm test
   git commit -m "story: add <your-slug>"
   gh pr create --title "story: <your headline>"
   ```

6. **After merge**: production rebuilds in ~2 minutes and your story is live at `buildwithclaude.com/stories/<your-slug>`.

## Where to read more

- **Copy-pasteable template + field reference**: <https://buildwithclaude.com/contribute#stories>
- **Existing stories for inspiration**: <https://buildwithclaude.com/stories>

## Tips

- Be specific: a real plugin, not a roundup.
- Be honest: what went wrong is usually more interesting than what worked.
- Be short: 3–5 paragraphs beats a 2000-word essay.
- End with something a reader can do — a link, an invitation, an open question.
