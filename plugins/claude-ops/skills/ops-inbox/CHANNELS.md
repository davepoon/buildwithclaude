# Channel Configuration Guide

This document explains how to configure each communication channel for the `/ops:ops-inbox` skill. All credentials come from environment variables or CLI auth — **no secrets are committed to this repo**.

## WhatsApp (wacli)

**Status:** CLI-based (wacli), no MCP needed.

**Setup:**

```bash
# Install latest version from source (brew version may be outdated)
git clone https://github.com/steipete/wacli.git /tmp/wacli-src
cd /tmp/wacli-src
go build -o wacli ./cmd/wacli/
cp wacli /usr/local/bin/

# Authenticate (scans QR code with phone)
wacli auth

# Verify
wacli doctor
# Expected: AUTHENTICATED true, CONNECTED false (until sync runs)

# Initial sync (takes a minute for 142+ conversations)
wacli sync
```

**Troubleshooting:**

- `Client outdated (405)`: Rebuild from source above
- `store is locked`: Kill stale process: `kill $(pgrep wacli)`
- After version upgrade: `wacli auth logout && wacli auth`

**History limitations:**
wacli only captures messages **received while connected**. It cannot reliably backfill historical messages after the fact:

- `wacli history backfill --chat <jid>` requires ≥1 existing local message per chat and often times out on the WhatsApp on-demand sync response.
- Chats in the new `@lid` (Linked Device) format frequently return empty message queries because their history was never captured during an active sync session.
- For ongoing inbox management, run `wacli sync --follow` in a persistent terminal (outside Claude Code) so new messages land in the local DB in real-time.

**Env vars (optional):**

- `WACLI_STORE` — default `~/.wacli`

**Run sync persistently (recommended):**

```bash
# In a dedicated terminal tab — keeps wacli connected so new messages are captured
wacli sync --follow
```

---

## Email (gog)

**Status:** CLI-based (gog), optional MCP fallback.

**Setup:**

```bash
# Install gog (gogcli — public CLI from steipete/gogcli, used by the OpenClaw ecosystem)
case "$(uname -s)" in
  Darwin*)            brew install gogcli ;;
  Linux*)             brew install gogcli 2>/dev/null \
                        || (command -v yay >/dev/null 2>&1 && yay -S gogcli) \
                        || (git clone https://github.com/steipete/gogcli.git /tmp/gogcli && cd /tmp/gogcli && make) ;;
  MINGW*|MSYS*|CYGWIN*) winget install -e --id steipete.gogcli ;;
  *) echo "Unsupported OS — see https://gogcli.sh/ for install instructions" ;;
esac

# Authorize once per Google account (uses your OS keyring for refresh tokens)
gog auth credentials /path/to/client_secret.json
gog auth add you@example.com --services gmail,calendar,drive,contacts,docs,sheets
```

**Env vars (optional):**

- `GMAIL_ACCOUNT` — Gmail account (auto-detected if unset)

---

## Slack

**Status:** ⚠️ Not configured. Requires Slack MCP server.

**Requirements:**

- Slack MCP server installed and configured in `~/.claude/settings.json` under `mcpServers`
- Bot token with `channels:history`, `im:history`, `chat:write`, `search:read` scopes

**Setup:**

1. Install a Slack MCP server:
   ```bash
   # Option A: Official reference
   npm install -g @modelcontextprotocol/server-slack
   ```
2. Add to `~/.claude/settings.json`:
   ```json
   {
     "mcpServers": {
       "slack": {
         "command": "npx",
         "args": ["-y", "@modelcontextprotocol/server-slack"],
         "env": {
           "SLACK_BOT_TOKEN": "${SLACK_BOT_TOKEN}",
           "SLACK_TEAM_ID": "${SLACK_TEAM_ID}"
         }
       }
     }
   }
   ```
3. Export env vars (from Doppler, 1Password, or direnv — never commit):
   ```bash
   export SLACK_BOT_TOKEN="xoxb-..."
   export SLACK_TEAM_ID="T..."
   export SLACK_MCP_ENABLED=true
   ```
4. Restart Claude Code to load the MCP server

**Env vars:**

- `SLACK_BOT_TOKEN` — Bot token (starts with `xoxb-`)
- `SLACK_TEAM_ID` — Workspace ID
- `SLACK_MCP_ENABLED` — Set `true` to enable in ops-unread

---

## Telegram

**Status:** ⚠️ Not configured. Requires USER-AUTH MCP server (NOT a bot).

**CRITICAL:** Do NOT use BotFather bots. The inbox skill must read the owner's **personal** conversations, which bots cannot access. Required: tdlib or MTProto user-auth integration.

**Requirements:**

- Telegram API ID and hash from https://my.telegram.org/apps
- User-auth MCP server (e.g., `mcp-telegram-user` or custom tdlib wrapper)

**Setup:**

1. Get API credentials from https://my.telegram.org/apps (for personal app, not bot)
2. Install a user-auth Telegram MCP server (tdlib-based):
   ```bash
   # Example: custom tdlib MCP wrapper
   npm install -g mcp-telegram-user
   ```
3. Add to `~/.claude/settings.json`:
   ```json
   {
     "mcpServers": {
       "telegram": {
         "command": "mcp-telegram-user",
         "env": {
           "TELEGRAM_API_ID": "${TELEGRAM_API_ID}",
           "TELEGRAM_API_HASH": "${TELEGRAM_API_HASH}",
           "TELEGRAM_PHONE": "${TELEGRAM_PHONE}",
           "TELEGRAM_SESSION_PATH": "${HOME}/.telegram-mcp-session"
         }
       }
     }
   }
   ```
4. Authenticate on first run (prompts for SMS code)
5. Export env vars and enable:
   ```bash
   export TELEGRAM_API_ID="..."
   export TELEGRAM_API_HASH="..."
   export TELEGRAM_PHONE="+1..."
   export TELEGRAM_ENABLED=true
   ```

**Env vars:**

- `TELEGRAM_API_ID` — from my.telegram.org/apps
- `TELEGRAM_API_HASH` — from my.telegram.org/apps
- `TELEGRAM_PHONE` — phone number for auth
- `TELEGRAM_ENABLED` — Set `true` to enable in ops-unread

**⚠️ The existing `telegram-server/index.js` in this repo uses a bot token and is NOT suitable for personal inbox management. It needs replacement with a tdlib-based user-auth implementation.**

---

## Notion

**Status:** MCP-based (claude.ai integration or self-hosted MCP server).

Notion acts as a knowledge base and task management channel. The integration surfaces:
- **Comments needing reply** — mentions, questions, and comments on pages/databases you own
- **Recently updated pages** — changes in databases you track (e.g., project boards, CRM)
- **Assigned tasks** — items assigned to you across Notion databases

**Requirements:**

- Notion MCP server configured via one of:
  - **Claude.ai integration** (recommended): Add Notion via claude.ai > Settings > Integrations
  - **Self-hosted MCP**: Install `@notionhq/notion-mcp-server` or similar

**Setup (Claude.ai integration — recommended):**

1. Go to claude.ai > Settings > Integrations > Notion
2. Authorize access to your Notion workspace
3. Set env var in `~/.claude/settings.json`:
   ```json
   {
     "env": {
       "NOTION_MCP_ENABLED": "true"
     }
   }
   ```
4. Restart Claude Code to load the integration

**Setup (Self-hosted MCP server):**

1. Install the Notion MCP server:
   ```bash
   npm install -g @notionhq/notion-mcp-server
   ```
2. Create a Notion integration at https://www.notion.so/my-integrations
3. Add to `~/.claude/settings.json`:
   ```json
   {
     "mcpServers": {
       "notion": {
         "command": "npx",
         "args": ["-y", "@notionhq/notion-mcp-server"],
         "env": {
           "NOTION_API_KEY": "${NOTION_API_KEY}"
         }
       }
     }
   }
   ```
4. Export env vars:
   ```bash
   export NOTION_API_KEY="ntn_..."
   export NOTION_MCP_ENABLED=true
   ```

**Env vars:**

- `NOTION_API_KEY` — Integration token (starts with `ntn_`, only for self-hosted MCP)
- `NOTION_MCP_ENABLED` — Set `true` to enable in ops-unread

**MCP tools used:**

| Tool | Purpose |
|------|---------|
| `notion-search` | Search across workspace and connected sources (Slack, Drive, etc.) |
| `notion-fetch` | Fetch full page/database content by URL or ID |
| `notion-get-comments` | Get comments on a specific page |
| `notion-create-comment` | Reply to a comment thread on a page |
| `notion-update-page` | Update page properties (status, assignee, etc.) |
| `notion-create-pages` | Create new pages in databases |

---

## Verification

After configuring any channel, verify with:

```bash
${CLAUDE_PLUGIN_ROOT}/bin/ops-unread
```

Expected output shows each channel's `available: true/false` status.
