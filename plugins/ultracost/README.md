# ultracost

**Per-stage model routing for Claude Code `ultracode` dynamic workflows.**

It applies to **any** kind of work a dynamic workflow does — frontend, backend,
research, refactors, audits — not a single domain. Wherever `ultracode` fans out to
subagents, ultracost governs how each stage is routed.

When `ultracode` is on, the session runs on Opus @ `xhigh` and a single dynamic
workflow fans out to dozens — up to ~1,000 — subagents that **inherit that session
model** unless every `agent()` stage is pinned. The built-in workflow guidance even
tells Claude to *omit* the per-agent model, so the whole fan-out silently lands on
Opus. In a scan of ~22 real `ultracode` scripts, almost none pinned a model — even
Anthropic's bundled `deep-research` workflow pins zero stages.

ultracost makes the per-stage routing **explicit, policy-driven, and verifiable**,
without giving up quality on the work that matters:

- **Quality-first policy.** Coding and reasoning stay on Opus @ `xhigh`; pre-planned
  mechanical work and search/collection drop to Sonnet; Haiku is never used. It routes
  by **tier** (`opus`/`sonnet`), not a pinned version.
- **Always-on guidance.** A `SessionStart` hook injects the routing policy each session
  so it's present when Claude authors a workflow.
- **The Workflow Guard.** A static analyzer that flags any `agent()` stage missing a
  `model:` pin, pinning a banned model, or whose pin mismatches the work the prompt
  describes (`UC001`–`UC008`).
- **A pre-flight cost gate.** A deterministic `PreToolUse` hook estimates a workflow and
  hard-stops the launch (Approve / Modify / Cancel) before a fan-out runs.
- **A closed loop.** Reads local transcripts offline to reconcile estimate-vs-actual
  per stage, self-calibrate the estimator, and keep a savings ledger.

## What this directory ships

The routing-policy **skill** (self-contained guidance). The complete plugin — guard,
cost gate, closed-loop commands, and the `/ultracost:*` slash commands — installs from
the canonical marketplace:

```text
/plugin marketplace add danielkremen818/ultracost
/plugin install ultracost@ultracost
```

Or via npm for CI/scripting:

```bash
npx ultracost init
```

- **Repository:** https://github.com/danielkremen818/ultracost
- **License:** MIT · no telemetry · no network on the hot path
- **Author:** [danielkremen818](https://github.com/danielkremen818)

## Security & trust

- **Zero runtime and dev dependencies** — there is no supply chain to compromise.
  Snyk Open Source and `npm audit` report **0 vulnerabilities**.
- **No telemetry, no network on the hot path.** The only outbound request is the
  user-invoked `ultracost pricing refresh`; the guard, estimate, and hooks run offline.
- **Signed releases.** Published to npm with OIDC Trusted Publishing and a signed
  `--provenance` attestation; every GitHub Action is pinned to a commit SHA.
- **CodeQL + OpenSSF Scorecard** run in CI. The installer touches only its own files
  and is fully reversible.
