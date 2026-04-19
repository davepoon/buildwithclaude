#!/usr/bin/env bash
# ops-package.sh — Carrier-agnostic shipping router.
# Subcommands: ship | label | track | list | carriers
# Auto-picks carrier from credentials. Override with --carrier <name>.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
LIB_DIR="$SCRIPT_DIR/lib"
CARRIERS_DIR="$LIB_DIR/carriers"

# shellcheck source=lib/common.sh
. "$LIB_DIR/common.sh"

# Known carriers in preference order (first-configured wins on auto-select).
CARRIERS=(myparcel sendcloud dhl postnl dpd ups fedex)

# Source every adapter. Each exports <carrier>_{ship,label,track,list,configured}.
for c in "${CARRIERS[@]}"; do
  # shellcheck source=/dev/null
  . "$CARRIERS_DIR/${c}.sh"
done

usage() {
  cat <<EOF
ops-package.sh — carrier-agnostic shipping

Usage:
  ops-package.sh [--carrier <name>] ship --to "<addr>" [flags]
  ops-package.sh [--carrier <name>] label <id>
  ops-package.sh [--carrier <name>] track <id>
  ops-package.sh [--carrier <name>] list
  ops-package.sh carriers         Show configured/unconfigured carriers

Carriers (auto-detected by configured credentials, preference order):
  myparcel, sendcloud, dhl, postnl, dpd, ups, fedex

ship flags:
  --to       "<Person / Company, Street 12A, 1011AB City, CC>"  (required)
  --from     override sender address
  --weight   grams (integer)
  --package-type   1=parcel (default) | 2=mailbox | 3=letter
  --signature      require delivery signature
  --insurance      EUR (integer; 0 = off)
  --description    <=45 char label reference
  --pickup         request home pickup at sender

Credential resolution (per-carrier env var → preferences.json key → Doppler):
  MyParcel   MYPARCEL_API_KEY
  Sendcloud  SENDCLOUD_PUBLIC_KEY + SENDCLOUD_PRIVATE_KEY
  DHL NL     DHL_PARCEL_USER_ID + DHL_PARCEL_KEY
  PostNL     POSTNL_API_KEY + POSTNL_CUSTOMER_CODE + POSTNL_CUSTOMER_NUMBER
  DPD        DPD_DELIS_ID + DPD_PASSWORD
  UPS        UPS_CLIENT_ID + UPS_CLIENT_SECRET + UPS_SHIPPER_NUMBER
  FedEx      FEDEX_CLIENT_ID + FEDEX_CLIENT_SECRET + FEDEX_ACCOUNT_NUMBER
EOF
}

# Sets $CARRIER to the selected carrier name. Exits with a helpful error when
# no carrier is configured.
CARRIER=""

pick_carrier() {
  if [ -n "$CARRIER" ]; then
    local found=0
    for c in "${CARRIERS[@]}"; do
      [ "$c" = "$CARRIER" ] && found=1 && break
    done
    if [ "$found" = 0 ]; then
      echo "Unknown carrier: $CARRIER (known: ${CARRIERS[*]})" >&2
      exit 64
    fi
    if ! "${CARRIER}_configured"; then
      echo "Carrier '$CARRIER' is not configured. Run 'ops-package.sh carriers' to see status." >&2
      exit 2
    fi
    return 0
  fi
  for c in "${CARRIERS[@]}"; do
    if "${c}_configured"; then
      CARRIER="$c"
      return 0
    fi
  done
  cat >&2 <<EOF
No shipping carrier is configured. Set credentials for at least one of:

  MyParcel    MYPARCEL_API_KEY
  Sendcloud   SENDCLOUD_PUBLIC_KEY + SENDCLOUD_PRIVATE_KEY
  DHL NL      DHL_PARCEL_USER_ID + DHL_PARCEL_KEY
  PostNL      POSTNL_API_KEY + POSTNL_CUSTOMER_CODE + POSTNL_CUSTOMER_NUMBER
  DPD         DPD_DELIS_ID + DPD_PASSWORD
  UPS         UPS_CLIENT_ID + UPS_CLIENT_SECRET + UPS_SHIPPER_NUMBER
  FedEx       FEDEX_CLIENT_ID + FEDEX_CLIENT_SECRET + FEDEX_ACCOUNT_NUMBER

Set env vars, store values in preferences.json, or register them in Doppler.
EOF
  exit 2
}

cmd_carriers() {
  echo "Configured carriers (✓) — preference order:"
  for c in "${CARRIERS[@]}"; do
    if "${c}_configured"; then
      echo "  ✓ $c"
    else
      echo "  · $c (no credentials)"
    fi
  done
}

# ─── dispatch ─────────────────────────────────────────────────────────────
# Extract --carrier flag if present (anywhere in the arg list before the verb).
ARGS=()
while [ $# -gt 0 ]; do
  case "$1" in
    --carrier)
      CARRIER="${2:-}"
      if [ -z "$CARRIER" ]; then
        echo "ops-package.sh: --carrier requires a value (e.g. --carrier myparcel)" >&2
        exit 64
      fi
      shift 2
      ;;
    *) ARGS+=("$1"); shift ;;
  esac
done
set -- "${ARGS[@]:-}"

sub="${1:-}"; shift || true
case "$sub" in
  carriers) cmd_carriers ;;
  ship)  pick_carrier; "${CARRIER}_ship" "$@" ;;
  label) pick_carrier; "${CARRIER}_label" "$@" ;;
  track) pick_carrier; "${CARRIER}_track" "$@" ;;
  list)  pick_carrier; "${CARRIER}_list" "$@" ;;
  ""|-h|--help) usage ;;
  *) echo "ops-package.sh: unknown subcommand '$sub' (try ship|label|track|list|carriers)" >&2; exit 64 ;;
esac
