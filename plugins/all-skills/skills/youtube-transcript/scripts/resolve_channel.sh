#!/bin/bash
# Resolves a channel handle/URL/id to its channel ID via the
# getyoutubetranscript.com API. Free - 0 credits.
#
# Usage:
#   YOUTUBE_TRANSCRIPT_API_KEY=sk_live_... ./resolve_channel.sh <@handle_or_url_or_id>
set -euo pipefail

HANDLE="${1:?Usage: resolve_channel.sh <@handle_or_url_or_id>}"

if [ -z "${YOUTUBE_TRANSCRIPT_API_KEY:-}" ]; then
    echo "Error: set YOUTUBE_TRANSCRIPT_API_KEY first (get a free key at https://getyoutubetranscript.com/dashboard)" >&2
    exit 1
fi

curl -s -G "https://getyoutubetranscript.com/api/v1/resolve" \
    --data-urlencode "handle=${HANDLE}" \
    -H "Authorization: Bearer ${YOUTUBE_TRANSCRIPT_API_KEY}"
