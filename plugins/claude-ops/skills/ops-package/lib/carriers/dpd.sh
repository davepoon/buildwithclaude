#!/usr/bin/env bash
# dpd.sh — DPD NL / DPD "MyDPD" shipping adapter.
# Docs: https://esolutions.dpd.com/dokuwiki/ (DPD REST API, "Shipment service")
# Auth: OAuth2-like login to /login with delisId + password → token. Token is
# used as `Authorization: <token>` (no Bearer prefix) in subsequent calls.
#
# UNVERIFIED - pending live test with a DPD business account. DPD's REST API
# base URL differs per country (NL uses public-dis-ws.dpd.nl); we support
# override via DPD_BASE_URL.
set -euo pipefail

DPD_DEFAULT_BASE_URL="https://public-dis-ws.dpd.nl/shipping/rest"

_dpd_token_cache="${TMPDIR:-/tmp}/dpd_token_${USER:-$(id -u)}.json"

_dpd_base_url() {
  local override
  override=$(resolve_env "DPD_BASE_URL" "dpd_base_url" 2>/dev/null || true)
  printf '%s' "${override:-$DPD_DEFAULT_BASE_URL}"
}

dpd_auth_header() {
  local delis pw
  delis=$(resolve_env "DPD_DELIS_ID" "dpd_delis_id") || \
    die_missing_creds "DPD" "DPD_DELIS_ID and DPD_PASSWORD" \
      "https://esolutions.dpd.com/"
  pw=$(resolve_env "DPD_PASSWORD" "dpd_password") || \
    die_missing_creds "DPD" "DPD_DELIS_ID and DPD_PASSWORD" \
      "https://esolutions.dpd.com/"

  local now; now=$(date +%s)
  if [ -f "$_dpd_token_cache" ]; then
    local expires_at token
    expires_at=$(jq -r '.expires_at // 0' "$_dpd_token_cache" 2>/dev/null || echo 0)
    token=$(jq -r '.token // empty' "$_dpd_token_cache" 2>/dev/null || true)
    if [ -n "$token" ] && [ "$now" -lt "$expires_at" ]; then
      printf 'Authorization: %s' "$token"
      return 0
    fi
  fi

  local base; base=$(_dpd_base_url)
  # DPD login: POST to /login with Basic-auth of delis:password, returns JSON.
  local b64; b64=$(printf '%s:%s' "$delis" "$pw" | base64 | tr -d '\n')
  local resp
  resp=$(curl -sS -X POST "${base%/shipping/rest}/authentication/rest/v1/login" \
    -H "Authorization: Basic $b64" \
    -H "Content-Type: application/json" \
    -H "Accept: application/json")
  local token
  token=$(printf '%s' "$resp" | jq -r '.token // .authToken // empty')
  if [ -z "$token" ]; then
    echo "dpd auth: failed — response:" >&2
    printf '%s\n' "$resp" >&2
    return 1
  fi
  # DPD tokens last ~24h; cache for 23.
  (umask 077; jq -n --arg t "$token" --arg e "$((now + 82800))" \
    '{token:$t, expires_at: ($e|tonumber)}' > "$_dpd_token_cache")
  printf 'Authorization: %s' "$token"
}

dpd_ship() {
  parse_ship_flags "$@" || return $?
  local auth; auth=$(dpd_auth_header)
  local base; base=$(_dpd_base_url)

  local recipient
  recipient=$(jq -n --argjson a "$TO_JSON" '{
    name1: (if $a.company == "" then $a.person else $a.company end),
    name2: (if $a.company == "" then null else $a.person end),
    street: ($a.street + " " + $a.number + (if $a.number_suffix == "" then "" else $a.number_suffix end)),
    zipCode: $a.postal_code,
    city: $a.city,
    country: $a.cc
  } | with_entries(select(.value != null))')

  local sender='null'
  if [ -n "$FROM_JSON" ]; then
    sender=$(jq -n --argjson a "$FROM_JSON" '{
      name1: (if $a.company == "" then $a.person else $a.company end),
      street: ($a.street + " " + $a.number + (if $a.number_suffix == "" then "" else $a.number_suffix end)),
      zipCode: $a.postal_code,
      city: $a.city,
      country: $a.cc
    } | with_entries(select(.value != null))')
  fi

  # DPD product code: "CL" classic. Signature in "notification" extras.
  local payload
  payload=$(jq -n \
    --argjson r "$recipient" --argjson s "$sender" \
    --arg weight "${WEIGHT:-500}" \
    --arg desc "$DESCRIPTION" \
    --arg sig "$SIGNATURE" \
    '{
      printOptions: {paperFormat: "A4"},
      parcels: [{
        recipient: $r,
        sender: (if $s == null then null else $s end),
        weight: ($weight|tonumber),
        productAndServiceData: {
          orderType: "consignment",
          product: "CL",
          saturdayDelivery: false,
          predict: null,
          additionalService: (if $sig == "true" then {predict: {channel: 1}} else null end)
        } | with_entries(select(.value != null)),
        reference1: (if $desc == "" then null else $desc end)
      } | with_entries(select(.value != null))]
    }')

  local resp
  resp=$(curl -sS -X POST "$base/v1/shipment" \
    -H "$auth" -H "$UA_HEADER" \
    -H "Content-Type: application/json" \
    -H "Accept: application/json" \
    --data-binary "$payload")

  local parcel_no
  parcel_no=$(printf '%s' "$resp" | jq -r '.shipmentResponses[0].parcelInformation[0].parcelLabelNumber // .parcelNumber // empty')
  if [ -z "$parcel_no" ]; then
    echo "dpd ship: failed — response:" >&2
    printf '%s\n' "$resp" | jq . >&2 2>/dev/null || printf '%s\n' "$resp" >&2
    return 1
  fi

  # Persist the parcel→shipment mapping so `label` can re-fetch.
  echo "$resp" > "${LABEL_DIR}/dpd_shipment_${parcel_no}.json"

  jq -n --arg id "$parcel_no" --argjson resp "$resp" --arg c "dpd" \
    '{carrier: $c, shipment_id: $id, response: $resp}'
}

dpd_label() {
  local id="${1:-}"
  [ -z "$id" ] && { echo "dpd label: parcel number required" >&2; return 64; }
  local auth; auth=$(dpd_auth_header)
  local base; base=$(_dpd_base_url)

  local tmp; tmp=$(mktemp)
  trap 'rm -f "$tmp"' RETURN
  curl -sS -H "$auth" -H "$UA_HEADER" -H "Accept: application/pdf" \
    -o "$tmp" \
    "$base/v1/parcellabelnumber/${id}?paperFormat=A4"
  if file "$tmp" 2>/dev/null | grep -qi "PDF"; then
    trap - RETURN
    save_label_pdf "dpd" "$id" "$tmp"
  else
    echo "dpd label: unexpected non-PDF response:" >&2
    cat "$tmp" >&2 2>/dev/null || true
    return 1
  fi
}

dpd_track() {
  local id="${1:-}"
  [ -z "$id" ] && { echo "dpd track: parcel number required" >&2; return 64; }
  local auth; auth=$(dpd_auth_header)
  local base; base=$(_dpd_base_url)
  # DPD's parcel-tracking endpoint lives on a separate subdomain but the
  # authenticated shipment-status endpoint works with the standard base.
  curl -sS -H "$auth" -H "$UA_HEADER" -H "Accept: application/json" \
    "${base%/shipping/rest}/parcellifecycle/rest/v1/status/${id}" \
  | jq '{
      carrier: "dpd",
      id: .parcelLabelNumber,
      status: (.statusInfo[-1].description // null),
      barcode: .parcelLabelNumber,
      tracking_url: (.trackingUrl // null),
      recipient: null,
      created: null,
      updated: (.statusInfo[-1].date // null)
    }'
}

dpd_list() {
  # DPD REST API does not offer a multi-shipment listing on the customer side.
  jq -n '{carrier: "dpd", shipments: [], note: "DPD REST API has no list endpoint; track by parcel number instead."}'
}

dpd_configured() {
  resolve_env "DPD_DELIS_ID" "dpd_delis_id" >/dev/null 2>&1 && \
    resolve_env "DPD_PASSWORD" "dpd_password" >/dev/null 2>&1
}
