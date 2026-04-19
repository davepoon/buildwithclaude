---
name: uninstall
description: Completely remove claude-ops plugin, all stored credentials, cached files, shell exports, and MCP registrations. Confirms each step before deletion.
argument-hint: "[--confirm]"
allowed-tools:
  - Bash
  - Read
  - AskUserQuestion
effort: low
maxTurns: 15
---

# OPS > UNINSTALL

You are running a **complete uninstall** of the claude-ops plugin. This removes everything the plugin and `/ops:setup` created. Every deletion step requires user confirmation via `AskUserQuestion` — never delete silently.

---

## Step 1 — Confirm intent

Use `AskUserQuestion`:

```
This will completely remove claude-ops and all its data:
  - Plugin installation and marketplace registration
  - Stored preferences and project registry
  - Cached plugin files
  - Keychain credentials (Telegram, Slack tokens)
  - Shell profile exports (CLAUDE_PLUGIN_ROOT)
  - MCP server registrations (Telegram, Slack)

  [Uninstall everything]  [Cancel]
```

If cancelled, stop immediately.

---

## Step 2 — Detect what exists

Scan for all claude-ops artifacts. Build a list of what's present:

```bash
# Preferences
PREFS_DIR="${CLAUDE_PLUGIN_DATA_DIR:-$HOME/.claude/plugins/data/ops-ops-marketplace}"
ls -la "$PREFS_DIR" 2>/dev/null

# Cache
CACHE_DIR="$HOME/.claude/plugins/cache/ops-marketplace"
ls -la "$CACHE_DIR" 2>/dev/null

# Keychain entries (macOS)
for key in telegram-api-id telegram-api-hash telegram-phone telegram-session slack-xoxc slack-xoxd; do
  security find-generic-password -s "$key" 2>/dev/null && echo "FOUND: $key"
done

# Shell profile exports
grep -l 'CLAUDE_PLUGIN_ROOT' ~/.zshrc ~/.bashrc ~/.zprofile ~/.bash_profile 2>/dev/null

# MCP registrations
grep -l 'telegram\|slack-mcp' ~/.claude.json 2>/dev/null
```

Print a summary of what was found, then proceed to delete each category.

---

## Step 3 — Remove keychain credentials

For each found keychain entry, ask via `AskUserQuestion`:

```
Remove keychain credential: <key-name>?
  [Yes]  [Skip]
```

On Yes:

```bash
security delete-generic-password -s "<key-name>" 2>/dev/null
```

---

## Step 4 — Remove preferences and cache

Ask via `AskUserQuestion`:

```
Remove plugin data?
  - Preferences: <prefs-dir>
  - Cache: <cache-dir>

  [Yes, delete both]  [Skip]
```

On Yes:

```bash
rm -rf "$PREFS_DIR"
rm -rf "$CACHE_DIR"
```

---

## Step 5 — Clean shell profile

For each shell profile file that contains `CLAUDE_PLUGIN_ROOT`:

Ask via `AskUserQuestion`:

```
Remove CLAUDE_PLUGIN_ROOT export from <file>?
  [Yes]  [Skip]
```

On Yes, read the file and remove lines containing `CLAUDE_PLUGIN_ROOT`. Use `sed` or similar — do NOT rewrite the entire file. Only remove the specific export line.

```bash
sed -i '' '/CLAUDE_PLUGIN_ROOT/d' "<file>"
```

---

## Step 6 — Remove MCP registrations

Check if `~/.claude.json` contains MCP server entries added by the plugin (telegram, slack-mcp). For each:

Ask via `AskUserQuestion`:

```
Remove MCP server registration: <server-name> from ~/.claude.json?
  [Yes]  [Skip]
```

On Yes, use `jq` to remove the entry:

```bash
jq 'del(.mcpServers["<server-name>"])' ~/.claude.json > /tmp/claude-json-tmp && mv /tmp/claude-json-tmp ~/.claude.json
```

---

## Step 7 — Remove plugin from Claude Code settings

The `/plugin uninstall` UI does not always clean up settings files. Directly remove all ops references from the JSON config files that Claude Code reads on startup.

### 7a — Remove from installed_plugins.json

```bash
INSTALLED="$HOME/.claude/plugins/installed_plugins.json"
if [ -f "$INSTALLED" ] && grep -q 'ops.*marketplace' "$INSTALLED"; then
  python3 -c "
import json, sys
with open('$INSTALLED') as f: data = json.load(f)
keys_to_remove = [k for k in data.get('plugins', {}) if 'ops-marketplace' in k or 'ops@ops' in k]
for k in keys_to_remove: del data['plugins'][k]
with open('$INSTALLED', 'w') as f: json.dump(data, f, indent=2)
print(f'Removed {len(keys_to_remove)} entries from installed_plugins.json')
"
else
  echo "No ops entries in installed_plugins.json"
fi
```

### 7b — Remove from known_marketplaces.json

```bash
KNOWN="$HOME/.claude/plugins/known_marketplaces.json"
if [ -f "$KNOWN" ] && grep -q 'ops-marketplace' "$KNOWN"; then
  python3 -c "
import json
with open('$KNOWN') as f: data = json.load(f)
keys_to_remove = [k for k in data if 'ops-marketplace' in k or 'ops' in k.lower()]
for k in keys_to_remove: del data[k]
with open('$KNOWN', 'w') as f: json.dump(data, f, indent=2)
print(f'Removed {len(keys_to_remove)} marketplace entries from known_marketplaces.json')
"
else
  echo "No ops marketplace in known_marketplaces.json"
fi
```

### 7c — Remove from settings.json and settings.local.json

Both `~/.claude/settings.json` and `~/.claude/settings.local.json` may contain `enabledPlugins` entries and stale `permissions.allow` entries referencing ops-marketplace paths.

```bash
for SETTINGS_FILE in "$HOME/.claude/settings.json" "$HOME/.claude/settings.local.json"; do
  [ -f "$SETTINGS_FILE" ] || continue
  if grep -q 'ops' "$SETTINGS_FILE"; then
    python3 -c "
import json, re
with open('$SETTINGS_FILE') as f: data = json.load(f)
# Remove ops from enabledPlugins
ep = data.get('enabledPlugins', {})
ops_keys = [k for k in ep if 'ops' in k.lower()]
for k in ops_keys: del ep[k]
# Remove ops-marketplace permission entries
perms = data.get('permissions', {})
if 'allow' in perms:
  before = len(perms['allow'])
  perms['allow'] = [p for p in perms['allow'] if 'ops-marketplace' not in p and 'claude-ops' not in p]
  removed = before - len(perms['allow'])
else:
  removed = 0
# Remove ops from extraKnownMarketplaces
ekm = data.get('extraKnownMarketplaces', {})
ekm_keys = [k for k in ekm if 'ops' in k.lower()]
for k in ekm_keys: del ekm[k]
with open('$SETTINGS_FILE', 'w') as f: json.dump(data, f, indent=2)
print(f'Cleaned $SETTINGS_FILE: {len(ops_keys)} plugin entries, {removed} permissions, {len(ekm_keys)} extra marketplaces')
"
  else
    echo "No ops references in $SETTINGS_FILE"
  fi
done
```

### 7d — Remove marketplace and cache directories

```bash
rm -rf "$HOME/.claude/plugins/marketplaces/ops-marketplace" 2>/dev/null
rm -rf "$HOME/.claude/plugins/cache/ops-marketplace" 2>/dev/null
rm -rf "$HOME/.claude/plugins/data/ops-inline" 2>/dev/null
echo "Removed marketplace, cache, and data directories"
```

---

## Step 8 — Final confirmation

Print:

```
claude-ops has been completely removed.

  Keychain:    <N> credentials deleted
  Preferences: deleted
  Cache:       deleted
  Shell:       <N> exports removed
  MCP:         <N> servers removed
  Settings:    cleaned (installed_plugins, known_marketplaces, settings)
  Directories: removed (marketplace, cache, data)

Run `/reload-plugins` then `/plugin` in Claude Code to verify ops no longer appears.

To reinstall later:
  /reload-plugins
  /plugin marketplace add Lifecycle-Innovations-Limited/claude-ops
  /plugin install ops@lifecycle-innovations-limited-claude-ops
  /reload-plugins
  /ops:setup
```
