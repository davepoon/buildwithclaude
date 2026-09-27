#!/bin/bash
# Searches YouTube via the getyoutubetranscript.com API.
#
# Usage (first page):
#   YOUTUBE_TRANSCRIPT_API_KEY=sk_live_... ./fetch_search.sh <query> [video|channel]
# Usage (later pages - pass the previous response's data.continuation_token
# verbatim, it's opaque, don't construct it yourself):
#   YOUTUBE_TRANSCRIPT_API_KEY=sk_live_... ./fetch_search.sh "" "" <page_token>
#
# Prints the raw JSON response to stdout. A non-2xx response is still valid
# JSON with a "code" field to branch on - see SKILL.md's Errors table.
set -euo pipefail

QUERY="${1:-}"
TYPE="${2:-video}"
PAGE_TOKEN="${3:-}"

if [ -z "$QUERY" ] && [ -z "$PAGE_TOKEN" ]; then
    echo "Usage: fetch_search.sh <query> [video|channel] | fetch_search.sh '' '' <page_token>" >&2
    exit 1
fi

if [ -z "${YOUTUBE_TRANSCRIPT_API_KEY:-}" ]; then
    echo "Error: set YOUTUBE_TRANSCRIPT_API_KEY first (get a free key at https://getyoutubetranscript.com/dashboard)" >&2
    exit 1
fi

if [ -n "$PAGE_TOKEN" ]; then
    curl -s -G "https://getyoutubetranscript.com/api/v1/search" \
        --data-urlencode "page_token=${PAGE_TOKEN}" \
        -H "Authorization: Bearer ${YOUTUBE_TRANSCRIPT_API_KEY}"
else
    curl -s -G "https://getyoutubetranscript.com/api/v1/search" \
        --data-urlencode "q=${QUERY}" \
        --data-urlencode "type=${TYPE}" \
        -H "Authorization: Bearer ${YOUTUBE_TRANSCRIPT_API_KEY}"
fi
