# CIAgent plugin for Claude Code

Lets a coding agent set up and operate [CIAgent](https://github.com/suniel12/ciagent)
(`pip install ciagent`) — pytest-native regression testing for AI agents — on
the agent it is building.

## Skills

- **onboard** — set up CIAgent in a repo from scratch: find the agent, write
  the runner, record golden baselines, generate a spec, verify with a real
  run. Includes a cost gate before any live recording.
- **check** — after any change to agent code, prompts, or the knowledge
  base: run the right CIAgent check (`test`, `test --runs 3`, `judge-audit`),
  read the stability report correctly, and never paper over a failure.

## Install

From the CIAgent repo's own marketplace:

```
/plugin marketplace add suniel12/ciagent
/plugin install ciagent@ciagent
```

## Disclosure

This plugin wraps the `ciagent` PyPI package. The plugin and the package are
built and maintained by the same author ([@suniel12](https://github.com/suniel12)).
The package is free and Apache-2.0 licensed; there is no paid tier, telemetry,
or hosted service behind it.
