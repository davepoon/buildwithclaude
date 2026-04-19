---
name: setup
description: Interactive setup wizard for the claude-ops plugin. Installs missing CLIs, configures env vars for each channel (Telegram, WhatsApp, Email, Slack, Notion, Linear, Sentry, Vercel), builds the project registry, and saves user preferences. Run once after installing the plugin or any time to reconfigure.
argument-hint: "[section]"
allowed-tools:
  - Bash
  - Read
  - Write
  - Edit
  - AskUserQuestion
  - Agent
  - TeamCreate
  - SendMessage
effort: high
maxTurns: 80
---

# OPS ► SETUP WIZARD

You are running an **interactive configuration wizard** for the `claude-ops` plugin. The user wants you to walk them through every step needed to get the plugin working: installing CLIs, setting env vars, configuring channels, populating the project registry, and saving preferences.

---

**RULE ZERO — EVERY BASH CALL USES `run_in_background: true`**

This is non-negotiable. EVERY SINGLE Bash tool call in this entire setup wizard MUST set `run_in_background: true`. There are ZERO exceptions. This applies to:
- Credential scans, CLI installs, OAuth flows, npm/brew installs
- Daemon starts, daemon reloads, launchctl commands
- Keychain writes, Doppler queries, Chrome history queries
- Autolink scripts, sync/backfill, smoke tests
- File writes, config writes, env appends
- ANY command, no matter how fast you think it will be

While background commands run, immediately continue to the next independent step or ask the user the next question. Handle results when the `<task-notification>` arrives. The setup wizard must NEVER show `(ctrl+b to run in background)` — if the user sees that prompt, you violated this rule.

**RULE ONE — SILENT BASH CALLS**

Every Bash tool call MUST include a short `description` parameter (5-10 words, e.g. "Install missing CLIs", "Scout keychain for Telegram creds", "Reload daemon"). This is what the user sees instead of the raw command. Keep setup clean and quiet — the user should see progress titles, not shell scripts.

---

**Other hard rules:**

- This is a _conversation_, not a script dump. Use `AskUserQuestion` for every decision — never ask in prose when a structured selector will do.
- Confirm actions via `AskUserQuestion` where the user hasn't already opted in (e.g., "Configure all" covers everything — no per-action confirmation needed after that).
- Skip sections the user declines. Don't nag.
- **NEVER auto-skip a channel or integration.** Every channel/service the user selected must get an explicit `AskUserQuestion` with skip as one of the options. If a credential isn't found, present the [Paste manually] / [Deep hunt] / [Skip] options. If a smoke test fails, ask the user whether to retry, reconfigure, or skip. The ONLY acceptable way to skip is the user choosing a "Skip" option. Do not silently move past a service because scanning found nothing — that's when the user needs to be asked the most.
- Show what's already configured first, so the user only fills gaps.
- **Never show the user's real name or email in output unless the user explicitly provided it in THIS session.** Do not read from memory, existing configs, or environment variables to populate display names.
- **Max 4 options per `AskUserQuestion` call.** The tool schema enforces `<=4` items in the `options` array. When a step lists >4 choices, filter already-configured items first, then batch the rest into multiple sequential calls of <=4 options each, grouped logically. Use `[More options...]` as the last option to bridge between batches.
- Run ALL diagnostic/probe commands in parallel when possible. Use multiple Bash tool calls in a single message. Never run sequential probes when they're independent (e.g., `gog auth status` AND `wacli doctor` AND keychain scouts should all run simultaneously).
- All writes go to one of these paths — and nothing else:
  - **`$PREFS_PATH`** — per-user preferences + secrets. Resolves to `${CLAUDE_PLUGIN_DATA_DIR:-$HOME/.claude/plugins/data/ops-ops-marketplace}/preferences.json`. Lives in Claude Code's plugin data dir so it survives plugin reinstalls and version bumps. Never committed to git.
  - **`${CLAUDE_PLUGIN_ROOT}/scripts/registry.json`** — per-user project registry (gitignored in the source repo). `mkdir -p` its parent if missing.
  - **`${CLAUDE_PLUGIN_ROOT}/.mcp.json`** — only to add `${user_config.*}` placeholders, never hardcoded tokens.
  - The user's shell profile (`~/.zshrc` etc.) — append-only, never rewrite.
- At the top of every wizard step, make sure `$PREFS_PATH`'s parent directory exists: `mkdir -p "$(dirname "$PREFS_PATH")"`. Claude Code creates `~/.claude/plugins/data/ops-ops-marketplace/` on plugin install but don't assume.

---

## Agent Teams support

If `CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1` is set, use **Agent Teams** when multiple "Deep hunt" credential agents are needed simultaneously. This enables:
- Credential scouts run in parallel across Doppler, keychains, browser profiles, and password managers
- Agents share findings (e.g., Doppler agent finds a partial config → keychain agent knows to skip that service)
- You can steer mid-hunt: "found the Telegram token, stop hunting for that one"

**Team setup** (only when flag is enabled, multiple deep hunts triggered):
```
TeamCreate("setup-hunters")
Agent(team_name="setup-hunters", name="hunt-telegram", model="haiku", ...)
Agent(team_name="setup-hunters", name="hunt-sentry", model="haiku", ...)
Agent(team_name="setup-hunters", name="hunt-shopify", model="haiku", ...)
```

Each agent reports back its findings. Merge results and present to the user for confirmation.

If the flag is NOT set, use independent fire-and-forget subagents with `run_in_background: true`.

---

## Setup agent delegation pattern

When the user asks a complex integration-specific question during setup (e.g., "how does /ops:ecom handle multi-store setups?"), the setup agent can load the related skill's SKILL.md for deeper context:

```bash
cat "${CLAUDE_PLUGIN_ROOT}/skills/ops-ecom/SKILL.md"
```

Each sub-step below includes a `> **Deep-dive:**` pointer to the related skill file. Follow these pointers instead of duplicating operational details in this wizard.

---

## Step 0 — Preflight (runs in background while you read)

```!
${CLAUDE_PLUGIN_ROOT}/bin/ops-setup-preflight &>/dev/null &
```

**Preflight data**: All probe results are cached at `/tmp/ops-preflight/`. Before running ANY diagnostic command, check if the result already exists there:
- CLI status: `cat /tmp/ops-preflight/clis.txt`
- Slack: `cat /tmp/ops-preflight/slack.json`
- Telegram: `cat /tmp/ops-preflight/telegram.txt`
- gog/Gmail: `cat /tmp/ops-preflight/gog-gmail.json`
- gog/Calendar: `cat /tmp/ops-preflight/gog-cal.json`
- WhatsApp: `cat /tmp/ops-preflight/wacli-doctor.json` and `wacli-chats.json`
- MCP servers: `cat /tmp/ops-preflight/mcp-servers.txt`
- GitHub: `cat /tmp/ops-preflight/gh-auth.txt`
- AWS: `cat /tmp/ops-preflight/aws-identity.json`
- Projects: `cat /tmp/ops-preflight/projects.txt`
- Existing registry: `cat /tmp/ops-preflight/existing-registry.json`
- Existing prefs: `cat /tmp/ops-preflight/existing-prefs.json`
- Doppler: `cat /tmp/ops-preflight/doppler.json`

Wait for `/tmp/ops-preflight/.complete` to exist before reading (it should be ready within 2-3 seconds). NEVER re-run a probe that already has cached results — read the cache file instead.

---

## Step 0b — Detect current state

Run the detector and parse its JSON output (or read from preflight cache if available):

```!
${CLAUDE_PLUGIN_ROOT}/bin/ops-setup-detect 2>/dev/null
```

If `CLAUDE_PLUGIN_ROOT` is unset, fall back to the latest installed cache dir at `~/.claude/plugins/cache/ops-marketplace/ops/<latest-version>/`. Store the resolved path as `PLUGIN_ROOT` for the rest of the session.

Also resolve `PREFS_PATH` once and reuse it everywhere:

```bash
PREFS_PATH="${CLAUDE_PLUGIN_DATA_DIR:-$HOME/.claude/plugins/data/ops-ops-marketplace}/preferences.json"
mkdir -p "$(dirname "$PREFS_PATH")"
```

Print a compact status header to the user, one line per category:

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 OPS ► SETUP WIZARD
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 Shell:       zsh → ~/.zshrc
 Core CLIs:   ✓ jq  ✓ git  ✓ gh  ✓ aws  ✓ node
 Channels:    ✓ wacli  ✓ gog  ○ telegram (no token)
 Secrets:     ✓ doppler (project: my-app, config: dev)
 MCPs:        ✓ linear  ✓ sentry  ○ slack  ○ vercel
 Registry:    19 projects
 Preferences: not set
──────────────────────────────────────────────────────
```

Use `✓` for present/set, `○` for missing/unset, `✗` for broken.

---

## Step 1 — Ask which sections to configure

First, offer a quick "set up everything" option:

```
How would you like to run setup?
  [Set up everything — install CLIs, configure all channels, MCPs, registry, daemon, preferences (Recommended)]
  [Pick sections — choose which parts to configure]
  [Re-run a specific section — I know what I need]
```

If the user selects "Set up everything", select ALL sections across all batches and run them in order (Step 2 → 2b → 2c → 3 → 4 → 5 → 5b → 6 → 7), skipping any already fully configured. Within each step, use the "Configure all" fast-path where available.

If the user selects "Re-run a specific section", show a single `AskUserQuestion` listing the section names (cli, daemon, channels, mcp, registry, prefs, env, ecom, mktg, voice, revenue) and jump directly to that step.

If the user selects "Pick sections", proceed with the batched selection below.

Use `AskUserQuestion` with `multiSelect: true`. Offer **only sections that need attention** (skip ones already green). Because AskUserQuestion allows max 4 options, batch into logical groups:

**Batch 1 — Core setup (run early so the daemon can pre-warm caches while you finish):**

| Option             | Header   | Description                                                                   |
| ------------------ | -------- | ----------------------------------------------------------------------------- |
| Install CLIs       | cli      | Install missing command-line tools via Homebrew                               |
| Background daemon  | daemon   | Install ops-daemon early — pre-warms briefing cache while remaining setup runs |
| Configure MCPs      | mcp      | Enable Linear, Sentry, Vercel, Gmail MCP servers                              |
| Build registry      | registry | Register projects Claude should manage                                        |

**Batch 2 — Channels & plugins:**

| Option             | Header   | Description                                                   |
| ------------------ | -------- | ------------------------------------------------------------- |
| Configure channels  | channels | Set tokens for Telegram, WhatsApp, Email, Slack               |
| Companion plugins   | plugins  | Install GSD for project roadmap tracking                      |
| Save preferences    | prefs    | Owner name, timezone, default priorities                      |
| Shell env           | env      | Export `CLAUDE_PLUGIN_ROOT` in shell profile                  |

**Batch 3 — Extras (only show if not already configured):**

| Option              | Header   | Description                                                   |
| ------------------- | -------- | ------------------------------------------------------------- |
| Configure ecommerce | ecom     | Set Shopify store URL + admin token, ShipBob                  |
| Configure marketing | mktg     | Set Klaviyo, Meta Ads, GA4, Search Console keys               |
| Configure voice     | voice    | Set Bland AI, ElevenLabs, Groq API keys                       |
| Configure revenue   | revenue  | Set Stripe + RevenueCat keys for live MRR tracking            |

Present each batch as a separate `AskUserQuestion` call. Skip batches where all items are already green. Collect all selections across batches and run each selected section in order.

---

## Step 2 — Install CLIs (if selected)

If multiple CLIs are missing, offer a bulk install first:

```
Missing CLIs detected: jq, gh, wacli. What would you like to do?
  [Install all missing CLIs (Recommended)]
  [Pick which to install]
  [Skip CLI installation]
```

If the user selects "Install all", install every missing tool in sequence without further prompts. If "Pick which to install", ask per tool:

```
Install jq?           [Yes, install now] [Skip]
Install gh?           [Yes, install now] [Skip]
Install wacli?        [Yes, install now] [Skip — manual install required]
```

For each `Yes`, run:

```bash
${PLUGIN_ROOT}/bin/ops-setup-install <tool>
```

Report success/failure. If Homebrew is missing on macOS, stop and tell the user to install it from https://brew.sh first — do not attempt to install brew automatically.

After installation, re-run `ops-setup-detect` to refresh status before continuing.

---

## Step 2b — Companion plugins (if selected)

### GSD (Get Shit Done)

GSD is a third-party Claude Code plugin that adds project roadmap tracking. When installed, claude-ops dashboards (`/ops:go`, `/ops:projects`, `/ops:next`, `/ops:yolo`) automatically show active phases, progress, and next actions per project. Without it, those sections are simply omitted.

Check if GSD is already installed:

```bash
find ~/.claude -name "gsd-progress" -path "*/skills/*" 2>/dev/null | head -1 | grep -q . && echo "installed" || echo "not_installed"
```

If not installed, ask via `AskUserQuestion`:

```
GSD adds project roadmap tracking to your ops dashboards.
  /ops:go shows active phases and progress per project
  /ops:projects shows GSD state alongside CI/PR status
  /ops:next factors in GSD work priority

  [Install GSD (latest)] [Skip — I don't need roadmap tracking]
```

On install, run the commands directly — do NOT tell the user to run them manually:

```bash
# Install GSD in one shot — no user intervention needed
claude plugin marketplace add gsd-build/get-shit-done 2>/dev/null && \
claude plugin install gsd@gsd-build-get-shit-done 2>/dev/null
```

If `claude` CLI is not available in the path, fall back to the plugin cache mechanism:

```bash
# Direct marketplace clone fallback
GSD_MARKETPLACE_DIR="$HOME/.claude/plugins/marketplaces/gsd-build-get-shit-done"
if [ ! -d "$GSD_MARKETPLACE_DIR" ]; then
  git clone https://github.com/gsd-build/get-shit-done.git "$GSD_MARKETPLACE_DIR" 2>/dev/null
fi
```

Report success/failure. Record `plugins.gsd = "installed"` in `$PREFS_PATH`.

If they skip:

```
Skipped GSD. Install later with: /plugin marketplace add gsd-build/get-shit-done
```

---

## Step 2c — Background Daemon (early install, pre-warm caches)

**Why install the daemon this early?** Running the daemon in parallel with the rest of setup lets it start pre-warming the briefing cache (`ops-gather` results for infra/git/PRs/CI), so by the time the user reaches Step 7 and runs `/ops:go`, the briefing is already cached and loads in under 3 seconds instead of 10. Channel-dependent services (wacli-sync, message-listener, inbox-digest, store-health) are added later in Step 5b once their channels are configured.

### Platform support

The background daemon ships with a `launchd` integration (macOS only). Detect the platform before attempting install:

```bash
case "$(uname -s)" in
  Darwin)                OS=macos ;;
  Linux)                 grep -qi microsoft /proc/version 2>/dev/null && OS=wsl || OS=linux ;;
  MINGW*|MSYS*|CYGWIN*)  OS=windows ;;
  *)                     OS=unknown ;;
esac
```

- **macOS** (`OS=macos`): proceed with the full `launchctl bootstrap` flow below.
- **Linux / WSL** (`OS=linux|wsl`): `launchctl` is not available. The daemon script (`${CLAUDE_PLUGIN_ROOT}/scripts/ops-daemon.sh`) runs fine under `bash`, but installing it as a user service requires `systemd --user` (Linux) or a custom cron/at wrapper (WSL). That work is **out of scope for this patch** — track as future work. For now, print:

  ```
  ○ Background daemon — skipped (Linux/WSL install via systemd --user is pending; see docs/daemon-guide.md).
    You can still launch it manually with:  nohup ${CLAUDE_PLUGIN_ROOT}/scripts/ops-daemon.sh &
  ```

  Write `daemon.enabled = false` and `daemon.skip_reason = "platform:<os>"` to `$PREFS_PATH` and continue to Step 3.
- **Windows** (native, `OS=windows`): the daemon is **not installed**. Print `○ Background daemon — not supported on native Windows. Use WSL or run ops-daemon.sh manually.` and continue.

If `OS=macos`, check whether the daemon is already installed:

```bash
launchctl print gui/$(id -u)/com.claude-ops.daemon 2>/dev/null | head -1
```

If already loaded, print `✓ Background daemon already running — will reconcile services in Step 5b.` and skip to Step 3.

Otherwise ask via `AskUserQuestion`:

```
Install the ops background daemon now?
  Starts pre-warming briefing cache while you finish the rest of setup.
  Auto-heals on failure. Single launchd agent (com.claude-ops.daemon).
  Channel services (wacli-sync, message-listener) added after channels are set up.
  [Yes — install now]  [Skip — I'll run it manually later]
```

On `Yes`, run the install (use `run_in_background: true` — RULE ZERO):

```bash
# Always resolve CLAUDE_PLUGIN_ROOT to the CURRENT installed version — never hardcode a version number.
# If CLAUDE_PLUGIN_ROOT is not set, detect it from the plugin cache:
PLUGIN_ROOT="${CLAUDE_PLUGIN_ROOT:-$(ls -d "$HOME/.claude/plugins/cache/ops-marketplace/ops"/*/ 2>/dev/null | sort -V | tail -1)}"
DAEMON_SCRIPT="${PLUGIN_ROOT}/scripts/ops-daemon.sh"
chmod +x "$DAEMON_SCRIPT"
PLIST_TEMPLATE="${PLUGIN_ROOT}/scripts/com.claude-ops.daemon.plist"
PLIST_DEST="$HOME/Library/LaunchAgents/com.claude-ops.daemon.plist"
DATA_DIR="${CLAUDE_PLUGIN_DATA_DIR:-$HOME/.claude/plugins/data/ops-ops-marketplace}"
LOG_DIR="$DATA_DIR/logs"
mkdir -p "$LOG_DIR"

# Resolve bash 4+ (required for associative arrays in ops-daemon.sh).
# macOS ships bash 3; Homebrew installs bash 5 at /opt/homebrew/bin/bash.
BASH_PATH="/bin/bash"
if [[ -x /opt/homebrew/bin/bash ]]; then
  BASH_PATH="/opt/homebrew/bin/bash"
elif [[ -x /usr/local/bin/bash ]]; then
  BASH_PATH="/usr/local/bin/bash"
fi

# Generate plist
sed -e "s|__DAEMON_SCRIPT_PATH__|$DAEMON_SCRIPT|g" \
    -e "s|__BASH_PATH__|$BASH_PATH|g" \
    -e "s|__PLUGIN_ROOT__|$PLUGIN_ROOT|g" \
    -e "s|__LOG_DIR__|$LOG_DIR|g" \
    -e "s|__HOME__|$HOME|g" \
    "$PLIST_TEMPLATE" > "$PLIST_DEST"

# Write a minimal initial services config — only the services that don't depend on
# channels yet. `briefing-pre-warm` runs ops-gather every 2 minutes so the next
# /ops:go is instant. `memory-extractor` runs but stays idle until channels exist.
SERVICES_CONFIG="$DATA_DIR/daemon-services.json"
cat > "$SERVICES_CONFIG" <<JSON
{
  "services": {
    "briefing-pre-warm": {
      "enabled": true,
      "command": "${CLAUDE_PLUGIN_ROOT}/bin/ops-gather",
      "cron": "*/2 * * * *",
      "_note": "Pre-warms /ops:go cache. Runs every 2 minutes."
    },
    "memory-extractor": {
      "enabled": true,
      "command": "${CLAUDE_PLUGIN_ROOT}/scripts/ops-memory-extractor.sh",
      "cron": "*/30 * * * *",
      "health_file": "~/.claude/plugins/data/ops-ops-marketplace/memories/.health",
      "_note": "Idle until channels are configured; will extract profiles once wacli/gog are live."
    }
  }
}
JSON

# Remove the old standalone wacli keepalive if present
launchctl bootout gui/$(id -u)/com.claude-ops.wacli-keepalive 2>/dev/null || true
rm -f "$HOME/Library/LaunchAgents/com.claude-ops.wacli-keepalive.plist"

# Load daemon in background — does NOT block the wizard
launchctl bootout gui/$(id -u) "$PLIST_DEST" 2>/dev/null || true
launchctl bootstrap gui/$(id -u) "$PLIST_DEST"
```

Write `daemon.enabled = true` and `daemon.installed_at_step = "2c"` to `$PREFS_PATH` so Step 5b knows to reconcile services instead of re-installing.

Print:

```
✓ Background daemon — installed. Pre-warming briefing cache in parallel while you finish setup.
  Channel-dependent services will be added after channels are configured (Step 5b).
```

Continue immediately to Step 3 — do NOT wait for the daemon to confirm startup. The health file check is deferred to Step 5b.

> **Deep-dive:** see `${CLAUDE_PLUGIN_ROOT}/docs/daemon-guide.md` for full operational instructions, CLI reference, and troubleshooting for the background daemon. The setup agent can load that file directly when it needs more depth than this wizard provides.

---

## Step 3 — Configure channels (if selected)

First, offer a quick "configure everything" option before individual selection. Use `AskUserQuestion`:

```
How would you like to configure channels and integrations?
  [Configure all — set up every available channel and service (Recommended)]
  [Pick individually — choose which channels to configure]
  [Skip all — configure channels later]
```

If the user selects "Configure all", run every channel sub-flow below in sequence (Telegram → WhatsApp → Email → Slack → Notion → Calendar → Doppler → Vault), skipping any already configured. If the user selects "Skip all", move to Step 4.

If the user selects "Pick individually", ask which channels using `AskUserQuestion` with `multiSelect: true`. Because AskUserQuestion allows max 4 options, batch into two groups. Skip channels already configured (show only those needing attention).

**Batch 1 — Messaging:**

| Option   | Header   | Description                                                             |
| -------- | -------- | ----------------------------------------------------------------------- |
| Telegram | telegram | Bot token + owner ID for `/ops-comms telegram`                          |
| WhatsApp | whatsapp | wacli doctor + auto-heal + backfill                                     |
| Email    | email    | gog CLI → Gmail MCP fallback for `/ops-inbox email`                     |
| Slack    | slack    | Slack MCP server (managed by Claude Code)                               |

**Batch 2 — Knowledge & Services:**

| Option   | Header   | Description                                                             |
| -------- | -------- | ----------------------------------------------------------------------- |
| Notion   | notion   | Notion MCP — workspace search, comments, tasks, knowledge base          |
| Calendar | calendar | gog calendar → Google Calendar MCP fallback — schedule context for briefings |
| Doppler  | doppler  | Secrets manager — set default project + config for all ops skills       |
| Vault    | vault    | Password manager — 1Password, Dashlane, Bitwarden, or macOS Keychain    |

Present each batch as a separate `AskUserQuestion` call. Skip batches where all items are already configured. For each selected channel, run the matching sub-flow below.

---

#### Shared: detect the host OS before suggesting installs

The claude-ops wizard runs on macOS, Linux (all major distros + WSL), and Windows (native + WSL). Before printing any install command, the skill MUST detect the host OS and pick the OS-appropriate variant. Never print a `brew install …` command to a Windows user, and never print `winget install …` to a macOS user.

Minimal detection snippet (bash — works on macOS, Linux, WSL, MSYS/Cygwin):

```bash
case "$(uname -s)" in
  Darwin*) OS=macos ;;
  Linux*)
    if grep -qi microsoft /proc/version 2>/dev/null; then OS=wsl
    elif [ -f /etc/os-release ]; then
      . /etc/os-release
      case "$ID" in
        arch|manjaro) OS=arch ;;
        fedora|rhel|centos|rocky|almalinux) OS=fedora ;;
        debian|ubuntu|pop|linuxmint) OS=debian ;;
        alpine) OS=alpine ;;
        opensuse*|sles) OS=suse ;;
        *) OS=linux ;;
      esac
    else OS=linux; fi ;;
  MINGW*|MSYS*|CYGWIN*) OS=windows ;;
  *) OS=unknown ;;
esac
```

Cascade for the package manager (pick the first one available):
1. `brew` (macOS + Linuxbrew) — preferred on macOS.
2. Native OS manager — `apt-get` (debian/ubuntu), `dnf` (fedora/rhel), `pacman` (arch), `zypper` (suse), `apk` (alpine).
3. `winget` (Windows 10 1809+) → `scoop` → `choco` → build-from-source as last resort on Windows.

When the preferred manager isn't installed, fall forward to the next available option rather than aborting the flow. Every `AskUserQuestion` "[Install now — …]" prompt below uses an OS-aware command table — print only the row(s) that match the detected OS.

For the authoritative cross-OS detection logic, reuse `bin/ops-setup-detect` (which emits `os`, `pkg_mgr`, `arch`, `keyring_backend`, `shell`, `browser_profiles_found` in its JSON output).

---

#### Shared: prefer OAuth over manual tokens

Whenever a channel has a **browser-based OAuth flow** available, offer that first and put manual-token entry behind it as a fallback. OAuth is safer (scoped, revocable, no secrets in dotfiles), and usually faster for the user.

| Channel        | OAuth path                                                 | Manual fallback                        |
| -------------- | ---------------------------------------------------------- | -------------------------------------- |
| Email (gog)    | `gog auth add <email> --services gmail,calendar,drive,contacts,docs,sheets` (browser) | n/a — gog is OAuth-only |
| Calendar (gog) | same `gog auth add` with calendar in `--services`          | n/a                                    |
| Slack          | `claude mcp add slack` (handles OAuth through Claude Code) | bot token via auto-scan + manual paste |
| Linear         | `claude mcp add linear`                                    | API key                                |
| Sentry         | `claude mcp add sentry`                                    | DSN / auth token                       |
| Vercel         | `claude mcp add vercel`                                    | personal access token                  |
| Telegram       | ❌ no OAuth (Bot API is token-only by design)              | auto-scan + manual paste (only option) |
| WhatsApp       | QR pairing via `wacli auth` (similar UX to OAuth)          | n/a — paired sessions only             |

When a channel supports OAuth, the default `AskUserQuestion` should lead with it:

```
[Connect via OAuth (recommended)]  [Enter a token manually]  [Skip]
```

Only go into the credential auto-scan flow below when the user picks "manually" or when the channel (Telegram, local tools) has no OAuth path.

---

---

## Universal Credential Auto-Scan

**BEFORE asking the user for ANY credential**, run this scan sequence. This applies to ALL steps — channels, ecommerce, marketing, voice, and MCPs. The user should never be asked to find a key that's already on their system.

**CRITICAL — exhaust ALL sources before reporting.** Run every scan source (1-10 below) in a single batch, THEN analyze the combined results. Do NOT report "no credentials found" after checking only env vars and Dashlane — Chrome history, .env files, Doppler, and keychain may have the answer. If API tokens are missing but the store/service identity was found (e.g. store URL in Chrome history, login entry in Dashlane), report what you found and skip to the token step with the identity pre-filled. The user saying "find it" or "check all available sources" means you did not search thoroughly enough — never ask the user to look for something you can find programmatically.

For each variable name (e.g. `TELEGRAM_BOT_TOKEN`, `SHOPIFY_ACCESS_TOKEN`, `KLAVIYO_API_KEY`):

1. **Current shell environment** — `printenv <VAR>`. Running shell inherits exports, Doppler injections, dotenv-loaded files. Most likely to be correct.
2. **Shell profile files** — grep `~/.zshrc`, `~/.bashrc`, `~/.zprofile`, `~/.config/fish/config.fish`, `~/.envrc` (direnv) for `<VAR>=` or `export <VAR>=`. Show the file path next to the value so the user knows where it's from.
3. **Doppler (all projects)** — if `command -v doppler` succeeds:
   ```bash
   for proj in $(doppler projects --json 2>/dev/null | jq -r '.[].slug'); do
     doppler secrets --project "$proj" --config prd --json 2>/dev/null | \
       jq -r --arg var "$VAR" --arg proj "$proj" \
       'to_entries[] | select(.key == $var) | "\(.value.computed) (doppler:\($proj)/prd)"'
   done
   ```
   Also try the default project config (dev/staging) if prd fails. Show source attribution `(project: <slug>, config: <config>)`.
4. **Dashlane CLI** — if `command -v dcli` succeeds:
   ```bash
   dcli password "$SERVICE_KEYWORD" --output json 2>/dev/null
   ```
   Map service keywords: `shopify` → SHOPIFY vars, `klaviyo` → KLAVIYO vars, `bland` / `bland-ai` → BLAND vars, etc.
5. **macOS Keychain** — for specific services:
   ```bash
   security find-generic-password -s "$SERVICE" -w 2>/dev/null
   ```
   Use service names matching common patterns (e.g. `shopify-admin-token`, `klaviyo-api-key`, `bland-ai-api-key`).
6. **OpenClaw config** — if `~/.openclaw/openclaw.json` exists:
   ```bash
   jq -r --arg var "$VAR" '.agents.defaults.env[$var] // empty' ~/.openclaw/openclaw.json 2>/dev/null
   ```
7. **Installed MCP configs** — read each `.mcp.json` the detector found. For each server entry, look at `.env` and `.args` for the variable name or for literal values that look like the target. Show the MCP server name as the source.
8. **Plugin preferences** — check existing `$PREFS_PATH` for the key under the relevant section (e.g. `.ecom.shopify.admin_token`, `.marketing.klaviyo.api_key`). If found and not a `doppler:` reference, show it as a source.
9. **Chrome history** — for services with web admin UIs (Shopify, Klaviyo, etc.), query Chrome's History SQLite DB for admin URLs that reveal the account/store identity:
   ```bash
   sqlite3 ~/Library/Application\ Support/Google/Chrome/Default/History \
     "SELECT DISTINCT url FROM urls WHERE url LIKE '%<service_domain>%' ORDER BY last_visit_time DESC LIMIT 10" 2>/dev/null
   ```
   Extract identifiers (e.g. `*.myshopify.com` store slugs, account IDs) from the URLs.
10. **Project .env files** — scan `~/Projects/*/.env*` for the variable name or service domain patterns. These often contain credentials from other projects that can be reused.

**Env var → service keyword mapping for auto-scan:**

| Variable names | Service keyword (Dashlane/Keychain) |
| --- | --- |
| `SHOPIFY_ACCESS_TOKEN`, `SHOPIFY_ADMIN_TOKEN`, `SHOPIFY_STORE_URL` | `shopify` |
| `KLAVIYO_API_KEY`, `KLAVIYO_PRIVATE_KEY` | `klaviyo` |
| `META_ACCESS_TOKEN`, `FACEBOOK_ACCESS_TOKEN`, `META_AD_ACCOUNT_ID` | `meta`, `facebook` |
| `GA4_PROPERTY_ID`, `GA_MEASUREMENT_ID` | `google-analytics`, `ga4` |
| `BLAND_AI_API_KEY`, `BLAND_API_KEY` | `bland-ai`, `bland` |
| `ELEVENLABS_API_KEY` | `elevenlabs` |
| `GROQ_API_KEY` | `groq` |
| `SHIPBOB_ACCESS_TOKEN` | `shipbob` |
| `TELEGRAM_BOT_TOKEN`, `TELEGRAM_API_ID`, `TELEGRAM_API_HASH` | `telegram` |
| `SLACK_BOT_TOKEN`, `SLACK_MCP_XOXC_TOKEN` | `slack` |

**Present the findings** with `AskUserQuestion` (**max 4 options per call**):

```
Found credential for SHOPIFY_ACCESS_TOKEN:
  [A] shell env + ~/.zshrc + Dashlane — shpat_508b...682e  (matched across 3 sources)
  [B] Doppler (project: mystore, config: prd) — shpat_9f2c...a17b  (different!)
  [C] Enter a different one
```

Rules for the prompt:

- Show the **first 8 and last 4 characters** of any token, never the full value.
- **Always collapse matching sources** into one option with `(matched in env + ~/.zshrc + Dashlane)` appended. This is critical to stay within the 4-option limit.
- If sources **disagree**, show each distinct value as a separate option. If there are more than 3 distinct values (rare), batch into multiple calls with `[More sources...]`.
- Placeholder values like `${user_config.*}`, `<your-token>`, `CHANGE_ME`, or empty strings count as NOT FOUND.
- Always include an `[Enter a different one]` option as the last option.
- If NO source has a value, present the user with options via `AskUserQuestion`:

```
<SERVICE_NAME> — no credential found after scanning all sources.

  [I have it — let me paste it]
  [Deep hunt — spawn an agent to find it]
  [Skip this service]
```

  - **"I have it"** → show instructions for where to find the credential in the service's dashboard, then accept free-text input.
  - **"Deep hunt"** → spawn a Haiku subagent in the background with this mandate:

    ```
    Find the <CREDENTIAL_NAME> for <SERVICE_NAME>. Search exhaustively:
    1. All Doppler projects and configs (dev/stg/prd/ci)
    2. All .env* files across ~/Projects/ recursively
    3. macOS Keychain (security find-generic-password with various service name patterns)
    4. Dashlane CLI (dcli password <service> + related keywords)
    5. Chrome browser — navigate to <service_admin_url> via Kapture/Playwright MCP, log in if needed, and extract the credential from the settings page
    6. All shell profile files (~/.zshrc, ~/.bashrc, ~/.zprofile, ~/.envrc, ~/.config/fish/*)
    7. 1Password CLI (op item list --tags <service>) if available
    8. AWS Secrets Manager / SSM Parameter Store if aws cli authenticated

    Return the credential value if found, or a detailed report of everywhere you checked and what you found (partial matches, expired tokens, wrong-format values).
    ```

    Use `Agent(subagent_type: "general-purpose", model: "haiku")` with `run_in_background: true`. Continue to the next service while the hunt runs. When the agent returns, present findings to the user for confirmation.

  - **"Skip"** → record as skipped in `$PREFS_PATH`, move on.

**On selection**, use the chosen value as the source of truth and — with the user's consent — optionally propagate it back to the other sources (e.g. "Also update ~/.zshrc and Doppler to match?"). Default to NO for propagation unless the user opts in.

---

#### Shared: credential auto-scan

**This section applies specifically to channel tokens (Telegram, Slack).** For all other steps, see the [Universal Credential Auto-Scan](#universal-credential-auto-scan) section above — the same pattern applies everywhere.

**Before prompting the user to paste any token**, scan for it using the Universal Credential Auto-Scan sequence above. Show the user what was found and ask them to confirm or override. Never silently use a token without confirmation.

---

### 3a — Telegram (user-auth via ops-telegram-autolink)

**Always ask before starting the Telegram flow** — even when the user selected "all channels". Use `AskUserQuestion`:

```
Set up Telegram personal account access?
  [Yes — enter my phone number and authenticate]
  [Skip Telegram]
```

If the user skips, record `channels.telegram = "skipped"` in `$PREFS_PATH` and move on. Do NOT silently mark Telegram as unconfigured — the explicit skip prevents the status header from showing `○ telegram (no token)` as an action item on subsequent runs.

**Rate-limit guard**: Before starting, check `$PREFS_PATH` for `channels.telegram` being an object with `.status == "rate_limited"` — use a type guard: `if (channels.telegram | type) == "object" and .channels.telegram.status == "rate_limited"` (jq: `if (.channels.telegram | type) == "object" then .channels.telegram.status else "skipped" end`). If `retry_after` is in the future, present the user with `AskUserQuestion`:
```
Telegram is rate-limited until [time]. What would you like to do?
  [Wait and retry after cooldown — re-run /ops:setup telegram after [time]]
  [Skip Telegram for now]
```
Do NOT attempt `send_password` during a rate-limit window — it will fail immediately and may extend the cooldown. If the user selects Skip, record the skip in `$PREFS_PATH` and move to the next channel.

**Bots cannot read user DMs**, so `/ops-inbox telegram` requires a personal-account MCP. The plugin ships `bin/ops-telegram-autolink.mjs` which:

1. Scans scout sources (keychain → ~/.claude.json → shell profiles → Doppler) for previously-extracted `TELEGRAM_API_ID` / `TELEGRAM_API_HASH` / `TELEGRAM_SESSION`.
2. If none found, makes plain HTTP requests to `my.telegram.org` (no browser — `my.telegram.org` uses server-side HTML, no JS required), logs in with a phone code from the bridge file, creates an app if needed, and extracts api_id + api_hash.
3. Runs gram.js `client.start()` to generate a session string, bridging the second code via the same file.
4. Emits final JSON on stdout: `{api_id, api_hash, phone, session}`.

Sub-flow (only runs if user selected Yes above):

1. **Scout first.** Check keychain for previously-extracted Telegram credentials:

   ```bash
   for svc in telegram-api-id telegram-api-hash telegram-phone telegram-session; do
     security find-generic-password -s "$svc" -w 2>/dev/null && echo "FOUND: $svc"
   done
   ```

   Also check `~/.claude.json mcpServers.telegram.env.TELEGRAM_API_ID`. If all 4 are found and the stored `TELEGRAM_SESSION` decodes as a StringSession, tell the user `"✓ Telegram already configured (api_id=XXXXXXX, phone=+XX...)"` and skip to step 8.

2. **Ask the user for their phone number** via `AskUserQuestion` with a single free-text option. Do NOT offer country-specific presets or example numbers — just one option that prompts for direct input:

   ```
   Enter your Telegram phone number (include country code, e.g. +31612345678):
     [Enter phone number — type your full number starting with +]
   ```

   The user will select this option and type their number in the "Other" free-text field. Validate it matches `^\+\d{7,15}$`. Explain that the phone is only used once during the first-run extraction and is stored locally only.

3. **Warn about 2 codes.** Inform the user via `AskUserQuestion`: `"Telegram will send TWO codes to your Telegram app — one for my.telegram.org web login, then a second one for gram.js auth. Have your Telegram app ready."` Options: `[I'm ready]`, `[Cancel]`.

4. **Spawn the autolink script in the background with restrictive file perms:**

   ```bash
   (umask 077 && node "${CLAUDE_PLUGIN_ROOT}/bin/ops-telegram-autolink.mjs" --phone "$PHONE" 2>/tmp/ops-telegram-autolink.log 1>/tmp/ops-telegram-autolink.out &)
   echo $! > /tmp/ops-telegram-autolink.pid
   ```

   Use the Bash tool's `run_in_background: true`. The `umask 077` creates all bridge files (log, out) with mode 0600. The .out file contains the full credential JSON including the gram.js session string — if it's world-readable, any local process can exfiltrate long-lived Telegram account access.

5. **Poll the stderr log for `need_code` events.** Every 3 seconds, read `/tmp/ops-telegram-autolink.log` and look for the most recent `{"type":"need_code", ...}` line that hasn't been answered yet. When you see one:
   - Determine which code: `channel: "web_login"` (first) or `channel: "gram_auth"` (second).
   - Use `AskUserQuestion` with a free-text input: `"Enter the code Telegram just sent to your Telegram app:"`. **Do NOT say "digits only"** — Telegram web login codes can contain letters, hyphens, and underscores (e.g. `Zv_-ef77YSU`). The autolink's bridge file accepts any 3-20 character alphanumeric+hyphen+underscore string.
   - Write the code to `/tmp/telegram-code.txt` with restrictive perms: `Bash: (umask 077 && printf '%s' "$CODE" > /tmp/telegram-code.txt)`. The `umask 077` is critical — without it the file is created world-readable on macOS (where `/tmp` is `drwxrwxrwt`) and any local process can race to read the code during the 2s poll window.
   - **Verify the code was consumed** within 10 seconds: `ls /tmp/telegram-code.txt 2>/dev/null`. If the file still exists after 10s, the script's validation regex rejected the code. Read the log for errors. Do NOT re-run the script or request a new code — that burns a login attempt.
   - Wait for the next event.
   - If you see `{"type":"need_password"}`, handle 2FA: ask the user via `AskUserQuestion` and write to `/tmp/telegram-password.txt` with `(umask 077 && printf '%s' "$PW" > /tmp/telegram-password.txt)`. Same perm hardening as the code file. The 2FA password is far more sensitive than a one-time code.

6. **Wait for the script to exit.** Poll until the process is no longer running (`ps -p "$(cat /tmp/ops-telegram-autolink.pid)"`). Read `/tmp/ops-telegram-autolink.out` — it should contain a single JSON line with `api_id`, `api_hash`, `phone`, and `session`. **Security note**: the setup skill should have dispatched the autolink with `(umask 077 && node "${CLAUDE_PLUGIN_ROOT}/bin/ops-telegram-autolink.mjs" --phone "$PHONE" 2>/tmp/ops-telegram-autolink.log 1>/tmp/ops-telegram-autolink.out &)` so the .log and .out files get 0600 mode. Verify with `stat -f '%Lp' /tmp/ops-telegram-autolink.out` → must print `600`. Immediately `shred -u` (Linux) or `rm -P` (macOS) the .out file after reading the credentials into memory.

   **Error recovery — CRITICAL: do NOT burn login attempts.** Each `send_password` call counts toward Telegram's rate limit (~3-5 per 8 hours). If the autolink fails:

   - **`"could not extract ... after 6 extraction strategies"` / extraction failure**: The HTML parsing failed but the login succeeded. Do NOT re-run the script. Instead, check if the error includes `html_snippet` — the snippet shows the stripped page text. If it contains a 5-12 digit number near "api_id" and a 32-char hex near "api_hash", extract them directly with grep/regex from the snippet. If the snippet shows a login page or redirect, the session expired during extraction.
   - **`rate-limited`**: Record `channels.telegram.status = "rate_limited"` and `channels.telegram.retry_after` (now + 8 hours) in `$PREFS_PATH`. Move on to the next channel. On subsequent `/ops:setup` runs, check `retry_after` and skip Telegram if the cooldown hasn't expired.
   - **Code file not consumed**: If `/tmp/telegram-code.txt` still exists 10+ seconds after writing, the validation regex rejected it. Read the file contents and the log. Do NOT ask the user for another code — the original code is still valid, you just need to fix the bridge.
   - **General rule**: You get at most 2 `send_password` attempts per setup session. If the first attempt fails for a non-rate-limit reason, diagnose the root cause before trying again. If the second attempt fails, save state and move on.

7. **Persist to keychain + preferences.** macOS only:

   ```bash
   security add-generic-password -U -s telegram-api-id -a "$USER" -w "$API_ID"
   security add-generic-password -U -s telegram-api-hash -a "$USER" -w "$API_HASH"
   security add-generic-password -U -s telegram-phone -a "$USER" -w "$PHONE"
   security add-generic-password -U -s telegram-session -a "$USER" -w "$SESSION"
   ```

   Then update `$PREFS_PATH` with `channels.telegram = {backend: "gram.js", api_id: "...", phone: "...", status: "configured"}`. **Never write the api_hash or session to preferences.json** — those stay in keychain only. preferences.json gets only the non-sensitive metadata.

8. **Auto-configure the MCP server.** Write the credentials directly into the plugin's user config so the user doesn't have to manually paste anything:

   ```bash
   # Read existing user config or create empty
   USER_CONFIG="${CLAUDE_PLUGIN_DATA_DIR:-$HOME/.claude/plugins/data/ops-ops-marketplace}/user-config.json"
   mkdir -p "$(dirname "$USER_CONFIG")"

   # Write Telegram credentials to user config
   jq -n \
     --arg api_id "$API_ID" \
     --arg api_hash "$API_HASH" \
     --arg phone "$PHONE" \
     --arg session "$SESSION" \
     '{telegram_api_id: $api_id, telegram_api_hash: $api_hash, telegram_phone: $phone, telegram_session: $session}' \
     > "${USER_CONFIG}.tmp"

   # Merge with existing config if present
   if [ -f "$USER_CONFIG" ]; then
     jq -s '.[0] * .[1]' "$USER_CONFIG" "${USER_CONFIG}.tmp" > "${USER_CONFIG}.new" && mv "${USER_CONFIG}.new" "$USER_CONFIG"
     rm -f "${USER_CONFIG}.tmp"
   else
     mv "${USER_CONFIG}.tmp" "$USER_CONFIG"
   fi
   chmod 600 "$USER_CONFIG"
   ```

   Also update `~/.claude.json` MCP server config if the telegram server entry exists — inject the credentials as env vars:

   ```bash
   # Update .claude.json mcpServers.telegram.env with actual values
   CLAUDE_JSON="$HOME/.claude.json"
   if [ -f "$CLAUDE_JSON" ] && jq -e '.mcpServers.telegram' "$CLAUDE_JSON" >/dev/null 2>&1; then
     jq --arg id "$API_ID" --arg hash "$API_HASH" --arg phone "$PHONE" --arg session "$SESSION" \
       '.mcpServers.telegram.env.TELEGRAM_API_ID = $id | .mcpServers.telegram.env.TELEGRAM_API_HASH = $hash | .mcpServers.telegram.env.TELEGRAM_PHONE = $phone | .mcpServers.telegram.env.TELEGRAM_SESSION = $session' \
       "$CLAUDE_JSON" > "${CLAUDE_JSON}.tmp" && mv "${CLAUDE_JSON}.tmp" "$CLAUDE_JSON"
   fi
   ```

   Print:
   ```
   ✓ Telegram configured automatically.
     API ID:  [api_id]
     Phone:   [phone]
     Session: stored in keychain + MCP config
     Restart Claude Code to activate the Telegram MCP server.
   ```

9. **Smoke test (optional).** Spawn `node ${CLAUDE_PLUGIN_ROOT}/telegram-server/index.js` with the env vars set inline for 3 seconds. If it doesn't print an auth error, the session works.

**Privacy notes for the user** (show once at start):

- The phone number and all credentials stay on your machine. The wizard never transmits them anywhere except to Telegram's own servers during the HTTP login flow.
- If you already have a gram.js / Telethon session for another project, you can skip this and paste those values manually into `/plugin settings`.
- If Telegram replies "Sorry, too many tries. Please try again later." your account is rate-limited for ~8 hours — the wizard cannot bypass this. Wait and retry.

> **Deep-dive:** see `${CLAUDE_PLUGIN_ROOT}/skills/ops-comms/SKILL.md` for full operational instructions, CLI reference, and troubleshooting for this integration. The setup agent can load that file directly when it needs more depth than this wizard provides.

### 3b — WhatsApp (doctor + self-heal + backfill)

WhatsApp is the channel that most often breaks silently. The wizard must **auto-diagnose, doctor, and fix** — not just report status and give up. Run this whole sub-flow top-to-bottom, stopping only when the system is healthy or the user declines a remediation.

#### Step 3b.1 — Presence

Run `command -v wacli`. If missing, ask `AskUserQuestion`: `[Show install docs]`, `[Skip WhatsApp]`. On install docs, print:

```
wacli is not on Homebrew. Install:
  git clone https://github.com/Lifecycle-Innovations-Limited/wacli ~/src/wacli
  cd ~/src/wacli && go build -o /usr/local/bin/wacli ./cmd/wacli
```

and stop this sub-flow.

#### Step 3b.2 — Collect state

Run these in parallel:

```bash
wacli doctor --json 2>&1
wacli auth status --json 2>&1
wacli messages list --after="$(date -v-1d +%Y-%m-%d 2>/dev/null || date -d '1 day ago' +%Y-%m-%d)" --limit=5 --json 2>&1
wacli chats list --json 2>&1 | head -c 4000
```

Parse:

- `doctor.data.authenticated` (bool)
- `doctor.data.lock_held` + `doctor.data.lock_info` (PID + acquired_at timestamp)
- `doctor.data.fts_enabled` (bool — if false, search is degraded, not fatal)
- `messages.data.messages` length → **this is the key health signal**. Authed with zero messages in the last 24h = broken.
- `chats` count and whether it populated at all

#### Step 3b.3 — Diagnose and classify

Apply these rules in order. Stop at the first match.

**A. Not authenticated**
If `doctor.authenticated: false` → print "WhatsApp needs QR pairing. Run `wacli auth` in a separate terminal and scan the QR code with your phone (WhatsApp → Linked Devices → Link a device), then re-run /ops:setup whatsapp." End of sub-flow. Do **not** try to automate the QR scan — it requires the user's phone camera pointed at the terminal (exception to Rule 2).

**B. Stuck sync (stale lock)**
If `lock_held: true` AND the `lock_info.acquired_at` is older than 2 minutes AND the lock-holder PID is still alive (`ps -p <pid>`):

1. Run `wacli sync` in the background (`timeout 15 wacli sync 2>&1`) via the existing process's stderr tail — OR if we can't tee into it, fall back to:
2. Ask `AskUserQuestion`: `"A wacli sync process (pid=N) has been holding the store lock for Xm. Most likely stuck. Kill it?"` → `[Kill pid N and restart sync]`, `[Leave it running]`.
3. On kill: `kill <pid>` (not -9 first). Wait 3s. If still alive, `kill -9 <pid>`. Verify with `ps -p <pid>`.
4. After kill, re-run `wacli doctor --json` to confirm lock is released. Continue to the next rule.

**C. App-state key desync (the big one)**
Run `timeout 15 wacli sync 2>&1 | tee /tmp/wacli-sync-probe.log` (must be done after B so the lock is free). Grep the output for:

- `didn't find app state key` → **session keys are desynced**, needs re-pair
- `failed to decode app state` → same class of error
- `Failed to do initial fetch of app state` → same class of error

If any match:

1. Print the diagnosis verbatim:
   ```
   ⚠  WhatsApp session is authenticated but the app-state decryption keys
      are out of sync with your primary device. This happens when the
      linked-device session is partially wiped on the phone side.
      Symptom: sync runs but 0 messages come through.
      Fix: logout this session and re-pair via QR.
   ```
2. Ask `AskUserQuestion`: `[Logout and walk me through re-pair]`, `[Skip — I'll fix manually]`.
3. On logout: run `wacli auth logout --json` and show the result. Then print:
   ```
   Now run `wacli auth` in a separate terminal (QR-based auth — requires your phone camera).
   A QR code will appear — scan it from WhatsApp → Settings → Linked Devices → Link a device.
   When it says "Connected", come back and type "done".
   ```
4. Wait for the user to confirm via `AskUserQuestion`: `[Done — re-paired]`, `[Cancel]`.
5. On Done, re-run Step 3b.2 to re-collect state and continue to rule D.

**D. Authenticated, lock free, no recent messages, no key errors**
This is usually a cold cache. Go to Step 3b.4 (backfill).

**E. Healthy (messages flowing)**
If `messages.data.messages` has ≥1 entry from the last 24h, print a ✓ summary and skip to Step 3b.5.

#### Step 3b.4 — Historical backfill (background, silent)

Always run this after a fresh re-pair, AND run it when rule D matches. Never skip unless the user explicitly declines.

Backfill is a background optimization — it should not produce verbose output or alarming status messages. Run it silently and swallow non-fatal errors.

1. Load the top 10 chats by recency:
   ```bash
   wacli chats list --json 2>&1 | jq -r '[.data[] | select(.jid) | {jid, name, last_msg: .last_message_ts}] | sort_by(.last_msg) | reverse | .[0:10]'
   ```
2. Tell the user: `"Running historical backfill on your 10 most-recent chats. This runs in the background."` Do not print per-chat progress or 0-message results.
3. For each chat JID, run **sequentially** (backfill shares the store lock, can't parallelize):
   ```bash
   wacli history backfill --chat="<jid>" --count=50 --requests=2 --wait=30s --idle-exit=5s --json 2>&1
   ```
4. **Suppress all per-chat output.** If the command exits non-zero, swallow the error silently — backfill failures are not user-visible events. Do NOT print "0 messages synced", error tracebacks, or explanations about device connectivity.
5. After the loop completes, print only the final health summary (Step 3b.6).

#### Step 3b.5 — FTS index check (optional)

If `doctor.fts_enabled: false`, print:

```
ℹ  Full-text search is disabled — `wacli messages search` will use SQL LIKE (slower).
   This is a non-fatal known-limitation. See wacli docs to enable FTS5.
```

Don't block on this.

#### Step 3b.6 — Record state

Write `channels.whatsapp = "wacli"` to `$PREFS_PATH` and print the final ✓ summary:

```
✓ WhatsApp — wacli authenticated, N chats
```

Never include message counts or backfill results in this summary line.

#### Step 3b.7 — Persistent connection (keepalive)

After successful auth and backfill, set up a persistent connection that keeps wacli connected and auto-syncing. This is what makes WhatsApp reliable across sessions — without it, the linked device disconnects after ~14 days of inactivity and @lid JIDs return empty messages.

**If the ops-daemon is configured (Step 5b), wacli runs as a daemon service** — skip the standalone launchd path below and note to the user that wacli sync is managed by the daemon. The daemon handles bootstrap, auto-backfill, and health reporting centrally.

**Standalone launchd fallback** (only if the ops-daemon is NOT being set up):

**1. Install the keepalive script:**

```bash
KEEPALIVE_SCRIPT="${CLAUDE_PLUGIN_ROOT}/scripts/wacli-keepalive.sh"
chmod +x "$KEEPALIVE_SCRIPT"
```

**2. Generate the launchd plist from template:**

```bash
PLIST_TEMPLATE="${CLAUDE_PLUGIN_ROOT}/scripts/com.claude-ops.wacli-keepalive.plist"
PLIST_DEST="$HOME/Library/LaunchAgents/com.claude-ops.wacli-keepalive.plist"
LOG_DIR="$HOME/.claude/plugins/data/ops-ops-marketplace/logs"
mkdir -p "$LOG_DIR" "$HOME/Library/LaunchAgents"

# Resolve bash 4+ (same logic as daemon plist)
BASH_PATH="/bin/bash"
if [[ -x /opt/homebrew/bin/bash ]]; then
  BASH_PATH="/opt/homebrew/bin/bash"
elif [[ -x /usr/local/bin/bash ]]; then
  BASH_PATH="/usr/local/bin/bash"
fi

sed -e "s|__KEEPALIVE_SCRIPT_PATH__|$KEEPALIVE_SCRIPT|g" \
    -e "s|__BASH_PATH__|$BASH_PATH|g" \
    -e "s|__LOG_DIR__|$LOG_DIR|g" \
    -e "s|__HOME__|$HOME|g" \
    "$PLIST_TEMPLATE" > "$PLIST_DEST"
```

**3. Load the agent:**

```bash
# Unload if already loaded (idempotent)
launchctl bootout gui/$(id -u) "$PLIST_DEST" 2>/dev/null || true
launchctl bootstrap gui/$(id -u) "$PLIST_DEST"
```

**4. Verify it's running:**

Wait 3 seconds, then check:
```bash
launchctl print gui/$(id -u)/com.claude-ops.wacli-keepalive 2>&1 | head -5
cat "$HOME/.wacli/.health" 2>/dev/null
```

If the health file shows `status=connected` or `status=needs_reauth`, the daemon is working. Print:

```
✓ WhatsApp keepalive — launchd agent installed and running
  Persistent sync active. Auto-restarts on disconnect.
  Health: ~/.wacli/.health | Logs: ~/.claude/plugins/data/ops-ops-marketplace/logs/
```

If `status=needs_reauth`, immediately trigger the re-pair flow from Step 3b.3 Rule C.

**5. How the keepalive self-heals:**

The keepalive script (`wacli-keepalive.sh`) handles these failure modes automatically:

| Failure | Auto-fix |
|---------|----------|
| Orphaned wacli process holding lock | Kills stale PIDs, clears lock |
| Connection drop (WhatsApp server restart) | launchd restarts within 60s |
| App-state key desync | Writes `needs_reauth` to health file — ops skills detect this and prompt QR |
| Auth expired | Writes `needs_auth` — same prompt flow |
| Script crash | launchd KeepAlive=true restarts immediately (throttled 60s) |

**6. Health file contract for other ops skills:**

All ops skills that use WhatsApp (`ops-inbox`, `ops-comms`, `ops-go`) MUST check `~/.wacli/.health` before attempting wacli commands. If `status=needs_auth` or `status=needs_reauth`:

1. Print the diagnosis to the user:
   ```
   ⚠ WhatsApp needs re-authentication.
   Run `wacli auth` in a separate terminal and scan the QR code with your phone
   (QR-based auth — exception to Rule 2). Then type "done" to continue.
   ```
2. Use `AskUserQuestion`: `[Done — re-paired]`, `[Skip WhatsApp]`.
3. On Done: restart the keepalive daemon via `launchctl kickstart -k gui/$(id -u)/com.claude-ops.wacli-keepalive` and wait 5s for health file update.

This ensures the user is never silently left with a broken WhatsApp connection — every ops skill surfaces the problem and walks them through the fix.

> **Deep-dive:** see `${CLAUDE_PLUGIN_ROOT}/skills/ops-comms/SKILL.md` and `${CLAUDE_PLUGIN_ROOT}/skills/ops-inbox/SKILL.md` for full operational instructions, CLI reference, and troubleshooting for this integration. The setup agent can load those files directly when it needs more depth than this wizard provides.

### 3c — Email

Email has two possible backends, tried in this order:

#### Preferred: `gog` CLI

`gog` is the email + calendar CLI that `ops-inbox` and `ops-comms` call by default. It's a self-contained binary with its own OAuth token at `~/.gog/token.json` — full read + send permissions, no Claude Desktop config required.

1. Check `gog` on PATH with `command -v gog`.
2. **If installed**, run `gog auth status 2>&1 || true` and show the output.
   - If auth is red (not authenticated / token expired / exit != 0), run `gog auth add "$USER_EMAIL" --services gmail,calendar,drive,contacts,docs,sheets` via Bash tool with `run_in_background: true` (it opens a browser for the OAuth flow). Tell the user: "Opening browser for Gmail OAuth — complete the sign-in there, then type 'done'." Use `AskUserQuestion`: `[Done — authenticated]`, `[Skip email]`.
   - If auth is green, probe with:
     ```bash
     gog gmail labels list --json 2>&1 | head -5
     ```
     If this returns JSON containing a `labels` array, gog is authenticated and the Gmail API is working. Report ✓. If the output is an error or empty, treat as broken and instruct the user to re-run `gog auth add <email> --services gmail,calendar,drive,contacts,docs,sheets`.
   - Record `channels.email = "gog"` in `$PREFS_PATH` and stop here.

#### Fallback: Claude Gmail MCP connector

If `gog` is not on PATH, look at the detector's `mcp_configured` array for any entry matching (case-insensitive) `gmail`, `google-mail`, or `claude_ai_Gmail` — these are the common names for Anthropic's Gmail connector or user-installed Gmail MCP servers.

3. **If a Gmail MCP is configured**, ask `AskUserQuestion`:
   - `[Use Gmail MCP (read-only fallback)]`
   - `[Install gog instead — show docs]`
   - `[Skip email]`
4. On "Use Gmail MCP", record `channels.email = "mcp:<name>"` in `$PREFS_PATH` (where `<name>` is the actual MCP server name you found) and **print this warning verbatim**:
   ```
   ⚠  Using the Gmail MCP connector as a fallback.
      Read operations (list inbox, search, fetch) will work.
      SEND operations will fail until you explicitly grant send permissions
      in Claude Desktop → Settings → Connectors → Gmail → Permissions.
      The ops plugin cannot grant those permissions for you — it's a Claude
      Desktop-side setting tied to your account.
      If you want unattended sending from ops-comms, install `gog` instead.
   ```
5. On "Install gog instead", print the OS-appropriate install command:

   | OS            | Command                                                       |
   |---------------|---------------------------------------------------------------|
   | macOS / Linuxbrew | `brew install gogcli`                                     |
   | Windows       | `winget install -e --id steipete.gogcli`                      |
   | Arch Linux    | `yay -S gogcli`                                               |
   | From source   | `git clone https://github.com/steipete/gogcli.git && cd gogcli && make` |

   Docs: <https://gogcli.sh/> · Repo: <https://github.com/steipete/gogcli>

   After install, authorise once per account:
   ```bash
   gog auth credentials /path/to/client_secret.json
   gog auth add you@example.com --services gmail,calendar,drive,contacts,docs,sheets
   ```
   Refresh tokens are stored in the OS keyring (Keychain on macOS, Secret Service / libsecret on Linux, Credential Manager on Windows). Then stop this sub-flow and wait for the user to re-run `/ops:setup email`.

#### Neither available

6. **If `gog` is missing AND no Gmail MCP is configured**, ask `AskUserQuestion`:
   - `[Install gog — show docs]`
   - `[Add a Gmail MCP — show docs]` → print `claude mcp add gmail` and tell the user to re-run `/ops:setup email` after
   - `[Skip email for now]`
7. Whatever the user picks, record the resulting state in `$PREFS_PATH` (either `channels.email = "gog"`, `channels.email = "mcp:<name>"`, or omit the key entirely).

> **Deep-dive:** see `${CLAUDE_PLUGIN_ROOT}/skills/ops-inbox/SKILL.md` and `${CLAUDE_PLUGIN_ROOT}/skills/ops-comms/SKILL.md` for full operational instructions, CLI reference, and troubleshooting for this integration. The setup agent can load those files directly when it needs more depth than this wizard provides.

### 3d — Slack (scout + ops-slack-autolink)

Slack's official API requires workspace admin approval for most useful scopes. The `slack-mcp-server` MCP uses **browser-session tokens** (xoxc + xoxd) that are per-user — no admin approval needed. The plugin ships `bin/ops-slack-autolink.mjs` which:

1. **Phase 1 — scout** — checks for already-extracted tokens in:
   - `~/.claude.json mcpServers.slack.env` (where Claude Code stores them)
   - Process env (`SLACK_MCP_XOXC_TOKEN` / `SLACK_MCP_XOXD_TOKEN` / `SLACK_BOT_TOKEN`)
   - macOS keychain (`slack-xoxc`, `slack-xoxd`)
   - Shell profile files (`~/.zshrc`, `~/.bashrc`, `~/.zprofile`, `~/.envrc`)
   - Doppler (`doppler secrets --json`)
2. **Phase 2 — Playwright extraction** — only if nothing is found, launches a persistent-profile Chromium, opens `https://app.slack.com/client/`, asks the user to log in (or uses an existing session for headless runs), then pulls `xoxc-...` from `localStorage.localConfig_v2.teams[teamId].token` and the `d=...` cookie (`xoxd-...`) from the cookie jar.

Ported from [maorfr/slack-token-extractor](https://github.com/maorfr/slack-token-extractor) (Python → Node).

Sub-flow:

1. **Scout first.** Run:

   ```bash
   node "${CLAUDE_PLUGIN_ROOT}/bin/ops-slack-autolink.mjs" --scout-only 2>/tmp/ops-slack.log
   ```

   Parse the stdout JSON. If non-empty with `xoxc_token` + `xoxd_token`, report `"✓ Slack already configured (source=XXX)"` and skip to step 5.

2. **If no existing tokens**, ask via `AskUserQuestion`:
   - `[Extract tokens via Playwright (Recommended)]` → runs the autolink in headed mode.
   - `[I'll paste tokens manually]` → collect `xoxc-...` and `xoxd-...` via two free-text `AskUserQuestion`s.
   - `[Skip Slack]`

3. **On Playwright path**: spawn the autolink in the background:

   ```bash
   (umask 077 && node "${CLAUDE_PLUGIN_ROOT}/bin/ops-slack-autolink.mjs" \
     --workspace "https://app.slack.com/client/" \
     2>/tmp/ops-slack-autolink.log 1>/tmp/ops-slack-autolink.out &)
   echo $! > /tmp/ops-slack-autolink.pid
   ```

   Poll the log for `{"type":"need_login"}`. When you see it, use `AskUserQuestion`:
   `"A Chromium window should be open on your desktop. Log in to Slack there, then pick [Done]."`. On Done, `touch /tmp/slack-login-done`. The script will finish and write the extracted tokens to `/tmp/ops-slack-autolink.out`.

4. **If Playwright is not installed** (script exits with `playwright is not installed`), offer:
   - `[Install Playwright now]` → run `cd ${CLAUDE_PLUGIN_ROOT}/telegram-server && npm install playwright && npx playwright install chromium` (background, ~150MB download, report progress).
   - `[Fall back to manual paste]` → go to step 2 manual path.

5. **Validate tokens.** Call the Slack auth endpoint with exact syntax:
   ```bash
   curl -s -H "Authorization: Bearer XOXC_TOKEN" -b "d=XOXD_TOKEN" "https://slack.com/api/auth.test"
   ```
   Expect `{"ok":true, "team_id":"T...", "user_id":"U...", "url":"https://<workspace>.slack.com/"}`. If `ok:false`, show the error and re-ask.

6. **Persist.**
   - Keychain: `security add-generic-password -U -s slack-xoxc -a "$USER" -w "$XOXC"; security add-generic-password -U -s slack-xoxd -a "$USER" -w "$XOXD"`.
   - `$PREFS_PATH` → `channels.slack = {backend: "mcp:slack", team_id: "...", source: "...", status: "configured"}`. **Do not** store the raw tokens in preferences.json — keychain only.

7. **Wire into Claude Code plugin settings.** Print instructions:

   ```
   Slack tokens saved to keychain. To activate the MCP, Claude Code needs them
   in ~/.claude.json. Since this skill can't write to ~/.claude.json directly,
   either:
     a) Run: claude mcp add slack --transport stdio -- npx -y slack-mcp-server@latest --transport stdio
        and Claude Code will prompt for the env vars.
     b) Manually paste the xoxc + xoxd into /plugin settings for the Slack MCP.
   ```

   (The reason we don't auto-write: per user-level feedback, ~/.claude.json is a Claude Code internal file and the plugin must not touch it. MCP registration is Claude Code's responsibility.)

8. **Smoke test**: call `https://slack.com/api/conversations.list?limit=1` with the tokens. Expect `ok:true` with at least one channel in the response.

**Privacy notes**:

- Tokens work as long as your browser session stays active — typically weeks to months with regular Slack usage. If the MCP starts returning 401s, re-run `/ops:setup slack`.
- Logging out of Slack invalidates the `d` cookie and breaks the MCP. Use `/ops:setup slack` to re-extract.
- Slack's Terms of Service allow personal-session-token use for your own account. Do not use this flow to access accounts you don't own.

> **Deep-dive:** see `${CLAUDE_PLUGIN_ROOT}/skills/ops-comms/SKILL.md` and `${CLAUDE_PLUGIN_ROOT}/skills/ops-inbox/SKILL.md` for full operational instructions, CLI reference, and troubleshooting for this integration. The setup agent can load those files directly when it needs more depth than this wizard provides.

### 3e — Notion (MCP integration)

**Always ask before starting the Notion flow** — even when the user selected "all channels". Use `AskUserQuestion`:

```
Set up Notion workspace integration?
  [Yes — configure Notion]
  [Skip Notion]
```

If the user skips, record `channels.notion = "skipped"` in `$PREFS_PATH` and move on.

#### Detection

1. **Check for existing claude.ai Notion integration.** Scan the detector's `mcp_configured` array for any entry matching `Notion`, `claude_ai_Notion`, or `notion`. If found, set `NOTION_MCP_ENABLED=true` and skip to verification.

2. **Check for self-hosted Notion MCP server.** Look in `~/.claude/settings.json` for `mcpServers.notion` or any entry with `notion` in its args/command.

#### Setup paths

**Path A — Claude.ai integration (recommended):**

If no existing integration detected, present `AskUserQuestion`:
```
How would you like to connect Notion?
  [Claude.ai integration (Recommended) — add via claude.ai settings]
  [Self-hosted MCP — use your own Notion API key]
  [Skip Notion]
```

For claude.ai integration:
1. Tell the user: "Add Notion integration at claude.ai > Settings > Integrations > Notion. Authorize access to your workspace, then type 'done'."
2. Use `AskUserQuestion`: `[Done — connected]`, `[Skip Notion]`
3. On "Done", verify by testing `mcp__claude_ai_Notion__notion-search` with a simple query

**Path B — Self-hosted MCP:**

1. Scout keychain for existing Notion API key:
   ```bash
   security find-generic-password -s "notion-api-key" -w 2>/dev/null || \
   security find-generic-password -s "NOTION_API_KEY" -w 2>/dev/null || echo ""
   ```
2. If not found, ask the user:
   ```
   Enter your Notion integration token (starts with ntn_):
     Create one at https://www.notion.so/my-integrations
     [Paste token now]  [Skip Notion]
   ```
3. Store the token:
   ```bash
   security add-generic-password -s "notion-api-key" -a "claude-ops" -w "$TOKEN" -U
   ```
4. Add MCP server config to `~/.claude/settings.json` under `mcpServers.notion`

#### Verification

Test the integration (run in background):
```bash
# For claude.ai: integration auto-detected — test via MCP tool call
# For self-hosted: verify API key works
if [ -n "$NOTION_API_KEY" ]; then
  curl -s -o /dev/null -w "%{http_code}" -H "Authorization: Bearer $NOTION_API_KEY" -H "Notion-Version: 2022-06-28" https://api.notion.com/v1/users/me | grep -q "200" && echo "OK" || echo "FAIL"
else
  echo "OK — claude.ai integration (verify via MCP tool call after restart)"
fi
```

#### Finalize

1. Set `NOTION_MCP_ENABLED=true` in `~/.claude/settings.json` env section
2. Record `channels.notion = {"backend": "mcp:notion", "status": "configured", "source": "<claude-ai|self-hosted>"}` in `$PREFS_PATH`
3. Add `"notion"` to `default_channels` array in `$PREFS_PATH`
4. Print: `✓ Notion — workspace connected via [source]`

> **Deep-dive:** see `${CLAUDE_PLUGIN_ROOT}/skills/ops-inbox/CHANNELS.md` for full Notion MCP tool reference and troubleshooting.

### 3f — Calendar

Calendar isn't a messaging channel, but every other ops skill (briefings, `/ops-next`, `/ops-go`) benefits massively from knowing the user's schedule — meetings blocking deep work, deploy windows, travel days. The wizard wires it up the same way as email: `gog calendar` primary, Google Calendar MCP connector fallback.

#### Preferred: `gog calendar`

`gog` (the `gogcli` binary — see Step 3c) already handles email; the same binary exposes `gog calendar` with the same OAuth token. No additional auth needed if Step 3c went green. Note: `gog cal` is **not** a valid alias — always use `gog calendar`.

1. Check `gog` on PATH with `command -v gog`.
2. **If installed and already authed from Step 3c**, probe:
   ```bash
   gog calendar calendars --json 2>&1 | head -20
   ```
   If this returns JSON with calendar metadata, record `channels.calendar = "gog"` in `$PREFS_PATH` and print `✓ Calendar — gog calendar`. Stop here.
3. **If gog is installed but calendar scope is missing** (typical error: `insufficient scope` or `403 insufficient_permissions`), print:
   ```
   Your gog OAuth token doesn't include the calendar scope.
   Re-add the account with the calendar service via Bash tool with `run_in_background: true`:
     gog auth add "$USER_EMAIL" --services gmail,calendar,drive,contacts,docs,sheets
   Tell the user: "Opening browser for Calendar OAuth — complete the sign-in there, then type 'done'." Use `AskUserQuestion`: `[Done — re-authorized]`, `[Skip calendar]`.
   ```
   Do not attempt to re-auth from the skill — it's a browser flow.

#### Fallback: Claude Google Calendar MCP connector

4. **If gog is not on PATH**, scan the detector's `mcp_configured` array for any entry matching (case-insensitive) `calendar`, `google-calendar`, or `claude_ai_Calendar`.
5. If found, ask `AskUserQuestion`:
   - `[Use Google Calendar MCP (read-only fallback)]`
   - `[Install gog instead — show docs]`
   - `[Skip calendar]`
6. On "Use Google Calendar MCP", record `channels.calendar = "mcp:<name>"` in `$PREFS_PATH` and **print this warning verbatim**:
   ```
   ⚠  Using the Google Calendar MCP connector as a fallback.
      Read operations (list calendars, fetch events, check free/busy) will work.
      WRITE operations (create events, decline meetings, reschedule) will fail
      until you explicitly grant write permissions in
      Claude Desktop → Settings → Connectors → Google Calendar → Permissions.
      The ops plugin cannot grant those permissions for you.
      If you want ops-next to auto-block focus time or ops-comms to confirm
      meetings, install `gog` instead.
   ```
7. On "Install gog instead", **run the install via Bash** (Rule 2) using the same npm → bun → source-clone chain as Step 3c — either inline the snippet or call `${CLAUDE_PLUGIN_ROOT}/bin/ops-setup-install gog` (background per Rule 4). Only fall back to printing manual instructions if all four attempts fail.

#### Neither available

8. **If `gog` is missing AND no Calendar MCP is configured**, ask:
   - `[Install gog — show docs]`
   - `[Add the Google Calendar MCP — show docs]` → print `claude mcp add google-calendar` and tell the user to re-run `/ops:setup calendar` after
   - `[Skip calendar]`

#### Why this matters (for context in the skill)

Downstream skills (`/ops-go`, `/ops-next`, `/ops-fires`) read `channels.calendar` from `$PREFS_PATH` to decide whether to cross-correlate today's schedule with their output:

- Briefings note "you have a 2pm standup, so don't start that refactor now"
- `/ops-next` deprioritizes deep work when a meeting is <30min away
- `/ops-fires` warns if a production incident falls during a scheduled call
  So this section is not optional for users who want context-aware briefings.

> **Deep-dive:** see `${CLAUDE_PLUGIN_ROOT}/skills/ops-go/SKILL.md` for full operational instructions, CLI reference, and troubleshooting for this integration (calendar context feeds `/ops:go` briefings). The setup agent can load that file directly when it needs more depth than this wizard provides.

### 3g — Doppler (secrets management)

Doppler is a secrets manager that injects environment variables at runtime. When configured, all ops skills can query secrets via `doppler secrets get` instead of reading from dotfiles or keychain. The wizard checks presence, auth status, and default project context.

#### Step 3g.1 — Presence

```bash
command -v doppler
```

If missing, detect the host OS via `uname -s` / `$OSTYPE` / `$OS` and pick the right install command. Ask via `AskUserQuestion`:

```
Doppler CLI is not installed.
  [Install now — <os-specific command>]
  [Skip Doppler]
```

Where the OS-specific command is:

| OS                  | Install command                                                                     |
|---------------------|-------------------------------------------------------------------------------------|
| macOS / Linuxbrew   | `brew install dopplerhq/cli/doppler`                                                |
| Debian / Ubuntu     | `curl -Ls https://cli.doppler.com/install.sh \| sudo sh`                            |
| Fedora / RHEL       | `sudo rpm --import https://packages.doppler.com/public.key && sudo dnf install -y doppler` |
| Arch Linux          | `yay -S doppler-cli`                                                                |
| Alpine              | `apk add --no-cache doppler-cli`                                                    |
| Windows (winget)    | `winget install Doppler.doppler`                                                    |
| Windows (scoop)     | `scoop bucket add doppler https://github.com/DopplerHQ/scoop-doppler.git; scoop install doppler` |

Run the chosen command in the background, capture stdout/stderr, and report success/failure. If the user skips, record `secrets_manager: "none"` in `$PREFS_PATH` and end this sub-flow.

#### Step 3g.2 — Auth status

Run:

```bash
doppler me --json 2>&1
```

Parse the JSON. If the output contains `"error"` or a non-zero exit code, the user is not authenticated. Print:

```
Doppler is not authenticated. Running `doppler login` now...
```

Run `doppler login` via Bash tool with `run_in_background: true` (it opens a browser for the OAuth flow). Tell the user: "Opening browser for Doppler OAuth — complete the sign-in there, then type 'done'." Use `AskUserQuestion`: `[Done — authenticated]`, `[Skip Doppler]`. On Done, re-run `doppler me --json` to verify. If authenticated, `doppler me` will return JSON with `name` and `email` — confirm:

```
✓ Doppler authenticated as <name> (<email>)
```

Never display the name or email unless they came from `doppler me` output in this session.

#### Step 3g.3 — Project context

If authenticated, list available projects:

```bash
doppler projects --json 2>&1
```

Parse the array of project objects. Present them via `AskUserQuestion` with `singleSelect`. **Max 4 options per call** — if there are more than 3 projects, paginate: show 3 projects + `[More projects...]` per page, with `[Skip — don't set a default project]` always as the last option on the final page.

```
Select your default Doppler project (page 1):
  [ ] my-app
  [ ] my-api
  [ ] my-service
  [ ] More projects...
```

If the user selects a project, fetch its configs:

```bash
doppler configs --project <selected_project> --json 2>&1
```

Present available configs via `AskUserQuestion` with `singleSelect` (max 4 options — paginate if needed):

```
Select the default config for <project>:
  [ ] dev
  [ ] staging
  [ ] production
```

Write the selection to `$PREFS_PATH` (merge, don't overwrite):

```json
{
  "secrets_manager": "doppler",
  "doppler": {
    "project": "<selected>",
    "config": "<selected>"
  }
}
```

Print confirmation:

```
✓ Doppler default context set: <project>/<config>
```

#### Step 3g.4 — Document for agents

Print this note so it's visible in the session:

```
All ops skills can now query secrets via:

  doppler secrets get <KEY> --plain --project <project> --config <config>

For example:
  doppler secrets get TELEGRAM_BOT_TOKEN --plain --project my-app --config dev

The project and config above are the defaults saved to preferences.
Individual skills can override with --project / --config flags.
```

> **Deep-dive:** no dedicated skill ships with Doppler — see `${CLAUDE_PLUGIN_ROOT}/docs/memories-system.md` (Runtime Context section) for how downstream skills consume the `secrets_manager` / `doppler.*` values from `$PREFS_PATH` and resolve `doppler:KEY_NAME` references at runtime. The setup agent can load that file directly when it needs more depth than this wizard provides.

#### Step 3g.5 — Doppler MCP Server

After the CLI is configured and authenticated, offer to set up the official `@dopplerhq/mcp-server` MCP integration. This gives Claude direct tool access to Doppler secrets without shelling out.

1. **Check availability**: Run `npx -y @dopplerhq/mcp-server --help 2>&1` in the background. If it exits 0, the package is available.

2. **Generate a service token**: If the user selected a project/config in Step 3g.3, generate a scoped token:
   ```bash
   doppler configs tokens create mcp-server-token --project <project> --config <config> --plain 2>/dev/null
   ```
   If the command fails or if no project/config was selected, ask:
   ```
   Doppler MCP Server needs a token. Options:
     [Generate from CLI (requires project/config)]
     [Paste a token manually]
     [Skip MCP server]
   ```

3. **Save token to userConfig**: Write the token to `doppler_token` in the plugin's `userConfig` (this feeds `.mcp.json` at runtime via `${user_config.doppler_token}`). Also save `doppler_project` and `doppler_config` if selected.

4. **Smoke test**: Verify the MCP server can start:
   ```bash
   DOPPLER_TOKEN="<token>" timeout 10 npx -y @dopplerhq/mcp-server --help 2>&1
   ```
   If it exits 0, the server is functional.

5. **Confirmation**:
   ```
   ✓ Doppler MCP Server configured — secrets accessible via MCP tools (mcp__doppler__*)
   ```

6. **Note for agents**:
   ```
   With the MCP server configured, skills can now query secrets directly via
   MCP tool calls (mcp__doppler__*) instead of shelling out to `doppler secrets get`.
   The Doppler CLI remains available as a fallback when the MCP server is unavailable.
   ```

### 3h — Password Manager (credential vault)

Ops agents frequently need to look up credentials (API keys, database passwords, service tokens) on your behalf. This step wires up a password manager so those queries can be automated via a standard command template stored in `$PREFS_PATH`.

#### Step 3h.1 — Auto-detect installed managers

Run these in parallel:

```bash
command -v op 2>/dev/null && op account list --format=json 2>&1    # 1Password CLI
command -v dcli 2>/dev/null && dcli sync 2>&1                       # Dashlane CLI
command -v bw 2>/dev/null && bw status --raw 2>&1                   # Bitwarden CLI
security find-generic-password -s "test" 2>&1 | head -1             # macOS Keychain (always available)
```

Parse each result to classify as `authenticated`, `needs_unlock`, `not_installed`, or `available` (Keychain is always `available`).

#### Step 3h.2 — Present findings

Show only what was detected via `AskUserQuestion`. **Max 4 options per call.** Since macOS Keychain and Skip are always shown, you have room for at most 2 detected managers per call. If all 3 CLIs (1Password, Dashlane, Bitwarden) are installed, batch into two calls:

**If <=2 CLI managers detected (common case — fits in one call):**
```
Password managers found:
  [1Password — authenticated as <account>]
  [Dashlane — needs unlock]
  [macOS Keychain — always available]
  [Skip — don't connect a password manager]
```

**If all 3 CLI managers detected (rare — batch into two calls):**
Call 1:
```
  [1Password — authenticated as <account>]
  [Dashlane — needs unlock]
  [Bitwarden — <status>]
  [More options...]
```
Call 2:
```
  [macOS Keychain — always available]
  [Skip — don't connect a password manager]
```

Never show managers that aren't installed. Always show macOS Keychain and Skip. If none of the CLIs are installed, skip straight to showing just `[macOS Keychain — always available]` and `[Skip]`.

#### Step 3h.3 — Configure selected manager

**1Password (`op`):**

1. Check auth: `op account list --format=json`
2. If the output is empty or exits non-zero (not signed in), print:
   ```
   1Password CLI is installed but not signed in.
   Run `op signin` via Bash tool with `run_in_background: true`, then re-run /ops:setup vault.
   ```
   Stop this sub-flow.
3. If authed, list vaults for the user to pick a default:
   ```bash
   op vault list --format=json
   ```
   Use `AskUserQuestion` (single select) to present the vault names. The selected vault becomes `password_manager_config.vault`.
4. Record query syntax:
   ```
   op item get "{{name}}" --fields label=password --format=json
   ```

**Dashlane (`dcli`):**

1. Check auth: `dcli sync`
2. If `dcli sync` fails or returns a not-configured error, print:
   ```
   Dashlane CLI is installed but not configured.
   Run `dcli configure` via Bash tool, then re-run /ops:setup vault.
   ```
   Stop this sub-flow.
3. Record query syntax:
   ```
   dcli password --filter "{{name}}" --output json
   ```
4. No vault selection needed — Dashlane has a flat namespace.

**Bitwarden (`bw`):**

1. Check auth: `bw status --raw` and parse the JSON `status` field.
   - `"unauthenticated"` → print:
     ```
     Bitwarden CLI is installed but not logged in.
     Run `bw login` via Bash tool with `run_in_background: true`, then re-run /ops:setup vault.
     ```
     Stop this sub-flow.
   - `"locked"` → print:
     ```
     Bitwarden vault is locked.
     Run `bw unlock --raw` via Bash tool, capture the session token, and export it as `BW_SESSION` for subsequent commands. Then continue /ops:setup vault.
     ```
     Stop this sub-flow.
   - `"unlocked"` → continue.
2. Record query syntax:
   ```
   bw get item "{{name}}" --pretty
   ```
3. No vault selection — Bitwarden uses a single unlocked vault per session.

**macOS Keychain:**

1. No auth check needed — always available.
2. Note for the user:
   ```
   macOS Keychain is always available but is limited to items stored locally.
   No cross-device sync. Best for machine-specific secrets (API keys added via
   `security add-generic-password`).
   ```
3. Record query syntax:
   ```
   security find-generic-password -s "{{name}}" -w
   ```

#### Step 3h.4 — Write to preferences

After the user selects and configures a manager, write to `$PREFS_PATH`:

```json
{
  "password_manager": "<1password|dashlane|bitwarden|keychain>",
  "password_manager_config": {
    "vault": "<vault name, or omit if not applicable>",
    "query_cmd": "<template with {{name}} placeholder>"
  }
}
```

Merge with the existing file (`jq '. + { ... }'`) — never overwrite. Example for 1Password:

```json
{
  "password_manager": "1password",
  "password_manager_config": {
    "vault": "Private",
    "query_cmd": "op item get \"{{name}}\" --fields label=password --format=json"
  }
}
```

If the user picks Skip, write `"password_manager": "none"` so subsequent runs don't re-prompt unless the user explicitly runs `/ops:setup vault`.

#### Step 3h.5 — Document for agents

After saving, print this note once:

```
All ops skills can now query credentials via your configured password manager.
The query command template is in preferences.json under password_manager_config.query_cmd.
Replace {{name}} with the item name — e.g. "GitHub PAT", "AWS root key", "my-project-db".

To query manually:
  op item get "GitHub PAT" --fields label=password --format=json   (1Password example)
  security find-generic-password -s "my-project-db" -w               (Keychain example)
```

#### Dashboard display

Update the Step 0b status header to include vault status:

```
 Vault:       ✓ 1password (vault: Private)
```

Use `○ none` if skipped, `✗ locked` if the manager is installed but inaccessible.

#### Completion summary (Step 8)

Include in the final summary block:

```
 ✓ Vault:      1password → Private vault
```

Omit this line entirely if `password_manager` is `"none"` or unset.

#### Invocation shortcut

Add to the shortcuts table: `vault`, `password-manager`, `pm` → Step 3h

> **Deep-dive:** no dedicated skill ships with the password manager integration — see `${CLAUDE_PLUGIN_ROOT}/docs/memories-system.md` (Runtime Context section) for how downstream skills resolve `password_manager` + related vault references from `$PREFS_PATH`. Privacy-and-security guidance lives in this SKILL.md (keychain-only storage of API hashes/session strings, `umask 077` for bridge files). The setup agent can load that file directly when it needs more depth than this wizard provides.

---

### 3i — Ecommerce (Shopify + dynamic partners)

#### Step 3i.1 — Auto-scan for existing Shopify credentials

**Before asking for anything**, run the Universal Credential Auto-Scan for all Shopify-related vars simultaneously:

```bash
# --- Token scan (API credentials) ---

# Scan shell env
printenv SHOPIFY_ACCESS_TOKEN SHOPIFY_ADMIN_TOKEN SHOPIFY_STORE_URL SHOPIFY_ADMIN_API_ACCESS_TOKEN 2>/dev/null

# Scan shell profiles
grep -h 'SHOPIFY\|myshopify' ~/.zshrc ~/.bashrc ~/.zprofile ~/.envrc 2>/dev/null | grep -v '^#'

# Scan Doppler across all projects
for proj in $(doppler projects --json 2>/dev/null | jq -r '.[].slug'); do
  doppler secrets --project "$proj" --config prd --json 2>/dev/null | \
    jq -r --arg proj "$proj" 'to_entries[] | select(.key | test("SHOPIFY|STORE")) | "\(.key)=\(.value.computed) (doppler:\($proj)/prd)"'
done

# Scan Dashlane for API tokens
dcli password shopify --output json 2>/dev/null | jq -r '.[] | select(.password != null and .password != "") | "\(.title): \(.url) → token found"'

# Scan macOS Keychain
security find-generic-password -s "shopify-admin-token" -w 2>/dev/null
security find-generic-password -s "shopify-access-token" -w 2>/dev/null

# Scan OpenClaw
jq -r '.agents.defaults.env | to_entries[] | select(.key | test("SHOPIFY")) | "\(.key)=\(.value)"' ~/.openclaw/openclaw.json 2>/dev/null

# Check existing prefs
jq -r '.ecom.shopify // empty' "$PREFS_PATH" 2>/dev/null

# --- Store URL discovery (even if no tokens found) ---
# Scan Chrome history for myshopify.com admin URLs
sqlite3 ~/Library/Application\ Support/Google/Chrome/Default/History \
  "SELECT DISTINCT replace(replace(url, 'https://', ''), 'http://', '') FROM urls WHERE url LIKE '%myshopify.com/admin%' OR url LIKE '%admin.shopify.com/store/%' ORDER BY last_visit_time DESC LIMIT 10" 2>/dev/null | \
  grep -oE '[a-z0-9-]+\.myshopify\.com|admin\.shopify\.com/store/[a-z0-9-]+' | sort -u

# Scan Dashlane URLs for myshopify.com store references
dcli password shopify --output json 2>/dev/null | jq -r '.[].url // empty' | grep -oE '[a-z0-9-]+\.myshopify\.com' | sort -u

# Scan project .env files for store URLs
grep -rhE 'myshopify\.com|SHOPIFY_STORE' ~/Projects/*/.env* 2>/dev/null | grep -v '^#' | head -5
```

**Important**: Do NOT report "No Shopify credentials found" until ALL scan sources have been checked. If tokens are missing but store URLs are found (e.g. from Chrome history or Dashlane), report: `"Found Shopify store(s): <stores>. No API token found — you'll need to create one."` and skip straight to Step 3i.3 (token) with the store URL pre-filled.

If both `store_url` and `admin_token` are already found, show:
```
✓ Shopify — already configured (<store_url>)
  [Keep existing]  [Reconfigure]
```
If the user keeps existing, skip to Step 3i.4. If reconfiguring or no values found, continue.

#### Step 3i.2 — Shopify store URL

If `SHOPIFY_STORE_URL` was found in the auto-scan, present it using the Universal Credential Auto-Scan prompt format. Only ask via free text if no value was found:
```
Enter your Shopify store URL:
  Format: yourstore.myshopify.com
  (Do not include https://)
```

Validate the input: strip `https://`, strip trailing slash, check that the result ends with `.myshopify.com`. If invalid, ask again with a correction note.

#### Step 3i.3 — Shopify Admin API token

If `SHOPIFY_ACCESS_TOKEN`, `SHOPIFY_ADMIN_TOKEN`, or `SHOPIFY_ADMIN_API_ACCESS_TOKEN` was found in the auto-scan, present it using the Universal Credential Auto-Scan prompt format with truncated display (`shpat_508b...682e`). Only ask via free text if no value was found.

**Multi-store handling**: When multiple stores are discovered, process each one independently. For stores without tokens, try automated approaches first:

1. **Check Doppler across all projects** for store-specific Shopify tokens:
   ```bash
   for proj in $(doppler projects --json 2>/dev/null | jq -r '.[].slug'); do
     doppler secrets --project "$proj" --config prd --json 2>/dev/null | \
       jq -r --arg proj "$proj" 'to_entries[] | select(.key | test("SHOPIFY.*TOKEN|SHOPIFY.*ACCESS"; "i")) | "\(.key)=\(.value.computed | .[0:12])... (doppler:\($proj)/prd)"'
   done
   ```
2. **Try Shopify CLI** if installed (`command -v shopify`):
   ```bash
   shopify auth logout 2>/dev/null  # Clear stale session
   shopify auth login --store <store>.myshopify.com 2>&1  # Opens browser OAuth
   ```
   After successful auth, generate a custom app token via the CLI. This avoids manual admin navigation.
3. **Browser automation** — if Kapture/Playwright MCP is available, navigate to `https://admin.shopify.com/store/<slug>/settings/apps/development` and automate the "Create an app" → "Configure scopes" → "Install" → "Reveal token" flow. Use scopes: `read_orders,read_products,read_customers,read_inventory,read_fulfillments,read_analytics`.
4. **Manual fallback** — only if all automated approaches fail:
   ```
   No automated path available for <store>.myshopify.com.
   To generate a token manually:
     1. Go to https://admin.shopify.com/store/<slug>/settings/apps/development
     2. Create an app → Configure → grant scopes → Install → copy token
     Token starts with "shpat_"
   ```

**Do NOT skip a store** just because no token was found — always attempt automation first. The user expects the wizard to handle credential generation, not just credential lookup.

Save to `$PREFS_PATH` under `ecom.shopify`. Apply the Doppler-reference pattern — if Doppler is configured, run:
```bash
doppler secrets set SHOPIFY_ADMIN_TOKEN="<token>" --project <project> --config <config>
```
and store `"admin_token": "doppler:SHOPIFY_ADMIN_TOKEN"` in preferences instead of the raw token.

Smoke test:
```bash
STORE=$(jq -r '.ecom.shopify.store_url' "$PREFS_PATH")
TOKEN=$(jq -r '.ecom.shopify.admin_token' "$PREFS_PATH")
if [[ "$TOKEN" == doppler:* ]]; then
  KEY="${TOKEN#doppler:}"
  TOKEN=$(doppler secrets get "$KEY" --plain 2>/dev/null)
fi
curl -s -H "X-Shopify-Access-Token: $TOKEN" \
  "https://$STORE/admin/api/2024-10/shop.json" | jq '.shop.name'
```
Expect a shop name string. If the response contains `errors` or `{"shop":null}`, show the error and ask the user to check the token scopes. Print `✓ Shopify — connected (<shop name>)`.

#### Step 3i.4 — Dynamic ecommerce partners

After Shopify is configured, ask via `AskUserQuestion` (free text):
```
Do you use any other ecommerce tools you'd like to connect?
  Examples: ShipBob (fulfillment), Recharge (subscriptions), Yotpo (reviews),
            Shippo (shipping rates), Gorgias (support), Attentive (SMS), Loop (returns)
  Type the names separated by commas, or leave blank to skip.
```

If the user provides partner names, process each one in a loop:

**For each partner:**

1. **Research credentials** — web search: `"<partner name> API authentication developer docs 2025"`. Determine:
   - What credentials are needed (API key, OAuth token, webhook secret, base URL, account ID, etc.)
   - The API base URL
   - A suitable health/auth endpoint to smoke test (e.g. `/me`, `/account`, `/v1/ping`, list endpoint with limit=1)
   - The auth header pattern (`Authorization: Bearer`, `X-Api-Key`, custom header, etc.)

2. **Ask for each credential** via `AskUserQuestion` (one question per credential field), citing where to find it based on what the docs say. Example for ShipBob:
   Run the Universal Credential Auto-Scan for `SHIPBOB_ACCESS_TOKEN`, `SHIPBOB_API_TOKEN` before asking. If found, present with source attribution. Only prompt manually if not found:
   ```
   Enter your ShipBob Personal Access Token:
     To generate: ShipBob dashboard → Integrations → API → Personal Access Tokens → Create Token
   ```

3. **Smoke test** using the auth endpoint discovered in step 1:
   ```bash
   curl -s -H "<auth_header>: $TOKEN" "<base_url>/<health_endpoint>" | jq '.<identity_field>'
   ```
   Show the result. If it fails, show the raw response and offer `[Re-enter credentials]` / `[Skip this partner]`.

4. **Save to preferences** under `ecom.partners.<partner_slug>` where `partner_slug` is the lowercased, hyphenated partner name:
   ```json
   {
     "ecom": {
       "partners": {
         "shipbob": {
           "api_base_url": "https://api.shipbob.com/v1",
           "auth_pattern": "Authorization: Bearer <token>",
           "credentials": { "api_token": "doppler:SHIPBOB_API_TOKEN" },
           "health_endpoint": "/user",
           "configured_at": "<ISO timestamp>"
         }
       }
     }
   }
   ```
   Store actual secrets via Doppler (key: `<PARTNER_SLUG_UPPER>_API_TOKEN`) when Doppler is configured, else store inline. The `auth_pattern` and `api_base_url` fields are the memory that future `/ops:ecom` calls use to reach the partner — always populate them from the researched docs.

5. **Print confirmation**:
   ```
   ✓ <Partner Name> — connected
   ```

6. **Loop**: After each partner, ask `AskUserQuestion`: "Any other ecommerce tools to connect?" → `[Yes — add another]` / `[Done]`. This lets users add partners one at a time if they prefer over the initial comma-separated list.

**Partners with known credential patterns** (use these directly without searching, but still verify with a smoke test):

| Partner    | Auth header                              | Base URL                               | Health endpoint        |
| ---------- | ---------------------------------------- | -------------------------------------- | ---------------------- |
| ShipBob    | `Authorization: Bearer <token>`          | `https://api.shipbob.com/v1`           | `/user`                |
| Recharge   | `X-Recharge-Access-Token: <token>`       | `https://api.rechargeapps.com/v1`      | `/shop`                |
| Yotpo      | `X-Api-Key: <app_key>`                   | `https://api.yotpo.com`                | `/core/v3/stores/<id>` |
| Shippo     | `Authorization: ShippoToken <token>`     | `https://api.goshippo.com`             | `/carrier_accounts`    |
| Gorgias    | `Authorization: Basic <base64>`          | `https://<domain>.gorgias.com/api`     | `/account`             |
| Loop       | `X-Authorization: <secret>`              | `https://api.loopreturns.com/api/v1`   | `/warehouse`           |
| Attentive  | `Authorization: Bearer <token>`          | `https://api.attentivemobile.com/v1`   | `/me`                  |

For any partner not in this table, always web search for current auth docs before asking for credentials.

> **Deep-dive:** see `${CLAUDE_PLUGIN_ROOT}/skills/ops-ecom/SKILL.md` for full operational instructions, CLI reference, and troubleshooting for the ecommerce integration (multi-store Shopify, partner dispatching, store-health daemon). The setup agent can load that file directly when it needs more depth than this wizard provides.

---

### 3j — Marketing (Klaviyo, Meta Ads, GA4, Search Console)

**Before showing the service selector**, run the Universal Credential Auto-Scan for all marketing vars simultaneously:

```bash
# Shell env
printenv KLAVIYO_API_KEY KLAVIYO_PRIVATE_KEY META_ACCESS_TOKEN FACEBOOK_ACCESS_TOKEN META_AD_ACCOUNT_ID GA4_PROPERTY_ID GA_MEASUREMENT_ID 2>/dev/null
printenv GOOGLE_ADS_DEVELOPER_TOKEN GOOGLE_ADS_CLIENT_ID GOOGLE_ADS_CLIENT_SECRET GOOGLE_ADS_REFRESH_TOKEN GOOGLE_ADS_CUSTOMER_ID 2>/dev/null

# Shell profiles
grep -h 'KLAVIYO\|META_\|FACEBOOK\|GA4\|GA_MEASUREMENT\|GOOGLE_ADS' ~/.zshrc ~/.bashrc ~/.zprofile ~/.envrc 2>/dev/null | grep -v '^#'

# Doppler across all projects
for proj in $(doppler projects --json 2>/dev/null | jq -r '.[].slug'); do
  doppler secrets --project "$proj" --config prd --json 2>/dev/null | \
    jq -r --arg proj "$proj" 'to_entries[] | select(.key | test("KLAVIYO|META|FACEBOOK|GA4|GOOGLE|GOOGLE_ADS")) | "\(.key)=\(.value.computed) (doppler:\($proj)/prd)"'
done

# Dashlane
dcli password klaviyo --output json 2>/dev/null
dcli password facebook --output json 2>/dev/null
dcli password meta --output json 2>/dev/null

# OpenClaw
jq -r '.agents.defaults.env | to_entries[] | select(.key | test("KLAVIYO|META_|FACEBOOK|GA4")) | "\(.key)=\(.value)"' ~/.openclaw/openclaw.json 2>/dev/null
```

Cache these results — use them to pre-fill answers for each sub-step below. For each service below, check if already configured (check `$PREFS_PATH` under `marketing.*`, then the auto-scan results above) before prompting. If already set, show `✓ <service> — already configured` and offer `[Keep]` / `[Reconfigure]`.

Ask which marketing integrations to configure via two sequential `AskUserQuestion` calls with `multiSelect: true` (max 4 per Rule 1):

**First call** (primary integrations):

| Option                  | Header        | Description                                   |
| ----------------------- | ------------- | --------------------------------------------- |
| Klaviyo                 | klaviyo       | Email/SMS marketing — private API key         |
| Meta Ads                | meta          | Facebook/Instagram ads — access token + ad account ID |
| Google Ads              | google-ads    | Paid search ads — OAuth2 + developer token    |
| More...                 | more          | Google Analytics 4, Search Console            |

If user selects `[More...]`, present **second call**:

| Option                      | Header   | Description                                            |
| --------------------------- | -------- | ------------------------------------------------------ |
| Google Analytics 4          | ga4      | Web analytics — GA4 property ID                        |
| Google Search Console       | gsc      | SEO data — site URL (uses gcloud auth)                 |
| WhatsApp Business API       | waba     | Template messaging at scale — Business token + IDs     |
| Skip                        | skip     | Done with marketing setup                              |

Run the selected sub-step(s) below in the order selected.

#### Klaviyo

If `KLAVIYO_API_KEY` or `KLAVIYO_PRIVATE_KEY` was found in the auto-scan, present it using the Universal Credential Auto-Scan prompt format. Only ask via free text if not found:
```
Enter your Klaviyo Private API Key:
  To generate one: Klaviyo dashboard → Settings → API Keys → Create Private Key
  Key starts with "pk_"
```

Smoke test:
```bash
curl -s -H "Authorization: Klaviyo-API-Key $KEY" \
  -H "revision: 2024-10-15" \
  "https://a.klaviyo.com/api/lists" | jq '.data | length'
```
Expect a number ≥ 0. If the response contains `"detail"` with an auth error, show it and re-ask.

#### Meta Ads

If `META_ACCESS_TOKEN` or `FACEBOOK_ACCESS_TOKEN` was found in the auto-scan, present it. If `META_AD_ACCOUNT_ID` was found, present that too. Only ask via free text for values not found.

Ask for:
1. Access token (explain: Meta Business Suite → Settings → System Users or your personal account → Generate token with `ads_read` permission)
2. Ad account ID (format: `act_XXXXXXXXXX` — found in Business Manager → Ad Accounts)

Smoke test:
```bash
curl -s "https://graph.facebook.com/v20.0/$AD_ACCOUNT_ID/campaigns?access_token=$TOKEN&limit=1" | jq '.data | length'
```

#### Google Ads

Google Ads requires three credential groups. Guide the user through each step sequentially.

**Step A — Developer Token:**
If `GOOGLE_ADS_DEVELOPER_TOKEN` was found in auto-scan, present it and offer `[Keep]` / `[Reconfigure]`.
Otherwise, ask via free text:
> Your Google Ads developer token (found in Google Ads → Tools & Settings → API Center).
> Note: New developer tokens start in "test" mode — they work against test accounts only. For production data, apply for Basic Access at https://ads.google.com/home/tools/manager-accounts/

**Step B — OAuth2 Client Credentials:**
If `GOOGLE_ADS_CLIENT_ID` and `GOOGLE_ADS_CLIENT_SECRET` were found in auto-scan, present and offer `[Keep]` / `[Reconfigure]`.
Otherwise, ask via free text (two prompts):
1. OAuth2 Client ID (from Google Cloud Console → APIs & Services → Credentials → OAuth 2.0 Client ID, type: Desktop app, Google Ads API must be enabled)
2. OAuth2 Client Secret (shown alongside the client ID)

**Step C — Refresh Token (browser OAuth flow):**
If `GOOGLE_ADS_REFRESH_TOKEN` was found in auto-scan, present and offer `[Keep]` / `[Reconfigure]`.
Otherwise, generate the auth URL and run the OAuth flow:

```bash
AUTH_URL="https://accounts.google.com/o/oauth2/auth?client_id=${GADS_CLIENT_ID}&redirect_uri=http://localhost:8080&response_type=code&scope=https://www.googleapis.com/auth/adwords&access_type=offline&prompt=consent"
open "$AUTH_URL"  # macOS
```

Start a temporary localhost server to catch the redirect:
```bash
# One-liner node HTTP server to capture the auth code
node -e "require('http').createServer((req,res)=>{const code=new URL(req.url,'http://localhost').searchParams.get('code');if(code){res.end('Authorization code received. You can close this tab.');process.stdout.write(code);process.exit(0)}else{res.end('Waiting for auth...')}}).listen(8080)"
```

Run the server via Bash with `run_in_background: true`. Wait up to 120 seconds for the auth code.

If the localhost approach fails, fall back to asking the user to paste the code from the browser URL bar (the `code=` parameter).

Exchange code for refresh token:
```bash
TOKEN_RESP=$(curl -s -X POST https://oauth2.googleapis.com/token \
  --data "code=${AUTH_CODE}" \
  --data "client_id=${GADS_CLIENT_ID}" \
  --data "client_secret=${GADS_CLIENT_SECRET}" \
  --data "redirect_uri=http://localhost:8080" \
  --data "grant_type=authorization_code")
GADS_REFRESH_TOKEN=$(echo "$TOKEN_RESP" | jq -r '.refresh_token')
```

If `GADS_REFRESH_TOKEN` is null or empty, print error and offer retry.

Warning: If the user's Google Cloud project is in "testing" publishing status, the refresh token expires in 7 days. Warn: "Your OAuth app is in testing mode — tokens expire in 7 days. To get long-lived tokens, publish the app in Google Cloud Console → OAuth consent screen → Publish App."

**Step D — Customer ID:**
Use the refresh token to get an access token, then list accessible customers:
```bash
ACCESS_TOKEN=$(curl -s -X POST https://oauth2.googleapis.com/token \
  --data "client_id=${GADS_CLIENT_ID}&client_secret=${GADS_CLIENT_SECRET}&refresh_token=${GADS_REFRESH_TOKEN}&grant_type=refresh_token" | jq -r '.access_token')

CUSTOMERS=$(curl -s -X GET \
  "https://googleads.googleapis.com/v23/customers:listAccessibleCustomers" \
  -H "Authorization: Bearer ${ACCESS_TOKEN}" \
  -H "developer-token: ${GADS_DEV_TOKEN}")
```

If multiple accounts returned, present as `AskUserQuestion` options (max 4 per Rule 1 — paginate if more). If single account, auto-select. Store as `customer_id` (strip "customers/" prefix and dashes).

If any account is a manager (MCC) account, also store `login_customer_id`. Auto-detect by checking if `listAccessibleCustomers` returns both manager and client accounts.

**Step E — Smoke Test:**
```bash
curl -s -X GET "https://googleads.googleapis.com/v23/customers:listAccessibleCustomers" \
  -H "Authorization: Bearer ${ACCESS_TOKEN}" \
  -H "developer-token: ${GADS_DEV_TOKEN}"
```
Expect JSON with `resourceNames` array. If error, print the error and offer `[Retry]` / `[Skip]`.

**Step F — Save to preferences:**
```json
{
  "marketing": {
    "google_ads": {
      "developer_token": "<YOUR_DEVELOPER_TOKEN>",
      "client_id": "<YOUR_CLIENT_ID>.apps.googleusercontent.com",
      "client_secret": "GOCSPX-<YOUR_SECRET>",
      "refresh_token": "1//<YOUR_REFRESH_TOKEN>",
      "customer_id": "1234567890",
      "login_customer_id": "9876543210"
    }
  }
}
```

Same Doppler-reference pattern as Step 3i — prefer `doppler:KEY_NAME` over raw tokens when Doppler is configured.

Print: `[Google Ads] ✓ connected — customer ID: XXXXXXXXXX`

#### Google Analytics 4

If `GA4_PROPERTY_ID` or `GA_MEASUREMENT_ID` was found in the auto-scan, present it. Only ask via free text if not found. Ask for the GA4 Property ID (explain: GA4 dashboard → Admin → Property Settings → Property ID, format: numeric, e.g. `123456789`).

No API key needed if `gcloud` is authenticated — the GA4 Data API uses Application Default Credentials. Check:
```bash
gcloud auth application-default print-access-token 2>/dev/null | head -c 10
```
If gcloud ADC is not set up, note that GA4 queries will require manual auth: `gcloud auth application-default login`.

#### Google Search Console

Ask for the site URL (format: `https://example.com/` or `sc-domain:example.com`). No API key needed if gcloud is authed.

Smoke test:
```bash
ACCESS_TOKEN=$(gcloud auth application-default print-access-token 2>/dev/null)
curl -s -H "Authorization: Bearer $ACCESS_TOKEN" \
  "https://searchconsole.googleapis.com/webmasters/v3/sites" | jq '.siteEntry | length'
```

#### WhatsApp Business API

**Separate from wacli personal WhatsApp.** Used for Business-to-customer template messaging at scale.

Auto-scan for:
```bash
printenv WHATSAPP_BUSINESS_TOKEN WHATSAPP_PHONE_NUMBER_ID WHATSAPP_BUSINESS_ACCOUNT_ID 2>/dev/null
claude plugin config get whatsapp_business_token 2>/dev/null && echo "waba_token: already configured"
claude plugin config get whatsapp_phone_number_id 2>/dev/null && echo "waba_phone_id: already configured"
claude plugin config get whatsapp_business_account_id 2>/dev/null && echo "waba_account_id: already configured"
```

Where to find credentials:
- `WHATSAPP_BUSINESS_TOKEN`: Meta Developer Portal → Your App → WhatsApp → API Setup → Temporary or System User token
- `WHATSAPP_PHONE_NUMBER_ID`: Same page → "From" phone number → Phone Number ID
- `WHATSAPP_BUSINESS_ACCOUNT_ID`: Meta Business Manager → Business Settings → WhatsApp Accounts → ID

Collect each via AskUserQuestion (free text) if not found. Save:
```bash
claude plugin config set whatsapp_business_token "$WABA_TOKEN"
claude plugin config set whatsapp_phone_number_id "$WABA_PHONE_ID"
claude plugin config set whatsapp_business_account_id "$WABA_ACCOUNT_ID"
```

Smoke test:
```bash
curl -s "https://graph.facebook.com/v20.0/${WABA_PHONE_ID}" \
  -H "Authorization: Bearer ${WABA_TOKEN}" | jq '.display_phone_number // empty'
```

If returns phone number: `WhatsApp Business ✓ connected — Phone: <number>`. Else show error.

#### Save to preferences

Write to `$PREFS_PATH` (merge):
```json
{
  "marketing": {
    "klaviyo": { "api_key": "<pk_...>" },
    "meta": { "access_token": "<token>", "ad_account_id": "act_XXXXXXXXXX" },
    "ga4": { "property_id": "123456789" },
    "gsc": { "site_url": "https://example.com/" },
    "whatsapp_business": { "phone_number_id": "<ID>", "business_account_id": "<WABA_ID>" }
  }
}
```

Same Doppler-reference pattern as Step 3i — prefer `doppler:KEY_NAME` over raw tokens when Doppler is configured.

#### Dynamic marketing partners

After the known services, ask via `AskUserQuestion` (free text):
```
Any other marketing tools you'd like to connect?
  Examples: Postscript (SMS), Privy (popups), Triple Whale (attribution), Northbeam,
            Hotjar, Heap, Segment, Mixpanel, Mailchimp, ActiveCampaign, HubSpot
  Type names separated by commas, or leave blank to skip.
```

If the user provides partner names, apply the same dynamic partner loop as Step 3i.4 — for each partner:

1. **Research credentials** via web search: `"<partner name> API authentication developer docs 2025"`
2. **Ask for credentials** via `AskUserQuestion` with instructions sourced from the docs
3. **Smoke test** against the auth/health endpoint
4. **Save to preferences** under `marketing.partners.<partner_slug>`:
   ```json
   {
     "marketing": {
       "partners": {
         "triple-whale": {
           "api_base_url": "https://api.triplewhale.com/api/v2",
           "auth_pattern": "Authorization: Bearer <token>",
           "credentials": { "api_key": "doppler:TRIPLE_WHALE_API_KEY" },
           "health_endpoint": "/attribution/get-attribution-data",
           "configured_at": "<ISO timestamp>"
         }
       }
     }
   }
   ```
5. **Loop** — offer `[Add another]` / `[Done]` after each partner.

**Partners with known credential patterns** (use directly, still smoke test):

| Partner       | Auth header                            | Base URL                                       | Health endpoint     |
| ------------- | -------------------------------------- | ---------------------------------------------- | ------------------- |
| HubSpot       | `Authorization: Bearer <token>`        | `https://api.hubapi.com`                       | `/crm/v3/objects/contacts?limit=1` |
| Mailchimp     | `Authorization: Bearer <api_key>`      | `https://<dc>.api.mailchimp.com/3.0`           | `/ping`             |
| Segment       | `Authorization: Basic <base64_key:>`   | `https://api.segment.io/v1`                    | n/a — use write key |
| Mixpanel      | `Authorization: Basic <base64_secret:>` | `https://data.mixpanel.com/api/2.0`           | `/engage?limit=1`   |
| Postscript    | `Authorization: ApiKey <key>`          | `https://api.postscript.io/api/v2`             | `/shops`            |
| Triple Whale  | `Authorization: Bearer <token>`        | `https://api.triplewhale.com/api/v2`           | `/attribution/get-attribution-data` |

For any partner not in this table, always web search for current auth docs before asking for credentials.

> **Deep-dive:** see `${CLAUDE_PLUGIN_ROOT}/skills/ops-marketing/SKILL.md` for full operational instructions, CLI reference, and troubleshooting for marketing integrations (Klaviyo flows, Meta Ads, GA4, Search Console). The setup agent can load that file directly when it needs more depth than this wizard provides.

---

### 3k — Voice (Bland AI, ElevenLabs, Groq)

**Before showing the service selector**, run the Universal Credential Auto-Scan for all voice vars simultaneously:

```bash
# Shell env
printenv BLAND_AI_API_KEY BLAND_API_KEY ELEVENLABS_API_KEY GROQ_API_KEY 2>/dev/null

# Shell profiles
grep -h 'BLAND\|ELEVENLABS\|GROQ' ~/.zshrc ~/.bashrc ~/.zprofile ~/.envrc 2>/dev/null | grep -v '^#'

# Doppler across all projects
for proj in $(doppler projects --json 2>/dev/null | jq -r '.[].slug'); do
  doppler secrets --project "$proj" --config prd --json 2>/dev/null | \
    jq -r --arg proj "$proj" 'to_entries[] | select(.key | test("BLAND|ELEVENLABS|GROQ")) | "\(.key)=\(.value.computed) (doppler:\($proj)/prd)"'
done

# Dashlane
dcli password "bland-ai" --output json 2>/dev/null
dcli password elevenlabs --output json 2>/dev/null
dcli password groq --output json 2>/dev/null

# OpenClaw (common location for AI service keys)
jq -r '.agents.defaults.env | to_entries[] | select(.key | test("BLAND|ELEVENLABS|GROQ")) | "\(.key)=\(.value)"' ~/.openclaw/openclaw.json 2>/dev/null
```

Cache these results — use them to pre-fill answers for each sub-step below. Check existing config in `$PREFS_PATH` under `voice.*` too. If a key is already set, show `✓ <service> — already configured` and offer `[Keep]` / `[Reconfigure]`.

Ask which voice services to configure via `AskUserQuestion` with `multiSelect: true`:

| Option      | Header      | Description                                    |
| ----------- | ----------- | ---------------------------------------------- |
| Bland AI    | bland       | Outbound AI phone calls — API key              |
| ElevenLabs  | elevenlabs  | Text-to-speech and voice cloning — API key     |
| Groq        | groq        | Fast LLM inference (Whisper, LLaMA) — API key  |

#### Bland AI

If `BLAND_AI_API_KEY` or `BLAND_API_KEY` was found in the auto-scan, present it using the Universal Credential Auto-Scan prompt format. Only ask via free text if not found:
```
Enter your Bland AI API Key:
  To find it: https://app.bland.ai → Settings → API Key
```

Smoke test:
```bash
curl -s -H "Authorization: $KEY" "https://api.bland.ai/v1/me" | jq '.user.id'
```
Expect a non-null user ID.

#### ElevenLabs

If `ELEVENLABS_API_KEY` was found in the auto-scan, present it using the Universal Credential Auto-Scan prompt format. Only ask via free text if not found:
```
Enter your ElevenLabs API Key:
  To find it: https://elevenlabs.io → Profile (top-right) → API Key
```

Smoke test:
```bash
curl -s -H "xi-api-key: $KEY" "https://api.elevenlabs.io/v1/user" | jq '.subscription.tier'
```
Expect a subscription tier string (e.g. `"free"`, `"starter"`).

#### Groq

If `GROQ_API_KEY` was found in the auto-scan, present it using the Universal Credential Auto-Scan prompt format. Only ask via free text if not found:
```
Enter your Groq API Key:
  To generate one: https://console.groq.com → API Keys → Create API Key
  Key starts with "gsk_"
```

Smoke test:
```bash
curl -s -H "Authorization: Bearer $KEY" \
  "https://api.groq.com/openai/v1/models" | jq '.data | length'
```
Expect a positive integer (number of available models).

#### Save to preferences

Write to `$PREFS_PATH` (merge):
```json
{
  "voice": {
    "bland": { "api_key": "<key>" },
    "elevenlabs": { "api_key": "<key>" },
    "groq": { "api_key": "gsk_..." }
  }
}
```

Same Doppler-reference pattern — prefer `doppler:KEY_NAME` over raw tokens when Doppler is configured.

> **Deep-dive:** see `${CLAUDE_PLUGIN_ROOT}/skills/ops-voice/SKILL.md` for full operational instructions, CLI reference, and troubleshooting for voice integrations (Bland AI call flows, ElevenLabs TTS, Groq transcription). The setup agent can load that file directly when it needs more depth than this wizard provides.

---

### 3l — Revenue (Stripe + RevenueCat)

**Before showing the service selector**, run the Universal Credential Auto-Scan for all revenue vars simultaneously (Rule 4 — background these):

```bash
# Shell env
printenv STRIPE_SECRET_KEY STRIPE_API_KEY REVENUECAT_API_KEY REVENUECAT_SECRET_KEY REVENUECAT_PROJECT_ID 2>/dev/null

# Shell profiles + .envrc files
grep -h 'STRIPE\|REVENUECAT\|RC_API' ~/.zshrc ~/.bashrc ~/.zprofile ~/.envrc 2>/dev/null | grep -v '^#'

# Doppler across all projects
for proj in $(doppler projects --json 2>/dev/null | jq -r '.[].slug'); do
  doppler secrets --project "$proj" --config prd --json 2>/dev/null | \
    jq -r --arg proj "$proj" 'to_entries[] | select(.key | test("STRIPE|REVENUECAT|RC_API")) | "\(.key)=\(.value.computed) (doppler:\($proj)/prd)"'
done

# 1Password
op item list --categories "API Credential" --format json 2>/dev/null | \
  jq -r '.[] | select(.title | test("stripe|revenuecat"; "i")) | .id' | \
  while read id; do op item get "$id" --format json 2>/dev/null; done

# Dashlane
dcli password stripe --output json 2>/dev/null
dcli password revenuecat --output json 2>/dev/null

# Bitwarden
bw list items --search stripe 2>/dev/null | jq -r '.[] | select(.login.password) | .login.password' | head -1
bw list items --search revenuecat 2>/dev/null | jq -r '.[] | select(.login.password) | .login.password' | head -1

# macOS Keychain
security find-generic-password -s "stripe" -w 2>/dev/null
security find-generic-password -s "revenuecat" -w 2>/dev/null

# OpenClaw
jq -r '.agents.defaults.env | to_entries[] | select(.key | test("STRIPE|REVENUECAT")) | "\(.key)=\(.value)"' ~/.openclaw/openclaw.json 2>/dev/null
```

Cache these results. Also check `$PREFS_PATH` under `revenue.stripe.*` and `revenue.revenuecat.*` — if already set, show `✓ <service> — already configured` and offer `[Keep]` / `[Reconfigure]`.

Ask which revenue integrations to configure via `AskUserQuestion` with `multiSelect: true`:

| Option       | Header       | Description                                                    |
| ------------ | ------------ | -------------------------------------------------------------- |
| Stripe       | stripe       | SaaS revenue — secret key for MRR, charges, disputes           |
| RevenueCat   | revenuecat   | Mobile subs — API key + project ID for mobile MRR              |

#### Stripe

If `STRIPE_SECRET_KEY` was found in the auto-scan, present it using the Universal Credential Auto-Scan prompt format with `[Use this value]` / `[Paste a different one]` / `[Skip]`.

Per Rule 3 — if nothing was found, offer (≤4 options):
```
No Stripe secret key found. How do you want to provide one?
  [Paste Stripe secret key manually]
  [Deep hunt — spawn agent]
  [Skip — use registry.json values]
```

On `[Deep hunt — spawn agent]`, spawn a background research agent per Rule 3:

```
Agent(
  subagent_type: "general-purpose",
  model: "haiku",
  run_in_background: true,
  prompt: "Grep the filesystem under $HOME (excluding node_modules, .git, Library/Caches) for Stripe secret key patterns: sk_live_[A-Za-z0-9]+ and sk_test_[A-Za-z0-9]+. Also scan ~/.config, ~/.aws, ~/.docker, any .env files, and known secrets directories. Return every hit with file path + line number + 6 chars of redacted prefix (e.g. sk_live_abc***). Do not print full keys."
)
```

While it runs, continue to the RevenueCat block. Return to Stripe when the agent reports results; present findings via `AskUserQuestion` (paginate to ≤4 per Rule 1).

On `[Paste Stripe secret key manually]`:
```
Enter your Stripe Secret Key:
  Format: sk_live_XXX  (production)  or  sk_test_XXX  (test mode)
  Find it: Stripe Dashboard → Developers → API keys → Secret key → Reveal
  Prefer a Doppler reference (e.g. doppler:STRIPE_SECRET_KEY) over the raw value.
```

Smoke test:
```bash
curl -s -u "$STRIPE_SECRET_KEY:" "https://api.stripe.com/v1/balance" | jq '.available | length'
```
Expect a non-zero integer. If `{"error": ...}`, show the message and re-ask.

#### RevenueCat

If `REVENUECAT_API_KEY` and `REVENUECAT_PROJECT_ID` were both found in the auto-scan, present them together with `[Use these values]` / `[Paste different ones]` / `[Skip]`.

Per Rule 3 — if not found, offer:
```
No RevenueCat credentials found. How do you want to provide them?
  [Paste RevenueCat API key manually]
  [Deep hunt — spawn agent]
  [Skip — mobile MRR will be omitted]
```

On `[Deep hunt — spawn agent]`, spawn (background, Rule 4):

```
Agent(
  subagent_type: "general-purpose",
  model: "haiku",
  run_in_background: true,
  prompt: "Grep the filesystem under $HOME (excluding node_modules, .git, Library/Caches) for RevenueCat credential patterns: rcb_[A-Za-z0-9]+ (V2 secret), sk_[A-Za-z0-9]+ near the literal string 'revenuecat', and any env vars matching REVENUECAT_* or RC_API_*. Also look for project IDs (32-char alphanum strings) adjacent to any revenuecat match. Return each hit with file path + line number + 6-char redacted prefix. Do not print full keys."
)
```

On `[Paste RevenueCat API key manually]`:
```
Enter your RevenueCat API Key:
  Find it: app.revenuecat.com → Project settings → API keys → Secret key
  Format: rcb_XXX (V2 secret)  or  sk_XXX (legacy secret key)

Enter your RevenueCat Project ID:
  Find it in the URL: app.revenuecat.com/projects/<project_id>/...
```

Smoke test:
```bash
curl -s -H "Authorization: Bearer $REVENUECAT_API_KEY" \
  "https://api.revenuecat.com/v2/projects/$REVENUECAT_PROJECT_ID/metrics/overview" | jq '.metrics // .object'
```
Expect a numeric `mrr` or an object descriptor. If the response is `{"code": 7243, ...}` (auth error), re-ask.

#### Save to preferences

Write to `$PREFS_PATH` (merge):
```json
{
  "revenue": {
    "stripe": {
      "secret_key": "doppler:STRIPE_SECRET_KEY",
      "configured_at": "<ISO timestamp>"
    },
    "revenuecat": {
      "api_key": "doppler:REVENUECAT_API_KEY",
      "project_id": "<project_id>",
      "configured_at": "<ISO timestamp>"
    }
  }
}
```

Prefer a Doppler reference (`doppler:STRIPE_SECRET_KEY`, `doppler:REVENUECAT_API_KEY`) over raw tokens when Doppler is configured. For either service, if the user picked `[Skip]`, save `{"revenue": {"<service>": "skipped"}}` so the wizard doesn't re-prompt on the next run — but `/ops:revenue` will fall back to `scripts/registry.json` `revenue.mrr` values as documented in the `revenue-tracker` agent.

> **Deep-dive:** see `${CLAUDE_PLUGIN_ROOT}/skills/ops-revenue/SKILL.md` for full operational instructions, CLI reference, and troubleshooting for revenue integrations (Stripe MRR/ARR queries, RevenueCat subscription metrics, registry fallbacks). The setup agent can load that file directly when it needs more depth than this wizard provides.

---

### 3n — Notifications (fires-watcher sinks)

Sets up push notifications for CRITICAL/HIGH fires so the user stops having to poll `/ops:fires` manually. Gated behind the `fires-watcher` daemon service (disabled by default).

**Before prompting**, run the sink auto-scan **in background** (Rule 4 — all parallel):

```bash
# Already-configured sinks (env + $PREFS_PATH)
printenv TELEGRAM_BOT_TOKEN TELEGRAM_NOTIFY_CHAT_ID TELEGRAM_OWNER_ID \
         DISCORD_WEBHOOK_URL NTFY_TOPIC PUSHOVER_USER PUSHOVER_TOKEN 2>/dev/null

jq -r 'to_entries
       | map(select(.key | test("telegram_bot_token|telegram_notify_chat_id|discord_webhook_url|ntfy_topic|pushover_user_key|pushover_app_token")))
       | .[] | "\(.key)=\(.value | if type == "string" and length > 6 then .[0:6] + "***" else . end)"' \
       "$PREFS_PATH" 2>/dev/null

# Macro: is the Telegram bot already configured via /ops:setup telegram?
jq -r '.telegram.bot_token // empty, .telegram.owner_id // empty' "$PREFS_PATH" 2>/dev/null
```

Cache the results. Then **filter the option list to what isn't already configured** (Rule 1 — max 4).

Present via `AskUserQuestion` (≤4 options). Typical first batch:

| Option                                | Header     | Description                                                                    |
| ------------------------------------- | ---------- | ------------------------------------------------------------------------------ |
| Use Telegram (recommended)            | telegram   | Reuse the bot you already configured in 3a. Zero extra setup.                  |
| Configure ntfy.sh                     | ntfy       | Free, no account. Pick a random topic, install the app on your phone.          |
| Configure Pushover                    | pushover   | ~$5 one-time. Highest-reliability mobile delivery with priority bypass for P0. |
| Skip — poll with /ops:fires instead   | skip       | Leaves `fires-watcher` disabled. You'll keep asking for fires manually.        |

If Telegram's bot token + owner ID aren't already in `$PREFS_PATH`, swap `[Use Telegram]` for `[Configure Telegram bot — jump to 3a]` and re-enter 3a before returning here. Per Rule 3, don't silently skip — always offer an explicit `[Skip]`.

For anyone who wants Discord on top (many users want both team + personal delivery), run a second `AskUserQuestion`:

| Option                            | Header     | Description                                         |
| --------------------------------- | ---------- | --------------------------------------------------- |
| Also add Discord webhook          | discord    | Fan out to a #incidents channel in addition to X.   |
| No — just the sink I picked       | done       | Single-sink setup.                                  |

#### Per-sink capture

**Telegram** — if `$TELEGRAM_NOTIFY_CHAT_ID` is empty, default it to `$TELEGRAM_OWNER_ID` (the bot will DM the owner) and save `{"telegram_notify_chat_id": "<owner_id>"}` to `$PREFS_PATH`. Smoke-test in background (Rule 4):

```bash
scripts/ops-notify.sh LOW "setup test" "fires-watcher Telegram sink is live" &
```

**ntfy.sh** — generate a random topic if the user has none:

```bash
TOPIC="claude-ops-fires-$(openssl rand -hex 6 2>/dev/null || head -c 12 /dev/urandom | base64 | tr -dc 'a-z0-9' | head -c 12)"
echo "$TOPIC"
```

Show the topic and install instructions (`open https://ntfy.sh/<topic>` in a browser, or scan the QR in the ntfy mobile app). Save to `$PREFS_PATH` under `ntfy_topic`.

**Pushover** — per Rule 3 offer: `[Paste user key + app token]` / `[Deep hunt — spawn agent]` / `[Skip]`. On paste, validate with a smoke-test in background (Rule 4):

```bash
curl -s -X POST https://api.pushover.net/1/messages.json \
  --data-urlencode "token=$PUSHOVER_TOKEN" \
  --data-urlencode "user=$PUSHOVER_USER" \
  --data-urlencode "title=claude-ops setup test" \
  --data-urlencode "message=fires-watcher Pushover sink is live" &
```

Expect `{"status":1,...}` within 5 s.

**Discord** — if the user already set `discord_default_webhook_url` via a prior run (or issue #20's work), reuse it; otherwise Rule-3-prompt for a webhook URL (`https://discord.com/api/webhooks/...`).

#### Save + enable daemon service

Write to `$PREFS_PATH` (merge, never overwrite unrelated keys):

```json
{
  "notifications": {
    "configured_sinks": ["telegram", "ntfy"],
    "configured_at": "<ISO timestamp>"
  },
  "telegram_notify_chat_id": "<chat_id>",
  "ntfy_topic": "<topic>"
}
```

Then **enable the daemon service** in background (Rule 4):

```bash
jq '.services["fires-watcher"].enabled = true' \
   ~/.claude/plugins/data/ops-ops-marketplace/daemon-services.json \
  > /tmp/daemon-services.json.new && \
  mv /tmp/daemon-services.json.new ~/.claude/plugins/data/ops-ops-marketplace/daemon-services.json && \
  scripts/ops-daemon.sh restart &
```

Confirm the watcher is alive after restart:

```bash
cat ~/.claude/plugins/data/ops-ops-marketplace/fires-watcher.health 2>/dev/null
```

Expect `{"status": "ok", ...}` within 60 seconds.

> **Deep-dive:** see `${CLAUDE_PLUGIN_ROOT}/docs/notifications.md`, `${CLAUDE_PLUGIN_ROOT}/scripts/ops-fires-watcher.sh`, and `${CLAUDE_PLUGIN_ROOT}/scripts/ops-notify.sh` for sink priority rationale, debounce rules, and a troubleshooting walk-through.

### 3m — Discord (webhook + optional bot)

Discord is a v1 integration — webhook-based send + REST channel reads. DM + gateway support are deferred to a v2 issue. The send-side webhook also supplies the Discord notification sink consumed by `scripts/ops-notify.sh`, so configuring it here covers both `/ops:comms discord send` and ops-fires alerts.

**Before showing the credential prompt**, run the Universal Credential Auto-Scan for Discord (Rule 4 — background every bash call unless the next step depends on it):

```bash
# Shell env
printenv DISCORD_BOT_TOKEN DISCORD_WEBHOOK_URL DISCORD_GUILD_ID 2>/dev/null

# Shell profiles + .envrc
grep -hE 'DISCORD_(BOT_TOKEN|WEBHOOK|GUILD_ID)' ~/.zshrc ~/.bashrc ~/.zprofile ~/.envrc 2>/dev/null | grep -v '^#'

# Doppler across all projects
for proj in $(doppler projects --json 2>/dev/null | jq -r '.[].slug'); do
  doppler secrets --project "$proj" --config prd --json 2>/dev/null | \
    jq -r --arg proj "$proj" 'to_entries[] | select(.key | test("DISCORD")) | "\(.key)=\(.value.computed) (doppler:\($proj)/prd)"'
done

# 1Password
op item list --categories "API Credential" --format json 2>/dev/null | \
  jq -r '.[] | select(.title | test("discord"; "i")) | .id' | \
  while read id; do op item get "$id" --format json 2>/dev/null; done

# Dashlane / Bitwarden
dcli password discord --output json 2>/dev/null
bw list items --search discord 2>/dev/null | jq -r '.[] | select(.login.password) | .login.password' | head -1

# macOS Keychain (Darwin only — the setup wizard already guards this at the OS level)
security find-generic-password -s "discord" -w 2>/dev/null

# Claude-ops credential store (cross-OS)
"${CLAUDE_PLUGIN_ROOT}/lib/credential-store.sh" get discord bot-token 2>/dev/null
```

Cache these results. Also check `$PREFS_PATH` under `discord.*` and `discord_webhook_url` (the flat key shared with ops-notify.sh) — if any of `discord.bot_token`, `discord.default_webhook_url`, or `discord_webhook_url` is already present, show `✓ Discord — already configured` and offer `[Keep]` / `[Reconfigure]`.

#### If anything was found

Present via the Universal Credential Auto-Scan prompt format with `[Use this value]` / `[Paste a different one]` / `[Skip]`. If a webhook URL was found but no bot token, note that reads + channel listing will be unavailable (send-only).

#### Per Rule 3 — if nothing was found, ask explicitly (≤4 options per Rule 1)

```
No Discord credentials found. How do you want to configure Discord?
  [Paste bot token]
  [Paste webhook URL only]
  [Deep hunt — spawn agent]
  [Skip — I'll configure later]
```

On `[Deep hunt — spawn agent]`, spawn a background research agent (Rule 4 — `run_in_background: true`):

```
Agent(
  subagent_type: "general-purpose",
  model: "haiku",
  run_in_background: true,
  prompt: "Grep the filesystem under $HOME (excluding node_modules, .git, Library/Caches) for Discord credentials. Patterns: bot tokens look like base64 segments separated by dots (e.g. MTAxXXXX.YYYYYY.ZZZZZZZZZZZZ), webhook URLs start with https://discord.com/api/webhooks/ or https://discordapp.com/api/webhooks/, guild IDs are 17-20 digit snowflakes adjacent to the word 'guild' or 'server'. Also scan ~/.config, ~/.env, any .envrc files, and Doppler/1Password exports. Return every hit with file path + line number + 6-char redacted prefix. Do not print full tokens."
)
```

While the hunt runs, continue with the next setup sub-step; return to Discord when the agent reports back and present findings via `AskUserQuestion` (paginate to ≤4 per Rule 1).

On `[Paste bot token]`:

```
Enter your Discord Bot Token:
  Find it: https://discord.com/developers/applications → your app → Bot → Reset Token
  Format: MTAxXXXX.YYYYYY.ZZZZZZZZZZZZZZ  (base64 dot-separated)
  Prefer a Doppler reference (doppler:DISCORD_BOT_TOKEN) over the raw value.

Enter your Discord Guild ID (optional — needed for `channels` listing):
  Enable Developer Mode in Discord → right-click server → Copy ID.
```

Smoke test (background via Bash per Rule 4):

```bash
curl -sS "https://discord.com/api/v10/users/@me" \
  -H "Authorization: Bot $DISCORD_BOT_TOKEN" \
  -H "User-Agent: ops-discord (claude-ops, v1)" | jq '.id // .message'
```

Expect a numeric snowflake `id`. If the response is `{"message":"401: Unauthorized", ...}`, re-ask.

On `[Paste webhook URL only]`:

```
Enter a default Discord Webhook URL:
  Find it: Discord → Server Settings → Integrations → Webhooks → New Webhook → Copy URL
  Format: https://discord.com/api/webhooks/<ID>/<TOKEN>
```

Smoke test — do NOT send content to the webhook during setup. Instead, issue a GET to confirm the URL resolves to webhook metadata:

```bash
curl -sS -o /dev/null -w '%{http_code}\n' -X GET "$DISCORD_WEBHOOK_URL"
```

Expect `200` (webhook metadata returned) or `401` (valid URL, token invalid — user needs to re-copy).

#### Save to preferences

Write to `$PREFS_PATH` (merge):

```json
{
  "discord": {
    "bot_token": "doppler:DISCORD_BOT_TOKEN",
    "guild_id": "<GUILD_ID>",
    "default_webhook_url": "doppler:DISCORD_WEBHOOK_URL",
    "configured_at": "<ISO timestamp>"
  },
  "discord_webhook_url": "doppler:DISCORD_WEBHOOK_URL"
}
```

Mirror the webhook to the flat `discord_webhook_url` key so `scripts/ops-notify.sh` (the existing fires sink) continues to find it. Prefer a Doppler reference over raw tokens when Doppler is configured. Prefer the credential-store (`ops_cred_set discord bot-token <value>`) over plaintext prefs on systems with a native keyring. If the user picked `[Skip]`, save `{"discord": "skipped"}` so the wizard doesn't re-prompt on the next run.

> **Deep-dive:** see `${CLAUDE_PLUGIN_ROOT}/skills/ops-comms/SKILL.md` (Discord send/read sections) and `${CLAUDE_PLUGIN_ROOT}/bin/ops-discord` for full operational instructions and subcommand reference.

---

## Step 4 — Configure MCPs (if selected)

For each MCP that isn't in `mcp_configured`, offer bulk setup first:

```
Unconfigured MCPs: Linear, Sentry, Vercel. What would you like to do?
  [Configure all MCPs — run claude mcp add for each (Recommended)]
  [Pick which MCPs to add]
  [Skip MCP configuration]
```

If the user selects "Configure all", run `claude mcp add <name>` for each unconfigured MCP in sequence. If "Pick which", list each individually:

```
Linear:  claude mcp add linear
Sentry:  claude mcp add sentry
Vercel:  claude mcp add vercel
Slack:   claude mcp add slack
Gmail:   claude mcp add gmail   (fallback only — prefer `gog` CLI, see Step 3c)
```

Offer `[Add now]`, `[Skip]` for each. Do **not** try to register MCPs from the skill — the plugin can't do that safely.

**Email note:** the ops plugin's primary email path is the `gog` CLI (full read + send, own OAuth). The Gmail MCP connector works as a fallback but **cannot send** without extra permission config in Claude Desktop → Settings → Connectors. The wizard handles that detection in Step 3c; this step only lists it so users who deliberately prefer MCP can install it here.

> **Deep-dive:** see `${CLAUDE_PLUGIN_ROOT}/skills/ops-linear/SKILL.md`, `${CLAUDE_PLUGIN_ROOT}/skills/ops-triage/SKILL.md`, and `${CLAUDE_PLUGIN_ROOT}/skills/ops-fires/SKILL.md` for full operational instructions, CLI reference, and troubleshooting for the MCP-backed integrations (Linear issue flows, triage routing, Sentry/Vercel fires). The setup agent can load those files directly when it needs more depth than this wizard provides.

---

## Step 5 — Build the project registry (if selected)

> **Templates:** a pre-baked starter for common stacks lives in `${CLAUDE_PLUGIN_ROOT}/scripts/registry.templates/`. If you want to start from one, `cp "${CLAUDE_PLUGIN_ROOT}/scripts/registry.templates/<stack>.json" "${CLAUDE_PLUGIN_ROOT}/scripts/registry.json"` then edit — or continue the wizard below for interactive discovery.

### Auto-discover from filesystem

Before asking the user to manually enter projects, scan for existing git repositories:

```bash
find ~ ~/Projects -maxdepth 2 -name ".git" -type d 2>/dev/null | sed 's|/.git||' | sort
```

Present the discovered paths to the user via `AskUserQuestion` with `multiSelect: true`. **Max 4 options per call** — paginate at 3 projects per page + `[More...]` or `[None — I'll enter projects manually]` as the last option:

```
Found git repositories (page 1 of N):
  [ ] ~/Projects/my-app
  [ ] ~/Projects/my-api
  [ ] ~/Projects/my-ai
  [ ] More repositories...
```

On the final page, replace "More repositories..." with `[None of the above / Done selecting]`.

For each selected project, collect these fields one `AskUserQuestion` at a time:

- `alias` (short name, required — suggest the directory name as default)
- `org` (GitHub org or owner, e.g. `your-org` or `your-username`)
- `infra.platform` → select `[aws]`, `[vercel]`, `[cloudflare]`, `[other]`
- `revenue.model` → select in batches of 4: `[saas]`, `[subscription]`, `[marketplace]`, `[More...]` then `[internal]`, `[portfolio]`, `[other]`

### Auto-discover external projects

A real user's portfolio is rarely just git repos. Shopify stores, Linear teams, Slack workspaces, and Notion databases are first-class projects that `ops-external` + `ops-projects` know how to surface — but only if they land in `registry.json`. This sub-step probes whatever integrations the wizard has already configured and offers discovered items for one-click registration.

```!
${CLAUDE_PLUGIN_ROOT}/bin/ops-discover-external 2>/dev/null || echo '[]'
```

The script reads Shopify creds from `$PREFS_PATH .ecom.shopify.*` + `SHOPIFY_*` env, Linear from `LINEAR_API_KEY`, Slack from keychain `slack-xoxc`/`slack-xoxd`, and Notion from `NOTION_API_KEY` / keychain `notion-api-key`. It returns an array of candidate projects, each with a ready-to-merge `config` block.

**Parse the candidates** and — for each one not already present in `registry.json` (match by `config.alias` or by `source + source-specific ID`) — present it via `AskUserQuestion`. Batch at 3 candidates per call + `[More...]` to respect Rule 1 (max 4 options). Example batch:

```
Found external projects not yet in your registry (page 1 of N):
  [Register "mystore" (shopify — basic plan, 142 products)]
  [Register "linear-eng" (linear — Engineering, 42 open issues)]
  [Register "notion-roadmap" (notion — Product Roadmap database)]
  [More candidates...]
```

On the final page, the last option becomes `[None of the remaining — skip]`. Multi-select is acceptable — if you offer it, keep the `multiSelect: true` list size ≤ 4.

For each **accepted** candidate, merge its `config` block straight into `registry.json .projects[]` with `jq`:

```bash
PLUGIN_ROOT="${CLAUDE_PLUGIN_ROOT}"
REG="$PLUGIN_ROOT/scripts/registry.json"
[ -f "$REG" ] || echo '{"version":"1.0","owner":"","projects":[]}' > "$REG"
jq --argjson new "$CONFIG_JSON" '.projects += [$new]' "$REG" > "$REG.tmp" && mv "$REG.tmp" "$REG"
```

**Status handling:**
- `discovered` → register as-is.
- `auth_expired` → surface a warning and route the user to `/ops:setup` for the affected channel before retrying.
- `unreachable` → offer `[Register anyway (will show as unreachable in dashboards)]` / `[Skip]`.

If the discovery script returns `[]`, print a single info line (`ℹ No external projects auto-discovered. You can add Shopify / Linear / Slack / Notion manually below.`) and continue. Never silently skip — the user must know the discovery ran.

If the candidate's credential value came from an env var but the user later wants Doppler, the credential key stored in the candidate (`SHOPIFY_ADMIN_TOKEN`, etc.) is safe to replace with a `doppler:` reference later via `/ops:settings`.

### Existing registry

If `registry.json` already has projects, ask first (4 options, fits in one call): `[Keep existing N projects]`, `[Add more projects]`, `[Auto-detect from existing registry]`, `[Start from scratch]`.

- "Keep existing" → skip this step.
- "Auto-detect from existing registry" → re-read the registry, show a summary of what's already there, and offer to add missing fields or newly-discovered repos.
- "Start from scratch" → write an empty skeleton first (`{"version":"1.0","owner":"","projects":[]}`) — **prompt to confirm before overwriting**.
- "Add more" → run the auto-discover scan above, then offer manual entry as a fallback.

### Manual add loop

After auto-discovery (or if the user selects "I'll enter projects manually"):

- Ask `AskUserQuestion`: "Add another project?" → `[Yes]`, `[Done]`.
- If Yes, collect these fields **one `AskUserQuestion` at a time**:
  - `alias` (short name, required)
  - `paths` (comma-separated absolute paths, required)
  - `repos` (comma-separated `org/repo`, required)
  - `type` → select `[monorepo]`, `[multi-repo]`
  - `infra.platform` → select `[aws]`, `[vercel]`, `[cloudflare]`, `[other]`
  - `revenue.model` → select in batches of 4: `[saas]`, `[subscription]`, `[marketplace]`, `[More...]` then `[internal]`, `[portfolio]`, `[other]`
  - `revenue.stage` → select `[pre-launch]`, `[development]`, `[growth]`, `[active]`
  - `gsd` → select `[Yes]`, `[No]`
  - `priority` (1-99, defaults to max+1)
- Ensure the registry directory exists: `mkdir -p "${CLAUDE_PLUGIN_ROOT}/scripts"`. If the write fails due to permissions (plugin cache dirs can be read-only), fall back to writing at `$DATA_DIR/registry.json` and symlink it.
- Read the current registry with `jq`, append the new project, write back atomically (`jq ... > tmp && mv tmp registry.json`).
- After each addition, print the running count and offer `[Add another]` / `[Done]`.
- The registry agent (if spawned) MUST have write access to the target path. If it can't write, the setup wizard should write the file itself from the agent's returned JSON — do not ask the user to intervene.

> **Deep-dive:** see `${CLAUDE_PLUGIN_ROOT}/skills/ops-projects/SKILL.md` for full operational instructions, CLI reference, and troubleshooting for the project registry (auto-discovery, registry schema, GSD filters, priority ordering). The setup agent can load that file directly when it needs more depth than this wizard provides.

---

## Step 5b — Daemon Service Reconciliation

By now, the daemon was already installed in Step 2c and has been pre-warming the briefing cache in the background while the user configured channels. This step adds **channel-dependent services** (`wacli-sync`, `message-listener`, `inbox-digest`, `store-health`, `competitor-intel`) now that we know which channels and integrations are configured.

**Skip conditions:**
- If the user declined daemon install in Step 2c, skip this step entirely.
- If `daemon.enabled != true` in `$PREFS_PATH`, skip.

Otherwise continue — reconcile the services list:

**1. Verify the daemon is running:**

```bash
DATA_DIR="${CLAUDE_PLUGIN_DATA_DIR:-$HOME/.claude/plugins/data/ops-ops-marketplace}"
PLIST_DEST="$HOME/Library/LaunchAgents/com.claude-ops.daemon.plist"
launchctl print gui/$(id -u)/com.claude-ops.daemon >/dev/null 2>&1 || {
  # Daemon not running — install it now as a fallback
  launchctl bootstrap gui/$(id -u) "$PLIST_DEST" 2>/dev/null
}
```

**2. Verify health after 5 seconds:**

```bash
cat "$DATA_DIR/daemon-health.json" 2>/dev/null
```

Parse the JSON. If `action_needed` is not null, surface the required action to the user. If the daemon wrote a health file, print:

```
✓ Background daemon — running (wacli-sync: connected, memory-extractor: scheduled)
```

If the health file is missing (daemon may still be initializing), wait 5 more seconds and retry once. If still missing, print:

```
⚠ Daemon started but health file not yet written. Check:
  launchctl print gui/$(id -u)/com.claude-ops.daemon
  tail -20 ~/.claude/plugins/data/ops-ops-marketplace/logs/ops-daemon.log
```

**3. Build the full services list and reconcile with the config written in Step 2c:**

Determine which services to enable based on what was configured in earlier steps. The `briefing-pre-warm` and `memory-extractor` services were already enabled at Step 2c — preserve them. Add channel-dependent services based on what's now configured:

- `wacli-sync` — always include if WhatsApp is configured (`channels.whatsapp` is set)
- `memory-extractor` — always include
- `inbox-digest` — always include (runs every 4h, aggregates all configured channels)
- `store-health` — include ONLY if ecommerce was configured (`ecom.shopify.store_url` is set in `$PREFS_PATH`)
- `competitor-intel` — always include (runs weekly Monday 10am)
- `message-listener` — include if WhatsApp or Telegram is configured (persistent poller)

Build the services array programmatically (starting from the 2c baseline):
```bash
SERVICES='["briefing-pre-warm","memory-extractor","inbox-digest","competitor-intel"]'
PREFS=$(cat "$PREFS_PATH" 2>/dev/null || echo '{}')
# Add wacli-sync + message-listener if WhatsApp is configured
if echo "$PREFS" | jq -e '.channels.whatsapp' > /dev/null 2>&1; then
  SERVICES=$(echo "$SERVICES" | jq '. + ["wacli-sync","message-listener"]')
fi
# Add message-listener for Telegram too (deduplicate)
if echo "$PREFS" | jq -e '.channels.telegram' > /dev/null 2>&1; then
  SERVICES=$(echo "$SERVICES" | jq '. + ["message-listener"] | unique')
fi
# Add store-health only if Shopify is configured
if echo "$PREFS" | jq -e '.ecom.shopify.store_url' > /dev/null 2>&1; then
  SERVICES=$(echo "$SERVICES" | jq '. + ["store-health"]')
fi
echo "Services to enable: $SERVICES"
```

Write daemon services config to `$DATA_DIR/daemon-services.json` — merge with the existing config from Step 2c, preserving `briefing-pre-warm` and `memory-extractor`, and enabling the new channel-dependent services. **Every service MUST include a `command` field** — the daemon's `start_service()` skips any service without one. Use `${CLAUDE_PLUGIN_ROOT}` (resolved at runtime) for script paths. Each service entry should include:
- `briefing-pre-warm`: `{ "enabled": true, "command": "${CLAUDE_PLUGIN_ROOT}/bin/ops-gather", "cron": "*/2 * * * *" }` — pre-warms /ops:go cache (installed in 2c)
- `wacli-sync`: `{ "enabled": true, "command": "${CLAUDE_PLUGIN_ROOT}/scripts/wacli-keepalive.sh", "health_file": "~/.wacli/.health", "restart_delay": 60, "max_restarts": 10 }` — only if WhatsApp configured
- `memory-extractor`: `{ "enabled": true, "command": "${CLAUDE_PLUGIN_ROOT}/scripts/ops-memory-extractor.sh", "health_file": "~/.claude/plugins/data/ops-ops-marketplace/memories/.health", "cron": "*/30 * * * *" }` — every 30 min (installed in 2c)
- `inbox-digest`: `{ "enabled": true, "command": "${CLAUDE_PLUGIN_ROOT}/scripts/ops-cron-inbox-digest.sh", "cron": "0 */4 * * *" }` — every 4h
- `store-health`: `{ "enabled": true, "command": "${CLAUDE_PLUGIN_ROOT}/scripts/ops-cron-store-health.sh", "cron": "0 9 * * *" }` — daily 9am, only if ecom configured
- `competitor-intel`: `{ "enabled": true, "command": "${CLAUDE_PLUGIN_ROOT}/scripts/ops-cron-competitor-intel.sh", "cron": "0 10 * * 1" }` — weekly Monday 10am
- `message-listener`: `{ "enabled": true, "command": "${CLAUDE_PLUGIN_ROOT}/scripts/ops-message-listener.sh" }` — only if WhatsApp or Telegram configured

After rewriting the services config, do a quick health check (foreground, <2s), then background the reload:

```bash
# Quick health check — foreground (fast)
test -f "$DATA_DIR/daemon-services.json" && echo "✓ Daemon services config written — N services enabled"
```

Then **background** the actual daemon reload — it can be slow:

```bash
# Background — daemon reload is slow, don't block setup
launchctl kickstart -k gui/$(id -u)/com.claude-ops.daemon 2>&1 && echo "✓ Daemon reloaded" || echo "⚠ Daemon kick failed (may still be running)"
```

Use `run_in_background: true` on the reload command. Do NOT wait for it — continue immediately to the next step. The daemon will pick up the new config on its own cycle even if kickstart is slow.

Write `daemon.enabled = true` and `daemon.services` (the reconciled array) to `$PREFS_PATH`. Print:

```
✓ Daemon services reconciled — N services enabled (briefing-pre-warm, memory-extractor, wacli-sync, ...)
  Daemon reloading in background.
```

> **Deep-dive:** see `${CLAUDE_PLUGIN_ROOT}/docs/daemon-guide.md` for full operational instructions, CLI reference, and troubleshooting for the background daemon (service lifecycle, launchctl/systemd integration, health reporting, reconciliation semantics). The setup agent can load that file directly when it needs more depth than this wizard provides.

---

## Step 6 — Save preferences (if selected)

Collect these via `AskUserQuestion` — one question each. **Never auto-fill from memory, existing configs, or previous sessions. Always ask explicitly.**

1. **Owner name** (free text): "What should Claude call you in briefings?" — no default, no suggestions from memory.

2. **Timezone** (single select — max 4 options per call, batch by region):

   First, detect the system timezone via `date +%Z` or `readlink /etc/localtime`. If detected, offer it as the first option:
   ```
   Select your timezone:
     [<detected timezone>]
     [Americas...]
     [Europe/Asia/Oceania...]
     [Other — type it]
   ```
   If user picks "Americas...": `[America/New_York]`, `[America/Los_Angeles]`, `[America/Chicago]`, `[Back]`
   If user picks "Europe/Asia/Oceania...": `[Europe/London]`, `[Asia/Bangkok]`, `[Asia/Tokyo]`, `[Australia/Sydney]`

3. **Briefing verbosity** (single select):
   ```
   How much detail do you want in briefings?
     [full]     — complete rundown of all channels, projects, and incidents
     [compact]  — key signals only, one line per item
     [minimal]  — just the fires and urgent items
   ```

4. **Primary project** → **"All projects active in last 7 days" should be the first/default option.** Most users working across multiple projects want a unified briefing, not a single-project focus:
   ```
   Primary project for briefings?
     [All projects active in last 7 days]  ← default
     [Pick a specific project...]
   ```
   If "specific project", show registry aliases paginated at 3 per page + `[More...]`. Store `"primary_project": "all_active_7d"` for the default, or the specific alias.

5. **YOLO mode** → select `[Yes — auto-approve low-risk actions]`, `[No — always confirm]`.

6. **Default channels** (single-select — these two options are mutually exclusive). **"All configured" should be the first option and pre-selected by default** — most users want all their channels active:
   ```
   Which channels should ops skills use by default?
     [All configured channels]
     [Pick specific channels...]
   ```
   If the user picks "specific channels", show a follow-up multiSelect with individual channel checkboxes. If they accept "All configured", set `default_channels` to the full list of configured channel names.

Write to `$PREFS_PATH`:

```json
{
  "version": "1.0",
  "owner": "...",
  "primary_project": "...",
  "timezone": "...",
  "briefing_verbosity": "...",
  "yolo_enabled": false,
  "default_channels": ["whatsapp", "email"],
  "secrets_manager": "doppler",
  "doppler": {
    "project": "...",
    "config": "..."
  },
  "channels": {
    "telegram": { "bot_token": "...", "owner_id": "..." }
  }
}
```

If the file already exists, **merge** — don't overwrite. Read with `jq`, apply updates with `jq '. + { ... }'`, write back.

---

## Step 7 — Shell env (if selected)

1. Check whether `CLAUDE_PLUGIN_ROOT` is already exported in the profile file (grep for `CLAUDE_PLUGIN_ROOT`).
2. If missing, **append it automatically** — this is a required step, not optional. Use `>>` (append, never overwrite). Print: `"✓ Added export CLAUDE_PLUGIN_ROOT=... to ~/.zshrc"`. Do NOT ask the user for permission — Rule 2 (never delegate commands to the user) applies here.
3. Tell the user: `"Run 'source ~/.zshrc' or open a new terminal for it to take effect."` — this will show as an approval prompt in Claude's next tool call, which the user accepts normally.

---

## Step 8 — Final summary + validation

Re-run the detector and present a final status dashboard:

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 OPS ► SETUP COMPLETE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 ✓ Core CLIs:  jq, git, gh, aws, node
 ✓ Channels:   telegram, whatsapp, email
 ✓ Ecommerce:  shopify (<store_url>)             ← omit line if not configured
 ✓ Marketing:  klaviyo, meta, google-ads, ga4, gsc           ← omit line if not configured
 ✓ Voice:      bland, elevenlabs, groq           ← omit line if not configured
 ✓ Secrets:    doppler → my-app/dev
 ✓ MCPs:       linear, sentry, vercel
 ✓ Registry:   20 projects
 ✓ Prefs:      saved to ~/.claude/plugins/data/ops-ops-marketplace/preferences.json
 ✓ Daemon:     ops-daemon → wacli-sync, memory-extractor, inbox-digest

 Next: /ops-go for your first briefing
──────────────────────────────────────────────────────
```

For each of ecommerce, marketing, and voice: only show the status line if at least one service was configured in that category. Use `✓` if configured, `○` if skipped. Omit the line entirely if the section was never visited.

For the daemon line, list only the services that were actually enabled (from the computed services array in Step 5b).

If any required tool is still missing, list it with the exact command to install it and stop short of claiming success.

After displaying the summary, run the completion banner to celebrate the successful setup. Pass the actual counts from the setup session:

```bash
bash ${CLAUDE_PLUGIN_ROOT}/bin/ops-setup-complete --channels <N> --projects <N> --agents 9 --skills 15
```

Where `<N>` is replaced with the actual number of channels configured and projects registered during this session.

---

## Daemon Health Contract

All ops skills should check daemon health before relying on background services:

```bash
cat ~/.claude/plugins/data/ops-ops-marketplace/daemon-health.json
```

If `action_needed` is not null, surface the required action to the user before proceeding.
If the daemon is not running, offer to start it: `launchctl bootstrap gui/$(id -u) ~/Library/LaunchAgents/com.claude-ops.daemon.plist`

---

## Invocation shortcuts

If `$ARGUMENTS` contains a specific section name, jump straight to that section:

| Argument                               | Go to   |
| -------------------------------------- | ------- |
| `cli`, `install`                       | Step 2  |
| `channels`                             | Step 3  |
| `telegram`                             | Step 3a |
| `whatsapp`, `wacli`, `whatsapp-doctor` | Step 3b |
| `email`                                | Step 3c |
| `slack`                                | Step 3d |
| `notion`                               | Step 3e |
| `calendar`, `cal`                      | Step 3f |
| `doppler`, `secrets`                   | Step 3g |
| `vault`, `password-manager`, `pm`      | Step 3h |
| `ecom`, `shopify`, `store`             | Step 3i |
| `marketing`, `klaviyo`, `ads`, `meta`, `ga4` | Step 3j |
| `google-ads`, `gads` | Step 3j (Google Ads) |
| `voice`, `bland`, `elevenlabs`, `tts`  | Step 3k |
| `mcp`                                  | Step 4  |
| `registry`, `projects`                 | Step 5  |
| `daemon`, `background`                 | Step 5b |
| `prefs`, `preferences`                 | Step 6  |
| `env`, `shell`                         | Step 7  |

Empty argument → full wizard from Step 0.

---

## Safety

- **Never** run `brew install` or write files without an explicit `AskUserQuestion` confirmation.
- **Never** overwrite an existing file without showing the diff and asking.
- **Never** put secrets in `registry.json` or commit them. Secrets only go in `$PREFS_PATH` (outside the plugin source tree entirely — Claude Code's per-plugin data dir) or the user's shell profile.
- **Never** touch `~/.claude.json` or `~/.claude/settings.json` — MCP registration is Claude Code's job, not yours.
- **Never** show the user's real name or email in output unless they explicitly provided it in the current session. Do not read from memory files, existing preferences, or environment variables to populate display names.

---

## Appendix: CLI Reference (EXACT SYNTAX — never guess)

### gog (v0.12.0+)

#### Top-level commands
auth, gmail, calendar, contacts, drive, docs, slides, sheets, forms, tasks, keep, chat, people, appscript, config, agent

#### Gmail — Search & Read
```bash
gog gmail search "<query>" --max N -j --results-only --no-input    # Search threads (Gmail query syntax)
gog gmail thread get <threadId> -j                                  # Get full thread with all messages
gog gmail get <messageId> -j                                        # Get single message
```

#### Gmail — Actions
```bash
gog gmail archive <messageId> ... --no-input --force               # Archive messages (remove from inbox)
gog gmail archive --query "<gmail-query>" --max N --force           # Archive by query
gog gmail mark-read <messageId> ... --no-input                     # Mark as read
gog gmail unread <messageId> ... --no-input                        # Mark as unread
gog gmail trash <messageId> ... --no-input --force                 # Move to trash
```

#### Gmail — Labels
```bash
gog gmail labels list -j                                            # List all labels
gog gmail labels modify <threadId> --add LABEL --remove LABEL       # Modify thread labels
gog gmail messages modify <messageId> --add LABEL --remove LABEL    # Modify message labels
```

#### Gmail — Send & Reply
```bash
gog gmail send --to "user@example.com" --subject "subj" --body "text"                    # Send new email
gog gmail send --to "a@b.com" --subject "Re: ..." --body "reply" --reply-to-message-id <msgId>  # Reply
gog gmail send --reply-to-message-id <msgId> --reply-all --body "reply text"             # Reply all
gog gmail send --to "a@b.com" --subject "subj" --body "text" --attach /path/to/file      # With attachment
```

#### Gmail — Drafts
```bash
gog gmail drafts list -j                                            # List drafts
gog gmail drafts create --to "user@example.com" --subject "subj" --body "text"
```

#### Calendar
```bash
gog calendar calendars -j                                           # List calendars
gog calendar events primary --today -j                              # Today's events
gog calendar events primary --from "2026-04-14" --to "2026-04-15" -j  # Date range
gog calendar create primary --summary "Meeting" --from "2026-04-15T10:00:00" --to "2026-04-15T11:00:00"
gog calendar freebusy --from "2026-04-14T00:00:00Z" --to "2026-04-14T23:59:59Z" -j
```

#### Contacts
```bash
gog contacts search "name" -j                                       # Search contacts
gog contacts list -j                                                # List all contacts
```

#### Drive
```bash
gog drive ls -j                                                     # List files
gog drive search "query" -j                                         # Search files
gog drive download <fileId>                                         # Download file
```

#### Tasks
```bash
gog tasks lists                                                     # List task lists
gog tasks list <tasklistId> -j                                      # List tasks
```

#### Auth
```bash
gog auth status                                                     # Check auth status
gog auth add user@example.com --services gmail,calendar,drive,contacts,docs,sheets
```

### wacli

```bash
# Health check
wacli doctor --json

# Auth status
wacli auth status --json

# List chats (MUST use subcommand `list`)
wacli chats list --json

# List messages (--after flag uses YYYY-MM-DD)
# macOS
wacli messages list --after="$(date -v-1d +%Y-%m-%d)" --limit=5 --json
# Linux
wacli messages list --after="$(date -d '1 day ago' +%Y-%m-%d)" --limit=5 --json

# Send message
wacli send --to "JID" --message "text"

# Sync (connect and pull)
wacli sync

# Backfill history
wacli history backfill --chat="JID" --count=50 --requests=2 --wait=30s --idle-exit=5s --json

# Contact lookup
wacli contacts --search "name" --json
```

> After setup, the memory-extractor daemon service will populate `memories/contact_*.md` from this contact data.

### Slack token validation

```bash
curl -s -H "Authorization: Bearer XOXC_TOKEN" -b "d=XOXD_TOKEN" "https://slack.com/api/auth.test"
```

### macOS Keychain

```bash
security find-generic-password -s "KEY_NAME" -w 2>/dev/null
security add-generic-password -U -s "KEY_NAME" -a "$USER" -w "VALUE"
security delete-generic-password -s "KEY_NAME" 2>/dev/null
```
