---
name: ops-package
description: Ship parcels via any configured carrier — MyParcel, Sendcloud, DHL Parcel NL, PostNL, DPD, UPS, FedEx. Auto-selects the first carrier whose credentials are configured, or pass --carrier <name> to override. Verbs: ship, label, track, list, carriers.
argument-hint: "[--carrier <name>] <ship|label|track|list|carriers> [args...]"
allowed-tools:
  - Bash
  - Read
  - AskUserQuestion
effort: low
maxTurns: 15
disallowedTools:
  - Edit
  - Write
  - NotebookEdit
---

# OPS ► PACKAGE — multi-carrier shipping

One skill, seven carriers. The router picks the carrier automatically based on which credentials are configured.

## Which carrier do I get?

| Condition                                                            | Selected carrier          |
| -------------------------------------------------------------------- | ------------------------- |
| `--carrier <name>` flag passed                                       | That carrier (validated)  |
| Exactly one carrier has credentials                                  | That carrier              |
| Multiple carriers have credentials                                   | First match in this order |
| No carrier has credentials                                           | Exit 2 with setup help    |

**Preference order:** `myparcel` → `sendcloud` → `dhl` → `postnl` → `dpd` → `ups` → `fedex`.

## Credential resolution

Each carrier resolves its credential(s) from, in order:

1. Environment variable(s) listed below.
2. `preferences.json` key (lowercase of the env var name) at `${CLAUDE_PLUGIN_DATA_DIR:-$HOME/.claude/plugins/data/ops-ops-marketplace}/preferences.json`.
3. Doppler: `doppler secrets get <NAME> --plain`.

| Carrier    | Env vars required                                                      | Docs                                                |
| ---------- | ---------------------------------------------------------------------- | --------------------------------------------------- |
| MyParcel   | `MYPARCEL_API_KEY`                                                     | https://developer.myparcel.nl/api-reference/        |
| Sendcloud  | `SENDCLOUD_PUBLIC_KEY` + `SENDCLOUD_PRIVATE_KEY`                       | https://api.sendcloud.dev/docs/                     |
| DHL NL     | `DHL_PARCEL_USER_ID` + `DHL_PARCEL_KEY`                                | https://api-gw.dhlparcel.nl/docs                    |
| PostNL     | `POSTNL_API_KEY` + `POSTNL_CUSTOMER_CODE` + `POSTNL_CUSTOMER_NUMBER`   | https://developer.postnl.nl/                        |
| DPD        | `DPD_DELIS_ID` + `DPD_PASSWORD`                                        | https://esolutions.dpd.com/                         |
| UPS        | `UPS_CLIENT_ID` + `UPS_CLIENT_SECRET` + `UPS_SHIPPER_NUMBER`           | https://developer.ups.com/api/reference/shipping    |
| FedEx      | `FEDEX_CLIENT_ID` + `FEDEX_CLIENT_SECRET` + `FEDEX_ACCOUNT_NUMBER`     | https://developer.fedex.com/api/en-us/catalog/      |

## Routing

All API calls are delegated to `${CLAUDE_PLUGIN_ROOT}/skills/ops-package/ops-package.sh`. Do not re-implement curl logic inline — pass args through.

| First token | Action                                                             |
| ----------- | ------------------------------------------------------------------ |
| `carriers`  | Show configured vs unconfigured carriers                           |
| `ship`      | Create a shipment                                                  |
| `label`     | Download + open label PDF                                          |
| `track`     | Show status + tracking barcode                                     |
| `list`      | List last 10 shipments (MyParcel / Sendcloud; others unsupported)  |
| (empty)     | Show usage                                                         |

## ship

Required: `--to "<address>"`. Address format:

```
"Person / Company, Street 12A, 1011AB Amsterdam, NL"
```

- `/ Company` segment is optional.
- Postcode accepts with/without space; NL postcodes are normalised to uppercase without space.
- Country defaults to NL; common names (Netherlands, Belgium, Germany, France, UK, USA) map to ISO codes.

Flags (not every carrier honours every flag — unsupported flags are safely ignored per adapter):
- `--from "<address>"` override sender; default is the account's configured sender.
- `--weight <grams>` integer grams.
- `--package-type 1|2|3` 1=parcel (default), 2=mailbox, 3=letter (MyParcel only).
- `--signature` require signature on delivery.
- `--insurance <EUR>` integer EUR; 0 disables (MyParcel only).
- `--description "<text>"` label reference (carriers differ; ~45 char max).
- `--pickup` request home pickup at sender (MyParcel only).

### Invocation

```bash
${CLAUDE_PLUGIN_ROOT}/skills/ops-package/ops-package.sh \
  [--carrier myparcel|sendcloud|dhl|postnl|dpd|ups|fedex] \
  ship --to "$TO" [--from "$FROM"] [--weight "$W"] \
       [--signature] [--insurance "$INS"] [--description "$DESC"] \
       [--package-type "$TYPE"] [--pickup]
```

Returns:

```json
{"carrier": "<name>", "shipment_id": "<id>", "response": { /* raw carrier JSON */ }}
```

Summarise to the user as:

```
Shipment created — <carrier> #<id>
Next: /ops:ops-package label <id>  to download the PDF.
```

Offer via `AskUserQuestion` (≤4 options):
- `[Download label now]` — call `label <id>` immediately
- `[Track it]` — call `track <id>`
- `[Ship another]`
- `[Done]`

## label `<shipment-id>`

```bash
${CLAUDE_PLUGIN_ROOT}/skills/ops-package/ops-package.sh label "$ID"
```

Behaviour per carrier:
- **MyParcel**: PDF saved to `/tmp/myparcel_label_<id>.pdf` and opened on macOS. If unpaid, returns `{"status":"payment_required","payment_url":"..."}` and opens the MultiSafepay URL.
- **Sendcloud**: Fetches the CDN PDF URL (v2 `/labels/<id>`) and saves locally.
- **DHL NL**: Fetches `/labels/<id>?format=PDF&printerType=A4`.
- **DPD**: Fetches `/v1/parcellabelnumber/<id>?paperFormat=A4`.
- **PostNL / UPS / FedEx**: PDF is returned inline with the `ship` call and cached to `/tmp/<carrier>_label_<id>.pdf`. Calling `label` re-opens that cached file. If the cache is gone, re-run `ship` (none of these carriers expose a stable label-recovery endpoint here).

## track `<shipment-id>`

Returns a normalised object across all carriers:

```json
{"carrier":"<n>","id":"<id>","status":"<s>","barcode":"<b>","tracking_url":"<u>","recipient":<o>,"updated":"<ts>"}
```

## list

`MyParcel` returns the last 10 shipments. `Sendcloud` returns the last 10 parcels. All other carriers return `{"shipments":[],"note":"..."}` because their APIs don't expose a customer-facing list endpoint — track by id instead.

## carriers

Prints which carriers are configured (`✓`) vs which are missing credentials (`·`). Use this when deciding which `--carrier` to pass.

## Error handling

- **No carrier configured** → script exits 2 with a checklist of envs. Surface it verbatim, then via `AskUserQuestion`:
  `[Paste key now]`  `[Open carriers doc]`  `[Skip — configure later]`
  On "Paste key now", collect via `AskUserQuestion` free-text and write to `preferences.json`.
- **4xx from carrier** → dump the JSON error body and stop. Do not retry silently.
- **Address parser looks wrong** → re-prompt the user with the parsed breakdown and ask for corrections before POSTing.

## Verification status

| Carrier    | Status                                                             |
| ---------- | ------------------------------------------------------------------ |
| MyParcel   | Verified against api.myparcel.nl v1.1 (same working reference)     |
| Sendcloud  | Verified request/response shapes against Sendcloud Panel API v3    |
| DHL NL     | UNVERIFIED — modelled on My DHL Parcel Swagger, needs live account |
| PostNL     | UNVERIFIED — modelled on Send API v2.2 docs, needs live account    |
| DPD        | UNVERIFIED — modelled on DPD eSolutions REST, needs live account   |
| UPS        | UNVERIFIED — modelled on UPS v2403 Ship/Track REST, needs account  |
| FedEx      | UNVERIFIED — modelled on FedEx Ship v1 + Track v1 REST             |

Unverified adapters are tagged with `# UNVERIFIED - pending live test with account` in the source. Payloads match the documented contract; adjustments may be needed when tested against live accounts.
