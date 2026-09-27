#!/bin/bash
# Fetches a playlist's videos via the getyoutubetranscript.com API -
# 1 credit/page. Fully paginated.
#
# Usage (first page):
#   YOUTUBE_TRANSCRIPT_API_KEY=sk_live_... ./fetch_playlist.sh <playlist_id_or_url>
# Usage (later pages - pass the previous response's data.continuation_token
# verbatim, it's opaque, don't construct it yourself):
#   YOUTUBE_TRANSCRIPT_API_KEY=sk_live_... ./fetch_playlist.sh "" <continuation_token>
set -euo pipefail

PLAYLIST="${1:-}"
CONTINUATION="${2:-}"

if [ -z "$PLAYLIST" ] && [ -z "$CONTINUATION" ]; then
    echo "Usage: fetch_playlist.sh <playlist_id_or_url> | fetch_playlist.sh '' <continuation_token>" >&2
    exit 1
fi

if [ -z "${YOUTUBE_TRANSCRIPT_API_KEY:-}" ]; then
    echo "Error: set YOUTUBE_TRANSCRIPT_API_KEY first (get a free key at https://getyoutubetranscript.com/dashboard)" >&2
    exit 1
fi

if [ -n "$CONTINUATION" ]; then
    curl -s -G "https://getyoutubetranscript.com/api/v1/playlist" \
        --data-urlencode "continuation=${CONTINUATION}" \
        -H "Authorization: Bearer ${YOUTUBE_TRANSCRIPT_API_KEY}"
else
    curl -s -G "https://getyoutubetranscript.com/api/v1/playlist" \
        --data-urlencode "list=${PLAYLIST}" \
        -H "Authorization: Bearer ${YOUTUBE_TRANSCRIPT_API_KEY}"
fi
