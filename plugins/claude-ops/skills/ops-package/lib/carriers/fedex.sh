#!/usr/bin/env bash
# fedex.sh — FedEx REST API adapter.
# Docs: https://developer.fedex.com/api/en-us/catalog/
# Auth: OAuth2 client_credentials. POST to /oauth/token with form-encoded body.
#
# UNVERIFIED - pending live test with FedEx merchant account. Requires a valid
# shipping account number (FEDEX_ACCOUNT_NUMBER).
set -euo pipefail

FEDEX_BASE_URL_PROD="https://apis.fedex.com"
FEDEX_BASE_URL_SANDBOX="https://apis-sandbox.fedex.com"

_fedex_token_cache="${TMPDIR:-/tmp}/fedex_token_${USER:-$(id -u)}.json"

_fedex_base_url() {
  if [ "${FEDEX_SANDBOX:-0}" = "1" ]; then
    printf '%s' "$FEDEX_BASE_URL_SANDBOX"
  else
    printf '%s' "$FEDEX_BASE_URL_PROD"
  fi
}

fedex_auth_header() {
  local cid secret
  cid=$(resolve_env "FEDEX_CLIENT_ID" "fedex_client_id") || \
    die_missing_creds "FedEx" "FEDEX_CLIENT_ID, FEDEX_CLIENT_SECRET, and FEDEX_ACCOUNT_NUMBER" \
      "https://developer.fedex.com/api/en-us/get-started.html"
  secret=$(resolve_env "FEDEX_CLIENT_SECRET" "fedex_client_secret") || \
    die_missing_creds "FedEx" "FEDEX_CLIENT_ID, FEDEX_CLIENT_SECRET, and FEDEX_ACCOUNT_NUMBER" \
      "https://developer.fedex.com/api/en-us/get-started.html"

  local now; now=$(date +%s)
  if [ -f "$_fedex_token_cache" ]; then
    local expires_at token
    expires_at=$(jq -r '.expires_at // 0' "$_fedex_token_cache" 2>/dev/null || echo 0)
    token=$(jq -r '.token // empty' "$_fedex_token_cache" 2>/dev/null || true)
    if [ -n "$token" ] && [ "$now" -lt "$expires_at" ]; then
      printf 'Authorization: Bearer %s' "$token"
      return 0
    fi
  fi

  local base; base=$(_fedex_base_url)
  local resp
  resp=$(curl -sS -X POST "$base/oauth/token" \
    -H "Content-Type: application/x-www-form-urlencoded" \
    -H "Accept: application/json" \
    --data-urlencode "grant_type=client_credentials" \
    --data-urlencode "client_id=${cid}" \
    --data-urlencode "client_secret=${secret}")
  local token ttl
  token=$(printf '%s' "$resp" | jq -r '.access_token // empty')
  ttl=$(printf '%s' "$resp" | jq -r '.expires_in // 3600')
  if [ -z "$token" ]; then
    echo "fedex auth: failed — response:" >&2
    printf '%s\n' "$resp" >&2
    return 1
  fi
  (umask 077; jq -n --arg t "$token" --arg e "$((now + ttl - 60))" \
    '{token:$t, expires_at: ($e|tonumber)}' > "$_fedex_token_cache")
  printf 'Authorization: Bearer %s' "$token"
}

_fedex_contact_address() {
  local json="$1"
  jq -n --argjson a "$json" '{
    contact: {
      personName: $a.person,
      companyName: (if $a.company == "" then null else $a.company end)
    } | with_entries(select(.value != null)),
    address: {
      streetLines: [($a.street + " " + $a.number + (if $a.number_suffix == "" then "" else $a.number_suffix end))],
      city: $a.city,
      postalCode: $a.postal_code,
      countryCode: $a.cc
    }
  }'
}

fedex_ship() {
  parse_ship_flags "$@" || return $?
  local auth; auth=$(fedex_auth_header)
  local base; base=$(_fedex_base_url)
  local account
  account=$(resolve_env "FEDEX_ACCOUNT_NUMBER" "fedex_account_number") || \
    die_missing_creds "FedEx" "FEDEX_ACCOUNT_NUMBER" \
      "https://developer.fedex.com/api/en-us/get-started.html"

  local to; to=$(_fedex_contact_address "$TO_JSON")
  local from
  if [ -n "$FROM_JSON" ]; then
    from=$(_fedex_contact_address "$FROM_JSON")
  else
    from=$(jq -n '{}')
  fi

  # Weight in kilograms, rounded to 3 decimals.
  local weight_kg="1.000"
  [ -n "$WEIGHT" ] && weight_kg=$(awk -v g="$WEIGHT" 'BEGIN{ printf "%.3f", g/1000 }')

  local payload
  payload=$(jq -n \
    --argjson from "$from" --argjson to "$to" \
    --arg account "$account" \
    --arg weight "$weight_kg" \
    --arg desc "$DESCRIPTION" \
    --arg sig "$SIGNATURE" \
    '{
      labelResponseOptions: "URL_ONLY",
      requestedShipment: {
        shipper: $from,
        recipients: [$to],
        shipDatestamp: (now | strftime("%Y-%m-%d")),
        serviceType: "FEDEX_INTERNATIONAL_PRIORITY",
        packagingType: "YOUR_PACKAGING",
        pickupType: "USE_SCHEDULED_PICKUP",
        shippingChargesPayment: {paymentType: "SENDER", payor: {responsibleParty: {accountNumber: {value: $account}}}},
        labelSpecification: {imageType: "PDF", labelStockType: "PAPER_4X6"},
        requestedPackageLineItems: [{
          weight: {units: "KG", value: ($weight|tonumber)},
          customerReferences: (if $desc == "" then null else [{customerReferenceType: "CUSTOMER_REFERENCE", value: $desc}] end)
        } | with_entries(select(.value != null))]
      },
      accountNumber: {value: $account}
    }')

  local resp
  resp=$(curl -sS -X POST "$base/ship/v1/shipments" \
    -H "$auth" -H "$UA_HEADER" \
    -H "Content-Type: application/json" \
    -H "Accept: application/json" \
    -H "x-locale: en_US" \
    --data-binary "$payload")

  local tracking
  tracking=$(printf '%s' "$resp" | jq -r '.output.transactionShipments[0].masterTrackingNumber // empty')
  if [ -z "$tracking" ]; then
    echo "fedex ship: failed — response:" >&2
    printf '%s\n' "$resp" | jq . >&2 2>/dev/null || printf '%s\n' "$resp" >&2
    return 1
  fi

  # Download the label URL from the response.
  local label_url
  label_url=$(printf '%s' "$resp" | jq -r '.output.transactionShipments[0].pieceResponses[0].packageDocuments[0].url // empty')
  if [ -n "$label_url" ]; then
    local out="${LABEL_DIR}/fedex_label_${tracking}.pdf"
    curl -sS -H "$auth" -H "$UA_HEADER" -o "$out" "$label_url" || true
  fi

  jq -n --arg id "$tracking" --argjson resp "$resp" --arg c "fedex" \
    '{carrier: $c, shipment_id: $id, response: $resp}'
}

fedex_label() {
  local id="${1:-}"
  [ -z "$id" ] && { echo "fedex label: tracking number required" >&2; return 64; }
  local out="${LABEL_DIR}/fedex_label_${id}.pdf"
  if [ ! -s "$out" ]; then
    cat >&2 <<EOF
fedex label: FedEx returns the label URL on the ship response; the cached
file ${out} is missing. Re-run ship, or recover via FedEx LabelRecovery API
(not implemented).
EOF
    return 1
  fi
  if [[ "$(uname)" == "Darwin" ]] && [ -t 1 ]; then
    open "$out" >/dev/null 2>&1 || true
  fi
  jq -n --arg p "$out" '{status: "ok", label_pdf: $p}'
}

fedex_track() {
  local id="${1:-}"
  [ -z "$id" ] && { echo "fedex track: tracking number required" >&2; return 64; }
  local auth; auth=$(fedex_auth_header)
  local base; base=$(_fedex_base_url)
  local payload
  payload=$(jq -n --arg t "$id" '{
    includeDetailedScans: true,
    trackingInfo: [{trackingNumberInfo: {trackingNumber: $t}}]
  }')
  curl -sS -X POST "$base/track/v1/trackingnumbers" \
    -H "$auth" -H "$UA_HEADER" \
    -H "Content-Type: application/json" \
    -H "Accept: application/json" \
    -H "x-locale: en_US" \
    --data-binary "$payload" \
  | jq '{
      carrier: "fedex",
      id: (.output.completeTrackResults[0].trackingNumber // null),
      status: (.output.completeTrackResults[0].trackResults[0].latestStatusDetail.description // null),
      barcode: (.output.completeTrackResults[0].trackingNumber // null),
      tracking_url: null,
      recipient: null,
      created: null,
      updated: (.output.completeTrackResults[0].trackResults[0].dateAndTimes[0].dateTime // null)
    }'
}

fedex_list() {
  jq -n '{carrier: "fedex", shipments: [], note: "FedEx API has no list endpoint; track by tracking number instead."}'
}

fedex_configured() {
  resolve_env "FEDEX_CLIENT_ID" "fedex_client_id" >/dev/null 2>&1 && \
    resolve_env "FEDEX_CLIENT_SECRET" "fedex_client_secret" >/dev/null 2>&1 && \
    resolve_env "FEDEX_ACCOUNT_NUMBER" "fedex_account_number" >/dev/null 2>&1
}
