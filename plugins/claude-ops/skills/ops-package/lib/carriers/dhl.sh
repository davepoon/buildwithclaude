#!/usr/bin/env bash
# dhl.sh — DHL eCommerce Netherlands (DHL Parcel NL) adapter.
# Docs: https://api-gw.dhlparcel.nl/docs (My DHL Parcel API)
# Auth: OAuth2-ish "accountless" flow — POST /authenticate/api-key with
# {userId, key} to get a JWT access token; use it as Bearer for 10 min.
#
# UNVERIFIED - pending live test with account. Endpoint shapes are modelled on
# the documented Swagger but may require tenant-specific fields.
set -euo pipefail

DHL_BASE_URL="https://api-gw.dhlparcel.nl"

_dhl_token_cache="${TMPDIR:-/tmp}/dhl_parcel_nl_token_${USER:-$(id -u)}.json"

dhl_auth_header() {
  local uid key
  uid=$(resolve_env "DHL_PARCEL_USER_ID" "dhl_parcel_user_id") || \
    die_missing_creds "DHL Parcel NL" "DHL_PARCEL_USER_ID and DHL_PARCEL_KEY" \
      "https://www.mydhlparcel.nl/home/user/settings/api-settings"
  key=$(resolve_env "DHL_PARCEL_KEY" "dhl_parcel_key") || \
    die_missing_creds "DHL Parcel NL" "DHL_PARCEL_USER_ID and DHL_PARCEL_KEY" \
      "https://www.mydhlparcel.nl/home/user/settings/api-settings"

  # Re-use cached token if still valid.
  local now; now=$(date +%s)
  if [ -f "$_dhl_token_cache" ]; then
    local expires_at token
    expires_at=$(jq -r '.expires_at // 0' "$_dhl_token_cache" 2>/dev/null || echo 0)
    token=$(jq -r '.token // empty' "$_dhl_token_cache" 2>/dev/null || true)
    if [ -n "$token" ] && [ "$now" -lt "$expires_at" ]; then
      printf 'Authorization: Bearer %s' "$token"
      return 0
    fi
  fi

  local resp
  resp=$(curl -sS -X POST "$DHL_BASE_URL/authenticate/api-key" \
    -H "Content-Type: application/json" \
    -H "Accept: application/json" \
    --data-binary "$(jq -n --arg u "$uid" --arg k "$key" '{userId:$u,key:$k}')")
  local token
  token=$(printf '%s' "$resp" | jq -r '.accessToken // empty')
  if [ -z "$token" ]; then
    echo "dhl auth: failed — response:" >&2
    printf '%s\n' "$resp" >&2
    return 1
  fi
  # DHL tokens last ~10 minutes; cache for 9.
  (umask 077; jq -n --arg t "$token" --arg e "$((now + 540))" \
    '{token:$t, expires_at: ($e|tonumber)}' > "$_dhl_token_cache")
  printf 'Authorization: Bearer %s' "$token"
}

dhl_ship() {
  parse_ship_flags "$@" || return $?
  local auth; auth=$(dhl_auth_header)

  local receiver
  receiver=$(jq -n --argjson a "$TO_JSON" '{
    name: {firstName: $a.person, companyName: (if $a.company == "" then null else $a.company end)},
    address: {
      countryCode: $a.cc,
      postalCode: $a.postal_code,
      city: $a.city,
      street: $a.street,
      number: $a.number,
      addition: (if $a.number_suffix == "" then null else $a.number_suffix end)
    } | with_entries(select(.value != null))
  }')

  local shipper='null'
  if [ -n "$FROM_JSON" ]; then
    shipper=$(jq -n --argjson a "$FROM_JSON" '{
      name: {firstName: $a.person, companyName: (if $a.company == "" then null else $a.company end)},
      address: {
        countryCode: $a.cc,
        postalCode: $a.postal_code,
        city: $a.city,
        street: $a.street,
        number: $a.number,
        addition: (if $a.number_suffix == "" then null else $a.number_suffix end)
      } | with_entries(select(.value != null))
    }')
  fi

  # Product code: DOOR (B2C) default; DOOR_SIG when signature flag set.
  local product="DOOR"
  [ "$SIGNATURE" = "true" ] && product="DOOR_SIG"

  local payload
  payload=$(jq -n \
    --argjson r "$receiver" --argjson s "$shipper" \
    --arg product "$product" --arg desc "$DESCRIPTION" \
    '{
      receiver: $r,
      shipper: (if $s == null then null else $s end),
      product: $product,
      reference: (if $desc == "" then null else $desc end),
      returnLabel: false
    } | with_entries(select(.value != null))')

  local resp
  resp=$(curl -sS -X POST "$DHL_BASE_URL/labels" \
    -H "$auth" -H "$UA_HEADER" \
    -H "Content-Type: application/json" \
    -H "Accept: application/json" \
    --data-binary "$payload")

  local shipment_id
  shipment_id=$(printf '%s' "$resp" | jq -r '.labelId // .id // empty')
  if [ -z "$shipment_id" ]; then
    echo "dhl ship: failed — response:" >&2
    printf '%s\n' "$resp" | jq . >&2 2>/dev/null || printf '%s\n' "$resp" >&2
    return 1
  fi
  jq -n --arg id "$shipment_id" --argjson resp "$resp" --arg c "dhl" \
    '{carrier: $c, shipment_id: $id, response: $resp}'
}

dhl_label() {
  local id="${1:-}"
  [ -z "$id" ] && { echo "dhl label: label id required" >&2; return 64; }
  local auth; auth=$(dhl_auth_header)

  local tmp; tmp=$(mktemp)
  trap 'rm -f "$tmp"' RETURN
  curl -sS -H "$auth" -H "$UA_HEADER" \
    -H "Accept: application/pdf" \
    -o "$tmp" \
    "$DHL_BASE_URL/labels/${id}?format=PDF&printerType=A4"

  if file "$tmp" 2>/dev/null | grep -qi "PDF"; then
    trap - RETURN
    save_label_pdf "dhl" "$id" "$tmp"
  else
    echo "dhl label: unexpected non-PDF response:" >&2
    cat "$tmp" >&2 2>/dev/null || true
    return 1
  fi
}

dhl_track() {
  local id="${1:-}"
  [ -z "$id" ] && { echo "dhl track: tracking barcode required" >&2; return 64; }
  # Public tracking endpoint uses barcode + postal code; our adapter only
  # has the barcode so we query the authenticated labels endpoint.
  local auth; auth=$(dhl_auth_header)
  curl -sS -H "$auth" -H "$UA_HEADER" -H "Accept: application/json" \
    "$DHL_BASE_URL/labels/${id}" \
  | jq '{
      carrier: "dhl",
      id: .labelId,
      status: (.status // null),
      barcode: (.barcode // .trackerCode // null),
      tracking_url: (.trackingUrl // null),
      recipient: (.receiver // null),
      created: (.createdAt // null),
      updated: (.updatedAt // null)
    }'
}

dhl_list() {
  local auth; auth=$(dhl_auth_header)
  curl -sS -H "$auth" -H "$UA_HEADER" -H "Accept: application/json" \
    "$DHL_BASE_URL/labels?limit=10" \
  | jq '[(.labels // . // [])[]? | {
      carrier: "dhl",
      id: (.labelId // .id),
      status: (.status // null),
      barcode: (.barcode // .trackerCode),
      recipient: ((.receiver.name.firstName // "") + " — " + (.receiver.address.city // "") + " (" + (.receiver.address.countryCode // "") + ")"),
      created: (.createdAt // null)
    }]'
}

dhl_configured() {
  resolve_env "DHL_PARCEL_USER_ID" "dhl_parcel_user_id" >/dev/null 2>&1 && \
    resolve_env "DHL_PARCEL_KEY" "dhl_parcel_key" >/dev/null 2>&1
}
