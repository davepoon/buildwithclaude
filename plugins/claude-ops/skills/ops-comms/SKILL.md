---
name: ops-comms
description: Send and read messages across all channels. Routes based on arguments — whatsapp, email, slack, telegram, discord, notion, or natural language like "send [msg] to [contact]".
argument-hint: "[channel] | send [message] to [contact] | read [channel] | notion [search query]"
allowed-tools:
  - Bash
  - Read
  - Grep
  - Glob
  - Skill
  - AskUserQuestion
  - mcp__claude_ai_Gmail__search_threads
  - mcp__claude_ai_Gmail__get_thread
  - mcp__claude_ai_Gmail__create_draft
  - mcp__claude_ai_Slack__slack_send_message
  - mcp__claude_ai_Slack__slack_read_channel
  - mcp__claude_ai_Slack__slack_search_users
  - mcp__claude_ai_Slack__slack_search_public_and_private
  - mcp__claude_ops_telegram__send_message
  - mcp__claude_ops_telegram__get_updates
  - mcp__claude_ops_telegram__list_chats
  - mcp__claude_ai_Notion__notion-search
  - mcp__claude_ai_Notion__notion-fetch
  - mcp__claude_ai_Notion__notion-get-comments
  - mcp__claude_ai_Notion__notion-create-comment
  - mcp__claude_ai_Notion__notion-update-page
  - mcp__claude_ai_Notion__notion-create-pages
effort: medium
maxTurns: 40
---

# OPS ► COMMS

## Runtime Context

Before executing, load available context:

1. **Daemon health**: Read `${CLAUDE_PLUGIN_DATA_DIR:-$HOME/.claude/plugins/data/ops-ops-marketplace}/daemon-health.json`
   - Check `wacli-sync` status before any WhatsApp operation
   - Also check `~/.wacli/.health` — if not `status=connected`, surface auth issue before proceeding

2. **Ops memories**: Before drafting any message, check `${CLAUDE_PLUGIN_DATA_DIR}/memories/`:
   - `contact_*.md` — load profile for the recipient
   - `preferences.md` — match user's communication style, language, and tone
   - `donts.md` — restrictions that must not appear in any draft

3. **Preferences**: Read `${CLAUDE_PLUGIN_DATA_DIR}/preferences.json` for `default_channels` to determine which channel to prefer when multiple are available for a contact.

## CLI/API Reference

### wacli (WhatsApp)

**Health file** — check `~/.wacli/.health` BEFORE any wacli command:
- `status=connected` → proceed
- `status=needs_auth` or `status=needs_reauth` → prompt user for QR scan, do NOT run wacli commands

| Command | Usage | Output |
|---------|-------|--------|
| `wacli doctor --json` | Check auth/connected/lock/FTS | `{data: {authenticated, connected, lock_held, fts_enabled}}` |
| `wacli chats list --json` | All chats | `{data: [{JID, Name, Kind, LastMessageTS}]}` |
| `wacli messages list --chat "<JID>" --limit N --json` | Messages for chat | `{data: {messages: [{FromMe, Text, Timestamp, SenderName, ChatName}]}}` |
| `wacli messages search --query "<text>" --json` | FTS search | Same as above |
| `wacli contacts --search "<name>" --json` | Contact lookup | Contact objects |
| `wacli send --to "<JID>" --message "<msg>"` | Send text | Success/error |

### gog CLI (Gmail/Calendar)

| Command | Usage | Output |
|---------|-------|--------|
| `gog gmail search "in:inbox" --max 50 -j --results-only --no-input` | Search inbox | JSON array of threads |
| `gog gmail thread get <threadId> -j` | Get full thread with all messages | Full message JSON |
| `gog gmail send --to "user@example.com" --subject "subj" --body "text"` | Send new email | Send result |
| `gog gmail send --reply-to-message-id <msgId> --reply-all --body "text"` | Reply all | Send result |
| `gog gmail send --to "a@b.com" --subject "subj" --body "text" --attach /path/file` | With attachment | Send result |
| `gog gmail archive <messageId> ... --no-input --force` | Archive messages | Archive result |

---

Parse `$ARGUMENTS` and route immediately:

## Routing table

| Pattern       | Action                                                  |
| ------------- | ------------------------------------------------------- |
| `whatsapp`    | Show WhatsApp recent chats — offer to read or send      |
| `email`       | Show recent email threads via Gmail MCP                 |
| `slack`       | Show recent Slack activity                              |
| `telegram`    | Show Telegram recent chats                              |
| `discord`     | Show recent Discord channel activity (via bin/ops-discord) |
| `notion`      | Search Notion workspace — pages, comments, tasks          |
| `send * to *` | Parse message and contact, determine best channel, send |
| `read *`      | Read the specified channel or contact's messages        |
| (empty)       | Show channel picker menu                                |

Natural-language parsing: phrases like `send "deploy done" to #general on discord` or `to #ops-alerts on Discord` should resolve to the `discord` branch below. Extract the channel token (the word after `#`, case-insensitive) and pass it as the first arg to `bin/ops-discord send`.

---

## Send flow: `send [message] to [contact]`

1. Parse contact name and message from `$ARGUMENTS`.
2. Determine channel by contact lookup:
   - Check WhatsApp: `wacli contacts --search "[contact]" --json 2>/dev/null`
   - Check Slack: `mcp__claude_ai_Slack__slack_search_users` with `query: "[contact]"`
   - Check email: known from context or ask
3. If multiple channels found, use `AskUserQuestion`: `[WhatsApp]` / `[Slack]` / `[Email]`
4. **Always preview before sending.** Use `AskUserQuestion` to confirm:

```
Ready to send via [channel]:
  To: [contact name] ([identifier])
  Message: "[full message text]"

  [Send now]  [Edit message]  [Cancel]
```

If user picks "Edit message", use `AskUserQuestion` with free-text to get the revised message, then re-preview.

5. Send via the chosen channel. Confirm with: `Sent to [contact] via [channel] ✓`

### WhatsApp send

**CRITICAL — READ BEFORE SENDING:** Before drafting ANY WhatsApp reply, you MUST:
1. Read the full conversation: `wacli messages list --chat "<JID>" --limit 20 --json`
2. Understand which messages are from the user (`FromMe: true`) vs the contact
3. Summarize what the conversation is about and what the contact is asking
4. Only THEN draft a reply that addresses what the contact actually said

**Never send a reply based on a single message.** A message like "can you pull it from Klaviyo?" means nothing without knowing what "it" refers to from prior messages.

**Pre-flight:** Before any wacli command, check `~/.wacli/.health`. If `status=needs_auth` or `status=needs_reauth`, prompt the user: "WhatsApp needs re-authentication. Run `wacli auth` in a separate terminal and scan the QR code, then type 'done'." Use `AskUserQuestion`: `[Done — re-paired]`, `[Skip WhatsApp]`. On Done, restart daemon: `launchctl kickstart -k gui/$(id -u)/com.claude-ops.wacli-keepalive`, wait 5s.

```bash
wacli send --to "[contact]" --message "[message]"
```

### Slack send

Use `mcp__claude_ai_Slack__slack_send_message` with resolved channel/user ID.

### Email send (draft)

Use `mcp__claude_ai_Gmail__create_draft` — always create draft first. Then use `AskUserQuestion`:
```
Draft created for [recipient]:
  Subject: [subject]
  Body: [preview]

  [Send now]  [Keep as draft]  [Edit]
```

---

## Read flow: `read [channel]`

**WhatsApp:**

```bash
wacli chats --limit 10 --json 2>/dev/null
```

Show last 10 chats with sender, preview, timestamp.

**Email:**
Use `mcp__claude_ai_Gmail__search_threads` with `query: "in:inbox"` (NOT `is:unread` — scan full inbox including read messages), show thread list.

**Slack:**
Use `mcp__claude_ai_Slack__slack_search_public_and_private` with `query: "in:channel"` (NOT `is:unread` — scan full recent activity).

**Telegram:**
Use `mcp__claude_ops_telegram__get_updates` (limit: 20) and `mcp__claude_ops_telegram__list_chats`.
Fall back to: `telegram-cli --exec "dialog_list" 2>/dev/null || echo "Telegram MCP not configured"`

**Discord:**
`${CLAUDE_PLUGIN_ROOT}/bin/ops-discord read "<CHANNEL_ID>" --limit 20 --json` — requires `DISCORD_BOT_TOKEN` (or credential-store `discord/bot-token`). Fall back to `bin/ops-discord channels --json` if the user doesn't know the channel ID and `DISCORD_GUILD_ID` is set.

**Notion:**
Use `mcp__claude_ai_Notion__notion-search` with the user's query (or `query: ""` sorted by `last_edited_time` for general browsing). For each result:
- Fetch full page content with `mcp__claude_ai_Notion__notion-fetch` using the page URL/ID from search results
- Get comments with `mcp__claude_ai_Notion__notion-get-comments`
- Show page title, database name, last editor, and recent comments

**Notion API fallback:** If MCP tools fail and `NOTION_API_KEY` is set, use `curl -s -H "Authorization: Bearer $NOTION_API_KEY" -H "Notion-Version: 2022-06-28" -X POST https://api.notion.com/v1/search -d '{"query":"<QUERY>","page_size":10}'`

### Notion comment/reply

Use `mcp__claude_ai_Notion__notion-create-comment` with the page ID to reply to a comment thread. For creating new pages in a database, use `mcp__claude_ai_Notion__notion-create-pages`.

Always preview before commenting:
```
Ready to comment on Notion page:
  Page: [page title]
  Comment: "[comment text]"

  [Post comment]  [Edit]  [Cancel]
```

### Telegram send

Use `mcp__claude_ops_telegram__send_message` with `chat_id` (from list_chats) and `text`.

### Discord send

Shell out to `bin/ops-discord send`. Three invocation shapes:

```bash
# By channel alias (resolves DISCORD_WEBHOOK_<UPPER> or DISCORD_WEBHOOK_URL)
${CLAUDE_PLUGIN_ROOT}/bin/ops-discord send "<channel-alias>" "<message>" --json

# By channel snowflake (17-20 digit ID, routed through bot token)
${CLAUDE_PLUGIN_ROOT}/bin/ops-discord send "<CHANNEL_ID>" "<message>" --json

# By full webhook URL (useful when the URL is stored per-project)
${CLAUDE_PLUGIN_ROOT}/bin/ops-discord send "https://discord.com/api/webhooks/<ID>/<TOKEN>" "<message>" --json
```

If the script exits 1 with `{"error":"no discord credential configured — run /ops:setup discord"}`, prompt the user via `AskUserQuestion` (≤4 options per Rule 1): `[Run /ops:setup discord]` / `[Paste webhook URL now]` / `[Skip]`. Do NOT silently skip — that violates Rule 3.

Note: `DISCORD_WEBHOOK_URL` is shared with the ops-fires notification sink (`scripts/ops-notify.sh`). When pre-existing, prefer it as the default for `/ops:comms discord send` rather than asking the user to set a separate value.

---

## Empty arguments — channel picker

Display the header, then use **batched AskUserQuestion calls** (max 4 options each):

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 OPS ► COMMS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

**Before presenting options**, read `${CLAUDE_PLUGIN_DATA_DIR}/preferences.json` and check which channels are configured. Only show configured channels. If <=4 total options (configured channels + "Send a message"), present in a single call. If >4, batch:

AskUserQuestion call 1 — Read channels:
```
  [Read WhatsApp]
  [Read Email]
  [Read Slack]
  [More...]
```

AskUserQuestion call 2 (only if "More..."):
```
  [Read Telegram]
  [Send a message]
```

If all channels are configured, that's 5 options — always batch. If only 3 channels are configured, "Read X" + "Read Y" + "Read Z" + "Send a message" = 4, fits in one call.

Execute the selected action.
