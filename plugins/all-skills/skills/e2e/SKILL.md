---
name: e2e
category: testing-qa
description: Writes, runs, and debugs end-to-end tests for web and mobile apps with e2e, an open source test runner that mixes agent.act goals with exact locator steps and assertions in a Playwright browser or on an iOS or Android device. Use when a project has an e2e.config.ts, when asked for end-to-end, browser, mobile, or agentic UI tests, or when an e2e run fails.
license: Apache-2.0
---

# e2e

[e2e](https://e2e.com) runs UI tests that mix agent goals with exact steps. `agent.act` drives one goal in plain language; `agent.assert`, `agent.waitFor`, and `agent.extract` judge the screen; `screen`, `app`, `browser`, and `expect` act and check exactly. Web tests use `@e2e-dev/web`; iOS simulators, Android emulators, and phones use `@e2e-dev/mobile`. Goals that a later check confirmed are recorded and replay without model calls on later runs.

This is a condensed version of the skill in [e2e-inc/e2e](https://github.com/e2e-inc/e2e/tree/main/skills/e2e). The full skill ships with the e2e plugin and has a reference for each task (setup, writing tests, agent steps, running, debugging, the MCP server, explore runs, bug bashes):

```bash
claude plugin marketplace add e2e-inc/e2e
claude plugin install e2e@e2e
```

## When to Use This Skill

- Adding end-to-end tests to a web or mobile app
- Writing a test for a new feature with a mix of agent goals and exact assertions
- Fixing a failed e2e run from its trace
- Running tests in CI and reading `report.json`
- Checking a UI change in the running app over the e2e MCP server

## What This Skill Does

1. **Checks the project**: Looks for `e2e.config.ts`, the tests glob (default `tests/**/*.e2e.ts`), and `e2e` in `package.json`. Asks before adding a test framework to a project that has none.
2. **Shapes the test**: One `describe` per feature, one test per behavior, each test in arrange, act, assert order.
3. **Writes the steps**: One atomic `agent.act` goal per call, `screen` lines for exact values, and a verifying check at the end of every test that runs a goal.
4. **Runs one test at a time**: `npx e2e run tests/<feature>.e2e.ts:<line>` with fast-fail flags while fixing.
5. **Fixes from the recorded run**: Reads the failure block and the trace page instead of walking the flow again.

## How to Use

### Basic Usage

```
Add e2e to this project and write a test for the sign-up flow
```

```
The billing test failed in CI. Fix it.
```

### Config and a first test

```ts
// e2e.config.ts
import type { E2EConfig } from 'e2e';
import { web } from '@e2e-dev/web';
import { gateway } from 'ai';

export default {
  targets: [
    {
      engine: web(),
      app: {
        url: 'http://127.0.0.1:3000',
        command: { executable: 'pnpm', args: ['dev'], log: '.e2e/logs/app.log' },
      },
    },
  ],
  agents: {
    default: {
      model: gateway('openai/gpt-6-luna-fast'),
      system: 'You are a thorough QA agent. Verify every outcome on screen.',
    },
  },
} satisfies E2EConfig;
```

```ts
// tests/billing.e2e.ts
import { describe, test } from '@e2e-dev/web';
import { expect } from 'e2e';

describe('billing', () => {
  test('a member upgrades to Pro', async ({ app, agent, screen, browser }) => {
    await app.open('/settings/billing');

    await agent.act('upgrade the workspace to the Pro plan');

    await expect(screen.getByRole('status')).toContainText('Pro');
    await expect(browser).toHaveURL('/settings/billing');
  });
});
```

Agent steps need a model in the config and that provider's key. Tests without agent steps need no model.

## Example

**User**: "The billing test fails on the upgrade step."

**Output**:
```
1. Read the failure block: the failing line, expected vs observed, the URL
   at failure, and the nearest nodes for a failed locator.
2. Read .e2e/results/<test>/trace.md, including "## Screen at failure".
3. Fix every line that evidence covers, not only the one that failed.
   Replace any fixed delay with agent.waitFor('<the state needed>').
4. Rerun only that test:
   npx e2e run tests/billing.e2e.ts:6 --action-timeout 5000 --retries 0
5. Once it passes, run it one time with --no-cache to confirm the agent
   still reaches the goal without its recordings.
```

## Tips

- Run the CLI as `npx e2e ...` or `pnpm exec e2e ...`.
- Keep the replay cache on while fixing a test. Renaming a test, its `describe`, or its file, or rewording a goal, records that goal again live.
- One goal per `agent.act`. Two outcomes are two goals in two calls.
- End every test that runs a goal with a locator matcher, an engine matcher, or `agent.assert`. Only a passing check lets earlier goals replay without model calls.
- A locator that matches two nodes fails with `LOCATOR_AMBIGUOUS`. Narrow it.
- Never put secrets in test code. Declare them under `credentials` or `secrets` in the config and pass the opaque value to `fill()` or `agent.act` params.
- `.e2e/` is output. Read it, never edit it.
- Docs: https://e2e.com/docs. Examples for Vite, Next.js, Expo, SwiftUI, Jetpack Compose, Flutter, and more: https://github.com/e2e-inc/e2e/tree/main/examples
