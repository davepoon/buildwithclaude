#!/bin/bash
# Searches within a single channel's videos via the getyoutubetranscript.com
# API - 1 credit/page.
#
# Usage (first page):
#   YOUTUBE_TRANSCRIPT_API_KEY=sk_live_... ./fetch_channel_search.sh <@handle_or_url_or_id> <query>
# Usage (later pages - pass the previous response's data.continuation_token
# verbatim, it's opaque, don't construct it yourself):
#   YOUTUBE_TRANSCRIPT_API_KEY=sk_live_... ./fetch_channel_search.sh "" "" <continuation_token>
set -euo pipefail

CHANNEL="${1:-}"
QUERY="${2:-}"
CONTINUATION="${3:-}"

if [ -z "$CONTINUATION" ] && { [ -z "$CHANNEL" ] || [ -z "$QUERY" ]; }; then
    echo "Usage: fetch_channel_search.sh <@handle_or_url_or_id> <query> | fetch_channel_search.sh '' '' <continuation_token>" >&2
    exit 1
fi

if [ -z "${YOUTUBE_TRANSCRIPT_API_KEY:-}" ]; then
    echo "Error: set YOUTUBE_TRANSCRIPT_API_KEY first (get a free key at https://getyoutubetranscript.com/dashboard)" >&2
    exit 1
fi

if [ -n "$CONTINUATION" ]; then
    curl -s -G "https://getyoutubetranscript.com/api/v1/channel/search" \
        --data-urlencode "continuation=${CONTINUATION}" \
        -H "Authorization: Bearer ${YOUTUBE_TRANSCRIPT_API_KEY}"
else
    curl -s -G "https://getyoutubetranscript.com/api/v1/channel/search" \
        --data-urlencode "channel=${CHANNEL}" \
        --data-urlencode "q=${QUERY}" \
        -H "Authorization: Bearer ${YOUTUBE_TRANSCRIPT_API_KEY}"
fi
