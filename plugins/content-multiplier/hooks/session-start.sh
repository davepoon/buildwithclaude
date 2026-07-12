#!/usr/bin/env bash
# Zero-permission: only inspects the local filesystem, prints a hint. No network.
set -euo pipefail
if [ -f "content/brand/brand-voice.md" ]; then
  echo "content-multiplier: brand profile detected at content/brand/ — /multiply and /campaign will write on-brand content."
fi
