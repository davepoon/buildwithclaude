#!/usr/bin/env bash
# common.sh — Shared helpers for ops-package carrier adapters.
# Sourced by lib/carriers/*.sh and by the top-level ops-package.sh router.
# Exposes: resolve_env, die_missing_creds, parse_address, UA_HEADER, PREFS_PATH.
set -euo pipefail

PREFS_PATH="${CLAUDE_PLUGIN_DATA_DIR:-$HOME/.claude/plugins/data/ops-ops-marketplace}/preferences.json"
UA_HEADER="User-Agent: claude-ops/ops-package"
LABEL_DIR="${OPS_PACKAGE_LABEL_DIR:-/tmp}"

# resolve_env <env-var-name> [prefs-key]
# Resolution order: env var → preferences.json key → Doppler secret with the
# same name as the env var. Prints the value on stdout, returns 1 if nothing
# found. The second argument is optional; when omitted, the lowercase form of
# the env-var name is used as the prefs key.
resolve_env() {
  local name="$1"
  local prefs_key="${2:-$(printf '%s' "$1" | tr '[:upper:]' '[:lower:]')}"
  local v
  v="${!name:-}"
  if [ -n "$v" ]; then
    printf '%s' "$v"; return 0
  fi
  if [ -f "$PREFS_PATH" ] && command -v jq &>/dev/null; then
    v=$(jq -r --arg k "$prefs_key" '.[$k] // .user_config[$k] // empty' "$PREFS_PATH" 2>/dev/null || true)
    if [ -n "$v" ] && [ "$v" != "null" ]; then
      printf '%s' "$v"; return 0
    fi
  fi
  if command -v doppler &>/dev/null; then
    v=$(doppler secrets get "$name" --plain 2>/dev/null || true)
    if [ -n "$v" ]; then
      printf '%s' "$v"; return 0
    fi
  fi
  return 1
}

# die_missing_creds <carrier-label> <env-var(s)> <docs-url>
die_missing_creds() {
  local carrier="$1" envs="$2" docs="$3"
  cat >&2 <<EOF
ERROR: Missing credentials for $carrier.

  Set the following environment variable(s):
    $envs

Or store the value(s) in:
  $PREFS_PATH
  (keys are the lowercase form of the variable names)

Or register them with Doppler under the same names.

Get credentials at: $docs
EOF
  exit 2
}

# parse_address "Person / Company, Street 12A, 1011AB City, Country"
# Emits a JSON object with normalised NL address fields. Shared by all carriers.
parse_address() {
  local raw="$1"
  local person company street number number_suffix postcode city cc
  IFS=',' read -r p1 p2 p3 p4 <<<"$raw"
  p1=$(printf '%s' "${p1:-}" | sed -E 's/^ +//;s/ +$//')
  p2=$(printf '%s' "${p2:-}" | sed -E 's/^ +//;s/ +$//')
  p3=$(printf '%s' "${p3:-}" | sed -E 's/^ +//;s/ +$//')
  p4=$(printf '%s' "${p4:-}" | sed -E 's/^ +//;s/ +$//')

  if [[ "$p1" == *" / "* ]]; then
    person="${p1%% / *}"
    company="${p1##* / }"
  else
    person="$p1"
    company=""
  fi

  if [[ "$p2" =~ ^(.+[^[:space:]])[[:space:]]+([0-9]+)([A-Za-z]{0,4})$ ]]; then
    street="${BASH_REMATCH[1]}"
    number="${BASH_REMATCH[2]}"
    number_suffix="${BASH_REMATCH[3]}"
  else
    street="$p2"
    number=""
    number_suffix=""
  fi

  if [[ "$p3" =~ ^([0-9]{4}[[:space:]]?[A-Za-z]{2})[[:space:]]+(.+)$ ]]; then
    postcode=$(printf '%s' "${BASH_REMATCH[1]}" | tr -d ' ' | tr '[:lower:]' '[:upper:]')
    city="${BASH_REMATCH[2]}"
  else
    postcode=$(printf '%s' "$p3" | awk '{print $1}')
    city=$(printf '%s' "$p3" | cut -d' ' -f2-)
  fi

  cc=$(printf '%s' "${p4:-NL}" | tr '[:lower:]' '[:upper:]' | sed -E 's/^ +//;s/ +$//')
  case "$cc" in
    NETHERLANDS|NEDERLAND|HOLLAND) cc=NL ;;
    BELGIUM|BELGIE|BELGIQUE) cc=BE ;;
    GERMANY|DEUTSCHLAND) cc=DE ;;
    FRANCE) cc=FR ;;
    "UNITED KINGDOM"|UK|"GREAT BRITAIN") cc=GB ;;
    "UNITED STATES"|USA) cc=US ;;
  esac
  [ -z "$cc" ] && cc=NL

  jq -n \
    --arg person "$person" \
    --arg company "$company" \
    --arg street "$street" \
    --arg number "$number" \
    --arg number_suffix "$number_suffix" \
    --arg postcode "$postcode" \
    --arg city "$city" \
    --arg cc "$cc" \
    '{
      person: $person,
      company: ($company // ""),
      street: $street,
      number: $number,
      number_suffix: $number_suffix,
      postal_code: $postcode,
      city: $city,
      cc: $cc
    }'
}

# strip_address_bits — Accept all ship flags and render them into a set of
# normalised shell variables (to_json, from_json, weight, pkg_type, signature,
# insurance, description, pickup). Carriers that don't consume some fields
# simply ignore them. Idempotent: can be re-run.
parse_ship_flags() {
  TO_RAW=""; FROM_RAW=""; WEIGHT=""; PKG_TYPE="1"
  SIGNATURE="false"; INSURANCE="0"; DESCRIPTION=""; PICKUP="false"
  while [ $# -gt 0 ]; do
    case "$1" in
      --to) TO_RAW="${2:-}"; shift 2 ;;
      --from) FROM_RAW="${2:-}"; shift 2 ;;
      --weight) WEIGHT="${2:-}"; shift 2 ;;
      --package-type) PKG_TYPE="${2:-1}"; shift 2 ;;
      --signature) SIGNATURE="true"; shift ;;
      --insurance) INSURANCE="${2:-0}"; shift 2 ;;
      --description) DESCRIPTION="${2:-}"; shift 2 ;;
      --pickup) PICKUP="true"; shift ;;
      *) echo "ship: unknown flag: $1" >&2; return 64 ;;
    esac
  done
  if [ -z "$TO_RAW" ]; then
    echo 'ship: --to is required, e.g. --to "Jane Doe, Kerkstraat 12A, 1011AB Amsterdam, NL"' >&2
    return 64
  fi
  TO_JSON=$(parse_address "$TO_RAW")
  if [ -n "$FROM_RAW" ]; then
    FROM_JSON=$(parse_address "$FROM_RAW")
  else
    FROM_JSON=""
  fi
  return 0
}

# save_label_pdf <carrier> <id> <http-response-body-file>
# Moves the PDF response to a predictable location and opens on macOS TTY.
save_label_pdf() {
  local carrier="$1" id="$2" src="$3"
  local out="${LABEL_DIR}/${carrier}_label_${id}.pdf"
  mv "$src" "$out"
  if [[ "$(uname)" == "Darwin" ]] && [ -t 1 ]; then
    open "$out" >/dev/null 2>&1 || true
  fi
  jq -n --arg p "$out" '{status: "ok", label_pdf: $p}'
}
