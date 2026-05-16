#!/usr/bin/env bash
# Dispatch the origin MCP server.
#
# Default path: pull the published origin-mcp from npm via npx. This is what
# end users get after installing the plugin.
#
# Dev paths (checked in order):
#   1. Sibling file `bin/origin-mcp.local` next to this script — typically a
#      symlink to a locally-built origin-mcp binary. Filesystem-based so it
#      survives plugin reloads that don't re-read settings.json env.
#   2. ORIGIN_MCP_DEV_BIN env var — secondary, kept for shells that already
#      export it. Requires Claude Code to inherit the var at startup.
#
# Either path means plugin changes to the MCP tool shape can be tested
# without publishing to npm first.

# Don't enable `set -u` here: if Claude Code (or any MCP host) invokes the
# script through a shell that doesn't populate BASH_SOURCE, `set -u` halts
# before we even get to the npx fallback. Fall back to $0 instead.
here="$(cd -- "$(dirname -- "${BASH_SOURCE[0]:-$0}")" 2>/dev/null && pwd -P)"
local_bin="${here}/origin-mcp.local"

if [ -x "${local_bin}" ]; then
  exec "${local_bin}" "$@"
fi

if [ -n "${ORIGIN_MCP_DEV_BIN:-}" ] && [ -x "${ORIGIN_MCP_DEV_BIN}" ]; then
  exec "${ORIGIN_MCP_DEV_BIN}" "$@"
fi

exec npx -y origin-mcp@^0.6.1 "$@"
