---
slug: shipping-frontend-design-pro
title: How I shipped Frontend Design Pro in a weekend
excerpt: Two days, an interactive wizard, and a lot of opinions about button radii. A behind-the-scenes look at building a plugin that landed on the front page.
author:
  name: Mira Okafor
  handle: miraok
  avatarHue: 28
target:
  name: frontend-design-pro
  kind: plugin
  href: /plugin/frontend-design-pro
category: Plugins
platforms:
  - Claude Code
cover: brown
coverAlt: A desk lamp glowing over a wooden workspace
date: May 22, 2026
readTime: 7
featured: true
pinned: true
pullQuote: The generic SaaS gradient hero is a default, not a destiny, so I made the plugin ask questions first.
---

I built [Frontend Design Pro](/plugin/frontend-design-pro) because I was tired of one-shot UI generators producing the same generic SaaS gradient hero. I wanted something that would interrogate the brief first: research the space, pull a direction, and push back when the prompt was vague.

So the plugin does not start by generating. It starts by asking. It opens an interactive wizard that walks through the decisions most generators skip, then does real trend research and browser-based inspiration analysis before assembling a moodboard, so you are reacting to something concrete instead of describing vibes into a void.

## Install it

It is a [Claude Code plugin](/plugins), so it installs from the marketplace in two lines:

```bash
# add the Build with Claude marketplace, then install the plugin
/plugin marketplace add davepoon/buildwithclaude
/plugin install frontend-design-pro@buildwithclaude
```

## Splitting one prompt into focused steps

Day one was the wizard and the research loop. I had written this as one monolithic prompt and it kept losing the plot around 3,000 tokens. The color decisions would forget the typography decisions. Breaking it into discrete steps, each with a narrow job, fixed the coherence problem immediately:

- a research step that reads current patterns in the space
- a moodboard step that commits to one direction
- a color and type step that defaults to restraint
- a build step that only runs after the direction is locked

Day two was the opinions. Color and typography selection that biases toward calm, spacing with an actual rhythm, and a final pass that checks the output against the moodboard instead of against my mood. That last step, closing the loop back to the direction we chose in step one, is what made it feel like a design partner rather than a generator.

If you want the same instinct applied to an existing screen rather than a new one, the [design review story](/stories/skill-for-design-review) covers the skill I reach for there. And if you are curious how plugins are packaged, the [plugin docs](https://docs.claude.com/en/docs/claude-code) are the place to start, with the source for this one in [the repo](https://github.com/davepoon/buildwithclaude).
