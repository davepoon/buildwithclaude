---
slug: how-to-share-your-story
title: How to share your story on Build with Claude
excerpt: A short walkthrough, from forking the repo to seeing your post live on the homepage strip. Written by someone who just did it for the first time.
author:
  name: BuildWithClaude
  handle: buildwithclaude
  avatarHue: 18
  url: https://www.buildwithclaude.com
  social: https://github.com/davepoon/buildwithclaude
target:
  name: share-your-story
  kind: command
  href: /command/share-your-story
category: Commands
platforms:
  - Claude Code
  - Claude Desktop
  - Agent SDK
cover: brown
coverAlt: A laptop, a mug, and a notebook on a wooden desk
date: May 27, 2026
readTime: 5
featured: true
pinned: false
pullQuote: Stories live in one folder, and the folder name is the URL.
---

Writing for Build with Claude is the same flow as shipping any other plugin here. You fork [the repo](https://github.com/davepoon/buildwithclaude), drop a folder in `stories/`, and open a PR. If you have contributed a [hook](/hooks) or a [subagent](/subagents) before, this will feel familiar, and if you have not, the file you are about to write is shorter than this article.

## One folder, one file

Stories live in `stories/<your-slug>/index.md`, with an optional cover image next to it. The folder name becomes your URL, so `stories/building-my-first-skill/index.md` lands at `/stories/building-my-first-skill`. The slug and the folder name have to match exactly, and the slug only takes lowercase letters, numbers, dashes, and underscores. The loader enforces that, so a typo quietly sends your post to a 404 instead of the homepage.

The frontmatter is where the [card and the article](/stories) get their shape. Here is the whole template:

```yaml
---
slug: my-first-skill
title: How a skill replaced my onboarding doc
excerpt: One sentence that earns the click.
author:
  name: Your Name
  handle: yourhandle
  avatarHue: 200
  url: https://your-site.com         # optional, links your name
  social: https://x.com/yourhandle   # optional, links your @handle
target:
  name: my-skill
  kind: skill              # skill, plugin, hook, subagent, command, mcp-server
  href: /skill/my-skill    # a real detail page on this site
category: Skills
platforms:
  - Claude Code
cover: blue                # brown, blue, green, purple (fallback wallpaper)
date: Jun 3, 2026
readTime: 5
---
```

A few fields earn their keep. `target` points at the thing the story is about and renders as a reference card inside the article, so link it to a real page like [/skill/webapp-testing](/skill/webapp-testing) or [/hook/smart-formatting](/hook/smart-formatting). Your byline can link out too: `author.url` links your name and `author.social` links your `@handle`, so readers can find you (the byline on this very post is wired that way). `pullQuote` becomes the blockquote near the top, `coverAlt` sets alt text for the cover, and `featured` or `pinned` decide whether you land on the homepage strip or the editor's pick slot.

## Links, code, and images

The body is markdown. Inline links work both directions: point inward to a [skill](/skills) or a [command](/commands) on the site, or outward to [the Claude Code docs](https://docs.claude.com/en/docs/claude-code). Fenced code blocks render in a monospace panel, like the template above, and you can use short headings and lists to break up a longer piece.

Images work in two places: a cover for the header, and body images on their own line.

![A laptop beside an open notebook on a desk](example.webp)

Reference body images by filename and keep the file in your story folder. Everything in the folder is published with the post, and relative names resolve automatically, so you never write a full path.

That is the whole format. When the folder is ready, commit, push, and open a PR. No setup, no local build, nothing to run. Once it is merged the post ships automatically and goes live at `/stories/<your-slug>` within a couple of minutes. The rest is writing something you would want to read, like the [other stories](/stories) here.
