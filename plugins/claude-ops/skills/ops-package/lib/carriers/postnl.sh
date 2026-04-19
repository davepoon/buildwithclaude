#!/usr/bin/env bash
# postnl.sh — PostNL Send API (Shipping Webservice v2.2) adapter.
# Docs: https://developer.postnl.nl/apis/shipping-api
# Auth: "apikey" header with customer-specific API key.
#
# UNVERIFIED - pending live test with a PostNL business account. Sandbox and
# production share the same shape but different base URLs. Set
# POSTNL_SANDBOX=1 to route to the sandbox host.
set -euo pipefail

POSTNL_BASE_URL_PROD="https://api.postnl.nl"
POSTNL_BASE_URL_SANDBOX="https://api-sandbox.postnl.nl"

_postnl_base_url() {
  if [ "${POSTNL_SANDBOX:-0}" = "1" ]; then
    printf '%s' "$POSTNL_BASE_URL_SANDBOX"
  else
    printf '%s' "$POSTNL_BASE_URL_PROD"
  fi
}

postnl_auth_header() {
  local k; k=$(resolve_env "POSTNL_API_KEY" "postnl_api_key") || \
    die_missing_creds "PostNL" "POSTNL_API_KEY (plus POSTNL_CUSTOMER_CODE and POSTNL_CUSTOMER_NUMBER)" \
      "https://developer.postnl.nl/"
  printf 'apikey: %s' "$k"
}

_postnl_customer() {
  local code num
  code=$(resolve_env "POSTNL_CUSTOMER_CODE" "postnl_customer_code") || true
  num=$(resolve_env "POSTNL_CUSTOMER_NUMBER" "postnl_customer_number") || true
  if [ -z "$code" ] || [ -z "$num" ]; then
    die_missing_creds "PostNL" "POSTNL_CUSTOMER_CODE and POSTNL_CUSTOMER_NUMBER" \
      "https://developer.postnl.nl/docs/#/onboarding"
  fi
  jq -n --arg c "$code" --arg n "$num" '{CustomerCode:$c, CustomerNumber:$n}'
}

postnl_ship() {
  parse_ship_flags "$@" || return $?
  local auth; auth=$(postnl_auth_header)
  local base; base=$(_postnl_base_url)
  local customer; customer=$(_postnl_customer)

  # Addresses[] array — receiver is AddressType "01", sender "02".
  local receiver
  receiver=$(jq -n --argjson a "$TO_JSON" '{
    AddressType: "01",
    FirstName: $a.person,
    CompanyName: (if $a.company == "" then null else $a.company end),
    Street: $a.street,
    HouseNr: $a.number,
    HouseNrExt: (if $a.number_suffix == "" then null else $a.number_suffix end),
    Zipcode: $a.postal_code,
    City: $a.city,
    Countrycode: $a.cc
  } | with_entries(select(.value != null))')

  local sender='null'
  if [ -n "$FROM_JSON" ]; then
    sender=$(jq -n --argjson a "$FROM_JSON" '{
      AddressType: "02",
      FirstName: $a.person,
      CompanyName: (if $a.company == "" then null else $a.company end),
      Street: $a.street,
      HouseNr: $a.number,
      HouseNrExt: (if $a.number_suffix == "" then null else $a.number_suffix end),
      Zipcode: $a.postal_code,
      City: $a.city,
      Countrycode: $a.cc
    } | with_entries(select(.value != null))')
  fi

  # 3085 = standard NL delivery; 3087 = signature.
  local product_code="3085"
  [ "$SIGNATURE" = "true" ] && product_code="3087"

  local shipment
  shipment=$(jq -n \
    --argjson receiver "$receiver" --argjson sender "$sender" \
    --argjson customer "$customer" \
    --arg productCode "$product_code" \
    --arg reference "$DESCRIPTION" \
    --arg weight "${WEIGHT:-500}" \
    '{
      Addresses: ([$receiver] + (if $sender == null then [] else [$sender] end)),
      Dimension: {Weight: ($weight|tonumber)},
      ProductCodeDelivery: $productCode,
      Reference: (if $reference == "" then null else $reference end),
      Customer: $customer
    } | with_entries(select(.value != null))')

  local payload
  payload=$(jq -n --argjson s "$shipment" --argjson c "$customer" '{
    Customer: $c,
    Message: {Printertype: "GraphicFile|PDF", MessageID: "1", MessageTimeStamp: (now|strftime("%d-%m-%Y %H:%M:%S"))},
    Shipments: [$s]
  }')

  local resp
  resp=$(curl -sS -X POST "$base/shipment/v2_2/label" \
    -H "$auth" -H "$UA_HEADER" \
    -H "Content-Type: application/json" \
    -H "Accept: application/json" \
    --data-binary "$payload")

  local barcode
  barcode=$(printf '%s' "$resp" | jq -r '.ResponseShipments[0].Barcode // empty')
  if [ -z "$barcode" ]; then
    echo "postnl ship: failed — response:" >&2
    printf '%s\n' "$resp" | jq . >&2 2>/dev/null || printf '%s\n' "$resp" >&2
    return 1
  fi

  # PostNL returns the label PDF as base64 in the same call. Save it so a
  # subsequent `label <barcode>` can open it without another round-trip.
  local pdf_b64
  pdf_b64=$(printf '%s' "$resp" | jq -r '.ResponseShipments[0].Labels[0].Content // empty')
  if [ -n "$pdf_b64" ]; then
    local out="${LABEL_DIR}/postnl_label_${barcode}.pdf"
    printf '%s' "$pdf_b64" | base64 -d > "$out" 2>/dev/null || \
      printf '%s' "$pdf_b64" | base64 -D > "$out" 2>/dev/null || true
  fi

  jq -n --arg id "$barcode" --argjson resp "$resp" --arg c "postnl" \
    '{carrier: $c, shipment_id: $id, response: $resp}'
}

postnl_label() {
  local id="${1:-}"
  [ -z "$id" ] && { echo "postnl label: barcode required" >&2; return 64; }
  # PostNL does not expose a "re-download label" endpoint; the PDF is only
  # returned alongside the original /label call. If ship saved it, reuse it.
  local out="${LABEL_DIR}/postnl_label_${id}.pdf"
  if [ -s "$out" ]; then
    if [[ "$(uname)" == "Darwin" ]] && [ -t 1 ]; then
      open "$out" >/dev/null 2>&1 || true
    fi
    jq -n --arg p "$out" '{status: "ok", label_pdf: $p}'
  else
    cat >&2 <<EOF
postnl label: PostNL returns the PDF only on shipment creation. The cached
file ${out} is missing. Re-ship or export from MijnPostNL.
EOF
    return 1
  fi
}

postnl_track() {
  local id="${1:-}"
  [ -z "$id" ] && { echo "postnl track: barcode required" >&2; return 64; }
  local auth; auth=$(postnl_auth_header)
  local base; base=$(_postnl_base_url)
  local cc; cc=$(resolve_env "POSTNL_DEFAULT_COUNTRY" "postnl_default_country" 2>/dev/null || printf 'NL')
  curl -sS -H "$auth" -H "$UA_HEADER" -H "Accept: application/json" \
    "$base/shipment/v2/status/barcode/${id}?countrycode=${cc}" \
  | jq '{
      carrier: "postnl",
      id: .CurrentStatus.Shipment.Barcode,
      status: (.CurrentStatus.Shipment.Status.StatusDescription // null),
      barcode: .CurrentStatus.Shipment.Barcode,
      tracking_url: null,
      recipient: (.CurrentStatus.Shipment.Addresses // null),
      created: null,
      updated: (.CurrentStatus.Shipment.Status.TimeStamp // null)
    }'
}

postnl_list() {
  # PostNL shipping API does not expose a "list my last shipments" endpoint
  # in the public contract — customers maintain their own record in MijnPostNL.
  jq -n '{carrier: "postnl", shipments: [], note: "PostNL Send API has no list endpoint; track by barcode instead."}'
}

postnl_configured() {
  resolve_env "POSTNL_API_KEY" "postnl_api_key" >/dev/null 2>&1 && \
    resolve_env "POSTNL_CUSTOMER_CODE" "postnl_customer_code" >/dev/null 2>&1 && \
    resolve_env "POSTNL_CUSTOMER_NUMBER" "postnl_customer_number" >/dev/null 2>&1
}
