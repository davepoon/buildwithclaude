#!/usr/bin/env sh
# cv-forge literal splice — insert render-core.js and resume.json at the template markers.
# Pure sh + awk; no Node, no network. Usage:
#   sh render.sh <template.html> <render-core.js> <resume.json>  > output.html
set -eu

tpl="$1"; core="$2"; data="$3"

awk -v core="$core" -v data="$data" '
  /\/\*__RENDER_CORE__\*\// { while ((getline line < core) > 0) print line; close(core); next }
  /\/\*__RESUME_DATA__\*\// { while ((getline line < data) > 0) { gsub(/</, "\\u003c", line); print line } close(data); next }
  { print }
' "$tpl"
