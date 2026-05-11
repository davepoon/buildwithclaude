#!/bin/sh
# shellcheck disable=SC2034  # Variables are exported for use by sourcing scripts
# Multi-host stdin normalization for Archcore plugin hook scripts.
# Source this file at the top of each bin/ script that receives hook stdin.
#
# Exports:
#   ARCHCORE_HOST       — "claude-code" | "cursor" | "copilot" (detected or from env)
#   ARCHCORE_RAW_STDIN  — unmodified stdin JSON
#   ARCHCORE_TOOL_NAME  — normalized tool name (mcp__archcore__* prefix for MCP tools)
#   ARCHCORE_FILE_PATH  — target file path from tool input (empty if N/A)
#   ARCHCORE_DOC_PATH   — document path from MCP tool input (empty if N/A)
#
# Functions:
#   archcore_hook_block "reason"  — block operation, exit (PreToolUse)
#   archcore_hook_info  "message" — emit info to agent (PostToolUse)
#   archcore_hook_allow           — allow operation silently, exit 0

# --- Read stdin once ---
ARCHCORE_RAW_STDIN=$(cat)

# --- Host detection ---
# Priority: env var override > stdin heuristic > default
#
# Cursor sends "conversation_id" in all hook events.
# GitHub Copilot sends "hookEventName" (camelCase, distinct from Cursor's "hook_event_name").
# Codex CLI sends "turn_id" in turn-scoped events (PreToolUse/PostToolUse/etc.); SessionStart
#   has no turn_id but Codex shares Claude Code's snake_case schema, so the claude-code
#   fallback handles SessionStart correctly.
# Claude Code sends none of the above — fallback default.
if [ -z "$ARCHCORE_HOST" ]; then
  if printf '%s' "$ARCHCORE_RAW_STDIN" | grep -q '"conversation_id"'; then
    ARCHCORE_HOST="cursor"
  elif printf '%s' "$ARCHCORE_RAW_STDIN" | grep -q '"hookEventName"'; then
    ARCHCORE_HOST="copilot"
  elif printf '%s' "$ARCHCORE_RAW_STDIN" | grep -q '"turn_id"'; then
    ARCHCORE_HOST="codex"
  else
    ARCHCORE_HOST="claude-code"
  fi
fi

# --- Extract fields by host ---
# Helper: extract a JSON string value by key (first occurrence, from raw stdin)
_archcore_json_val() {
  printf '%s' "$ARCHCORE_RAW_STDIN" | \
    grep -o "\"$1\"[[:space:]]*:[[:space:]]*\"[^\"]*\"" | head -1 | \
    sed "s/.*\"$1\"[[:space:]]*:[[:space:]]*\"//;s/\"$//"
}

# Helper: extract a JSON string value from escaped JSON strings (e.g. tool_input in afterMCPExecution)
_archcore_json_val_unescaped() {
  printf '%s' "$ARCHCORE_RAW_STDIN" | sed 's/\\"/"/g' | \
    grep -o "\"$1\"[[:space:]]*:[[:space:]]*\"[^\"]*\"" | head -1 | \
    sed "s/.*\"$1\"[[:space:]]*:[[:space:]]*\"//;s/\"$//"
}

case "$ARCHCORE_HOST" in
  claude-code)
    # Claude Code: tool_name has full prefix (mcp__archcore__create_document)
    ARCHCORE_TOOL_NAME=$(_archcore_json_val "tool_name")
    ARCHCORE_FILE_PATH=$(_archcore_json_val "file_path")
    ARCHCORE_DOC_PATH=$(_archcore_json_val "path")
    ;;
  cursor)
    _event=$(_archcore_json_val "hook_event_name")
    _raw_tool=$(_archcore_json_val "tool_name")
    case "$_event" in
      afterMCPExecution|beforeMCPExecution)
        # MCP events have bare tool names (create_document, update_document).
        # Normalize to mcp__archcore__ prefix so bin scripts work unchanged.
        ARCHCORE_TOOL_NAME="mcp__archcore__${_raw_tool}"
        ;;
      *)
        ARCHCORE_TOOL_NAME="$_raw_tool"
        ;;
    esac
    ARCHCORE_FILE_PATH=$(_archcore_json_val "file_path")
    # In afterMCPExecution, tool_input is an escaped JSON string.
    # Try direct extraction first, then unescaped fallback.
    ARCHCORE_DOC_PATH=$(_archcore_json_val "path")
    if [ -z "$ARCHCORE_DOC_PATH" ]; then
      ARCHCORE_DOC_PATH=$(_archcore_json_val_unescaped "path")
    fi
    ;;
  copilot)
    ARCHCORE_TOOL_NAME=$(_archcore_json_val "tool_name")
    ARCHCORE_FILE_PATH=$(_archcore_json_val "file_path")
    ARCHCORE_DOC_PATH=$(_archcore_json_val "path")
    ;;
  codex)
    # Codex CLI shares Claude Code's snake_case stdin schema:
    # tool_name carries the full mcp__archcore__* prefix for MCP events,
    # tool_input.file_path for Write/Edit/apply_patch, tool_input.path for MCP doc ops.
    ARCHCORE_TOOL_NAME=$(_archcore_json_val "tool_name")
    ARCHCORE_FILE_PATH=$(_archcore_json_val "file_path")
    ARCHCORE_DOC_PATH=$(_archcore_json_val "path")
    ;;
  *)
    # Unknown host — best-effort extraction, treat as Claude Code
    ARCHCORE_HOST="claude-code"
    ARCHCORE_TOOL_NAME=$(_archcore_json_val "tool_name")
    ARCHCORE_FILE_PATH=$(_archcore_json_val "file_path")
    ARCHCORE_DOC_PATH=$(_archcore_json_val "path")
    ;;
esac

# --- Output helpers ---

# Block the current operation (for gatekeeping hooks like preToolUse).
# Exit code 2 blocks in both Claude Code and Cursor.
archcore_hook_block() {
  _reason="$1"
  echo "$_reason" >&2
  exit 2
}

# Emit informational message to the agent (for post-execution hooks).
# Does NOT exit — caller continues.
archcore_hook_info() {
  _msg="$1"
  _escaped=$(printf '%s' "$_msg" | sed 's/"/\\"/g' | tr '\n' ' ')
  case "$ARCHCORE_HOST" in
    claude-code|copilot|codex)
      printf '{"hookSpecificOutput":{"hookEventName":"PostToolUse","additionalContext":"%s"}}' "$_escaped"
      ;;
    cursor)
      printf '{"additional_context":"%s"}' "$_escaped"
      ;;
  esac
}

# Emit context injection for PreToolUse hooks (additive, non-blocking).
# Preserves multi-line output via literal "\n" in JSON (not concatenation).
# Does NOT exit — caller continues. Callers exit 0 afterward.
archcore_hook_pretool_info() {
  _msg="$1"
  _escaped=$(printf '%s' "$_msg" | sed 's/\\/\\\\/g; s/"/\\"/g' | awk 'BEGIN{ORS="\\n"}{print}')
  case "$ARCHCORE_HOST" in
    claude-code|copilot|codex)
      printf '{"hookSpecificOutput":{"hookEventName":"PreToolUse","additionalContext":"%s"}}' "$_escaped"
      ;;
    cursor)
      printf '{"additional_context":"%s"}' "$_escaped"
      ;;
  esac
}

# Allow the operation silently and exit.
archcore_hook_allow() {
  exit 0
}
