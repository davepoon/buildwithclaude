---
slug: webapp-testing-skill
title: A skill that taught Claude to test my web app
excerpt: I stopped describing bugs in prose and gave the agent a browser. With the webapp-testing skill it clicks through the app, reads the console, and shows me a screenshot of what broke.
author:
  name: Joon Park
  handle: joonp
  avatarHue: 196
target:
  name: webapp-testing
  kind: skill
  href: /skill/webapp-testing
category: Skills
platforms:
  - Claude Code
  - Agent SDK
cover: blue
coverAlt: A laptop screen displaying colorful code
date: May 19, 2026
readTime: 6
pullQuote: An agent that cannot see the page is guessing; one that can open it is debugging.
---

For the longest time, "the agent cannot run my app" was the ceiling on how useful it could be for frontend work. It could write a component, but it could not tell whether the component actually worked. The [webapp-testing](/skill/webapp-testing) skill removes that ceiling by handing the agent a real browser through [Playwright](https://playwright.dev).

The difference is that it stops describing and starts doing. Instead of me narrating "click the menu, then the second item, the dropdown does not close," the agent drives a local instance itself. It navigates, clicks, fills forms, and verifies the frontend behaves. When something is off, it captures a screenshot and reads the browser console, so I get the actual error and a picture of the broken state, not a guess.

## What a check looks like

The skill leans on a small set of browser actions. A run reads roughly like this:

```ts
await page.goto('http://localhost:3000/settings')
await page.getByRole('button', { name: 'Save' }).click()
await page.waitForSelector('[data-toast="saved"]')   // assert the success state
const errors = await page.consoleMessages('error')   // catch what the UI hid
await page.screenshot({ path: 'settings-after-save.png' })
```

That last part changed how I debug UI. An agent that can only read code is reasoning about what should happen. An agent that can open the page is observing what does. The console logs alone closed a class of "works on my machine" bugs I used to chase by hand.

I treat it as the verification half of every frontend change: write the code, then let the skill prove it works in a browser before I look. It pairs naturally with the [code-review subagent](/stories/code-review-subagent) I run on the diff, one checking the behavior and one checking the code. If I were starting a UI project over, I would wire this in on day one. You can grab it from the [skills directory](/skills), and the browser API it builds on is documented at [playwright.dev](https://playwright.dev/docs/intro).
