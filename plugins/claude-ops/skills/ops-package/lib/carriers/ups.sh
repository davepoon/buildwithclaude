#!/usr/bin/env bash
# ups.sh — UPS Shipping REST API adapter (v2403).
# Docs: https://developer.ups.com/api/reference/shipping
# Auth: OAuth2 client_credentials. POST to /security/v1/oauth/token with
# Basic-auth of client_id:client_secret and form-encoded grant_type.
#
# UNVERIFIED - pending live test with UPS merchant account. Shipper number and
# payment account fields are required to actually book; we surface them via
# UPS_SHIPPER_NUMBER.
set -euo pipefail

UPS_BASE_URL="https://onlinetools.ups.com"

_ups_token_cache="${TMPDIR:-/tmp}/ups_token_${USER:-$(id -u)}.json"

ups_auth_header() {
  local cid secret
  cid=$(resolve_env "UPS_CLIENT_ID" "ups_client_id") || \
    die_missing_creds "UPS" "UPS_CLIENT_ID, UPS_CLIENT_SECRET, and UPS_SHIPPER_NUMBER" \
      "https://developer.ups.com/get-started"
  secret=$(resolve_env "UPS_CLIENT_SECRET" "ups_client_secret") || \
    die_missing_creds "UPS" "UPS_CLIENT_ID, UPS_CLIENT_SECRET, and UPS_SHIPPER_NUMBER" \
      "https://developer.ups.com/get-started"

  local now; now=$(date +%s)
  if [ -f "$_ups_token_cache" ]; then
    local expires_at token
    expires_at=$(jq -r '.expires_at // 0' "$_ups_token_cache" 2>/dev/null || echo 0)
    token=$(jq -r '.token // empty' "$_ups_token_cache" 2>/dev/null || true)
    if [ -n "$token" ] && [ "$now" -lt "$expires_at" ]; then
      printf 'Authorization: Bearer %s' "$token"
      return 0
    fi
  fi

  local b64; b64=$(printf '%s:%s' "$cid" "$secret" | base64 | tr -d '\n')
  local resp
  resp=$(curl -sS -X POST "$UPS_BASE_URL/security/v1/oauth/token" \
    -H "Authorization: Basic $b64" \
    -H "Content-Type: application/x-www-form-urlencoded" \
    -H "Accept: application/json" \
    --data 'grant_type=client_credentials')
  local token ttl
  token=$(printf '%s' "$resp" | jq -r '.access_token // empty')
  ttl=$(printf '%s' "$resp" | jq -r '.expires_in // 3600')
  if [ -z "$token" ]; then
    echo "ups auth: failed — response:" >&2
    printf '%s\n' "$resp" >&2
    return 1
  fi
  (umask 077; jq -n --arg t "$token" --arg e "$((now + ttl - 60))" \
    '{token:$t, expires_at: ($e|tonumber)}' > "$_ups_token_cache")
  printf 'Authorization: Bearer %s' "$token"
}

_ups_address() {
  local json="$1"
  jq -n --argjson a "$json" '{
    Name: (if $a.company == "" then $a.person else $a.company end),
    AttentionName: $a.person,
    Address: {
      AddressLine: [($a.street + " " + $a.number + (if $a.number_suffix == "" then "" else $a.number_suffix end))],
      City: $a.city,
      PostalCode: $a.postal_code,
      CountryCode: $a.cc
    }
  }'
}

ups_ship() {
  parse_ship_flags "$@" || return $?
  local auth; auth=$(ups_auth_header)
  local shipper_num
  shipper_num=$(resolve_env "UPS_SHIPPER_NUMBER" "ups_shipper_number") || \
    die_missing_creds "UPS" "UPS_SHIPPER_NUMBER" \
      "https://developer.ups.com/get-started"

  local to; to=$(_ups_address "$TO_JSON")
  local from
  if [ -n "$FROM_JSON" ]; then
    from=$(_ups_address "$FROM_JSON")
  else
    from=$(jq -n '{}')
  fi

  # Service code 11 = UPS Standard (EU ground). Signature delivery confirmation = 2.
  local payload
  payload=$(jq -n \
    --argjson from "$from" --argjson to "$to" \
    --arg shipper "$shipper_num" \
    --arg weight "${WEIGHT:-500}" \
    --arg desc "$DESCRIPTION" \
    --arg sig "$SIGNATURE" \
    '{
      ShipmentRequest: {
        Shipment: {
          Description: (if $desc == "" then "Goods" else $desc end),
          Shipper: ($from + {ShipperNumber: $shipper}),
          ShipTo: $to,
          ShipFrom: $from,
          PaymentInformation: {ShipmentCharge: {Type: "01", BillShipper: {AccountNumber: $shipper}}},
          Service: {Code: "11", Description: "UPS Standard"},
          Package: [{
            Description: (if $desc == "" then "Parcel" else $desc end),
            Packaging: {Code: "02", Description: "Customer Supplied"},
            PackageWeight: {UnitOfMeasurement: {Code: "KGS"}, Weight: (($weight|tonumber)/1000|tostring)},
            PackageServiceOptions: (if $sig == "true" then {DeliveryConfirmation: {DCISType: "2"}} else null end)
          } | with_entries(select(.value != null))]
        },
        LabelSpecification: {LabelImageFormat: {Code: "PDF"}, LabelStockSize: {Height: "6", Width: "4"}}
      }
    }')

  local resp
  resp=$(curl -sS -X POST "$UPS_BASE_URL/api/shipments/v2403/ship" \
    -H "$auth" -H "$UA_HEADER" \
    -H "Content-Type: application/json" \
    -H "Accept: application/json" \
    -H "transId: $(date +%s%N)" \
    -H "transactionSrc: claude-ops" \
    --data-binary "$payload")

  local tracking
  tracking=$(printf '%s' "$resp" | jq -r '.ShipmentResponse.ShipmentResults.ShipmentIdentificationNumber // empty')
  if [ -z "$tracking" ]; then
    echo "ups ship: failed — response:" >&2
    printf '%s\n' "$resp" | jq . >&2 2>/dev/null || printf '%s\n' "$resp" >&2
    return 1
  fi

  # Label PDF ships inline as base64 on PackageResults[0].ShippingLabel.GraphicImage
  local pdf_b64
  pdf_b64=$(printf '%s' "$resp" | jq -r '.ShipmentResponse.ShipmentResults.PackageResults[0].ShippingLabel.GraphicImage // empty')
  if [ -n "$pdf_b64" ]; then
    local out="${LABEL_DIR}/ups_label_${tracking}.pdf"
    printf '%s' "$pdf_b64" | base64 -d > "$out" 2>/dev/null || \
      printf '%s' "$pdf_b64" | base64 -D > "$out" 2>/dev/null || true
  fi

  jq -n --arg id "$tracking" --argjson resp "$resp" --arg c "ups" \
    '{carrier: $c, shipment_id: $id, response: $resp}'
}

ups_label() {
  local id="${1:-}"
  [ -z "$id" ] && { echo "ups label: tracking number required" >&2; return 64; }
  local out="${LABEL_DIR}/ups_label_${id}.pdf"
  if [ ! -s "$out" ]; then
    cat >&2 <<EOF
ups label: UPS returns the label PDF inline with the ship call; re-run ship
to regenerate, or retrieve via the UPS LabelRecovery API (not implemented).
EOF
    return 1
  fi
  if [[ "$(uname)" == "Darwin" ]] && [ -t 1 ]; then
    open "$out" >/dev/null 2>&1 || true
  fi
  jq -n --arg p "$out" '{status: "ok", label_pdf: $p}'
}

ups_track() {
  local id="${1:-}"
  [ -z "$id" ] && { echo "ups track: tracking number required" >&2; return 64; }
  local auth; auth=$(ups_auth_header)
  curl -sS -H "$auth" -H "$UA_HEADER" -H "Accept: application/json" \
    -H "transId: $(date +%s%N)" -H "transactionSrc: claude-ops" \
    "$UPS_BASE_URL/api/track/v1/details/${id}" \
  | jq '{
      carrier: "ups",
      id: (.trackResponse.shipment[0].package[0].trackingNumber // null),
      status: (.trackResponse.shipment[0].package[0].currentStatus.description // null),
      barcode: (.trackResponse.shipment[0].package[0].trackingNumber // null),
      tracking_url: null,
      recipient: null,
      created: null,
      updated: (.trackResponse.shipment[0].package[0].activity[0].date // null)
    }'
}

ups_list() {
  jq -n '{carrier: "ups", shipments: [], note: "UPS API has no list endpoint; track by tracking number instead."}'
}

ups_configured() {
  resolve_env "UPS_CLIENT_ID" "ups_client_id" >/dev/null 2>&1 && \
    resolve_env "UPS_CLIENT_SECRET" "ups_client_secret" >/dev/null 2>&1 && \
    resolve_env "UPS_SHIPPER_NUMBER" "ups_shipper_number" >/dev/null 2>&1
}
