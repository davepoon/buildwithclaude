#!/usr/bin/env bash
# olrapi.sh — authenticated wrapper around the Obsidian Local REST API.
# Resolves host/port/API-key from the connected obsidian MCP server config
# (~/.claude.json), so no secrets are hardcoded.
#
# Usage:
#   olrapi.sh <METHOD> <path> [extra curl args...]
#   olrapi.sh GET /tags/
#   olrapi.sh GET /vault/Note.md
#   olrapi.sh PUT /vault/New.md --data-binary @file.md -H 'Content-Type: text/markdown'
#   olrapi.sh MOVE "/vault/old/Note.md" -H 'Destination: archive/Note.md'
#
# Prints the HTTP status to stderr and the body to stdout.
set -euo pipefail

CFG="${OLRAPI_CONFIG:-$HOME/.claude.json}"

read -r HOST PORT KEY < <(python3 - "$CFG" <<'PY'
import json, sys
cfg = sys.argv[1]
def walk(o):
    if isinstance(o, dict):
        if 'OBSIDIAN_API_KEY' in o:
            yield o
        for v in o.values():
            yield from walk(v)
    elif isinstance(o, list):
        for v in o:
            yield from walk(v)
try:
    d = json.load(open(cfg))
except Exception:
    d = {}
env = next(walk(d), {})
host = (env.get('OBSIDIAN_HOST') or 'http://127.0.0.1').replace('https://','').replace('http://','')
port = env.get('OBSIDIAN_PORT') or '27123'
key  = env.get('OBSIDIAN_API_KEY') or ''
# env vars override config (useful on other machines)
import os
host = os.environ.get('OBSIDIAN_HOST', host).replace('https://','').replace('http://','')
port = os.environ.get('OBSIDIAN_PORT', port)
key  = os.environ.get('OBSIDIAN_API_KEY', key)
print(host, port, key)
PY
)

if [[ -z "${KEY:-}" ]]; then
  echo "olrapi: could not resolve OBSIDIAN_API_KEY (checked $CFG and env)" >&2
  exit 2
fi

METHOD="$1"; PATH_="$2"; shift 2

# 27124 is the TLS port for the Local REST API; -k because it uses a self-signed cert.
BASE="https://${HOST}:27124"
[[ "$PORT" == "27123" || "$PORT" == "27124" ]] || BASE="https://${HOST}:${PORT}"

curl -sk -X "$METHOD" "${BASE}${PATH_}" \
  -H "Authorization: Bearer ${KEY}" \
  -w '\n<<HTTP %{http_code}>>\n' \
  "$@"
