#!/usr/bin/env bash
# myparcel.sh — MyParcel.nl adapter. VERIFIED against api.myparcel.nl v1.1.
# Docs: https://developer.myparcel.nl/api-reference/
# Auth: Basic, base64(api_key + ":") — we base64 the raw key alone which the
# API accepts (the colon is optional in MyParcel's flavour).
set -euo pipefail

MYPARCEL_BASE_URL="https://api.myparcel.nl"

myparcel_auth_header() {
  local k; k=$(resolve_env "MYPARCEL_API_KEY" "myparcel_api_key") || \
    die_missing_creds "MyParcel.nl" "MYPARCEL_API_KEY" "https://developer.myparcel.nl/api-reference/"
  local b64; b64=$(printf '%s' "$k" | base64 | tr -d '\n')
  printf 'Authorization: Basic %s' "$b64"
}

myparcel_ship() {
  parse_ship_flags "$@" || return $?
  local auth; auth=$(myparcel_auth_header)

  local recipient
  recipient=$(jq -n --argjson a "$TO_JSON" '{
    cc: $a.cc, person: $a.person,
    company: (if $a.company == "" then null else $a.company end),
    street: $a.street, number: $a.number,
    number_suffix: (if $a.number_suffix == "" then null else $a.number_suffix end),
    postal_code: $a.postal_code, city: $a.city
  } | with_entries(select(.value != null))')

  local sender_block='null'
  if [ -n "$FROM_JSON" ]; then
    sender_block=$(jq -n --argjson a "$FROM_JSON" '{
      cc: $a.cc, person: $a.person,
      company: (if $a.company == "" then null else $a.company end),
      street: $a.street, number: $a.number,
      number_suffix: (if $a.number_suffix == "" then null else $a.number_suffix end),
      postal_code: $a.postal_code, city: $a.city
    } | with_entries(select(.value != null))')
  fi

  # For NL insured shipments MyParcel requires signature + only_recipient.
  local _sig_val="$SIGNATURE"
  local _only_recip="false"
  if [ "$INSURANCE" -gt 0 ] 2>/dev/null; then
    local _to_cc; _to_cc=$(printf '%s' "$TO_JSON" | jq -r '.cc // "NL"')
    if [ "$_to_cc" = "NL" ]; then
      _sig_val="true"
      _only_recip="true"
    fi
  fi

  local options
  options=$(jq -n \
    --argjson pkg "$PKG_TYPE" \
    --arg sig "$_sig_val" \
    --arg only "$_only_recip" \
    --argjson ins "$INSURANCE" \
    --arg desc "$DESCRIPTION" \
    '{
      package_type: $pkg,
      signature: ($sig == "true"),
      only_recipient: (if $only == "true" then true else null end),
      label_description: (if $desc == "" then null else $desc end),
      insurance: (if $ins > 0 then {amount: ($ins * 100), currency: "EUR"} else null end)
    } | with_entries(select(.value != null))')

  local phys='null'
  if [ -n "$WEIGHT" ]; then
    phys=$(jq -n --argjson w "$WEIGHT" '{weight: $w}')
  fi

  local pickup_block='null'
  if [ "$PICKUP" = "true" ] && [ "$sender_block" != "null" ]; then
    pickup_block=$(jq -n --argjson s "$sender_block" '$s + {location_name: $s.company}')
  elif [ "$PICKUP" = "true" ]; then
    pickup_block=$(jq -n '{}')
  fi

  local shipment
  shipment=$(jq -n \
    --argjson recipient "$recipient" \
    --argjson sender "$sender_block" \
    --argjson options "$options" \
    --argjson phys "$phys" \
    --argjson pickup "$pickup_block" \
    '{
      recipient: $recipient,
      options: $options,
      carrier: 1,
      sender: (if $sender == null then null else $sender end),
      physical_properties: (if $phys == null then null else $phys end),
      pickup: (if $pickup == null then null else $pickup end)
    } | with_entries(select(.value != null))')

  local payload
  payload=$(jq -n --argjson s "$shipment" '{data: {shipments: [$s]}}')

  local resp
  resp=$(curl -sS -X POST "$MYPARCEL_BASE_URL/shipments" \
    -H "$auth" -H "$UA_HEADER" \
    -H "Content-Type: application/vnd.shipment+json;version=1.1;charset=utf-8" \
    -H "Accept: application/json;charset=utf-8" \
    --data-binary "$payload")

  local shipment_id
  shipment_id=$(printf '%s' "$resp" | jq -r '.data.ids[0].id // empty')
  if [ -z "$shipment_id" ]; then
    echo "myparcel ship: failed — response:" >&2
    printf '%s\n' "$resp" | jq . >&2 2>/dev/null || printf '%s\n' "$resp" >&2
    return 1
  fi
  jq -n --arg id "$shipment_id" --argjson resp "$resp" --arg c "myparcel" \
    '{carrier: $c, shipment_id: $id, response: $resp}'
}

myparcel_label() {
  local id="${1:-}"
  [ -z "$id" ] && { echo "myparcel label: shipment id required" >&2; return 64; }
  local auth; auth=$(myparcel_auth_header)

  local tmp_body tmp_headers
  tmp_body=$(mktemp); tmp_headers=$(mktemp)
  trap 'rm -f "$tmp_body" "$tmp_headers"' RETURN
  curl -sS -D "$tmp_headers" -o "$tmp_body" \
    -H "$auth" -H "$UA_HEADER" -H "Accept: application/pdf" \
    "$MYPARCEL_BASE_URL/shipment_labels/${id}?format=A4&positions=1"

  local ctype
  ctype=$(awk -F': *' 'tolower($1)=="content-type"{print tolower($2)}' "$tmp_headers" | tr -d '\r' | tail -1)

  if [[ "$ctype" == application/pdf* ]]; then
    trap - RETURN
    rm -f "$tmp_headers"
    save_label_pdf "myparcel" "$id" "$tmp_body"
  else
    local body; body=$(cat "$tmp_body")
    local pay_url
    pay_url=$(printf '%s' "$body" | jq -r '.data.payment_instructions.payment_url // empty' 2>/dev/null)
    if [ -n "$pay_url" ]; then
      if [[ "$(uname)" == "Darwin" ]] && [ -t 1 ]; then
        open "$pay_url" >/dev/null 2>&1 || true
      fi
      jq -n --arg u "$pay_url" '{status: "payment_required", payment_url: $u}'
    else
      echo "myparcel label: unexpected response (content-type=$ctype):" >&2
      printf '%s\n' "$body" >&2
      return 1
    fi
  fi
}

myparcel_track() {
  local id="${1:-}"
  [ -z "$id" ] && { echo "myparcel track: shipment id required" >&2; return 64; }
  local auth; auth=$(myparcel_auth_header)
  curl -sS -H "$auth" -H "$UA_HEADER" \
    -H "Accept: application/json;charset=utf-8" \
    "$MYPARCEL_BASE_URL/shipments/${id}" \
  | jq '{
      carrier: "myparcel",
      id: .data.shipments[0].id,
      status: .data.shipments[0].status,
      barcode: .data.shipments[0].barcode,
      tracking_url: .data.shipments[0].tracking_url,
      recipient: .data.shipments[0].recipient,
      created: .data.shipments[0].created,
      updated: .data.shipments[0].modified
    }'
}

myparcel_list() {
  local auth; auth=$(myparcel_auth_header)
  curl -sS -H "$auth" -H "$UA_HEADER" \
    -H "Accept: application/json;charset=utf-8" \
    "$MYPARCEL_BASE_URL/shipments?size=30&page=1" \
  | jq '[.data.shipments[] | {
      carrier: "myparcel",
      id, status, barcode,
      recipient: ((.recipient.person // "") + " — " + (.recipient.city // "") + " (" + (.recipient.cc // "") + ")"),
      created
    }]'
}

# Probe whether credentials are available without hitting the network.
myparcel_configured() {
  resolve_env "MYPARCEL_API_KEY" "myparcel_api_key" >/dev/null 2>&1
}
