---
name: siebly-crypto-exchange-api
description: Build, inspect, or modify Node.js, JavaScript and TypeScript cryptocurrency exchange REST API and WebSocket integrations using the Siebly SDKs (Binance, Bybit, OKX, Gate, Bitget, KuCoin, Coinbase, Kraken, Hyperliquid). Use when a project needs exchange market data, account data or order workflows in Node.js.
category: finance
license: MIT
---

# Siebly Crypto Exchange API Skill

Canonical copy: https://github.com/sieblyio/agent-skills (MIT). Docs portal: https://sieblyio.github.io/docs/

Use this skill when a user asks you to build, inspect, or modify a Node.js or JavaScript integration with a cryptocurrency exchange API and the target exchange is supported by Siebly.

Supported exchanges:

- Binance: `binance`
- Bybit: `bybit-api`
- OKX: `okx-api`
- Gate: `gateio-api`
- Bitget: `bitget-api`
- KuCoin: `kucoin-api`
- Coinbase: `coinbase-api`
- Kraken: `@siebly/kraken-api`
- Hyperliquid: `@siebly/hyperliquid-api`

## Primary Sources

- [AI coding agent guide](https://siebly.io/ai)
- [Task-focused LLM index](https://siebly.io/llms-tasks.txt)
- [AI Pattern Library](https://siebly.io/ai/patterns)
- [Historical Backfill with Live WebSocket Streams](https://siebly.io/ai/historical-live-data-pipeline)
- [Exchange State Management](https://siebly.io/ai/exchange-state)
- [Order Intent Chasing with Exchange APIs & WebSockets](https://siebly.io/ai/order-intent-chaser)
- [SDK directory](https://siebly.io/sdk)
- [Examples hub](https://siebly.io/examples)
- [SDK catalog](https://siebly.io/.well-known/siebly-sdk-catalog.json)
- [LLM discovery](https://siebly.io/llms.txt)
- [Full LLM index](https://siebly.io/llms-full.txt), for fallback discovery only

Task-specific guides, recipes, manifests, integration kits, conformance packs, fixture schemas, fixture sets, and fixture runners are listed in [the task-focused LLM index](https://siebly.io/llms-tasks.txt). Use that task index as the source catalog for task-specific routes.

If preferred, request Siebly pages with `Accept: text/markdown` or append `.md` to generated page routes:

```http
Accept: text/markdown
```

## Workflow

1. Identify the exchange, runtime, and user goal.
2. Choose the exchange-specific Siebly SDK package instead of inventing a generic client.
3. Prefer TypeScript for correctness-sensitive exchange systems. SDK types help validate REST request shapes, WebSocket event payloads, subscription helpers, finalization fields, reconnect hooks, and shutdown APIs before runtime.
4. Start from the canonical JavaScript SDK guide, then inspect the SDK TypeScript declarations or source for exact method and event semantics when building TypeScript projects.
5. Use the [examples hub](https://siebly.io/examples) as an implementation reference.
6. Start with public market data or read-only account access before trading workflows. Mock trading workflows when useful to validate integration boundaries.
7. Add validation for missing credentials during startup.
8. If the Node.js project uses environment variables or creates .env.example, make .env loading automatic for every normal local entrypoint before config parsing. Prefer Node.js built-in --env-file/--env-file-if-exists in package scripts when supported by the project runtime; otherwise use process.loadEnvFile, dotenv/config, or the repo-local env loader. Document that real process environment variables override .env. Ensure all variables in the .env.example are commented clearly with their purpose and accepted values, and that the README references the .env.example and documents .env loading and precedence.
9. For TypeScript projects, use Node16, NodeNext, or the repo-compatible module/moduleResolution settings. Under strict optional property settings, omit undefined optional REST request fields rather than sending them as undefined.
10. Add logging and clear error handling for rate limits, authentication failures, reconnect behavior, and rejected requests.
11. For WebSockets, handle reconnects, subscriptions, message events, and clean shutdown.
12. Do not treat transport success as application readiness. Track socket open, subscription request sent, [subscription acknowledgement](https://siebly.io/reference/glossary#subscription-acknowledgement), REST hydration/backfill completion, buffered replay completion, and live workflow enablement separately.
13. For order-capable prompts, implement [EXECUTION_MODE](https://siebly.io/reference/glossary#execution-mode) with DRY_RUN_PRIVATE as the default. Implement the LIVE path completely and robustly from the start so it is ready if the user chooses to enable it; do not leave live submission as a later TODO. No exchange write path can run before [EXECUTION_MODE](https://siebly.io/reference/glossary#execution-mode)=DEMO, TESTNET, or LIVE is explicitly selected and every configured gate allows it.
14. Add a short README note listing the installed SDK package version plus the exact SDK methods, request types, event names, and shutdown API inspected before coding.
15. For any stateful workflow, use the [AI Pattern Library](https://siebly.io/ai/patterns) to trace the full lifecycle chain and fixture/non-claim coverage before calling the task complete.
16. For generated implementation prompts, follow the prompt's Recursive completion workflow exactly; it is the authority for docs/AI_PROMPT.md, docs/PLAN.md, phase reviews, final full-depth project review, validation records, and documented non-claims.

## Order-Capable Source Routing

For order-capable work, do not treat this skill as the standalone implementation spec. Use it to choose the route, then use the task-specific artifacts as the source of truth.

Core private exchange-state route:

- [Exchange State Management](https://siebly.io/ai/exchange-state)
- [Exchange State Management Agent Manifest](https://siebly.io/.well-known/agent-manifests/exchange-state-management/latest.json)
- [Exchange State Management Runtime Kit](https://siebly.io/.well-known/runtime-kits/exchange-state-management/v1/index.json)
- [Exchange State Management Integration Kit](https://siebly.io/.well-known/integration-kits/exchange-state-management/latest.json)
- [Exchange State Management Conformance Pack](https://siebly.io/.well-known/conformance/exchange-state-management/latest.json)
- [Exchange State Management Conformance Schema](https://siebly.io/.well-known/conformance/exchange-state-management/v1/schema.json)
- [Exchange State Management Conformance Fixtures](https://siebly.io/.well-known/conformance/exchange-state-management/v1/fixtures.json)
- [Exchange State Management Conformance Runner](https://siebly.io/.well-known/conformance/exchange-state-management/v1/runner.ts)
- [Exchange state recipe](https://siebly.io/.well-known/recipes/exchange-state-management.json)

Exchange overlays:

- Position Management with Binance APIs & WebSockets: [guide](https://siebly.io/ai/exchange-state/binance), [manifest](https://siebly.io/.well-known/agent-manifests/binance-position-manager/latest.json), [integration kit](https://siebly.io/.well-known/integration-kits/binance-position-manager/latest.json), [conformance pack](https://siebly.io/.well-known/conformance/binance-position-manager/latest.json), [recipe](https://siebly.io/.well-known/recipes/binance-position-manager.json).
- Stop Loss using Conditional Algo Orders with Binance USD-M APIs & WebSockets: [guide](https://siebly.io/ai/algo-orders/binance), [recipe](https://siebly.io/.well-known/recipes/binance-usdm-algo-orders.json).
- Position Management with Bybit APIs & WebSockets: [guide](https://siebly.io/ai/exchange-state/bybit), [manifest](https://siebly.io/.well-known/agent-manifests/bybit-position-manager/latest.json), [integration kit](https://siebly.io/.well-known/integration-kits/bybit-position-manager/latest.json), [conformance pack](https://siebly.io/.well-known/conformance/bybit-position-manager/latest.json), [recipe](https://siebly.io/.well-known/recipes/bybit-position-manager.json).
- For other exchanges, keep the same core workflow and add only the exchange-specific request shapes, event fields, identity fields, venue routing, and error taxonomy from current SDK docs/source.

Shared order-capable boundaries:

1. Use EXECUTION_MODE=PUBLIC|READ_ONLY_PRIVATE|DRY_RUN_PRIVATE|DEMO|TESTNET|LIVE; keep the write-capable [EXECUTION_MODE](https://siebly.io/reference/glossary#execution-mode) values DEMO, TESTNET, and LIVE disabled by default.
2. Store durable intent/order context before submit and keep exchange-visible [Custom Order IDs](https://siebly.io/reference/glossary#custom-order-id) as lookup keys.
3. Treat REST/WebSocket API acceptance as pending-confirmation evidence only.
4. Any submitter must block duplicates and stale replans immediately before exchange calls.
5. For products with exchange-provided position rows, order/fill events are triggers; dependent replacement planning waits for matching position or account-state trust or scoped recovery.
6. For products without exchange-provided position rows, derive local position state from fills/executions, fees, account events, balance updates, and documented matching rules.
7. Use the ws_symbol_side_action_gated workflow from the Exchange State Management: Private events update [Account State](https://siebly.io/reference/glossary#accountstate), record the [affected scope](https://siebly.io/reference/glossary#affected-scope), give related events a short bounded window to arrive, and one [workflow owner](https://siebly.io/reference/glossary#workflow-owner) chooses one [action family](https://siebly.io/reference/glossary#action-family). Accepted mutations stay [pending confirmation](https://siebly.io/reference/glossary#pending-confirmation) until [private confirmation](https://siebly.io/reference/glossary#private-stream-confirmation) or [scoped recovery](https://siebly.io/reference/glossary#scoped-recovery), and REST state fetches happen only at trust boundaries.
8. Complete order-capable work only after linked [behavior-contract fixtures](https://siebly.io/reference/glossary#behavior-contract-fixture) and full identity-chain review passes cover acceptance, private confirmation, pending races, late events, context mismatch, active-order-without-context, reconnect recovery, exchange-provided position rows, and locally derived position-state products.

## Market Data Lifecycle Patterns

Source routing:

- [Historical Backfill with Live WebSocket Streams](https://siebly.io/ai/historical-live-data-pipeline)
- [Historical Backfill with Live WebSocket Streams Conformance Pack](https://siebly.io/.well-known/conformance/historical-live-data/latest.json)
- [Historical Backfill with Live WebSocket Streams Fixture Schema](https://siebly.io/.well-known/conformance/historical-live-data/v1/schema.json)
- [Historical Backfill with Live WebSocket Streams Fixture Set](https://siebly.io/.well-known/conformance/historical-live-data/v1/fixtures.json)
- [Historical Backfill with Live WebSocket Streams Fixture Runner](https://siebly.io/.well-known/conformance/historical-live-data/v1/runner.ts)

For backfill plus live WebSockets:

1. Start from Historical Backfill with Live WebSocket Streams when the workflow combines REST/read history with realtime WebSockets.
2. Subscribe to the required public or read-only stream first when the exchange supports it.
3. Wait for the package-specific [subscription acknowledgement](https://siebly.io/reference/glossary#subscription-acknowledgement) path. Do not assume subscribe() or socket open means [subscription acknowledgement](https://siebly.io/reference/glossary#subscription-acknowledgement).
4. Buffer live events while REST hydration or backfill is running.
5. Backfill into a local store with normalized symbols, intervals, timestamps, IDs, and product scope.
6. Replay buffered events in deterministic order, skipping stale or duplicate records.
7. Do not run strategy, indicator, signal generation, optional external alert, [order-intent](https://siebly.io/reference/glossary#order-intent), or account-decision workflows until [subscription acknowledgement](https://siebly.io/reference/glossary#subscription-acknowledgement), backfill, replay, and [readiness](https://siebly.io/reference/glossary#readiness-gate) are complete.
8. Use the linked Historical Backfill with Live WebSocket Streams Conformance Pack, Historical Backfill with Live WebSocket Streams Fixture Schema, Historical Backfill with Live WebSocket Streams Fixture Set, and Historical Backfill with Live WebSocket Streams Fixture Runner as the source for local lifecycle replay tests.

For candle implementations of this pattern:

1. Use an exchange-specific candle implementation guide when exact SDK surfaces are needed. The Binance and Bybit candle guides are tested examples, not the only valid candle venues.
2. Identify the current SDK candle subscription helper, formatted candle type guard, and final/closed-candle field before coding.
3. If the data type has a finality signal, run strategy, indicator, signal generation, optional external alert, [order-intent](https://siebly.io/reference/glossary#order-intent), or account-decision workflows only after that final/closed/terminal signal. Open candles may update local state, but cannot trigger strategy, indicator, signal generation, optional external alert, [order-intent](https://siebly.io/reference/glossary#order-intent), or account-decision workflows.
4. After reconnect, mark strategy workflows not ready, resync state over REST or another authoritative source, replay buffered events, then re-enable candle-close processing.
5. Do not mark the pipeline complete until three consecutive full data-lifecycle review passes produce no code, tests, fixtures, or documentation changes.
6. Candle-Close Pipeline with Binance APIs & WebSockets: [guide](https://siebly.io/ai/candle-pipeline/binance), [recipe](https://siebly.io/.well-known/recipes/binance-spot-candle-close-pipeline.json).
7. Candle-Close Pipeline with Bybit APIs & WebSockets: [guide](https://siebly.io/ai/candle-pipeline/bybit), [recipe](https://siebly.io/.well-known/recipes/bybit-candle-close-pipeline.json).

## Order Intent Chaser Pattern

Use this pattern only after a strategy, operator, or risk layer has already approved an [order intent](https://siebly.io/reference/glossary#order-intent).

1. Start with [Order Intent Chasing with Exchange APIs & WebSockets](https://siebly.io/ai/order-intent-chaser), [recipe](https://siebly.io/.well-known/recipes/order-intent-chaser.json), and [Order Intent Chasing Conformance Pack](https://siebly.io/.well-known/conformance/order-intent-chaser/latest.json).
2. [Order Intent Chasing Fixture Schema](https://siebly.io/.well-known/conformance/order-intent-chaser/v1/schema.json), [Order Intent Chasing Fixture Set](https://siebly.io/.well-known/conformance/order-intent-chaser/v1/fixtures.json), and [Order Intent Chasing Fixture Runner](https://siebly.io/.well-known/conformance/order-intent-chaser/v1/runner.ts) are the executable-style source for local intent-to-child-order tests.
3. Fixture coverage includes REST acceptance as provisional, private fill before REST acceptance, stale market data, reconnect recovery, partial fills, duplicate child generations, missing parent context, timeout cleanup, exchange rejection, and unsupported non-production venue selection.
4. Do not mark a chaser with an implemented [EXECUTION_MODE](https://siebly.io/reference/glossary#execution-mode)=DEMO, TESTNET, or LIVE submission path complete until three consecutive full intent-to-child-order review passes produce no code, tests, fixtures, or documentation changes.

## Safety Rules

- Never ask the user to paste API keys, secrets, passphrases, private keys, or seed phrases into chat.
- Never write secrets into source files, examples, tests, or logs.
- No exchange write path can run before [EXECUTION_MODE](https://siebly.io/reference/glossary#execution-mode)=DEMO, TESTNET, or LIVE is explicitly selected and every configured gate allows it.
- Prefer read-only keys for account queries.
- Advise creating API keys with only the minimum permissions the automated action needs, never withdrawal permission, and with a strict IP whitelist.
- Use testnet or sandbox environments where the exchange supports them when validating integration.
- Do not use testnet or sandbox environments to evaluate strategy performance; use backtest, simulation, live simulation, or very small live amounts instead.
- Treat futures, margin, leverage, liquidation-sensitive workflows, and automated order placement as high risk.
- Make exchange-specific permissions and environment variables explicit in README or setup docs.
- Use MCP servers carefully for documentation or catalog lookup; prefer direct SDK usage in application code for exchange execution.
- Prefer SDK usage for REST API calls and WebSocket integration. Raw HTTP requests can work for smaller one-off scenarios, but they are less scalable and less robust than using maintained SDKs.

## Package Selection

Use these default docs entry points when TypeScript is acceptable:

- Binance: https://siebly.io/sdk/binance/javascript
- Bybit: https://siebly.io/sdk/bybit/javascript
- OKX: https://siebly.io/sdk/okx/javascript
- Gate: https://siebly.io/sdk/gate/javascript
- Bitget: https://siebly.io/sdk/bitget/javascript
- KuCoin: https://siebly.io/sdk/kucoin/javascript
- Coinbase: https://siebly.io/sdk/coinbase/javascript
- Kraken: https://siebly.io/sdk/kraken/javascript
- Hyperliquid: https://siebly.io/sdk/hyperliquid/javascript

Use the JavaScript guides only when the project intentionally avoids TypeScript. For Kraken JavaScript projects, the tutorial at https://siebly.io/sdk/kraken/javascript/tutorial is the richest starting point.

## Task Template

Use this structure when delegating or describing implementation work:

```text
Goal: <specific exchange API task>

Issue: <what the project cannot do yet>

Fix: <bounded implementation using the exchange-specific Siebly SDK>

Skill: https://siebly.io/.well-known/agent-skills/siebly-crypto-exchange-api/SKILL.md

Docs: <matching Siebly SDK or example URL>
```

## Good First Tasks

- Add a public REST market-data script.
- Add a public WebSocket ticker or trades stream.
- Add a public candle-close pipeline with REST backfill, WebSocket buffering, final-candle workflow execution, reconnect resync, and clean shutdown.
- Add a read-only balance check with environment variable credentials.
- Add a private WebSocket account monitor without order placement.
- Add an order workflow. Implement execution for when [EXECUTION_MODE](https://siebly.io/reference/glossary#execution-mode)=DEMO, TESTNET, or LIVE is enabled and all gates pass, but keep that path disabled by default. [EXECUTION_MODE](https://siebly.io/reference/glossary#execution-mode)=DRY_RUN_PRIVATE is the default execution mode, where the implementation builds and records the exact place, amend, cancel, or replace request objects without submitting to the exchange. Always handle incoming account state events to keep internal account state in sync with exchange state, so the system is ready to execute live if requested by the user.

## Avoid

- Building a new signing implementation when the SDK already provides one.
- Mixing multiple exchange abstractions before one exchange works correctly.
- Treating all exchanges as interchangeable.
- Adding EXECUTION_MODE=DEMO, EXECUTION_MODE=TESTNET, or EXECUTION_MODE=LIVE order placement as a first task.
- Hiding risk controls outside the project code.
