---
name: ops-whatsapp-biz
description: WhatsApp Business Cloud API — send approved template messages at scale, manage templates with approval tracking, and integrate product catalogs. Separate from wacli personal WhatsApp.
argument-hint: "[send-template|list-templates|create-template|check-template|catalog|setup]"
allowed-tools:
  - Bash
  - Read
  - Write
  - Grep
  - AskUserQuestion
effort: medium
maxTurns: 30
---

# OPS ► WHATSAPP BUSINESS

WhatsApp Business Cloud API — distinct from wacli personal WhatsApp.

**Key difference:** This skill uses the WhatsApp Business Cloud API (Meta Graph API) for business-to-customer messaging at scale. `wacli` is for personal WhatsApp messaging. Different credentials, different phone numbers, different use cases.

## Credential Resolution

```bash
PREFS_PATH="${CLAUDE_PLUGIN_DATA_DIR:-$HOME/.claude/plugins/data/ops-ops-marketplace}/preferences.json"

# WhatsApp Business credentials (separate from wacli personal)
WABA_TOKEN="${WHATSAPP_BUSINESS_TOKEN:-$(claude plugin config get whatsapp_business_token 2>/dev/null)}"
WABA_PHONE_ID="${WHATSAPP_PHONE_NUMBER_ID:-$(claude plugin config get whatsapp_phone_number_id 2>/dev/null)}"
WABA_ACCOUNT_ID="${WHATSAPP_BUSINESS_ACCOUNT_ID:-$(claude plugin config get whatsapp_business_account_id 2>/dev/null)}"

# Doppler fallback
if [ -z "$WABA_TOKEN" ]; then
  WABA_TOKEN="$(doppler secrets get WHATSAPP_BUSINESS_TOKEN --plain 2>/dev/null)"
fi
if [ -z "$WABA_PHONE_ID" ]; then
  WABA_PHONE_ID="$(doppler secrets get WHATSAPP_PHONE_NUMBER_ID --plain 2>/dev/null)"
fi
if [ -z "$WABA_ACCOUNT_ID" ]; then
  WABA_ACCOUNT_ID="$(doppler secrets get WHATSAPP_BUSINESS_ACCOUNT_ID --plain 2>/dev/null)"
fi
```

**Credential check**: If `WABA_TOKEN` or `WABA_PHONE_ID` is empty, print:
`WhatsApp Business not configured. Run /ops:whatsapp-biz setup to configure credentials.`
and stop.

---

## Sub-command Routing

Route `$ARGUMENTS`:

| Input | Action |
|---|---|
| (empty), list-templates | List all templates with approval status |
| send-template | Send an approved template message to one or more recipients |
| create-template | Guided template creation wizard |
| check-template \<NAME\> | Poll approval status for a specific template |
| catalog | View and manage linked product catalog |
| setup | Configure WhatsApp Business API credentials |

---

## list-templates

List all message templates for the WhatsApp Business Account.

```bash
RESULT=$(curl -s "https://graph.facebook.com/v20.0/${WABA_ACCOUNT_ID}/message_templates?fields=name,status,category,language,components&limit=50" \
  -H "Authorization: Bearer ${WABA_TOKEN}")

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  WHATSAPP BUSINESS TEMPLATES"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
printf "| %-30s | %-10s | %-12s | %-8s |\n" "Template Name" "Status" "Category" "Language"
printf "|%s|%s|%s|%s|\n" "--------------------------------" "------------" "--------------" "----------"

echo "$RESULT" | jq -r '.data[]? | [.name, .status, .category, .language] | @tsv' 2>/dev/null | \
  while IFS=$'\t' read -r name status category language; do
    STATUS_ICON="○"
    [ "$status" = "APPROVED" ] && STATUS_ICON="✓"
    [ "$status" = "REJECTED" ] && STATUS_ICON="✗"
    [ "$status" = "PENDING" ] && STATUS_ICON="…"
    printf "| %-30s | %s %-9s | %-12s | %-8s |\n" "${name:0:30}" "$STATUS_ICON" "$status" "${category:0:12}" "$language"
  done

TOTAL=$(echo "$RESULT" | jq '.data | length // 0')
APPROVED=$(echo "$RESULT" | jq '[.data[]? | select(.status == "APPROVED")] | length')
echo ""
echo "Total: ${TOTAL} templates  |  Approved: ${APPROVED}"
echo ""
echo "Note: Per-template pricing applies since July 2025. Check Meta pricing page for current rates."
```

---

## send-template

Send an approved template message to one or more recipients.

**Before sending**, collect via AskUserQuestion:

1. Template name (free text — use `list-templates` first to see available)
2. Recipient phone number(s) — free text (single number or comma-separated list, include country code, e.g. +14155552671)

If template has variables, ask for each parameter value via AskUserQuestion (free text).

**Cost note**: Always display approximate cost before sending. Utility templates: ~$0.005/msg; Marketing: ~$0.025/msg (US rates — varies by country). Show AskUserQuestion to confirm before bulk sends > 10 recipients.

```bash
# Parse recipients
IFS=',' read -ra RECIPIENTS <<< "$PHONE_NUMBERS"
RECIPIENT_COUNT=${#RECIPIENTS[@]}

# For bulk sends > 10, confirm
if [ $RECIPIENT_COUNT -gt 10 ]; then
  # AskUserQuestion: "Send to ${RECIPIENT_COUNT} recipients? Estimated cost: ~$$(awk "BEGIN {printf \"%.2f\", $RECIPIENT_COUNT * 0.025}") for marketing templates." options [Send, Cancel]
  [ "$CONFIRM" = "Cancel" ] && echo "Cancelled." && exit 0
fi

# Send to each recipient
SUCCESS=0; FAILED=0
for PHONE in "${RECIPIENTS[@]}"; do
  PHONE=$(echo "$PHONE" | tr -d ' ')
  
  RESP=$(curl -s -X POST "https://graph.facebook.com/v20.0/${WABA_PHONE_ID}/messages" \
    -H "Authorization: Bearer ${WABA_TOKEN}" \
    -H "Content-Type: application/json" \
    -d "{
      \"messaging_product\": \"whatsapp\",
      \"to\": \"${PHONE}\",
      \"type\": \"template\",
      \"template\": {
        \"name\": \"${TEMPLATE_NAME}\",
        \"language\": {\"code\": \"en_US\"},
        \"components\": ${TEMPLATE_COMPONENTS_JSON:-[]}
      }
    }")
  
  MSG_ID=$(echo "$RESP" | jq -r '.messages[0].id // empty')
  if [ -n "$MSG_ID" ]; then
    SUCCESS=$((SUCCESS + 1))
  else
    FAILED=$((FAILED + 1))
    ERR=$(echo "$RESP" | jq -r '.error.message // "unknown error"')
    echo "  Failed for ${PHONE}: ${ERR}"
  fi
done

echo ""
echo "Sent: ${SUCCESS}/${RECIPIENT_COUNT} messages delivered"
[ $FAILED -gt 0 ] && echo "Failed: ${FAILED} — check phone number format (+country_code + number)"
```

**Template components format** (build `TEMPLATE_COMPONENTS_JSON` from user input):

For templates with header + body variables:
```json
[
  {
    "type": "header",
    "parameters": [{"type": "text", "text": "{{header_value}}"}]
  },
  {
    "type": "body",
    "parameters": [
      {"type": "text", "text": "{{var1}}"},
      {"type": "text", "text": "{{var2}}"}
    ]
  }
]
```

For templates with no variables: `TEMPLATE_COMPONENTS_JSON=[]`

---

## create-template

Guided template creation wizard.

Step 1 — Collect basic info:

AskUserQuestion: "Template category?" options `[MARKETING, UTILITY, AUTHENTICATION, More...]`

If More: AskUserQuestion: `[AUTHENTICATION, UTILITY, Skip]`

Step 2 — AskUserQuestion: "Template name (lowercase, underscores only, e.g. order_confirmation):" (free text)

Step 3 — AskUserQuestion: "Language?" options `[en_US, en_GB, es, fr]`

Step 4 — Collect body text (free text). Instruct user: "Use {{1}}, {{2}} etc for variables."

Step 5 — AskUserQuestion: "Add a header?" options `[Text header, Image header, No header, Video header]`

Step 6 — AskUserQuestion: "Add call-to-action button?" options `[URL button, Phone button, No button, Quick reply]`

```bash
# Build components array
COMPONENTS='[{"type":"BODY","text":"'"${BODY_TEXT}"'"}]'

# Add header if selected
if [ "$HEADER_TYPE" = "Text header" ]; then
  HEADER_TEXT_INPUT="..."  # collected via AskUserQuestion
  COMPONENTS=$(echo "$COMPONENTS" | jq '. + [{"type":"HEADER","format":"TEXT","text":"'"${HEADER_TEXT_INPUT}"'"}]')
elif [ "$HEADER_TYPE" = "Image header" ]; then
  COMPONENTS=$(echo "$COMPONENTS" | jq '. + [{"type":"HEADER","format":"IMAGE","example":{"header_handle":["<upload_handle>"]}}]')
fi

# Add button if selected
if [ "$BUTTON_TYPE" = "URL button" ]; then
  BUTTON_URL="..."  # collected via AskUserQuestion: "Button URL:"
  BUTTON_TEXT="..."  # collected via AskUserQuestion: "Button text:"
  COMPONENTS=$(echo "$COMPONENTS" | jq '. + [{"type":"BUTTONS","buttons":[{"type":"URL","text":"'"${BUTTON_TEXT}"'","url":"'"${BUTTON_URL}"'"}]}]')
elif [ "$BUTTON_TYPE" = "Phone button" ]; then
  BUTTON_PHONE="..."  # collected via AskUserQuestion: "Phone number for button:"
  BUTTON_TEXT="..."
  COMPONENTS=$(echo "$COMPONENTS" | jq '. + [{"type":"BUTTONS","buttons":[{"type":"PHONE_NUMBER","text":"'"${BUTTON_TEXT}"'","phone_number":"'"${BUTTON_PHONE}"'"}]}]')
fi

RESP=$(curl -s -X POST "https://graph.facebook.com/v20.0/${WABA_ACCOUNT_ID}/message_templates" \
  -H "Authorization: Bearer ${WABA_TOKEN}" \
  -H "Content-Type: application/json" \
  -d "{
    \"name\": \"${TEMPLATE_NAME}\",
    \"category\": \"${CATEGORY}\",
    \"language\": \"${LANGUAGE}\",
    \"components\": ${COMPONENTS}
  }")

TEMPLATE_ID=$(echo "$RESP" | jq -r '.id // empty')
STATUS=$(echo "$RESP" | jq -r '.status // empty')

if [ -n "$TEMPLATE_ID" ]; then
  echo "Template submitted (ID: ${TEMPLATE_ID}, status: ${STATUS})."
  echo "Approval typically takes 24-48 hours. Check status with: /ops:whatsapp-biz check-template ${TEMPLATE_NAME}"
else
  echo "Template creation failed: $(echo "$RESP" | jq -r '.error.message // "unknown error"')"
fi
```

---

## check-template \<NAME\>

Poll approval status for a specific template by name.

```bash
TEMPLATE_NAME_ARG=$(echo "$ARGUMENTS" | awk '{print $2}')
if [ -z "$TEMPLATE_NAME_ARG" ]; then
  # AskUserQuestion: "Template name to check:" (free text)
  TEMPLATE_NAME_ARG="$USER_INPUT"
fi

RESULT=$(curl -s "https://graph.facebook.com/v20.0/${WABA_ACCOUNT_ID}/message_templates?name=${TEMPLATE_NAME_ARG}&fields=name,status,rejected_reason,quality_score" \
  -H "Authorization: Bearer ${WABA_TOKEN}")

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  TEMPLATE STATUS: ${TEMPLATE_NAME_ARG}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

echo "$RESULT" | jq -r '.data[]? | "Status: \(.status)\nQuality: \(.quality_score.score // "N/A")\nRejection reason: \(.rejected_reason // "—")"' 2>/dev/null

STATUS=$(echo "$RESULT" | jq -r '.data[0].status // "NOT_FOUND"')
case "$STATUS" in
  APPROVED)  echo "Template is ready to use with send-template." ;;
  REJECTED)  echo "Template was rejected. Review the rejection reason and create a revised template." ;;
  PENDING)   echo "Template is pending review (typically 24-48h)." ;;
  NOT_FOUND) echo "Template '${TEMPLATE_NAME_ARG}' not found. Run list-templates to see available templates." ;;
esac
```

---

## catalog

View and manage the product catalog linked to your WhatsApp Business Account.

```bash
# List linked catalogs
CATALOGS=$(curl -s "https://graph.facebook.com/v20.0/${WABA_ACCOUNT_ID}?fields=catalog_id" \
  -H "Authorization: Bearer ${WABA_TOKEN}")
CATALOG_ID=$(echo "$CATALOGS" | jq -r '.catalog_id // empty')

if [ -z "$CATALOG_ID" ]; then
  echo "No product catalog linked to this WhatsApp Business Account."
  echo "To link a catalog: go to Meta Business Manager → Commerce Manager → link your catalog to WhatsApp."
  exit 0
fi

# List products in catalog
PRODUCTS=$(curl -s "https://graph.facebook.com/v20.0/${CATALOG_ID}/products?fields=id,name,retailer_id,price,availability,url&limit=20" \
  -H "Authorization: Bearer ${WABA_TOKEN}")

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  WHATSAPP PRODUCT CATALOG"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Catalog ID: ${CATALOG_ID}"
echo ""
printf "| %-25s | %-12s | %-10s | %-12s |\n" "Product Name" "SKU" "Price" "Availability"
printf "|%s|%s|%s|%s|\n" "---------------------------" "--------------" "------------" "--------------"
echo "$PRODUCTS" | jq -r '.data[]? | [.name, (.retailer_id // "—"), (.price // "—"), (.availability // "—")] | @tsv' 2>/dev/null | \
  while IFS=$'\t' read -r name sku price avail; do
    printf "| %-25s | %-12s | %-10s | %-12s |\n" "${name:0:25}" "${sku:0:12}" "$price" "$avail"
  done

PRODUCT_COUNT=$(echo "$PRODUCTS" | jq '.data | length // 0')
echo ""
echo "Total products shown: ${PRODUCT_COUNT} (use catalog in message templates with product cards)"
```

**MM Lite note**: Marketing Messages Lite (AI-optimized sends) is a beta API as of 2026. It is not implemented here — check Meta's developer documentation for current availability and enrollment requirements.

---

## setup

Configure WhatsApp Business API credentials.

**Before asking**, auto-scan for existing credentials:

```bash
# Scan env vars
printenv WHATSAPP_BUSINESS_TOKEN WHATSAPP_PHONE_NUMBER_ID WHATSAPP_BUSINESS_ACCOUNT_ID 2>/dev/null

# Scan Doppler
for proj in $(doppler projects --json 2>/dev/null | jq -r '.[].slug'); do
  for cfg in dev stg prd; do
    doppler secrets --project "$proj" --config "$cfg" --json 2>/dev/null | \
      jq -r --arg p "$proj" --arg c "$cfg" 'to_entries[] | select(.key | test("WHATSAPP_BUSINESS|WHATSAPP_PHONE"; "i")) | "\(.key)=\(.value.computed) (doppler:\($p)/\($c))"'
  done
done

# Shell profiles
grep -h 'WHATSAPP_BUSINESS\|WHATSAPP_PHONE' ~/.zshrc ~/.bashrc ~/.zprofile ~/.envrc 2>/dev/null | grep -v '^#'

# Existing plugin config
claude plugin config get whatsapp_business_token 2>/dev/null && echo "✓ whatsapp_business_token already configured"
claude plugin config get whatsapp_phone_number_id 2>/dev/null && echo "✓ whatsapp_phone_number_id already configured"
claude plugin config get whatsapp_business_account_id 2>/dev/null && echo "✓ whatsapp_business_account_id already configured"
```

**If credentials not found**, guide user:

1. AskUserQuestion: "Where do you have your WhatsApp Business credentials?" options `[Paste token now, Find in Meta dashboard, Skip]`

**Where to find credentials in Meta:**
- `WHATSAPP_BUSINESS_TOKEN`: Meta Developer Portal → Your App → WhatsApp → API Setup → Temporary access token (or generate a permanent System User token)
- `WHATSAPP_PHONE_NUMBER_ID`: Same page → "From" phone number → Phone Number ID
- `WHATSAPP_BUSINESS_ACCOUNT_ID`: Meta Business Manager → Business Settings → WhatsApp Accounts → Account ID

2. Collect each value via AskUserQuestion (free text):
   - WhatsApp Business Token
   - Phone Number ID
   - Business Account ID (WABA ID)

3. Save via plugin config:
```bash
claude plugin config set whatsapp_business_token "$WABA_TOKEN"
claude plugin config set whatsapp_phone_number_id "$WABA_PHONE_ID"
claude plugin config set whatsapp_business_account_id "$WABA_ACCOUNT_ID"
```

4. Smoke test:
```bash
TEST=$(curl -s "https://graph.facebook.com/v20.0/${WABA_PHONE_ID}" \
  -H "Authorization: Bearer ${WABA_TOKEN}")
NAME=$(echo "$TEST" | jq -r '.display_phone_number // empty')
if [ -n "$NAME" ]; then
  echo "WhatsApp Business ✓ connected — Phone: ${NAME}"
else
  echo "WhatsApp Business ✗ connection failed: $(echo "$TEST" | jq -r '.error.message // "invalid token or phone ID"')"
fi
```

Report: `WhatsApp Business ✓ connected` or `✗ invalid — [error]`.
