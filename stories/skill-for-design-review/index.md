---
slug: skill-for-design-review
title: Teaching Claude to do a design review
excerpt: A skill that runs a real UX review (CRAP principles, information architecture, error states) and writes it up like a senior designer who has three points, not thirty.
author:
  name: Petra Wallin
  handle: petraw
  avatarHue: 48
target:
  name: oiloil-ui-ux-guide
  kind: skill
  href: /skill/oiloil-ui-ux-guide
category: Skills
platforms:
  - Claude Code
  - Claude Desktop
cover: brown
date: Apr 29, 2026
readTime: 6
pullQuote: A linter is correct, exhaustive, and impossible to act on. I wanted feedback that knows which item matters.
---

Most automated design feedback reads like a linter: correct, exhaustive, and impossible to act on. The [oiloil-ui-ux-guide](/skill/oiloil-ui-ux-guide) skill is the first one I have used that reviews a screen the way a person would. It has a checklist, but it knows which items matter.

## The checklist underneath

The foundation is the classic CRAP set, then the things that actually break products:

- **Contrast, Repetition, Alignment, Proximity** as the visual baseline
- information architecture: task-first, not org-chart-first
- system status: does the screen tell you what state it is in
- affordances and recovery: honest controls, reversible mistakes
- cognitive load: how much you have to hold in your head to proceed

It walks those deliberately instead of pattern-matching against a screenshot, so the output is specific rather than generic.

## Taste in the output

What makes it usable is the direction baked in. It enforces a modern, minimal style (clean, spacious, typography-led) and it actively cuts noise: reduce the copy, drop emoji used as icons, use one consistent icon set. A review comes back closer to this than to a bug list:

```md
1. Hierarchy: the page has three "primary" buttons. Demote two to text links.
2. Status: saving shows no feedback. Add an inline confirmation, not a toast.
3. Density: the form asks 11 questions to do a 3-question job. Cut to 3, defer the rest.
```

So the review does not just list problems, it points at a coherent destination. I reach for it before I would reach for a human reviewer's time, not to replace them, but so the obvious half is handled before they show up. By the time a person looks, the contrast is fixed and the real conversation can start.

If you would rather generate a new interface than critique one, the [Frontend Design Pro story](/stories/shipping-frontend-design-pro) is the build side of the same instinct. Both come from the [skills directory](/skills), and the design principles trace back to [Robin Williams' CRAP framework](https://en.wikipedia.org/wiki/The_Non-Designer%27s_Design_Book).
