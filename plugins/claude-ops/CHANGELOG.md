# Changelog

All notable changes to this project will be documented in this file.

## [1.7.0] — 2026-04-18

### Added

- **`/gtm` — cross-channel go-to-market planning skill** (PR #141). New `ops-gtm` skill acts as a strategy layer on top of `/marketing`. Guides the operator through GTM intake (audience, positioning, constraints, targets), generates a full plan across paid, unpaid, sales, and AI-automation avenues, and persists dated plan/brief files under `${CLAUDE_PLUGIN_DATA_DIR}/gtm/`. Plan items hand off to `/marketing` sub-commands via the `Skill` tool so credential resolution and API calls stay single-sourced. Approval gates are enforced for every paid or outbound action.
- **`ops-memory-extractor` — Claude Code OAuth support** (PR #138). The background memory extractor now prefers the Claude Code OAuth token stored in macOS Keychain (service `Claude Code-credentials`) over `ANTHROPIC_API_KEY`. Calls use `Authorization: Bearer <oauth-token>` with the `anthropic-beta: oauth-2025-04-20` header, billed against the user's Claude Max subscription instead of their API credit. Falls back to `ANTHROPIC_API_KEY` (env → keychain `anthropic-api-key` → Doppler `sharedsecrets/prd`). The OAuth token is never exported to the shell environment, avoiding the Claude Code misbehavior that occurs when `ANTHROPIC_API_KEY` is set in a parent terminal session.
- **`/ops:projects` — portfolio dashboard** (PR #139). Renders a dashboard of every project in the GSD registry, including active phase, task count, dirty-file count, and open-PR status. Reads from `$OPS_DATA_DIR/registry.json` synced by `scripts/ops-gsd-registry-sync.sh`.
- **`ops-speedup` v2 parity — GPU/ANE monitoring and power-hog detection** (PR #140). Full feature parity with the v1 bash script: `--gpu` reports GPU + Neural Engine utilization via `powermetrics` (macOS) with sampling-window controls, `--power` surfaces top energy consumers from `top -o pmem` / `ps -eo`, `--os-actions` performs cross-platform kernel_task / WindowServer restarts and launchd service masking behind an allowlist.

### Fixed

- **`scripts/wacli-keepalive.sh` — persistent `--follow` connection torn down by immediate backfill** (PR #138, reported via daemon log audit). The supervisor was invoking `wacli sync --once` on the very first supervisor tick before `--follow` had stabilized its store lock, which terminated the persistent connection within ~5-20 minutes every time. Added `INITIAL_BACKFILL_DELAY=30` seconds after follower start before the first `--once` sweep, and introduced `_WACLI_BATCH_HELD` reentrant guards to prevent overlapping sweeps. The `ops-daemon` now keeps `wacli --follow` alive indefinitely.
- **`bin/ops-speedup` — `eval` on user-controlled strings** (PR #140, SEV-9 from Seer). Replaced `eval` with `declare -g` plus a string allowlist to close a shell-injection vector in the OS-action dispatcher.
- **`bin/ops-speedup` — RETURN-trap race** (PR #140, SEV-8). Temp files previously leaked if the function returned mid-trap; now scoped with a local trap per function and cleared on the success path.
- **`bin/ops-speedup` — systemd mask without allowlist** (PR #140, SEV-8). The Linux path now validates the service name against a static allowlist before calling `systemctl mask`, preventing accidental masking of critical services.
- **`bin/ops-speedup` — `lsof +D` wedged the probe on large dirs** (PR #140, SEV-7). Replaced `+D` (recursive descent) with a bounded file-list argument so the liveness check returns in under 200 ms on any realistic directory.
- **`bin/ops-speedup` — non-portable `mktemp`, awk field reorder, and `find` precedence** (PR #140, SEV-low trio). `mktemp` now passes an explicit template for BSD/GNU compatibility, the awk power-hog formatter orders by `%MEM` before `%CPU` (matching the help text), and `find` predicates are correctly parenthesized.
- **`bin/ops-projects` — hardcoded developer registry path** (PR #139, SEV-9 blocker from Seer + blocksorg + cursor + devin + codex). The inline Python heredoc hardcoded `/Users/<user>/…/registry.json` inside a single-quoted heredoc, so the `$REGISTRY` shell variable never expanded and the dashboard printed `(no registry)` for every other user. Rewrote to read `OPS_DATA_DIR` from the environment inside the Python block (`import os; registry = Path(os.environ.get("OPS_DATA_DIR", os.path.expanduser("~/.claude/plugins/data/ops-ops-marketplace"))) / "registry.json"`). Also violated `CLAUDE.md Rule 0` (public repo, no personal paths).
- **`scripts/daemon-services.default.json` — three services enabled without backing scripts** (PR #139, SEV-7 from blocksorg). `inbox-digest`, `message-listener`, and `competitor-intel` were default-enabled but their scripts were not shipped in the diff, so `message-listener` (with `max_restarts: 20`) would have log-spammed 20 restart attempts. Set `enabled: false` for all three; the daemon reconciles them back to `true` once the user configures the relevant channel during `/ops:setup`.
- **`skills/ops-projects/SKILL.md` — `AskUserQuestion` removed from `allowed-tools` but still referenced in body** (PR #139, SEV-7 from blocksorg). Added `AskUserQuestion` back to the allowed-tools frontmatter so the interactive deep-dive flow doesn't crash with `InputValidationError`.

## [1.6.2] — 2026-04-16

### Fixed

- **`bin/ops-marketing-dash` — empty data from background gatherers** (sentry[bot] + cursor[bot], HIGH). `VAR=$(fn) &` with `wait` only assigns inside the backgrounded subshell, so `KLAVIYO_DATA`, `META_DATA`, `GA4_DATA`, `GSC_DATA`, `GADS_DATA`, and `INSTAGRAM_DATA` were all empty after `wait`. Switched to the tempfile pattern already used in `bin/ops-external` / `bin/ops-discover-external`.
- **`bin/ops-marketing-dash` — hardcoded `EMAIL_SCORE=10`** (cursor[bot]). Now derived from Klaviyo last-campaign `open_rate` (≥20% → 20pt, ≥10% → 10pt, else 0), matching the thresholds documented in `skills/ops-marketing/SKILL.md §Marketing Health Score`. `gather_klaviyo` now fetches campaign-values-reports for the most recent campaign.
- **`bin/ops-marketing-dash` — active-channel count used string compare** (cursor[bot] + codex[bot]). After the tempfile fix, unconfigured gatherers emit JSON `null`, so the literal `!= "0"` test mis-counted. Replaced with a numeric `is_positive` awk helper.
- **`skills/ops-marketing/SKILL.md` — Meta ad creative passed ad account ID as page_id** (codex[bot] P1 + sentry[bot]). Meta's `object_story_spec.page_id` requires a real FB Page ID, not `act_…`. Now requires `META_PAGE_ID` in env or plugin config with a clear error message.
- **`skills/ops-marketing/SKILL.md` — Instagram Story publishing sent duplicate `media_type`** (cursor[bot]). Removed the duplicate form field from the Stories container `curl`.
- **`agents/marketing-optimizer.md` — parser keys mismatched dashboard schema** (codex[bot] P1). Optimizer expected `meta_ads.*` / `google_ads.campaigns[]` / `klaviyo.attributed_revenue` but dashboard emits `meta.*` / raw `google_ads` searchStream array / no `attributed_revenue` field. Rewrote the schema reference to match what `bin/ops-marketing-dash` actually produces, with null-safe jq reductions for the Google Ads path.

## [1.6.1] — 2026-04-16

### Added

- **`ops-package` carrier-agnostic shipping skill** — Unified `/ops:package ship|label|track|list|carriers` entrypoint routing to 7 carrier adapters. Each adapter lives in `skills/ops-package/lib/carriers/<carrier>.sh` and shares common helpers (address parsing, credential resolution, label storage) in `lib/common.sh`.
  - **VERIFIED (live API tested)**: MyParcel.nl (api.myparcel.nl v1.1), Sendcloud (Panel API v3).
  - **UNVERIFIED (modelled from vendor docs, live account pending)**: DHL NL (My DHL Parcel Swagger), PostNL (Send API v2.2), DPD (eSolutions REST), UPS (v2403 Ship/Track REST), FedEx (Ship v1 + Track v1 REST). Adapters tagged `# UNVERIFIED - pending live test with account` in source; payloads may need adjustment against live accounts.

### Fixed

- **MyParcel NL insured shipments force `only_recipient:true` + `signature:true`** — MyParcel's own API contract requires both flags when `insurance > 0` for NL domestic shipments; omitting them returns a 422. Flagged by coderabbitai (Major).
- **`mktemp` temp files leaked on `curl` failure** — Under `set -e`, a failed `curl` short-circuited label flows before `rm -f` ran, leaving stale PDFs in `$TMPDIR`. Fixed in myparcel, dhl, dpd, sendcloud label flows via `trap 'rm -f "$tmp"' RETURN` (scoped to the function, cleared on success path before `save_label_pdf` takes ownership). Flagged by sentry[bot] and chatgpt-codex-connector (P1).
- **OAuth token cache written world-readable in `/tmp`** — `mktemp` inherits the ambient umask; on default systems that's 0644. Added `umask 077` before creating token cache files so only the owner can read them. Flagged by cursor[bot] (Medium).
- **`myparcel_list` recipient concatenation NPE on missing name/city** — `jq` join of `.recipient.name` + `.recipient.city` crashed when either field was absent. Added `// empty` fallbacks. Flagged by cursor[bot] (Low).
- **Dead code: `consume_carrier_flag` and `list_configured_carriers`** — Unused helper functions in `ops-package.sh` removed. Flagged by cursor[bot] (Low).
- **`--carrier` without value crashed under `set -u`** — `CARRIER="$2"` expanded to unbound-variable error when user ran `ops-package.sh --carrier` with nothing after it. Now guards with `"${2:-}"` and exits 64 with a usage message. Flagged by devin-ai-integration[bot].
- **MyParcel `Authorization` header scheme capitalization** — Changed `basic` to `Basic` to match RFC 7235 convention and MyParcel vendor docs (scheme matching is case-insensitive per spec but explicit casing avoids edge-case proxies). Flagged by coderabbitai (Minor).
- **MyParcel list page size** — Bumped default from 10 to 30 to match the API's documented page size and reduce pagination chatter on the typical user's recent-shipment view. Flagged by chatgpt-codex-connector (P2).

## [1.6.0] — 2026-04-16

### Added

- **`bin/ops-discover-external`** — Auto-discovers external (non-git) projects from credentials already configured in the plugin: Shopify stores (via prefs/env), Linear teams (via `LINEAR_API_KEY`), Slack workspaces (via keychain `slack-xoxc`/`slack-xoxd`), and Notion databases (via `NOTION_API_KEY` / keychain `notion-api-key`). Emits a JSON array of ready-to-register candidates with pre-built `config` blocks. Never writes to `registry.json` itself — the setup wizard handles registration after user confirmation. Shopify candidates emit the credential key that actually supplied the token (`SHOPIFY_ADMIN_TOKEN` or `SHOPIFY_ACCESS_TOKEN`) so downstream health checks resolve correctly, and Slack lookups use account=`$USER` (matching `bin/ops-slack-autolink.mjs`) so real installations are discovered.
- **Setup Step 5: "Auto-discover external projects"** — New sub-step in `skills/setup/SKILL.md` that runs `ops-discover-external` after the filesystem git-repo scan, cross-references against the existing registry, and presents only unregistered candidates via batched `AskUserQuestion` calls (≤ 4 options per call, per Rule 1).
- **`ops-projects` external candidate surfacing** — The portfolio dashboard now runs `ops-discover-external` alongside `ops-external` and shows an "UNREGISTERED CANDIDATES" footer listing Shopify/Linear/Slack/Notion projects the user has credentials for but has not yet added to `registry.json`, with a one-line path to `/ops:setup registry`.
- **`ops-projects` external deep-dive** — The `/ops:projects <alias>` jump-to-project view now branches on `type: external` and renders a source-specific deep-dive (Shopify order summary, Linear team issues, Slack workspace health, Notion recent edits) with actions that route to the relevant source-specific skill instead of assuming git/CI/PR context.

### Fixed

- **`CODE_OF_CONDUCT.md`** — Enforcement contact changed from a product support address to the plugin maintainer email (`info@lifecycleinnovations.limited`), matching `SECURITY.md`. Fixes Rule 0 (no personal/product-specific emails in a public repo).

## [1.5.0] — 2026-04-15

### Added

- **`bin/wacli-safe`** — Lock-free one-shot wacli command wrapper. Pauses keepalive sync via pause-signal protocol, runs the command, then resumes automatically.
- **`bin/wacli-health`** — Health check script with `--json` and `--repair` flags for any ops skill to verify wacli + keepalive status.
- **Self-healing service supervisor** — `ensure_all_services()` in ops-daemon enumerates all expected `com.claude-ops.*` launchd agents (macOS) and systemd units (Linux), verifies each is installed with a live PID, and auto-repairs (reinstall, kickstart) unhealthy services. Runs at startup + every 5min.
- **Wacli data cache** — Keepalive writes `wacli_chats.json` and `wacli_urgent.json` to cache every 5min. Daemon intelligence functions read from cache instead of calling wacli directly, eliminating store-lock contention.
- **Periodic backfill** — Keepalive re-checks for chats needing backfill every 30min (configurable via `BACKFILL_INTERVAL`).
- **Missed message detection** — Compares chat metadata timestamps against actual DB content; gaps > 1 hour are auto-queued for backfill.
- **Backfill memory integration** — Writes conversation summaries to `$DATA_DIR/memories/` for the ops memory-extractor to consume.
- **Pause-signal protocol** — `$STORE/.pause_sync` + `$STORE/.batch_wacli` files coordinate exclusive wacli access between keepalive, daemon, and external commands.

### Fixed

- **Keepalive P0 crash** — `detect_missed_messages` was called before its function definition; keepalive exited with status 127 on every machine, never reaching persistent sync.
- **Cache directory never created** — `WACLI_CACHE_DIR` was defined but not included in `mkdir -p`, causing all cache writes to silently fail.
- **Restart delay never applied** — `restart_delay` was logged but no `sleep` happened; services restarted immediately ignoring configured backoff.
- **Launchctl PID parsing** — `awk '/PID/{print $2}'` extracted `=` instead of the PID from `launchctl list` dictionary output; replaced with `launchctl list | awk '$3==lbl'` which parses the tabular format correctly.
- **Plist repair early-return** — `_install_launchd_plist` returned early on live PID even when the destination plist file was missing; service would vanish on reboot. Now requires both file existence AND live PID to skip.
- **Store-lock contention in cache refresh** — `refresh_wacli_cache`, `detect_missed_messages`, and `write_backfill_memory` all called wacli directly during persistent sync. Now use `acquire_wacli_batch` / `release_wacli_batch` to pause sync first.
- **dateutil dependency** — Replaced third-party `dateutil.parser` with stdlib `datetime.fromisoformat` in missed-message detection.
- **Restart counter permanent death** — `max_restarts` counter now resets after 30min of stability instead of staying dead forever.
- **Startup race condition** — 15s delay in keepalive when another `wacli sync` is already running.
- **Daemon version tracking** — Health JSON now includes daemon version from package.json.

---

## [1.4.0] — 2026-04-15

### Added

- **External project support** — Non-repo projects (Shopify stores, Linear teams, Slack/Notion workspaces, custom SaaS endpoints) can now be registered in `registry.json` with `type: "external"` and appear across all dashboards, briefings, fire detection, revenue tracking, and C-suite analysis.
- **`bin/ops-external`** — New data collector that probes external project health (Shopify Admin API, Linear GraphQL, custom health endpoints).
- **`registry.templates/external-project.json`** — Registry template for all supported external project types.
- **`/ops:daemon` skill** — Manage the background daemon (start, stop, restart, health check).
- **gog CLI reference** — Comprehensive command reference added to all agent skills.

### Changed

- **`ops-projects`** — Portfolio dashboard now includes an EXTERNAL PROJECTS table.
- **`ops-go`** — Morning briefing includes external project health status.
- **`ops-fires`** — Classifies external project issues by severity (unreachable=CRITICAL, auth_expired=HIGH).
- **`ops-revenue`** — Pulls Shopify GMV for external stores, adds SOURCE column to revenue pipeline.
- **`ops-yolo`** — Pre-gathers external project data for all 4 C-suite agents.
- **`project-scanner` agent** — Handles external projects in scan output.
- **`infra-monitor` agent** — Probes external projects, fire detection rules for auth_expired/unreachable.
- **`revenue-tracker` agent** — Queries Shopify orders API for GMV on external stores.
- **All C-suite agents** (CEO/CTO/CFO/COO) — Factor external projects into strategic, technical, financial, and operational analysis.

### Fixed

- **`ops-daemon`** — Critical installer, test, and arg-parser fixes.
- **Stale plist and wait bugs** in `ops-daemon.sh`.

---

## [1.3.0] — 2026-04-14

### Added

- **Notion integration** — Full channel support for Notion workspaces in inbox, comms, and setup flows.

### Fixed

- **Notion search API** — Corrected API usage, added missing tools and API fallback.
- **Setup wizard** — Renumbered sections after Notion insertion, fixed verification command.

---

## [1.2.0] — 2026-04-14

### Added

- **Agent Teams enforcement** — All agent-spawning skills now support Agent Teams when `CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1` is set.
- **Discord integration** — `/ops:comms discord` via webhook + bot read.
- **Docker support** — Turnkey container image + compose stack for Linux/CI.
- **Fires-watcher daemon** — Push notification sinks (Telegram/Discord/ntfy/Pushover).
- **`/ops:status` skill** — Lightweight integration health panel.
- **Registry templates** — Starter templates for 4 common stacks (monorepo, Next.js SaaS, Python microservices, React Native).
- **CI release workflow** — Auto-opens PR for version bumps.

### Fixed

- **Daemon** — Services work out of the box on fresh install.

---

## [1.1.1] — 2026-04-14

### Added

- **`docs/os-compatibility.md`** — Authoritative cross-OS reference: support matrix (macOS, Debian/Fedora/Arch/SUSE/Alpine, Windows, WSL2), per-channel install tables, credential cascade explainer, daemon registration mechanisms, browser-profile discovery roots, URL opener resolution, dev/CI guidance, known limitations, contributor testing notes (#100).

### Fixed

- **`bin/ops-setup-preflight`** — Restored `gog calendar calendars --json` (the v1.1.0 release dropped this fix during merge, leaving a probe of the non-existent `gog cal list` that silently wrote `{"error":"failed"}` to the calendar cache) (#101).
- **`bin/ops-unread`** — Error message no longer suggests `npm install -g @auroracapital/gog` (a package that doesn't exist on npm); now points to `brew install gogcli` / `winget install -e --id steipete.gogcli` / source build (#101).
- **`skills/ops-inbox/CHANNELS.md`** — Install snippet replaced the private `auroracapital/gog` references and invalid `gog auth login` command with an OS-aware `gogcli` install + `gog auth add` flow (#101).
- **`skills/ops-go/SKILL.md`** — Wording fix: "When `gog cal` fails" → "When `gog calendar` fails" (#101).
- **`bin/ops-autofix` + `bin/ops-setup-preflight`** — Back-compat `_cred_*` wrappers now gated by `IS_MACOS` / `[[ "$(uname)" == "Darwin" ]]` so the macOS-only `security` fallback never runs on Linux/Windows (would have crashed under `set -euo pipefail`) (#101).
- **`tests/test-bin-scripts.sh`** — macOS-tool detector now recognizes broader guard patterns (`if [ "$OS" = "macos" ]`, `case "$(uname)" in Darwin)`, the `else` branch of `if declare -F ops_cred_*`), eliminating false-positive failures on `ops-speedup`, `ops-autofix`, and `ops-setup-preflight` that were blocking PR merges (#101).

---

## [1.1.0] — 2026-04-14

### Added

- **"Configure all" first option in every setup phase** — Enter→Enter→Enter = full optimized install with zero friction. Steps 1 (sections), 2 (CLIs), 3 (channels), and 4 (MCPs) all offer "configure/install everything" as the recommended first option.
- **CODE_OF_CONDUCT.md** — Contributor Covenant 2.1.
- **Dependabot** — Weekly npm + GitHub Actions version bumps.
- **`.prettierrc.json`** — Explicit formatting config (was implicit defaults).
- **`npm scripts`** — `lint`, `format`, `test`, `type-check` in package.json.
- **Cross-OS foundation** — `lib/os-detect.{sh,mjs}`, `lib/credential-store.{sh,mjs}`, `lib/opener.{sh,mjs}` for macOS/Linux/WSL/Windows portability.
- **Cross-OS CI matrix** — GitHub Actions workflow tests on ubuntu-latest, macos-latest, windows-latest.
- **Gitleaks coverage** — Custom rules for all 22 integrated services (Shopify, RevenueCat, Sentry, Doppler, Linear, Klaviyo, ElevenLabs, Bland AI, Cloudflare).

### Changed

- **Telegram phone number prompt** — Now a single free-text field starting with `+` instead of country-specific presets.
- **Setup wizard gog install** — Points to `steipete/gogcli` (public) with cross-OS install table instead of private repo.
- **All `gog` commands updated** — `gog auth login` → `gog auth add`, `gog cal` → `gog calendar events`.

### Fixed

- **Gitleaks false positives** — `curl-auth-user` in SKILL.md docs, example phone numbers, `$STRIPE_SECRET_KEY` env var references.
- **Prettier formatting** — All `.mjs`/`.js`/`.json` files formatted with explicit config.

---

## [1.0.0] — 2026-04-14

### Added

- **`/ops:monitor`** — Unified APM surface for Datadog, New Relic, and OpenTelemetry. Active alerts, error traces, entity health. `--watch` for live polling.
- **`/ops:settings`** — Post-setup credential manager. Shows integration status, allows selective updates with smoke tests.
- **`/ops:integrate`** — Onboard any SaaS API into the partner registry (WebSearch discovery → confirm → credential → health check).
- **`monitor-agent`** — Lightweight haiku-4-5 agent for APM polling.
- **`templates/nestjs-api/`** — Full NestJS API template with JWT auth, BullMQ queues, Prisma, Fastify, health endpoint, multi-stage Dockerfile.
- **`templates/nextjs-saas/`** — Full Next.js SaaS App Router template with Auth.js v5, Stripe billing, Prisma, Tailwind, shadcn/ui.
- **`@claude-ops/sdk`** — npm package with TypeScript types (SkillManifest, AgentManifest, PluginManifest, HooksConfig) and `create-ops-skill` CLI scaffolder for third-party skill authors.
- **Automated release pipeline** — GitHub Actions workflow triggered on v* tag push, parses CHANGELOG, creates GitHub Release.
- **Ubuntu 24.04 CI** — Full test suite runs on both ubuntu-latest and ubuntu-24.04.
- **Merge conflict resolution** — `/ops:merge` now auto-rebases on `origin/main`; on failure offers accept-theirs / accept-ours / manual / skip.
- **CLAUDE.md plugin rules** — Plugin-root `CLAUDE.md` with two hard rules enforced across all skills: (1) max 4 options per `AskUserQuestion` call (schema limit), (2) never delegate CLI commands to the user — run via Bash tool instead (exception: `wacli auth` QR code).
- **Shopify admin app template** — `templates/shopify-admin-app/` — full Shopify Admin Remix template with all admin scopes, forked from Shopify/shopify-app-template-remix.
- **`bin/ops-shopify-create`** — Non-interactive Shopify app scaffolding script. Automates device-code OAuth (auto-opens browser via `expect`), fetches org ID from Shopify Partners API cache, runs `shopify app init` with all flags, and injects client ID into `shopify.app.toml`.
- **`expect` as required CLI** — Added to `bin/ops-setup-preflight` detection and `bin/ops-setup-install` for browser-automation flows.
- **Test suite** — New `tests/` directory with bash-based validation covering skills, bin scripts, hooks, templates, and secrets.
- **`briefing-pre-warm` daemon service** — Runs `bin/ops-gather` every 2 minutes and caches dashboards so `/ops:go` loads in <3s instead of <10s. Registered under `ops-daemon` alongside wacli-keepalive and memory-extractor.
- **Early daemon install (Step 2c of setup wizard)** — Setup wizard now installs `ops-daemon` immediately after CLI tooling so the `briefing-pre-warm` service can start caching `/ops:go` data while the remaining setup steps run. Step 5b became "daemon service reconciliation" (verify + restart) instead of fresh install.
- **`/ops:revenue` actual revenue tracking** — `revenue-tracker` agent now queries Stripe (charges, subscriptions → MRR, balance, disputes, open invoices, churn) and RevenueCat (mobile subscription MRR, active subs, churn). AWS cost data still included alongside revenue. `/ops:setup` Step 3k prompts for Stripe + RevenueCat credentials.
- **New `userConfig` keys** — `stripe_secret_key`, `revenuecat_api_key`, `revenuecat_project_id` added to `plugin.json`.
- **`infra-monitor` full-AWS coverage** — Service discovery probes IAM access per service, then reports on ECS, EC2, RDS, Lambda, S3 (flags public buckets), CloudFront, ALB/NLB, API Gateway, SQS (backlogs + DLQ), SNS, DynamoDB, ElastiCache, Route 53, ACM (cert expiry), CloudWatch alarms, Budgets, and IAM (stale access keys).
- **Wiki revamp** — 10 wiki pages rewritten with 2026 GitHub formatting (badges, mermaid diagrams, alert callouts). New pages: `Daemon-Guide`, `Memories-System`, `Plugin-Rules`, `Changelog`, `Privacy-and-Security`.
- **Privacy & Security transparency** — new `Privacy-and-Security.md` wiki page and README section explicitly document every credential scan source, what the daemon does on disk, and the plugin's no-telemetry / no-phone-home stance.

### Changed

- **AskUserQuestion <=4 enforcement** — All 15 skills audited and fixed. setup section picker (11→batched 4+4+3), setup channel picker (7→4+3), ops-comms / deploy / fires / go / inbox / linear / projects / revenue / speedup / triage / yolo all batch >4 menus with `[More options...]` bridges. ops-dash hotkey menu refactored.
- **Subagent models bumped Sonnet 4.5 → Sonnet 4.6** — `comms-scanner`, `infra-monitor`, `project-scanner`, `revenue-tracker`, and `triage-agent` now run on `claude-sonnet-4-6`. `yolo-*` agents stayed on `claude-opus-4-6`; `memory-extractor` stayed on `claude-haiku-4-5`.
- **Agent Teams adoption** — `/ops:fires`, `/ops:inbox`, `/ops:merge`, `/ops:orchestrate`, `/ops:triage`, and `/ops:yolo` now use the `TeamCreate` + `SendMessage` primitives for parallel agent coordination instead of sequential `Task`-based dispatch.
- **`/ops:speedup` is now OS- and hardware-agnostic** — auto-detects macOS / Linux / WSL / Windows, selects the right sub-script per platform, and degrades gracefully when tools are missing instead of erroring out.

### Fixed

- **`gog` install fallback chain** — Setup wizard now tries `npm install -g @auroracapital/gog` → `bun install -g @auroracapital/gog` → `git clone https://github.com/auroracapital/gog ~/.gog && ./install.sh` → clear manual instructions. Removed the previous incorrect pointer to `Lifecycle-Innovations-Limited/tap/gog` (Homebrew) — `gog` is a private `@auroracapital` CLI and is not distributed via Homebrew.

## [0.6.0] — 2026-04-13

### Added

- **`/ops:ecom`** — E-commerce operations command center (Shopify, Klaviyo, ShipBob, Meta Ads)
- **`/ops:marketing`** — Marketing analytics (email campaigns, ads, SEO, social, competitors)
- **`/ops:voice`** — Voice channel management
- **Daemon cron jobs** — Competitor intel, inbox digest, store health monitoring scripts
- **Message listener** — Real-time message event processing via wacli
- **Universal credential auto-scan** — Setup wizard auto-discovers API keys from env, Doppler, password managers, and browser sessions
- **Dynamic partner discovery** — Ecom/marketing setup detects installed platforms automatically
- **docs/** — Full reference documentation (skills, agents, daemon, memories)

### Fixed

- MCP namespace corrections across 8 skills and 3 agents (Linear, Gmail, Sentry)
- Broken YAML frontmatter in ops-comms, ops-triage, ops-yolo
- All 19 audit gaps resolved (100/100 score)

### Changed

- README updated with v0.6.0 features, architecture diagram, new skills table
- Plugin userConfig expanded: Klaviyo, Meta Ads, GA4, Search Console, Shopify, ShipBob keys

## [0.5.0] — 2026-04-13

### Added

- **ops-daemon** — Unified background process manager (launchd). Manages wacli sync, memory extraction, and future services with auto-heal, bootstrap sync, and auto-backfill for @lid chats.
- **ops-memories** — Daemon-spawned haiku agent extracts contact profiles, user preferences, communication patterns, and conversation context from chat history every 30 min. Writes structured markdown to `memories/`.
- **wacli-keepalive** — Persistent WhatsApp connection with bootstrap sync, auto-detection of empty @lid chats, health file contract (`~/.wacli/.health`), and launchd integration.
- **Doppler integration** — Setup wizard detects and configures Doppler CLI for secrets management. All skills can query secrets via `doppler secrets get`.
- **Password manager integration** — Setup wizard detects 1Password (`op`), Dashlane (`dcli`), Bitwarden (`bw`), and macOS Keychain. Configures query commands for agent use.
- **CLI/API reference tables** — All 14 operational skills now include complete command reference tables with exact syntax, flags, and output formats for wacli, gog, gh, aws, sentry-cli, and Linear GraphQL.
- **Deep context inbox** — ops-inbox and ops-comms now read full conversation threads (20+ messages), build contact profiles across channels, search for topic context, and draft replies matching user's language and style. Safety rail: NEVER send without full thread understanding.
- **PreToolUse hooks** — Automatic wacli health check before any WhatsApp command. Daemon health surfaced to user when action needed.
- **Stop hooks** — Session cleanup removes stale worktrees and temp files.
- **Runtime Context** — Every skill loads preferences, daemon health, ops-memories, and secrets at execution time.

### Changed

- **Plugin feature adoption ~35% → ~85%** — All 19 skills annotated with `effort`, `maxTurns`, and `disallowedTools`. 3 heavy skills use `claude-opus-4-6`. 4 read-only skills block Edit/Write. All 10 spawnable agents have `memory` (project/user scope). 4 scanner agents have `initialPrompt` for auto-start. Triage agent has `isolation: worktree`.
- **Setup wizard** — New steps for Doppler (3f), password manager (3g), and background daemon (5b). Daemon replaces standalone wacli launchd agent.
- **ops-inbox** — Full thread reads (20 msgs not 5), contact profile cards, topic search, cross-channel history, language/style matching in drafts.
- **ops-comms** — Full conversation context required before any send. Health pre-flight for WhatsApp.

## [0.4.2] — 2026-04-13

### Added

- **`bin/ops-autofix`** — Silent auto-repair script for common ops issues. Fixes wacli FTS5 (rebuilds with `sqlite_fts5` Go build tag), registers Slack MCP (from keychain tokens), and registers Vercel MCP. Runs non-interactively with `--json` output. Supports `--fix=all|wacli-fts|slack-mcp|vercel-mcp` targeting.

### Changed

- **`bin/ops-doctor`** — Now runs `ops-autofix` after diagnostics and reports any auto-applied fixes.
- **`bin/ops-setup-preflight`** — Now runs `ops-autofix` as a background job during preflight, so `/ops:setup` auto-repairs issues before the wizard even starts.

## [0.4.0] — 2026-04-13

### Added

- **`/ops:dash`** — Interactive pixel-art command center dashboard. Visual HQ with instant hotkey navigation (1-9, 0, a-h), live status indicators (fires, unread, PRs, GSD phases), C-suite report viewer, interactive settings editor, share-your-setup social flow, and FAQ/wiki section with links. `/ops` with no args now launches the dashboard instead of a text menu.
- **`/ops:speedup`** — Cross-platform system optimizer. Auto-detects macOS/Linux/WSL, scans for reclaimable disk space (brew, npm, Xcode, Docker, trash, logs, tmp, app caches), reports memory pressure, runaway processes, startup bloat, network latency. Health score (0-100). Tiered cleanup options: quick/full/deep/custom/memory/startup/network. On macOS, leverages the existing comprehensive `speedup.sh` for deep optimization.
- **`bin/ops-dash`** — Shell script that renders the pixel-art dashboard with parallel background data probes (projects, PRs, CI, unread, GSD, YOLO reports).
- **`bin/ops-speedup`** — Shell script for cross-platform system diagnostics (OS detection, hardware fingerprint, disk/memory/process/network metrics). Supports `--json` flag for machine-readable output.

### Changed

- **`/ops` router** — Empty args now launch `/ops:dash` instead of showing a static text menu. Added routing for `speedup`, `clean`, `optimize`, `cleanup` to `/ops:speedup`.
- **Telegram setup** — After authenticating via `ops-telegram-autolink.mjs`, credentials are now auto-written to the MCP config. No more manual paste into `/plugin settings`.
- **GSD companion install** — Now installs automatically with a single "Yes" instead of telling users to run slash commands manually.

## [Unreleased — legacy drafts]

### Added — autolink wizards for Telegram and Slack

- **`bin/ops-telegram-autolink.mjs`** — zero-browser Telegram user-auth wizard. Takes a phone number, uses plain HTTP against `my.telegram.org` (pattern borrowed from [esfelurm/Apis-Telegram](https://github.com/esfelurm/Apis-Telegram) — `my.telegram.org` is fully server-rendered so no Playwright/Selenium is needed for api_id extraction). Scouts existing credentials in macOS keychain and `~/.claude.json` first. If none found, posts phone to `/auth/send_password`, waits for the user's code via `/tmp/telegram-code.txt` bridge file, POSTs `/auth/login`, GETs `/apps`, regex-extracts `api_id` + `api_hash`, creates an app if none exists, then runs gram.js `client.start()` to generate a session string (handling a second code via the same bridge). Final result: JSON line to stdout with `{api_id, api_hash, phone, session}`.
- **`bin/ops-slack-autolink.mjs`** — Slack token wizard with scout-first, Playwright fallback. Scouts `~/.claude.json mcpServers.slack`, process env, macOS keychain (`slack-xoxc`/`slack-xoxd`), shell profile files, and Doppler. If nothing is found, launches Playwright with a persistent Chromium profile dir at `~/.claude-ops/slack-profile`, navigates to `app.slack.com/client/`, waits for the user to log in via a bridge file (`/tmp/slack-login-done`), then extracts the `xoxc-...` token from `localStorage.localConfig_v2.teams[teamId].token` and the `d` cookie (`xoxd-...`) from the cookie jar. Ported from [maorfr/slack-token-extractor](https://github.com/maorfr/slack-token-extractor) (Python → Node).
- **`skills/setup/SKILL.md` Step 3a + 3d rewritten** to invoke these binaries as background processes via the file-bridge pattern, and to display instructions for wiring extracted values into `/plugin settings` (we do not auto-write to `~/.claude.json` — that's Claude Code's internal file and the plugin must not touch it).
- **New deps**: `playwright` (~200MB Chromium browser on first install) added to `telegram-server/package.json`. Only required if the user chooses to run the Playwright fallback path for Slack — scout-only mode has no dependency on Playwright.
- **Bumped to v0.2.2** — `plugin.json` + `marketplace.json`. Earlier user-auth-only fixes were v0.2.1.

### Fixed — public-repo hygiene pass

- **Scrubbed `scripts/registry.json` from all git history** via `git filter-repo` + force-push. The file contained real project data (paths, repo slugs, revenue stages, infra topology) and was tracked in the repo since day one. Now gitignored, with `scripts/registry.example.json` as a starter template.
- **Removed `.planning/` from tracked files** (`git rm -r --cached`). Previously leaked internal phase docs, ROADMAP.md, STATE.md, PROJECT.md. Gitignored going forward.
- **Refactored hardcoded project references to registry-driven iteration** in 7 files: `agents/yolo-cto.md`, `agents/yolo-coo.md`, `agents/infra-monitor.md`, `agents/triage-agent.md`, `agents/comms-scanner.md`, `skills/ops-deploy/SKILL.md`, `skills/ops-triage/SKILL.md`, `skills/ops-next/SKILL.md`, `skills/ops-projects/SKILL.md`. All loops now read `.projects[].repos[]` / `.paths[]` / `.infra.ecs_clusters[]` / `.infra.health_endpoints[]` from `scripts/registry.json` (with `registry.example.json` fallback). Sensible defaults shown in example tables use `example-app` / `example-api` instead of real project names.
- **Removed hardcoded personal data**: hardcoded email in `agents/comms-scanner.md` replaced with preferences-driven `channels.email.account`. Hardcoded home-dir fallback removed from `skills/setup/SKILL.md` detector invocation.
- **Rewrote README installation section** to reflect marketplace-plugin install flow (`/plugin marketplace add` + `/plugin`), not manual `git clone` + `settings.json` editing.
- **Rewrote README Telegram section** to match the v0.2.0 user-auth rewrite (gram.js MTProto) with API ID / API hash / phone / session flow instead of obsolete Bot API token flow.
- **Bumped `marketplace.json` to 0.2.1** to match `plugin.json`.
- Registered `.gitignore` superset: `node_modules/`, `.env*`, editor swap files, `.planning/`, `.claude/worktrees/`, `.DS_Store`, `*.log`, `scripts/preferences.json`, `scripts/registry.json`.

### Added

#### Interactive setup wizard (`/ops:setup`)

- `skills/setup/SKILL.md` — end-to-end config wizard with `AskUserQuestion` selectors
- `bin/ops-setup-detect` — JSON state probe (tools, env vars, MCPs, registry, prefs)
- `bin/ops-setup-install` — idempotent Homebrew/apt installer for CLI dependencies
- `~/.claude/plugins/data/ops-ops-marketplace/preferences.json` — owner, timezone, verbosity, default channels, channel secrets. Lives in Claude Code's per-plugin data dir so it survives reinstalls and version bumps; never stored in the plugin source tree.
- Routes `setup|configure|init|install` in the `/ops` command router

#### WhatsApp auto-heal (Step 3b of wizard)

- Detects stuck `wacli sync` processes via stale store lock + age check
- Detects app-state key desync via `wacli sync` stderr probe (the `didn't find app state key` error class)
- Offers to kill stale sync / logout + re-pair interactively
- Automatic historical backfill via `wacli history backfill` on top 10 most-recent chats after a successful heal

#### Email + Calendar with MCP fallback

- **Email**: primary `gog` CLI (full read + send); fallback Claude Gmail MCP connector (read-only until user grants send perms in Claude Desktop → Connectors)
- **Calendar**: primary `gog cal` (shared gog OAuth token); fallback Google Calendar MCP connector (read-only until user grants write perms in Claude Desktop)
- Both record the chosen backend in the plugin-data `preferences.json` (`channels.email`, `channels.calendar`) so downstream skills (`/ops-go`, `/ops-next`, `/ops-fires`) can cross-correlate with today's schedule

## [0.1.0] — 2026-04-11

### Added

#### Phase 1: Plugin Scaffold + Registry

- `scripts/registry.example.json` — template for the per-user project registry (aliases, paths, repos, infra, revenue stage, GSD flag). Real `scripts/registry.json` is gitignored.
- `bin/ops-unread` — parallel unread counts for WhatsApp, Email, Slack, Telegram
- `bin/ops-git` — git status across all registry projects
- `bin/ops-prs` — open PRs across all registered GitHub repos
- `bin/ops-ci` — CI failures (last 24h) from GitHub Actions
- `bin/ops-infra` — ECS cluster and service health from AWS
- `bin/ops-gather` — meta-runner for all gather scripts

#### Phase 2: Morning Briefing

- `skills/ops-go/SKILL.md` — token-efficient morning briefing using `!` shell injection
- Pre-gathers all data in <10 seconds before model reads context
- Unified business dashboard with prioritized actions

#### Phase 3: Communications Hub

- `skills/ops-inbox/SKILL.md` — inbox zero across WhatsApp, Email, Slack, Telegram
- `skills/ops-comms/SKILL.md` — send/read routing with natural language parsing
- Telegram MCP integration (mcp**claude_ops_telegram**\*)

#### Phase 4: Project Management

- `skills/ops-projects/SKILL.md` — portfolio dashboard with GSD state, CI, PRs
- `skills/ops-linear/SKILL.md` — Linear sprint board, issue management, GSD sync
- `skills/ops-triage/SKILL.md` — cross-platform triage (Sentry + Linear + GitHub)
- `skills/ops-fires/SKILL.md` — production incidents dashboard with agent dispatch
- `skills/ops-deploy/SKILL.md` — ECS + Vercel + GitHub Actions deploy status

#### Phase 5: Business Intelligence

- `skills/ops-revenue/SKILL.md` — AWS costs, credits, revenue pipeline, runway
- `skills/ops-next/SKILL.md` — priority-ordered next action (fires > comms > PRs > sprint > GSD)

#### Phase 6: YOLO Mode

- `skills/ops-yolo/SKILL.md` — 4-agent C-suite analysis + autonomous mode
- `agents/yolo-ceo.md` — Strategic analysis agent (claude-opus-4-5)
- `agents/yolo-cto.md` — Technical health agent (claude-sonnet-4-5)
- `agents/yolo-cfo.md` — Financial analysis agent (claude-sonnet-4-5)
- `agents/yolo-coo.md` — Operations execution agent (claude-sonnet-4-5)

#### Phase 7: Telegram MCP Server

- `telegram-server/index.js` — minimal MCP server using Telegram Bot API
- Tools: `send_message`, `get_updates`, `list_chats`
- `telegram-server/package.json` — @modelcontextprotocol/sdk dependency
- `.mcp.json` — Claude Code MCP server registration

#### Supporting Agents

- `agents/comms-scanner.md` — background comms monitoring agent
- `agents/infra-monitor.md` — infrastructure health monitoring agent
- `agents/project-scanner.md` — project state analysis agent
- `agents/revenue-tracker.md` — revenue and cost monitoring agent
- `agents/triage-agent.md` — issue triage and fix dispatch agent
