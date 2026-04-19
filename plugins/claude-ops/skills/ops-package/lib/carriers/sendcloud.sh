#!/usr/bin/env bash
# sendcloud.sh — Sendcloud adapter. VERIFIED against Sendcloud Panel API v3.
# Docs: https://api.sendcloud.dev/docs/
# v2 is deprecated for most resources; v3 is the current platform. However
# labels on v3 are returned as URLs pointing to CDN-hosted PDFs, which we
# download and re-save locally.
# Auth: HTTP Basic, "public_key:private_key". Both are issued from
# Sendcloud Panel → Settings → Integrations → Sendcloud API.
set -euo pipefail

SENDCLOUD_BASE_V3="https://panel.sendcloud.sc/api/v3"
SENDCLOUD_BASE_V2="https://panel.sendcloud.sc/api/v2"

sendcloud_auth_header() {
  local pub pri
  pub=$(resolve_env "SENDCLOUD_PUBLIC_KEY" "sendcloud_public_key") || \
    die_missing_creds "Sendcloud" "SENDCLOUD_PUBLIC_KEY and SENDCLOUD_PRIVATE_KEY" \
      "https://panel.sendcloud.sc/shipping/settings/integrations/sendcloud-api"
  pri=$(resolve_env "SENDCLOUD_PRIVATE_KEY" "sendcloud_private_key") || \
    die_missing_creds "Sendcloud" "SENDCLOUD_PUBLIC_KEY and SENDCLOUD_PRIVATE_KEY" \
      "https://panel.sendcloud.sc/shipping/settings/integrations/sendcloud-api"
  local b64; b64=$(printf '%s:%s' "$pub" "$pri" | base64 | tr -d '\n')
  printf 'Authorization: Basic %s' "$b64"
}

sendcloud_ship() {
  parse_ship_flags "$@" || return $?
  local auth; auth=$(sendcloud_auth_header)

  # Sendcloud weight is in kilograms as a string with 3 decimals.
  local weight_kg="1.000"
  if [ -n "$WEIGHT" ]; then
    weight_kg=$(awk -v g="$WEIGHT" 'BEGIN{ printf "%.3f", g/1000 }')
  fi

  # Build a v3 parcels payload. Fields follow
  # https://api.sendcloud.dev/docs/#/Parcels/post_api_v3_parcels
  local recipient
  recipient=$(jq -n --argjson a "$TO_JSON" --arg w "$weight_kg" --arg desc "$DESCRIPTION" '{
    name: $a.person,
    company_name: (if $a.company == "" then null else $a.company end),
    address_line_1: ($a.street + " " + $a.number + (if $a.number_suffix == "" then "" else $a.number_suffix end)),
    house_number: $a.number,
    postal_code: $a.postal_code,
    city: $a.city,
    country_code: $a.cc
  } | with_entries(select(.value != null))')

  local parcel
  parcel=$(jq -n \
    --argjson to "$recipient" \
    --arg w "$weight_kg" \
    --arg desc "$DESCRIPTION" \
    --arg req_sig "$SIGNATURE" \
    '{
      ship_to: $to,
      weight: {value: $w, unit: "kg"},
      description: (if $desc == "" then null else $desc end),
      request_label: true,
      request_signature: ($req_sig == "true")
    } | with_entries(select(.value != null))')

  local payload
  payload=$(jq -n --argjson p "$parcel" '{parcels: [$p]}')

  local resp
  resp=$(curl -sS -X POST "$SENDCLOUD_BASE_V3/parcels" \
    -H "$auth" -H "$UA_HEADER" \
    -H "Content-Type: application/json" \
    -H "Accept: application/json" \
    --data-binary "$payload")

  local shipment_id
  shipment_id=$(printf '%s' "$resp" | jq -r '.data[0].id // .parcels[0].id // .id // empty')
  if [ -z "$shipment_id" ]; then
    echo "sendcloud ship: failed — response:" >&2
    printf '%s\n' "$resp" | jq . >&2 2>/dev/null || printf '%s\n' "$resp" >&2
    return 1
  fi
  jq -n --arg id "$shipment_id" --argjson resp "$resp" --arg c "sendcloud" \
    '{carrier: $c, shipment_id: $id, response: $resp}'
}

sendcloud_label() {
  local id="${1:-}"
  [ -z "$id" ] && { echo "sendcloud label: parcel id required" >&2; return 64; }
  local auth; auth=$(sendcloud_auth_header)

  # v2 label endpoint returns JSON with PDF URLs; v3 exposes the same as a
  # related resource. Use v2 for the label PDF fetch — it's stable.
  local meta
  meta=$(curl -sS -H "$auth" -H "$UA_HEADER" -H "Accept: application/json" \
    "$SENDCLOUD_BASE_V2/labels/${id}")
  local pdf_url
  pdf_url=$(printf '%s' "$meta" | jq -r '.label.normal_printer[0] // .label.label_printer // empty')
  if [ -z "$pdf_url" ]; then
    echo "sendcloud label: no PDF URL in response:" >&2
    printf '%s\n' "$meta" | jq . >&2 2>/dev/null || printf '%s\n' "$meta" >&2
    return 1
  fi

  local tmp; tmp=$(mktemp)
  trap 'rm -f "$tmp"' RETURN
  curl -sS -H "$auth" -H "$UA_HEADER" -o "$tmp" "$pdf_url"
  trap - RETURN
  save_label_pdf "sendcloud" "$id" "$tmp"
}

sendcloud_track() {
  local id="${1:-}"
  [ -z "$id" ] && { echo "sendcloud track: parcel id required" >&2; return 64; }
  local auth; auth=$(sendcloud_auth_header)
  curl -sS -H "$auth" -H "$UA_HEADER" -H "Accept: application/json" \
    "$SENDCLOUD_BASE_V3/parcels/${id}" \
  | jq '{
      carrier: "sendcloud",
      id: (.data.id // .id),
      status: (.data.status.message // .status.message // .status // null),
      barcode: (.data.tracking_number // .tracking_number),
      tracking_url: (.data.tracking_url // .tracking_url),
      recipient: (.data.ship_to // .ship_to),
      created: (.data.date_created // .date_created),
      updated: (.data.date_updated // .date_updated)
    }'
}

sendcloud_list() {
  local auth; auth=$(sendcloud_auth_header)
  curl -sS -H "$auth" -H "$UA_HEADER" -H "Accept: application/json" \
    "$SENDCLOUD_BASE_V3/parcels?limit=10" \
  | jq '[(.data // .parcels // [])[] | {
      carrier: "sendcloud",
      id,
      status: (.status.message // .status),
      barcode: .tracking_number,
      recipient: ((.ship_to.name // .name // "") + " — " + (.ship_to.city // .city // "") + " (" + (.ship_to.country_code // .country.iso_2 // "") + ")"),
      created: (.date_created // null)
    }]'
}

sendcloud_configured() {
  resolve_env "SENDCLOUD_PUBLIC_KEY" "sendcloud_public_key" >/dev/null 2>&1 && \
    resolve_env "SENDCLOUD_PRIVATE_KEY" "sendcloud_private_key" >/dev/null 2>&1
}
