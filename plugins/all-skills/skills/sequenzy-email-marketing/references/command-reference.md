# Command Reference

## Source Of Truth

- Commands and flags: `sequenzy --help` and `sequenzy <command> --help` from the installed CLI (`npm install -g @sequenzy/cli`)
- MCP tools: the tool list returned by the Sequenzy MCP server
- HTTP API: the [API reference](https://docs.sequenzy.com/api-reference)

If this reference and the installed CLI's help output disagree, trust the help output.

## Authentication

### Interactive login

```bash
sequenzy login
```

- starts device auth against `POST /api/device-auth/initiate`
- polls `POST /api/device-auth/poll`
- opens `${SEQUENZY_APP_URL}/setup/auth?code=...` in the browser
- stores the API key in `Bun.secrets` when available, otherwise in local config

### Non-interactive auth

Set `SEQUENZY_API_KEY` in the environment. The CLI checks it before locally stored credentials, so it is the safest path for automation.

### Identity and logout

```bash
sequenzy whoami
sequenzy account
sequenzy logout
```

Behavior:

- `whoami` prints cached local config only
- `account`: `GET /api/v1/account`
- `logout` removes locally stored auth

Caveat:

- treat `whoami` as "is this machine authenticated?" rather than authoritative server-side account discovery

## Environment Variables

```bash
SEQUENZY_API_KEY=...
SEQUENZY_API_URL=https://api.sequenzy.com
SEQUENZY_APP_URL=https://sequenzy.com
```

Notes:

- `SEQUENZY_API_KEY` overrides local keychain/config state
- the current CLI code defaults `SEQUENZY_APP_URL` to `https://sequenzy.com`
- many company-scoped commands accept `--company`, which sends `x-company-id` for personal API keys

## Dashboard URLs

```bash
sequenzy urls --company comp_123
sequenzy urls --company comp_123 --sequence seq_123
sequenzy urls --company comp_123 --campaign camp_123
sequenzy urls --company comp_123 --template tmpl_123
sequenzy urls --company comp_123 --landing-page lp_123
sequenzy urls --company comp_123 --transactional tx_123
sequenzy urls --company comp_123 --email-send send_123
sequenzy urls --company comp_123 --settings-tab integrations
sequenzy urls --company comp_123 --json
```

Behavior:

- uses `SEQUENZY_APP_URL` as the base URL, defaulting to `https://sequenzy.com`
- if `--company` is omitted, tries the current company from `GET /api/v1/account`
- returns route templates, settings tab values, and concrete URLs when a company ID is known
- also accepts `--email <id>` (email editor), `--domain <id>` (sending domain), and `--status` for campaign/sequence list URLs
- campaign, sequence, template, company, and account outputs include `url` or `appUrls` fields when the company can be resolved

Common route patterns:

- sequence editor: `/dashboard/company/{companyId}/sequences/{sequenceId}`
- campaign editor: `/dashboard/company/{companyId}/campaign/{campaignId}`
- template/email editor: `/dashboard/company/{companyId}/emails/{emailId}`
- settings: `/dashboard/company/{companyId}/settings`
- settings tab: `/dashboard/company/{companyId}/settings?tab={tab}`

## Stats

```bash
sequenzy stats
sequenzy stats --period 30d
sequenzy stats --start "2026-05-01T00:00:00Z" --end "2026-05-31T00:00:00Z"
sequenzy stats --campaign camp_123
sequenzy stats --sequence seq_123
sequenzy stats --transactional password-reset
sequenzy stats --email-type transactional
sequenzy stats --campaign camp_123 --mailbox-provider gmail
sequenzy stats --campaign camp_123 --include-bots
```

Behavior:

- no ID: `GET /api/v1/metrics?period=7d|30d|90d`, or a custom range with both `--start` and `--end`
- `--campaign`: `GET /api/v1/metrics/campaigns/:id`
- `--sequence`: `GET /api/v1/metrics/sequences/:id`
- `--transactional <id-or-slug>` reports one saved transactional email; its stats are all-time by default, pass `--period` for a window
- use exactly one of account-level stats, `--campaign`, `--sequence`, or `--transactional`; `--email-type` (e.g. `transactional`) applies only to account-level stats
- `--mailbox-provider` (e.g. `gmail`, `microsoft`, `yahoo`) scopes account or campaign engagement metrics to one recipient mailbox provider; replies, conversions, and revenue cannot be segmented per provider and report 0 under this filter
- bot/scanner opens and clicks are excluded by default; pass `--include-bots` to inspect raw engagement
- sequence stats include a live active/waiting enrollment breakdown by current node plus per-step failures

Output includes:

- `sent`
- `delivered`
- `opened`
- `clicked`
- `unsubscribed`
- `openRate`
- `clickRate`

Campaign stats also include a `clickedLinks` array when the campaign has tracked link clicks: the top 20 destination URLs, most clicked first, each with `url`, `clicks`, and `percentage` (that link's share of every recorded link click). The CLI prints these as a Clicked Links section; use `--json` for the raw array. The MCP `get_campaign_stats` tool returns the same top-level array.

`sequenzy stats --clients` shows which mail clients (Apple Mail, Gmail, Outlook, Yahoo Mail, Thunderbird, Android mail app, web browser, other) and devices (desktop, mobile, tablet, unknown) opened your emails, as shares of unique opens; each send counts once, by the client of its first open. Add `--campaign <id>` for one campaign (whole campaign; no period or email-type filters), or use `--period`, `--start`/`--end`, and `--email-type` for account-level breakdowns (default 90 days). It calls `GET /api/v1/metrics/clients` or `GET /api/v1/metrics/campaigns/:id/clients`; MCP: `get_email_client_stats`. Gmail, Yahoo, and Apple Mail privacy proxies hide the device, reported as `privacyProxyOpens`. Recipients who never open are not represented, so describe results as shares of openers.

`sequenzy stats --by <dimension>` breaks the funnel down by `email` (each campaign, sequence email step and transactional template), `sequence`, `email_type`, `mailbox_provider` or `recipient_domain` (default 30 days, top 25, `--limit` up to 100). Every row includes attributed revenue, credited to the provider and domain of the send each conversion came from. Each row prints the flag that drills into it (`--source sequence:<id>`, `--source sequence_step:<id>`, `--source campaign:<id>`, `--mailbox-provider`, `--recipient-domain` or `--email-type`); pass that flag to `sequenzy stats` or another `--by` to narrow every number to that subgroup. MCP: `get_stats_breakdown`, and the same `source`/`recipientDomain` arguments on `get_stats`. API: `GET /api/v1/metrics/breakdown`. Source- or domain-filtered account stats report replies as 0. `--outcome permanent_bounce|temporary_bounce|blocked|complaint` (MCP/API `outcome`) limits account stats or `--by` to sends that bounced that way or drew a spam complaint, so `sequenzy stats --by email --outcome complaint` answers "which emails are my complaints from"; outcome-filtered stats also report replies as 0.

`sequenzy stats --links` ranks link destinations by unique clicks across every email in the account (default 90 days, top 10), with `clicks` (every click, repeats included), `uniqueClicks` (subscribers who clicked the link, each counted once), and `share` of all unique clicks. Query strings, fragments, and trailing slashes are ignored, so UTM-tagged variants of a page count as one link. It accepts `--period`, `--start`/`--end`, `--email-type`, `--mailbox-provider`, and `--limit` (up to 50); `totalClicks`, `totalUniqueClicks` and `totalLinks` cover every link before the limit. It calls `GET /api/v1/metrics/links`; MCP: `get_link_click_stats`. For one campaign's links, use `clickedLinks` from campaign stats instead.

Sequence stats carry the same summaries per email step as `steps[].polls` (lifetime results, omitted for steps without answers); the CLI prints them as a Poll & NPS Results section, and the MCP `get_sequence_stats` tool returns them in `steps`. To list one step's respondents, pass the step's `nodeId` as the campaign ID to `poll-responses` / `list_poll_responses`.

Campaign stats also include a `polls` array when the campaign collected poll / NPS answers: one entry per poll block with `question`, `totalResponses`, per-answer counts and percentages, and an `nps` breakdown (`score`, `average`, promoters / passives / detractors) for NPS surveys.

## Events

```bash
sequenzy events --campaign camp_123
sequenzy events --sequence seq_123 --event-types delivery,open,click
sequenzy events --campaign camp_123 --type open --period 24h --page 2 --limit 100
```

Behavior:

- `--campaign`: `GET /api/v1/metrics/campaigns/:id/events`; `--sequence`: `GET /api/v1/metrics/sequences/:id/events`; use exactly one
- defaults to delivery events; use `--type` for a single event type or `--event-types` for a comma-separated set (delivery, open, click, ...)
- accepts `--period` (`1h`, `24h`, `7d`, `30d`, `90d`) or `--start`/`--end`, plus `--page` and `--limit` pagination
- bot/scanner opens and clicks are excluded by default; pass `--include-bots` to inspect raw engagement
- MCP parity: `list_campaign_events` and `list_sequence_events`

## Subscribers

### List

```bash
sequenzy subscribers list
sequenzy subscribers list --tag vip
sequenzy subscribers list --list "Master List" --json
sequenzy subscribers list --segment seg_123
sequenzy subscribers list --limit 100
sequenzy subscribers list --tag vip --company comp_123 --json
```

Behavior:

- sends `GET /api/v1/subscribers`
- maps `--segment` to `segmentId`
- maps `--tag` to `tags`
- maps `--list` to `list`; the API resolves list ID first, then exact list name
- maps `--limit` to `limit`
- fetches every result page by default when `--limit` is omitted
- supports `--company` and `--json`

### Add

```bash
sequenzy subscribers add user@example.com
sequenzy subscribers add user@example.com --first-name John --last-name Doe --tag premium --attr plan=pro
sequenzy subscribers add user@example.com --phone "+15550100" --sms-consent
sequenzy subscribers add user@example.com --list list_123 --skip-sequences
sequenzy subscribers add user@example.com --created-at "2024-03-01T00:00:00Z"
sequenzy subscribers add user@example.com --tag premium --tag beta --company comp_123 --json
```

Behavior:

- sends `POST /api/v1/subscribers`
- body shape is `{ email, firstName, lastName, tags, customAttributes }`
- `--first-name` / `--last-name` set the native profile name fields; do not store names in `--attr`
- `--phone` (with optional `--phone-country` for national numbers) writes the native phone field, not a custom attribute; pair it with `--sms-consent` to assert express written SMS consent
- `--external-id <id>` stores a customer-owned subscriber ID that other subscriber commands can address with `--external-id`
- `--list <ids...>` adds the subscriber to specific lists with `subscribers:write`; `--no-lists` targets none. When both are omitted, a new contact follows workspace default lists and an existing contact keeps its memberships
- `--skip-sequences` suppresses sequence enrollment for this add
- `--attr key=value` always sends strings; `--attrs-json '{"zip":"02134","seats":5}'` keeps JSON types (numbers, booleans, lists, and strings with leading zeros). When both set a key, `--attr` wins. Check existing names and types first with `subscribers attributes`
- `--created-at` preserves a contact's real signup date (for migrations) so date-relative segments stay correct; it never moves an existing contact's date later and suppresses sequence enrollment by default. Single-contact creation with a signup date at most one hour old remains eligible for account notifications; older dates and bulk imports do not notify on creation, but double opt-in confirmation can still notify. Preferences, double opt-in and daily caps still apply
- supports repeated `--tag` values
- supports `--company` and `--json`

### Update

```bash
sequenzy subscribers update user@example.com --status unsubscribed
sequenzy subscribers update user@example.com --status complained
sequenzy subscribers update user@example.com --first-name Ana --last-name Silva
sequenzy subscribers update user@example.com --phone "+15550100" --sms-consent
sequenzy subscribers update user@example.com --tag churned --attr cancelReason=too_expensive
sequenzy subscribers update user@example.com --attr plan=pro --merge
sequenzy subscribers update user@example.com --attrs-json '{"zip":"02134"}' --merge
```

Behavior:

- sends `PATCH /api/v1/subscribers/:email`
- requires at least one of `--status`, `--first-name`, `--last-name`, `--phone`, `--sms-consent`/`--no-sms-consent`, `--tag`, `--attr`, or a non-empty `--attrs-json`
- `--first-name` / `--last-name` set the native profile name fields; do not store names in `--attr`
- `--status` accepts `active`, `unsubscribed`, `bounced` or `complained`. `complained` records a company spam-complaint suppression, then unsubscribes the contact and cancels its sequence enrollments; the contact reads as `unsubscribed` afterwards and `sequenzy suppressions get <email>` shows the complaint. MCP parity: `update_subscriber` with `status: "complained"`
- changing `--phone` resets SMS consent unless `--sms-consent` is passed in the same command; `--no-sms-consent` revokes it
- `--tag` replaces the subscriber's tags; `--attr` / `--attrs-json` replace custom attributes unless `--merge` is passed
- `--attrs-json` keeps value types, so use it to set numbers, booleans or lists, or to change an attribute's type; `--attr` always sends strings and wins on the same key
- `--external-id <id>` addresses the subscriber by customer-owned ID instead of email
- supports `--company` and `--json`

### Attributes

```bash
sequenzy subscribers attributes
sequenzy subscribers attributes --include-nested --json
```

Behavior:

- sends `GET /api/v1/subscribers/attributes` (`?includeNested=true` with `--include-nested`); requires `subscribers:read`
- lists custom attribute names in use across the account with `valueType` (`string`, `number`, `boolean`), `isArray`, `mixedTypes`, an example `sampleValue`, and `sampledContacts`
- `mixedTypes: true` means contacts hold different types for the key (for example zip stored as 2134 and "02134"); `valueType` is then `string`. Always send values with leading zeros as strings, whatever `valueType` says
- types and examples come from up to 100 recent contacts; names only older contacts carry (up to the 500 most used) are listed with `sampledContacts` 0; their `isArray` is always false because the index does not record list shape
- use it before `add`/`update` to reuse names and match types, e.g. keep `zip` a string (`"02134"`); set list attributes with `--attrs-json`
- MCP parity: `list_subscriber_attributes`
- supports `--company` and `--json`

### Get

```bash
sequenzy subscribers get user@example.com
sequenzy subscribers get user@example.com --company comp_123 --json
```

Behavior:

- sends `GET /api/v1/subscribers/:email`
- returns the full subscriber profile, including list memberships, sequence enrollments, email stats, and recent activity
- `--external-id <id>` looks the subscriber up by customer-owned ID; `--include-bots` includes bot/scanner engagement in the stats
- supports `--company` and `--json`

### Remove

```bash
sequenzy subscribers remove user@example.com
sequenzy subscribers remove user@example.com --hard
sequenzy subscribers remove user@example.com --company comp_123 --json
```

Behavior:

- without `--hard`, sends `PATCH /api/v1/subscribers/:email` with `{ status: "unsubscribed" }`
- with `--hard`, sends `DELETE /api/v1/subscribers/:email`; usually within an hour the contact's activity history and Sent emails records are erased and their delivery and engagement events anonymized, while bounce and spam-complaint suppressions keep the address
- `--external-id <id>` addresses the subscriber by customer-owned ID
- supports `--company` and `--json`

### Import

```bash
sequenzy subscribers import ./contacts.csv --list list_123
sequenzy subscribers import --records-json '[{"email":"a@example.com","firstName":"Ana","plan":"pro"}]'
sequenzy subscribers import ./contacts.csv --duplicate-strategy merge --opt-in-mode confirmed
sequenzy subscribers import-status imp_123
```

Behavior:

- `import` sends `POST /api/v1/subscribers/imports` and queues a full-record import from CSV, JSON file, or `--records-json`
- CSV columns for email, names, external ID, phone, status, and tags are detected automatically; other columns become custom attributes
- CSV status values from AWeber, Mailchimp, Kit, MailerLite, Brevo, ActiveCampaign, and beehiiv exports map to `active`, `unsubscribed` (`cancelled`, `inactive`, `complained`, ...) or `bounced` (`cleaned`, `hard bounce`, ...); a filled unsubscribe-date column (`Unsubscribe Date`, `unsubscribed_at`, `UNSUB_TIME`) marks the row unsubscribed. Not-confirmed or pending rows and unrecognized values import as active; the output prints the counts (`statusSummary` in `--json`). With `--records-json` or MCP, map provider values yourself before sending
- unsubscribed and bounced rows never enroll in sequences or receive double opt-in emails, and an active row never resubscribes an unsubscribed or bounced contact. `merge`/`overwrite` apply an unsubscribed or bounced row to an existing active contact; `skip` leaves existing contacts unchanged
- `--duplicate-strategy skip|merge|overwrite` (default `skip`) controls existing-contact behavior; `--list <ids...>` adds every imported subscriber to lists and requires `lists:write`
- `--enroll-sequences` enrolls matching subscribers (requires the `automations:trigger` scope); `--default-phone-country` and `--sms-consent` handle imported phone numbers
- `--opt-in-mode default|confirmed|double_opt_in` sets email consent; use `confirmed` only when the contacts already gave verified consent. A repeat double opt-in request for an unconfirmed contact sends a new confirmation only when the last one went out at least 24 hours ago, up to three per address, and never after it unsubscribed or complained; otherwise it returns `optIn.emailQueued: false`, so do not retry to "resend" it sooner
- imports run asynchronously; poll the returned ID with `subscribers import-status` (`GET /api/v1/subscribers/imports/:importId`). A completed import can still contain failed rows - inspect failed counts and the `--json` reason maps
- MCP parity: `create_subscriber_import` and `get_subscriber_import`

### Notes

```bash
sequenzy subscribers notes list user@example.com
sequenzy subscribers notes add user@example.com "Asked for annual invoicing"
sequenzy subscribers notes delete note_123
```

Behavior:

- `notes list`: `GET /api/v1/subscribers/:email/notes`; `notes add`: `POST /api/v1/subscribers/:email/notes`; `notes delete`: `DELETE /api/v1/subscribers/notes/:noteId`
- `--external-id` addresses the subscriber by customer-owned ID
- MCP parity: `list_subscriber_notes`, `add_subscriber_note`, and `delete_subscriber_note`

### Trigger Event

```bash
sequenzy subscribers event user@example.com saas.purchase -p amount=99 -p plan=pro
sequenzy subscribers event user@example.com saas.purchase --occurred-at "2025-11-02T10:00:00Z"
```

Behavior:

- sends the named custom event for one subscriber; `-p/--property` sets event properties and `-a/--attr` updates custom attributes in the same call
- without `--occurred-at` the event is live and runs the full chain: sync rules, sequence enrollment, waiting steps, and goal conversions
- with an `--occurred-at` more than an hour in the past the event is recorded as history: stored with its real timestamp and counted by segments, but no sequences enroll and no webhooks fire; the contact's signup date also moves back to when the event occurred (never later). Use it for backfills, never to fake a live event
- `--event-id` provides an idempotency key
- MCP parity: `trigger_subscriber_event` and `trigger_subscriber_events` (bulk)

### Bulk Tags

```bash
sequenzy subscribers tags add vip --email one@example.com two@example.com
sequenzy subscribers tags add imported-2026 --emails-file ./batch.csv
sequenzy subscribers tags remove trial --emails-json '["one@example.com"]'
```

Behavior:

- sends `POST /api/v1/subscribers/bulk/tags/add|remove`; targets come from repeated `--email`, `--emails-json`, `--emails-file`, `--external-id`, or `--subscriber-id`
- only touches contacts that already exist; unknown identifiers are reported, never created
- tag automations are skipped by default (what historical backfills want); pass `--trigger-automations` to fire `tag_added` sequences
- requests are chunked at 500 targets each; totals in the output are combined across chunks
- use `subscribers add`/`subscribers update` for single-contact tag changes
- MCP parity: `bulk_add_subscriber_tags` and `bulk_remove_subscriber_tags`

## Transactional Emails

### Send

```bash
sequenzy send user@example.com --template welcome --var firstName=Ana
sequenzy send user@example.com --subject "Hello" --html "<h1>Hi</h1>"
sequenzy send user@example.com --subject "Hello" --html-file ./email.html
sequenzy send user@example.com --subject "Hello" --html-file ./email.html --email-type marketing
sequenzy send user@example.com --template weekly-digest --header "List-Unsubscribe: <https://example.com/unsubscribe/abc>" --header "List-Unsubscribe-Post: List-Unsubscribe=One-Click"
```

Behavior:

- sends `POST /api/v1/transactional/send`
- template sends use `slug`; direct HTML uses `body` with `subject`. Both include `to` and `variables`, plus selected recipient, delivery, identity, and tracking options
- use `--company` for explicit workspace targeting with a personal API key and `--json` for the complete accepted receipt on stdout; inspect `emailSendId` with `email-sends get`
- `--html-file -` reads piped UTF-8 HTML; generate one `--idempotency-key` per logical send and reuse it with unchanged input after an uncertain outcome
- use either `--template` (a transactional API slug, cannot be combined with `--subject`) or `--html`/`--html-file` with a required `--subject`
- `--email-type marketing` adds the standard unsubscribe footer and RFC 8058 one-click-unsubscribe headers; it supports one recipient only
- `--reply-to` overrides the saved template or company Reply-To default
- `--no-track-clicks` / `--no-track-opens` opt out of tracking for this send only; they cannot enable tracking the account has disabled
- repeat `--header "Name: value"` for extra email headers (up to 50, MCP `headers`). Transactional sends can carry the caller's own `List-Unsubscribe` and `List-Unsubscribe-Post: List-Unsubscribe=One-Click`; marketing sends always use Sequenzy's signed pair. Headers Sequenzy manages (From, To, Subject, Reply-To, Message-ID, Content-Type, `X-Sequenzy-*`) are never applied. Unapplied headers never fail the send; the receipt lists them as `ignoredHeaders` with a reason. A `--header` without `Name:`, a repeated name, or a non-string MCP value is rejected before sending
- `--vars-json` accepts nested objects and arrays (including arrays for repeat blocks); `--var` overrides individual scalar keys
- if the recipient matches a subscriber, saved first and last names fill omitted name variables; `--var` values override them
- MCP parity: `send_email`

### Saved Transactional Templates

```bash
sequenzy transactional list --status enabled
sequenzy transactional get welcome
sequenzy transactional create password-reset --prompt "Write a password reset email"
sequenzy transactional create welcome --subject "Welcome" --html-file ./welcome.html
sequenzy transactional update welcome --no-enabled
sequenzy transactional delete welcome --yes
```

Behavior:

- Transactional labels: create/update accept `--label <names...>`; update accepts `--clear-labels` (mutually exclusive with `--label`). List accepts `--label` and matches any supplied name alongside search/status. Human and JSON output show labels.
- API/MCP use `labels: string[]` for creation/replacement and `labels: []` to clear. Omit to preserve on update. Names are trimmed/deduplicated, non-empty, at most 255 characters; missing company labels are created. Null is invalid. API list uses repeated exact-name `label` query parameters (commas are literal, unlike campaign list shorthand); MCP list uses `labels`. Get/list expose names.
- Label-only edits preserve body/localizations and never send. Replacements are safe to retry for the same assignment; after an uncertain result, read the template to reconcile before retrying.
- `list`: `GET /api/v1/transactional` with `--search`, `--status`, `--sort`, `--order`, and `--include-bots` filters
- `get <slug>`: `GET /api/v1/transactional/:slug`
- `create <name>`: `POST /api/v1/transactional`; provide exactly one of `--prompt`, HTML, or blocks; `--slug` sets the API slug used by `sequenzy send --template`
- `update <slug>` is a partial update: only the fields you pass change; replacing the body takes HTML or blocks, not both; `--no-enabled` stops sends while keeping the template and its stats
- `delete <slug>` frees the slug for reuse and stops further sends; past deliveries and stats are kept; requires the `transactional:delete` scope
- `sequenzy transactional widgets preferences-token <email>` generates a subscription preferences iframe token
- per-template stats: `sequenzy stats --transactional <id-or-slug>`
- MCP parity: `list_transactional_emails`, `get_transactional_email`, `create_transactional_email`, `update_transactional_email`, `delete_transactional_email`, and `get_transactional_stats`

## Email Sends

```bash
sequenzy email-sends list --recipient user@example.com --days 7
sequenzy email-sends list --status bounced --email-type transactional
sequenzy email-sends list --mailbox-provider orange --status opened
sequenzy email-sends list --all --csv email-sends.csv
sequenzy email-sends get send_123
sequenzy email-sends get send_123 --html-only
```

Behavior:

- `list`: `GET /api/v1/email-sends`; matches the dashboard's 14-day delivery history with `--search`, `--subject`, `--recipient`, `--status`, `--email-type`, `--bounce-type` (`Permanent`, `Transient`, or its `Soft` and `Blocked` parts), `--campaign`, `--transactional`, `--sequence`, `--mailbox-provider`, `--list`, `--days`, paging, and sort filters
- the `opened` status includes clicked deliveries, matching the dashboard
- `--mailbox-provider` uses the same providers as `stats --mailbox-provider` (`other` = every domain outside the named providers), so it lists the deliveries behind a provider's analytics numbers; `--list <id>` keeps sends to active subscribers currently on that list (the analytics list audience)
- `--all --csv <path>` exports every matching delivery
- `get <emailSendId>`: `GET /api/v1/email-sends/:id`; returns timestamps and the complete event timeline; `--html` prints the stored HTML body when still available, `--html-only` prints just the HTML
- email send rows are short-lived; if a row was cleaned up, `get` falls back to retained ClickHouse events
- an email that didn't arrive carries `outcome` (`bounced`: the address can't take mail; `blocked`: the receiver refused the sender for spam or content, its domain, policy, or failed SPF/DKIM/DMARC; `delayed`: still retrying; `failed`: Sequenzy couldn't deliver it) and a one-sentence `reason`; relay `reason` as is. Only `blocked` is the sender's to fix; never suppress on `failed`. Sending IPs are always `null`
- MCP parity: `list_email_sends` and `get_email_send`
- History includes pending, successful and failed tests with `isTestEmail: true`; filter returned rows for live deliveries only.

## Suppressions

```bash
sequenzy suppressions get user@example.com
sequenzy suppressions remove user@example.com --yes
```

Behavior:

- `get`: `GET /api/v1/suppressions/:email`, optionally scoped with `--region`; `remove`: clears the suppression
- lookup is exact-address only because the SES account-level list is shared across companies
- removal clears stale bounce entries only; complaint and unsubscribe protections are preserved
- MCP parity: `get_recipient_suppression` and `remove_recipient_suppression`

## Companies, Lists, Tags, And Segments

### Companies

```bash
sequenzy companies list
sequenzy companies get comp_123
sequenzy companies create example.com --name Example
sequenzy companies create --without-website --name Example --description "Product updates for teams" --with-welcome-sequence
sequenzy companies update comp_123 --primary-color '#0ea5e9' --tone-voice "clear, direct, warm"
sequenzy companies update comp_123 --company-context-file ./product.md
sequenzy companies update comp_123 --sender-profile-id sender_abc --from-name "Example News"
sequenzy companies update comp_123 --enable-reply-tracking --reply-tracking-domain-mode sequenzy
sequenzy companies update comp_123 --category mobile_app
```

Behavior:

- `companies list`: `GET /api/v1/companies`
- `companies get`: `GET /api/v1/companies/:id`
- `--category <type>` on `companies update` / `companies create` sets `websiteType` (`saas`, `content`, `ecommerce`, `offline`, `mobile_app`, `other`; `none` clears it on update so website detection may classify again). Reads return `websiteType` and `websiteTypeSource` (`user` when chosen, `detected` when set from the website; detection never overwrites `user`). `mobile_app` recommends push-first mobile journeys and app-aware AI copy. After connecting RevenueCat, Superwall or Adapty, `integrations connect` may return `websiteTypeSuggestion`; offer it to the user rather than applying it silently. MCP: `update_company` / `create_company` `websiteType`
- `darkModeLogoStatus` / `darkModeLogoUrl` (read-only, also in `get_company`): `outlined` means emails show `darkModeLogoUrl`, the logo with a thin white outline so dark transparent logos stay visible in dark-mode inboxes; `not_needed` means the logo already reads on dark; `custom` means the company uploaded its own; `pending` means a new logo is checked automatically within about 10 minutes. `companies update --dark-mode-logo-url <url>` (MCP `darkModeLogoUrl`) replaces the automatic copy in every email, so it must read on light and dark; `--automatic-dark-mode-logo` (MCP `null`) goes back. Changing `--logo-url` drops an uploaded one and triggers a new check
- `companies create`: `POST /api/v1/companies`; takes a domain plus optional `--name`, or `--without-website --name` for a ready company without a website; `--description`/`--description-file` (up to 500 characters, may be replaced by website processing when a domain is given) and `--with-welcome-sequence` (drafts the four-email sequence, off until turned on) work with either
- `companies update`: `PATCH /api/v1/companies/:id` covering brand fields (`--description`, `--logo-url`, `--primary-color`, `--brand-colors-json`, `--font-family`, `--email-theme-json` (partial theme patch; `{"layout":{"contentAlign":"left"}}` moves the email's content column flush left instead of centered, with buttons, the logo and footers unless set to right or kept centered with block `styles.keepAlign: true`, `center` restores it), `--email-direction`, `--email-preset branded|minimal` for the default header and footer, `--footer-style auto|classic|mono|band|editorial` for the footer AI-designed emails get, `--footer-theme-json` for the auto-added footer's colors and copy as a merge patch where `null` resets a field, and footer font, size and line height through `--email-theme-json` `typography.footerFontFamily`/`footerFontSize`/`footerLineHeight`), AI context (`--tone-voice`, `--company-context`, `--value-props-json`, `--testimonials-json`, `--pricing-json`, `--email-length-preference`, `--email-style visual|plain|ask` for designed or simple text AI emails; `ask` clears the choice), compliance (`--privacy-policy-url`, `--terms-url`, `--address`, `--language`, `--social-links-json` keyed by platform, including `appstore` and `googleplay` for mobile app store icons in the footer), and sender identity (`--sender-profile-id`, `--from-email`, `--from-name`, `--reply-profile-id`, `--reply-to`, `--reply-to-name`, `--enable/disable-reply-tracking`, `--reply-tracking-domain-mode`, `--enable/disable-reply-forwarding`)
- most JSON-valued flags have `-file` variants to avoid shell escaping
- MCP parity: `get_company`, `create_company`, and `update_company`

### Lists

```bash
sequenzy lists list
sequenzy lists create Newsletter --description "Public newsletter list"
sequenzy lists create VIP --private --company comp_123
sequenzy lists update list_123 --name "Weekly Newsletter" --private
sequenzy lists update list_123 --no-private
sequenzy lists add-subscribers list_123 --email one@example.com two@example.com
sequenzy lists add-subscribers list_123 --emails-json '["one@example.com","two@example.com"]'
sequenzy lists add-subscribers list_123 --emails-file ./batch-001.csv
sequenzy lists import list_123 --emails-file ./batch-001.csv
sequenzy lists remove-subscribers list_123 --email one@example.com two@example.com
sequenzy lists remove-subscribers list_123 --emails-file ./churned.csv
sequenzy lists delete list_123 --yes
```

Behavior:

- `lists list`: `GET /api/v1/lists`
- `lists create`: `POST /api/v1/lists`
- create body shape is `{ name, description, isPrivate, allowMemberUnsubscribe }`
- `lists update`: `PATCH /api/v1/lists/:listId` with at least one of `--name`, `--description`, `--private`, `--no-private`, `--allow-member-unsubscribe`, or `--no-allow-member-unsubscribe`
- `lists delete`: `DELETE /api/v1/lists/:listId`; removes the list and all of its memberships, reports `removedMemberships`, and keeps the subscribers themselves
- `lists add-subscribers` and `lists import`: `POST /api/v1/lists/:listId/subscribers`
- `lists remove-subscribers`: `POST /api/v1/lists/:listId/subscribers/remove`
- add-subscribers body shape is `{ emails, duplicateStrategy, enrollInSequences, optInMode }`
- remove-subscribers takes the same email input formats as add-subscribers, only removes list memberships, and reports `removed` plus `notFound` emails
- the CLI splits large files into API-safe batches of up to 500 emails for both add and remove
- files may be newline-separated, CSV with an email column, a JSON email array, or a JSON object with `emails` or `subscribers`
- CSV headers named `email`, `e-mail`, `email address`, or `mail` are detected; otherwise the first column is used
- `lists delete` prompts for confirmation; pass `--yes` to skip
- MCP parity: `update_list`, `delete_list`, and `remove_subscribers_from_list` (max 500 emails per call)

### Tags

```bash
sequenzy tags
sequenzy tags list --company comp_123 --json
sequenzy tags create vip --color purple
sequenzy tags update tag_123 --color red
sequenzy tags delete tag_123 --yes
```

Behavior:

- `tags list`: `GET /api/v1/tags`; bare `sequenzy tags` without a subcommand still lists tag definitions for backwards compatibility
- `tags create`: `POST /api/v1/tags` with `{ name, color? }`
- `tags update`: `PATCH /api/v1/tags/:tagId` with `{ color }` (`--color` is required)
- `tags delete`: `DELETE /api/v1/tags/:tagId`
- tag names are normalized to lowercase with dashes, so `VIP Customer` becomes `vip-customer`
- the color defaults to `gray`; valid colors are `gray`, `red`, `orange`, `amber`, `yellow`, `lime`, `green`, `emerald`, `teal`, `cyan`, `sky`, `blue`, `indigo`, `violet`, `purple`, `fuchsia`, `pink`, and `rose`
- system tags cannot be updated or deleted
- tags still referenced by sequences cannot be deleted until those sequences stop using them
- deleting a tag removes it from every subscriber; the delete prompt warns about this, and `--yes` skips it
- MCP parity: `list_tags`, `create_tag`, `update_tag`, and `delete_tag`

### Segments

```bash
sequenzy segments list
sequenzy segments count seg_123
sequenzy segments create --name "Bought Pro" --stripe-product prod_pro
sequenzy segments create --name "3+ Pro Payments" --stripe-product prod_pro --purchase-operator at-least --payments 3
sequenzy segments create --name "VIP or Churn Risk" --match any --filter-json '[{"field":"tag","operator":"contains","value":"vip"},{"field":"emailOpened","operator":"is_not","value":"30d"}]'
sequenzy segments create --name "Active non-paying" --filter-json '{"kind":"group","id":"root","joinOperator":"and","children":[{"kind":"filter","id":"f1","field":"attribute","operator":"gte","value":"last_login_days_ago:0"},{"kind":"group","id":"g1","joinOperator":"or","children":[{"kind":"filter","id":"f2","field":"attribute","operator":"is_empty","value":"plan_end"},{"kind":"filter","id":"f3","field":"attribute","operator":"lt","value":"plan_end:2026-04-21"}]}]}'
sequenzy segments update seg_123 --name "Churn Risk"
sequenzy segments update seg_123 --filters-json '[{"field":"tag","operator":"contains","value":"vip"}]'
sequenzy segments update seg_123 --join-operator or
sequenzy segments delete seg_123 --yes
```

Behavior:

- `segments list`: `GET /api/v1/segments`
- `segments count`: `GET /api/v1/segments/:id/count`
- `segments create`: `POST /api/v1/segments`
- `segments update`: `PATCH /api/v1/segments/:segmentId` with at least one of `--name`, `--filters-json`, `--filters-file`, or `--join-operator and|or`
- `segments delete`: `DELETE /api/v1/segments/:segmentId`; prompts for confirmation, `--yes` skips
- update filters replace the existing filter set; `--filters-json`/`--filters-file` accept the same array or `root` object shapes as create, and missing filter IDs are filled in by the CLI
- `--filter-json` accepts either the legacy raw segment filter array or a nested filter `root` object
- `--match all|any` controls whether top-level filters are combined with `and` or `or`
- MCP/API use `filterJoinOperator: "and" | "or"` for the same behavior
- nested segment logic uses `{ "kind": "group", "joinOperator": "and" | "or", "children": [...] }`
- custom event filters use `field: "event"` with values like `saas.purchase:30d`, `saas.purchase:all`, or `saas.purchase:5:30d`
- email engagement filters (`emailSent`, `emailDelivered`, `emailOpened`, `emailClicked`, `emailBounced`, `emailComplained`) accept day windows (`7d`, `30d`, `all`) and whole-hour windows from `1h` to `8760h` (`24h`, `6h`), measured to the exact hour (count filters are exact up to `168h`; longer hour windows count like day windows); counts use `count:window` such as `2:24h`, and `segments create --engagement-range 24h` builds one from flags. Custom event and push filters stay on day windows. For "opened any email in the last 24 hours OR opened campaign X", use `--match any` with `emailOpened is 24h` and `emailOpened is campaign:<id>`
- saved segment composition uses `field: "segment"` with `operator: "is" | "is_not"` and the referenced segment id as `value`
- push filters: `pushDevice` (`is`/`is_not` with `any`, `web`, `ios`, or `android`) matches active push devices; `pushSent`, `pushDelivered` (displayed on a device), and `pushClicked` take `is`/`is_not` with a time range (`30d`, `all`) and ignore test sends. The dashboard only offers them once push is set up
- counts follow up to 16 levels of segment-to-segment references and 1,000 references in total (a segment counts again each time it is referenced; nested groups inside a segment do not count); past a limit the API returns `400` `SEGMENT_REFERENCE_DEPTH_EXCEEDED` or `SEGMENT_REFERENCE_COUNT_EXCEEDED` with `details.segmentId` and `details.referenceChain`. Do not retry: for depth, copy an inner segment's conditions into its parent; for the total, reference fewer segments or inline segments referenced from several places
- Stripe product filters use `field: "stripeProduct"` and product IDs, not product names
- commerce purchase filters use `--commerce-product <id>` or `--commerce-collection <key>` with `--purchase-operator` and `--orders <number>` for order-count thresholds; `--payments` is the Stripe equivalent
- threshold operators encode the count as `productId:count`, for example `prod_pro:3`
- MCP parity: `update_segment` (reuses the create filter schemas) and `delete_segment`

## Products And Digital Delivery

```bash
sequenzy products list
sequenzy products list --provider stripe --search guide
sequenzy products list --all
sequenzy products sync
sequenzy products upsert my-course --title "Video Course" --price-cents 4900 --currency usd --file ./course.zip
sequenzy products upsert --products-file ./catalog.json
sequenzy products delete my-course
sequenzy products attach-file <product-id> --file ./guide.pdf
sequenzy products attach-file <product-id> --url https://example.com/template.zip --name template.zip
sequenzy products detach-file <product-id>
```

Behavior:

- `products list`: `GET /api/v1/products`, optionally with `?provider=stripe|shopify|woocommerce|manual&search=...`; returns one page by default (100-per-request cap), pass `--all` to page through larger catalogs
- `products sync`: `POST /api/v1/products/sync`; queues a catalog sync (`--integration` selects one when several are connected) and returns 404 without an active integration
- `products upsert [productId]`: creates or updates API-provider products keyed by your own `productId`; supports `--title`, `--description`, `--price-cents`, `--currency`, `--image-url`, `--product-url`, `--in-stock`/`--out-of-stock`, `--provider-created-at`, and bulk `--products-json`/`--products-file` for up to 100 products; combine `--file` or `--url` with a single-product upsert to attach the deliverable in the same command
- `products delete <productId>`: `DELETE /api/v1/products/:id`
- `products attach-file --file`: `POST /api/v1/products/delivery/upload-url` for a presigned URL, PUTs the file bytes there, then `PUT /api/v1/products/:id/delivery` with `source: "upload"`
- `products attach-file --url`: `PUT /api/v1/products/:id/delivery` with `source: "url"`
- `products detach-file`: `DELETE /api/v1/products/:id/delivery`
- MCP equivalents: `list_products`, `upsert_products`, `delete_product`, `attach_product_file` (URL attach only), `remove_product_file`, `sync_products`

Caveats:

- the `<product-id>` argument is the internal Sequenzy product ID from `products list`, not the Stripe `prod_...` ID; the Stripe ID is shown as the provider product ID in list output
- uploads accept PDF, ePub, ZIP, images, audio, video, and text files up to 100MB; HTML, SVG, and executables are rejected
- after attaching, purchases of the product enrich the `saas.purchase` event with `download.url` and `download.name`, so purchase sequences can deliver the file with `{{event.download.url}}` and `{{event.download.name}}`
- to start a purchase sequence only for one product, the trigger needs a `productIds equals <stripe product id>` property filter on the `saas.purchase` event; this is configured in the dashboard sequence editor ("Only for product" picker), not through current CLI/MCP flags
- products archived in Stripe stay listed with an archived flag, and attached files survive catalog re-syncs
- the upload endpoint returns 503 when file storage is not configured on the server; fall back to `--url` in that case

## Audience Syncs (Meta Ads)

```bash
sequenzy audience-syncs list
sequenzy audience-syncs ad-accounts
sequenzy audience-syncs create --template recent-buyers --ad-account act_123 --name "Sequenzy - Recent buyers"
sequenzy audience-syncs create --segment seg_123 --ad-account act_123 --name "Sequenzy - VIPs" --frequency hourly
sequenzy audience-syncs update sync_123 --frequency weekly --active false
sequenzy audience-syncs sync sync_123
sequenzy audience-syncs delete sync_123
```

Behavior:

- syncs a segment to a Meta custom audience; requires the Meta Ads integration connected in the dashboard (Settings -> Integrations)
- `create` requires `--ad-account` (from `audience-syncs ad-accounts`) and `--name`, plus either `--segment <id>` or `--template` (`zero-ltv`, `no-purchase-1y`, `recent-buyers`, `high-spenders-ecom`, `non-buyers`, `engaged` - the segment is created automatically on first use)
- `--frequency hourly|daily|weekly` defaults to daily; `sync` triggers an immediate run
- audiences are add-only: subscribers who leave the segment stay in the Meta audience
- MCP parity: `list_audience_syncs`, `list_ad_accounts`, `create_audience_sync`, `update_audience_sync`, `delete_audience_sync`, and `sync_audience_now`

## Warehouse Sync (import from a warehouse)

```bash
sequenzy warehouse connections list
sequenzy warehouse connections create --provider snowflake --name Snowflake --account myorg-myaccount --username SEQUENZY_READER --warehouse ANALYTICS_WH --database PROD --private-key-file key.p8
sequenzy warehouse connections create --provider bigquery --name BigQuery --project-id acme-analytics --service-account-file key.json
SEQUENZY_WAREHOUSE_PASSWORD=... sequenzy warehouse connections create --provider postgres --name Analytics --host db.example.com --database analytics --username reader
sequenzy warehouse connections test conn_123
sequenzy warehouse connections preview conn_123 --query "select email, plan, updated_at from customers"
sequenzy warehouse syncs create --connection conn_123 --name Customers --query-file customers.sql --cursor-column updated_at --mapping-json '{"emailColumn":"email","attributes":[{"column":"plan","attribute":"plan"}]}'
sequenzy warehouse syncs create --connection conn_123 --name Orders --kind events --query-file orders.sql --mapping-json '{"emailColumn":"email","eventName":"order_placed","eventIdColumn":"order_id","occurredAtColumn":"placed_at"}'
sequenzy warehouse syncs run sync_123 [--full-resync]
sequenzy warehouse syncs runs sync_123
sequenzy warehouse syncs update sync_123 --enabled false
sequenzy warehouse syncs delete sync_123 --yes
```

Behavior:

- connections run a test query before saving and report the warehouse's reason on failure; credentials are encrypted and never returned; ask the user for them and prefer `SEQUENZY_WAREHOUSE_PASSWORD`, `--private-key-file` or `--service-account-file` over inline secrets; on `connections update` the variable is only read with `--password-from-env`, so a rename never rotates the password
- queries are one SELECT/WITH statement with no semicolons anywhere (use `CHR(59)` to match one in a string)
- Postgres/Redshift hosts must be publicly reachable (no private networks, tunnels or IP allowlists yet); Snowflake uses key-pair auth; BigQuery needs Job User plus Data Viewer
- preview the query first: mapping and cursor columns are checked against the query's real columns (Snowflake returns unquoted names in upper case)
- subscriber syncs import through the regular pipeline with `overwrite` semantics: mapped values replace stored ones, empty values never clear, tags are only added, unsubscribed contacts stay unsubscribed; `--lists` apply to contacts the sync creates, existing contacts keep their lists; imports run as whoever last saved the sync, so if a run says that person lost access, re-save the sync
- event syncs only record events for contacts that already exist, deduplicated by event ID (later property changes to the same ID are not applied), and events older than an hour are history that never starts automations; with a cursor, events for unknown contacts are only read again when the row changes or on `--full-resync`, so sync contacts first
- each run sends only changed rows; with `--cursor-column` it reads rows at or after the last value; `--full-resync` resends everything
- `--trigger-automations` and `--opt-in-mode double_opt_in` need `automations:trigger`, and so do query, mapping, cursor or list changes and `--full-resync` on a sync that has them on; event syncs need `events:write`; syncs need `warehouse:write` plus `subscribers:write`
- failing syncs retry with backoff and show `lastError`; check `syncs runs` for row problems and import progress instead of re-running in a loop
- MCP parity: `list_warehouse_connections`, `get_warehouse_connection`, `create_warehouse_connection`, `update_warehouse_connection`, `delete_warehouse_connection`, `test_warehouse_connection`, `preview_warehouse_query`, `list_warehouse_syncs`, `get_warehouse_sync`, `create_warehouse_sync`, `update_warehouse_sync`, `delete_warehouse_sync`, `run_warehouse_sync`, `list_warehouse_sync_runs`

## Data Exports (warehouse streaming)

```bash
sequenzy data-exports list
SEQUENZY_DATA_EXPORT_SECRET=... sequenzy data-exports create --name "Lake" --bucket acme-exports --region us-east-1 --prefix sequenzy --access-key-id AKIA...
SEQUENZY_DATA_EXPORT_SECRET=... sequenzy data-exports create --name "GCS" --provider gcs --bucket acme --access-key-id GOOG1... --datasets email_events,subscribers --backfill-days 7
sequenzy data-exports update exp_123 --enabled false
sequenzy data-exports update exp_123 --datasets email_events,sms_events --frequency hourly
sequenzy data-exports test exp_123
sequenzy data-exports run exp_123
sequenzy data-exports runs exp_123 --limit 5
sequenzy data-exports delete exp_123 --yes
```

Behavior:

- writes `email_events`, `sms_events`, `custom_events` and a daily `subscribers` snapshot as gzipped JSON lines under `<prefix>/<dataset>/date=YYYY-MM-DD/`; delivery is at least once, so consumers deduplicate on `id`
- `create` and location/credential updates write a test file first and fail with the provider's reason (missing bucket, access denied, wrong region, unknown key); nothing is saved on failure
- ask the user for bucket credentials; pass the secret through `SEQUENZY_DATA_EXPORT_SECRET` rather than the command line when possible, and never echo it back; the API only returns a masked access key ID
- `--frequency every_5_minutes|every_15_minutes|hourly|daily` (default every_15_minutes); `--backfill-days 0-30` only on create; datasets added later start from the time they are added
- failed runs retry automatically with backoff; report `lastError` and `exportedThrough` from `list`/`get` instead of re-running in a loop
- API keys need `data_exports:read` to view and `data_exports:write` plus `subscribers:read` and `analytics:read` to change; marketers cannot manage exports
- MCP parity: `list_data_exports`, `get_data_export`, `create_data_export`, `update_data_export`, `delete_data_export`, `test_data_export`, `run_data_export`, `list_data_export_runs` (create/update are not on the OpenAI-reviewed surface)

## Templates

```bash
sequenzy templates list
sequenzy templates list --label edm
sequenzy templates get tmpl_123
sequenzy templates create welcome --subject "Welcome" --label edm --html-file ./welcome.html
sequenzy templates create welcome --subject "Welcome" --blocks-file ./welcome-blocks.json
sequenzy templates from-example https://sequenzy.com/email-examples/brands/linear/emails/welcome-to-linear --brief "Mention our trial"
sequenzy templates from-example "https://sequenzy.com/email-examples/brands/linear/sequences/onboarding#email-welcome-to-linear"  # an email shown inside its sequence
sequenzy references --kind transactional --subtype password_reset
sequenzy references --kind campaign --all --search "black friday"
sequenzy brand-requests add competitor.com --note "Their onboarding emails"
sequenzy brand-requests
sequenzy watchlist add linear.app
sequenzy watchlist emails --since 2026-10-01 --limit 10
sequenzy templates update tmpl_123 --subject "Updated" --label edm --html-file ./welcome-v2.html
sequenzy templates update tmpl_123 --blocks-file ./welcome-v2-blocks.json
sequenzy templates render tmpl_123 --out preview.html
sequenzy templates localizations set tmpl_123 es --blocks-file ./welcome-es.json
sequenzy templates localizations sync tmpl_123 --locale es fr
sequenzy templates localizations sync tmpl_123 --skip-edited
sequenzy templates localizations coverage
sequenzy templates localizations translate-missing --locale fr
sequenzy templates localizations set tmpl_123 es --blocks-file ./welcome-es.json --keep-edits
sequenzy templates delete tmpl_123
```

Behavior:

- `templates list`: `GET /api/v1/templates`, optionally with `?label=...`
- `templates get`: `GET /api/v1/templates/:id`
- `templates create`: `POST /api/v1/templates`
- `templates from-example <url|brand/email>`: `POST /api/v1/templates/from-example`; remixes a public email gallery email into a new template written in the company's brand (exact layout kept, text rewritten, logo/color/links swapped, example brand never named; saved as an HTML template). Optional `--brief` and `--name`. Takes 5-20 seconds, saves nothing on failure, and each success creates another template. MCP: `create_template_from_example`
- `templates preview-example <url|brand/email> [--website <site>] [--brief] [--json]`: `POST /api/v1/templates/from-example/preview`; the same rewrite as `templates from-example`, written for your brand or another `--website`, returned without saving (`--json` includes the HTML). Requires `templates:write`.
- `brand-requests [list]`, `brand-requests add <website> [--note]`, `brand-requests remove <id>`: `GET/POST /api/v1/gallery/brand-requests`, `DELETE /api/v1/gallery/brand-requests/{id}`; asks for a brand (usually a competitor) to be added to the email gallery and shows each request's `status`: `requested`, `collecting` (added, emails being collected), `available` (in the gallery; `brand.url`, and `references` can return it) or `declined` (`declineReason`). The website is reduced to its registrable domain; asking again keeps one request (200, `created: false`; a new note replaces the old); your own website or more than 50 requests returns 400. Requires templates:read to list and templates:write to add or remove. MCP: `list_gallery_brand_requests`, `request_gallery_brand`, `remove_gallery_brand_request`
- `watchlist [list]`, `watchlist add <website> [--note]`, `watchlist remove <id>`, `watchlist emails [--brand <domain>] [--since <iso>] [--limit 1-60] [--cursor]`: `GET/POST /api/v1/gallery/watchlist`, `DELETE /api/v1/gallery/watchlist/{id}`, `GET /api/v1/gallery/watchlist/emails`; the dashboard's Competitors page. Watching a brand already in the gallery is immediate (`status: available`, with `emailCount` and `latestEmailAt`); any other brand is requested (the same row as `brand-requests`, sharing its 50 limit and its `requested`/`collecting`/`declined` states). `watchlist emails` lists the watched brands' emails newest sent first: one line each with the send time, brand, subject and a `url` that `templates from-example` accepts (`--json` adds `type`, `subtype`, `collectedAt` and `analysis`); page with `--cursor` from the printed `nextCursor`. Emails arrive a few hours after sending and `--since` matches the send time, so poll with `--since` about a day before the last check and skip ids already seen. Watching again keeps one watch (200, `created: false`). Requires templates:read to list and templates:write to add or remove. MCP: `list_watched_brands`, `watch_brand`, `unwatch_brand`, `list_watched_brand_emails`
- `references [--kind campaign|sequence|transactional] [--search <words>] [--page] [--subtype] [--limit]`: `GET /api/v1/references`; real gallery emails (and whole sequences for `sequence`) from the 12 gallery brands most like the company, ranked by what each brand sells, and to whom, against its company description (`profile: missing` and an empty list until it has a description or company context; rankings are reused up to 10 minutes); `--kind` defaults to `campaign`; `--all` (`scope=all`) browses the whole gallery for that kind, 48 per page; `--search` (`q`) matches by meaning. Each email carries an `analysis` (null until analyzed): `mainButton`, `buttonLabels`, `buttonCount`, `linkCount`, `wordCount`, `readingTimeSeconds`, `imageCount`, `hasGif`, `darkMode`, `fonts`, `columns`, `format`, `voice`, `language`, `structure` (its beats in order), `takeaways` (why it works) and `sender` (redacted name and address, or null); the human output prints the main button, length, voice and first takeaway. Each result has a URL for `templates from-example` / `sequences from-example` (requires templates:read; 503 `REFERENCES_UNAVAILABLE` means retry). MCP: `list_email_references` with `scope`, `search`, `page`, `subtype` and `limit`
- `templates update`: `PUT /api/v1/templates/:id`
- `templates render`: `GET /api/v1/templates/:id/render`; same personalization and output flags as `campaigns render` (see Campaigns)
- `templates check`: `POST /api/v1/templates/:id/check`; same checks and flags as `campaigns check` except `--variant` (see Campaigns). Transactional templates skip the unsubscribe rule
- `templates localizations set <id> <locale>` stores caller-supplied localized content immediately; the locale must be enabled in the company's localization settings and cannot be the primary locale; provide exactly one HTML or blocks content source. Add `--keep-edits` so automatic on-save translation keeps it (marked `stale` when the original changes) instead of replacing it
- `templates localizations sync <id>` queues AI translation for selected `--locale` values, or every enabled non-primary locale when omitted. It retranslates edited localizations (losing the edits) unless you pass `--skip-edited`; prefer `--skip-edited` when someone may have hand-edited a translation
- `templates localizations coverage`: `GET /api/v1/templates/localizations/coverage`; per enabled non-primary locale, how many emails that keep sending (every email step and A/B variant in sequences that are not archived, plus enabled transactional emails; marketer keys never see transactional ones) are `upToDate`, `edited`, `outdated` (still sends), `translating`, `failed` or `missing`. Campaigns are not counted. Requires `templates:read`
- `templates localizations translate-missing [--locale <locales...>]`: `POST /api/v1/templates/localizations/translate-missing`; queues AI translation for every one of those emails with no translation in a locale yet or a failed one, into the given locales or every enabled non-primary locale. Edited, up-to-date and outdated translations are left alone (use `sync` on one template to retranslate it). Repeating while translations are queued queues nothing new. Adding a language in the dashboard already does this for that language. Requires `templates:write`
- `templates delete`: `DELETE /api/v1/templates/:id`
- MCP parity: `set_template_localization` (`keepEdits` matches `--keep-edits`), `sync_template_localizations` (`skipEdited` matches `--skip-edited`), `get_template_localization_coverage` and `translate_missing_template_localizations` (`locales` matches `--locale`)

Caveats:

- list accepts `--label <labels...>` to filter by template label name
- create requires `name`, `subject`, and either `html` or `blocks`; it can also assign labels with `--label <labels...>`
- update accepts `name`, `subject`, `html`, `blocks`, and replacement labels with `--label <labels...>`
- `--blocks-json` and `--blocks-file` pass Sequenzy block arrays through directly
- conditional email content is only available through block JSON, using a block-level `condition` object
- raw HTML is still stored as a single text block by the current API path
- deletion can fail if the template is still referenced by a campaign or sequence

## Campaigns

- `campaigns from-audience [--name <name>] --selection-json <json>|--selection-file <path>` calls `POST /api/v1/campaigns/from-audience`. A selection is `{source:"contacts",contacts:{subscriberIds:[...]}}` or complete contact filters (root/filters/segmentId plus search/listId/exclusions), or `{source:"email_activity",activity:{campaignId,eventType,period,...}}`. Activity also supports sequence/node/transactional/audience sources and mailbox/bounce/machine-engagement filters. Requires campaigns:write and subscribers:read, plus analytics:read for activity. Returns a blank draft and selectedCount/eligibleCount/selectedAt; does not send. Maximum 100,000 contacts and 8 MiB. `--selection-file -` reads stdin; `--json` preserves the full response. Read with get/audience; replace or clear with update target-list options. MCP: `create_campaign_for_audience`.

```bash
sequenzy campaigns list
sequenzy campaigns list --status draft --label edm --company comp_123
sequenzy campaigns get camp_123
sequenzy campaigns create "April Launch" --prompt "Announce our new dashboard"
sequenzy campaigns create "April Launch" --subject "We shipped" --label edm --html-file ./campaign.html
sequenzy campaigns create "April Launch" --subject "We shipped" --blocks-file ./campaign-blocks.json
sequenzy campaigns create "Partner Update" --subject "We shipped" --html-file ./campaign.html --segment seg_123
sequenzy campaigns create "Partner Update" --subject "We shipped" --html-file ./campaign.html --target-lists-json '{"type":"lists","listIds":["list_123"]}'
sequenzy campaigns update camp_123 --subject "Updated subject" --label edm
sequenzy campaigns update camp_123 --blocks-file ./campaign-v2-blocks.json
sequenzy campaigns update camp_123 --reply-to support@example.com
sequenzy campaigns update camp_123 --reply-profile reply_123
sequenzy campaigns audience camp_123
sequenzy campaigns render camp_123 --out preview.html
sequenzy campaigns render camp_123 --subscriber sub_123 --out -
sequenzy campaigns check camp_123
sequenzy campaigns check camp_123 --fail-on error --json
sequenzy campaigns schedule camp_123 --at "2026-06-01T14:00:00Z"
sequenzy campaigns schedule camp_123 --at "2026-06-01T14:00:00Z" --segment seg_123
sequenzy campaigns schedule camp_123 --at "2026-06-01T14:00:00Z" --target-lists-json '{"type":"all"}'
sequenzy campaigns schedule camp_123 --at "2026-06-01T14:00:00Z" --repeat monthly
sequenzy campaigns test camp_123 --to you@example.com
sequenzy campaigns cancel camp_123
sequenzy campaigns unschedule camp_123
sequenzy campaigns pause camp_123
sequenzy campaigns resume camp_123 --spread-over-hours 6
sequenzy campaigns delete camp_123 --yes
sequenzy campaigns duplicate camp_123 --mode ab_test
sequenzy campaigns duplicate camp_123 --mode variant --variant-id var_b
sequenzy campaigns resend-to-non-openers camp_123
```

Behavior:

- `campaigns list`: `GET /api/v1/campaigns`, optionally with `?status=...` and `?label=...`; results are paginated (default page size 50, `--limit` capped at 100), page with `--offset`
- `campaigns get`: `GET /api/v1/campaigns/:id`
- `campaigns audience`: `GET /api/v1/campaigns/:id/audience`; resolves list and segment names, recomputes the recipient count at read time, and warns when targeting is unset (scheduling then sends to every active subscriber)
- `campaigns render`: `GET /api/v1/campaigns/:id/render`; renders the email exactly as it would be sent. Personalize with `--subscriber <id>` or `--email <addr>` (plus `--first-name`, `--attr`, `--attrs-json`, `--var`, `--vars-json`), force a locale with `--locale`, apply auto-UTM with `--tracking`, pick an A/B variant with `--variant`, and write with `--out <file|->`. Unresolved merge tags are listed in the summary; per-send click redirects and the open pixel are added at send time, so they never appear in a render
- `campaigns check`: `POST /api/v1/campaigns/:id/check`; read-only pre-send check of the saved content: the editor's email checker rules plus live verification of every link and image. Each link gets a status (`ok`, `broken`, `invalid`, `server_error`, `unreachable`, `restricted`, `personalized`, `not_checked`); `restricted` means the site refused an automated check and may work in a browser; `invalid` includes links a rule already proved unusable (localhost, missing https://). Issues carry `severity`, a stable `rule` (e.g. `links.broken`, `links.missing-scheme`, `content.placeholder-text`) and `blockId`. `--no-links` skips network requests; `--fail-on error|warning` exits 1 when issues reach that severity. Links in every A/B variant and translation are checked unless `--variant` or `--locale` pins one. Personalization flags match `render`. Sender settings are not checked
- `campaigns create`: `POST /api/v1/campaigns`
- `campaigns update`: `PUT /api/v1/campaigns/:id`
- `campaigns schedule`: `POST /api/v1/campaigns/:id/schedule`
- `campaigns test`: `POST /api/v1/campaigns/:id/test`
- `campaigns cancel`: `POST /api/v1/campaigns/:id/cancel`
- `campaigns unschedule`: returns a scheduled campaign (and any recurrence) to an editable draft; only scheduled campaigns can be unscheduled
- `campaigns pause`: `POST /api/v1/campaigns/:id/pause`
- `campaigns resume`: `POST /api/v1/campaigns/:id/resume`
- `campaigns delete`: `DELETE /api/v1/campaigns/:id`
- `campaigns duplicate`: `POST /api/v1/campaigns/:id/duplicate`
- `campaigns resend-to-non-openers`: `POST /api/v1/campaigns/:id/resend-to-non-openers`; available 6 hours after a sent campaign finishes, creates a draft targeting the same audience plus a "didn't open this campaign" rule, and estimates the non-opener count - review the draft, then schedule it Every audience format keeps opener exclusions that manual additions cannot override. Resending a resend also preserves exclusions from earlier campaigns. Your audience is evaluated live, so new members can qualify even if they never received the original. If an older resend draft lacks `excludedCampaignOpenerIds`, recreate it from the original campaign and review the new draft before scheduling.
- dashboard-aware responses include `url`, campaign review `previewUrl`, and `appUrls` when the company can be resolved

Caveats:

- list accepts `--status` and `--label <labels...>` filters
- create supports `name`, optional `subject` when `--prompt` is used (the generated subject is used unless `--subject` is also provided), `html`, `blocks`, `--prompt`, `--style`, `--tone`, and labels with `--label <labels...>`
- create and update also take `--preview-text` / `--preheader-text` for the inbox preview line and `--tracking-code` for a campaign UTM code
- create `--status sent` with `--sent-at` archives an already-sent campaign (for migrations); it does not send email or create per-recipient delivery history
- create can save the audience on the draft with `--segment <id>`, `--target-lists-json`, or `--target-lists-file`; `--segment` and the target list flags are mutually exclusive, and omitting all of them leaves targeting unset
- `campaigns create` and `campaigns get` print the saved audience on the `Audience` line and return it as `targetLists` with `--json`
- target list examples: `{"type":"all"}`, `{"type":"lists","listIds":["list_123"]}`, `{"type":"segment","segmentId":"seg_123"}`
- update supports `name`, `subject`, `html`, `blocks`, replacement labels with `--label <labels...>`, `--reply-to`, and `--reply-profile`
- update can replace the saved audience with `--segment` or `--target-lists-json`/`--target-lists-file`, or drop it with `--clear-target-lists` to choose at schedule time
- update takes `--campaign-data-json/-file` and `--computed-lists-json/-file` to upload personalization data for repeat blocks
- schedule requires `--at <datetime>` with a future ISO timestamp and a verified sending domain
- schedule can pass targeting with `--segment`, `--target-lists-json`, or `--target-lists-file`; omit them to reuse saved targeting or default to all active subscribers
- schedule `--repeat weekly|monthly` makes the campaign a recurring template: each run is duplicated and sent automatically, and audience membership is re-evaluated at every run; use `campaigns unschedule` to stop the series, or re-schedule without `--repeat` for a one-shot send
- `--spread-over-hours` accepts integers from 1 to 72 and takes precedence over send-time optimization (`--send-time-optimization`)
- `--max-recipients <count>` (update and schedule) sends to at most that many audience members: the first N matching subscribers by subscriber id after every audience and suppression rule; `--clear-max-recipients` removes a saved cap. Omit both on schedule to keep the draft's saved cap. Recipients already reached count against the cap on resume; duplicates keep it. `campaigns get` and `campaigns list` print `Recipient limit` when one is set
- `--attach <files...>` (create and update) attaches local files to every recipient's email, uploaded as Base64; `--attachments-json '[{"filename":"terms.pdf","path":"https://..."}]'` adds files by public URL or Base64 `content`; `--clear-attachments` (update) removes them. Up to 10 files, 5MB in total; inline images are not supported. CC/BCC copies, test sends, duplicates and recurring runs carry the same files. If a file cannot be loaded when sending starts, nothing is sent and the campaign returns to draft. `campaigns get` prints `Attachments` when there are any
- Campaign A/B recipient limits must allow one recipient per variant plus one for the winner. If scheduling rejects a saved or requested limit, raise it or explicitly clear it; the rejected request leaves the campaign and schedule unchanged.
- `--prompt` generates draft campaign content through `POST /api/v1/generate/email`; do not combine it with HTML or block flags
- `--blocks-json` and `--blocks-file` pass Sequenzy block arrays through directly
- conditional email content is only available through block JSON, using block-level `condition` rules
- `--reply-to` resolves an existing reply profile by email and `--reply-profile` sets it directly by ID
- `--reply-to` and `--reply-profile` are mutually exclusive
- `campaigns get` now includes saved reply-to details when the campaign has a reply profile
- only draft campaigns can be updated through this API path
- there is no CLI command for immediate send; schedule with a near-future `--at` timestamp instead
- `cancel` works from scheduled, sending, paused, waiting_approval, and rejected statuses; it shows no confirmation prompt so a bad send can be stopped fast
- `pause` only works on a campaign in sending status; `resume` only works on a paused campaign
- `resume --spread-over-hours` accepts integers from 1 to 72 to spread the remaining delivery
- `delete` is blocked while the campaign is sending, scheduled, or paused; cancel it first
- `duplicate --mode campaign` copies the campaign email, `--mode ab_test` also copies the A/B test with all variants, and `--mode variant` (requires `--variant-id`) copies one variant's content as a plain campaign; the copy is always a new draft
- `campaigns test` queues a real email and returns `emailSendId` and `jobId`; queue acceptance does not confirm delivery. Inspect delivery with `sequenzy email-sends get EMAIL_SEND_ID`. The sending domain must be verified.

MCP parity:

- `list_templates` and `list_campaigns` accept `label`
- `create_template`, `update_template`, `create_campaign`, and `update_campaign` accept `labels`
- `create_campaign` accepts `targetLists` (or the `segmentId` shorthand, mutually exclusive) to save the audience on the draft; `get_campaign` returns it as `targetLists`, `null` when targeting is still unset
- `update_campaign` accepts `name`, `subject`, `html`, `blocks`, `labels`, `replyTo`, and `replyProfileId`
- `schedule_campaign` accepts `campaignId`, `scheduledAt`, optional `targetLists`, `sendTimeOptimization`, `spreadOverHours`, and `maxRecipients` (omit to keep the draft's cap, `null` to clear)
- `update_campaign` also accepts `maxRecipients` (1-10,000,000, or `null`) to cap the draft; `get_campaign` and `list_campaigns` report it
- `create_campaign` and `update_campaign` accept `attachments`: up to 10 items of `filename` plus Base64 `content` (with optional `contentType`) or a public `path`; `null` or `[]` on update removes them; `get_campaign` reports them as `{ filename, path }`
- every API, CLI `--json` and MCP response lists request fields the API ignored as `ignoredFields` (`[{ path, reason }]`); a listed field had no effect, so fix its name or drop it. Human CLI output prints them as a warning
- `cancel_campaign`, `unschedule_campaign`, `pause_campaign`, `resume_campaign` (optional `spreadOverHours`), `delete_campaign`, and `duplicate_campaign` (optional `mode` and `variantId`) mirror the lifecycle commands
- `get_campaign_audience`, `render_email`, `check_email`, and `resend_campaign_to_non_openers` mirror `audience`, `render`, `check`, and `resend-to-non-openers` (`check_email` also covers sequence steps and templates; pass `links: false` for a rules-only check)
- `replyTo` and `replyProfileId` are mutually exclusive
- MCP rejects calls that omit all update fields before hitting the API
- MCP rejects unsupported extra update fields before hitting the API

## Forms

```bash
sequenzy forms list --json
sequenzy forms update form_123 --headline "Join the newsletter" --button-text "Subscribe"
sequenzy forms update form_123 --list list_123 --tag tag_456 --duplicate-strategy merge
sequenzy forms update form_123 --resubscribe-behavior double_opt_in
sequenzy forms update form_123 --bot-protection
sequenzy forms update form_123 --blocks-file ./form-blocks.json
```

Behavior:

- `forms list`: `GET /api/v1/forms`; `forms update`: `PATCH /api/v1/forms/:id`
- updates are partial: only the options you pass change; other flags cover `--name`, `--success-message`, `--redirect-url`, `--theme-json/-file`, and `--clear-tags` to empty the tag targeting
- run `forms list --json` before replacing blocks and send the complete current block array; the form must retain exactly one email field and one submit button
- a contact who unsubscribed from all email and submits a saved form or popup again is resubscribed and rejoins its lists, whatever `--duplicate-strategy` says (it only covers profile fields). `--resubscribe-behavior double_opt_in` (also on `popups create/update`, and `resubscribeBehavior` in MCP) sends the double opt-in confirmation email first instead; it returns 400 until the workspace has a confirmation email and default sender. `reactivate` is the default
- `--bot-protection` / `--no-bot-protection` (also on `popups create/update`, and `botProtection` in MCP `create_form`/`update_form`/`create_popup`/`update_popup`) runs an invisible Cloudflare Turnstile check before each signup from the hosted JavaScript embed or popup. Signups that fail it, or come from the plain HTML snippet, which cannot run it, must confirm by email before they are subscribed; turning it on returns 400 until the workspace has a double opt-in confirmation email and a default sender. Human output prints a `Bot protection:` line. Suggest it when a form receives fake or bot signups
- MCP parity: `list_forms` and `update_form`; MCP additionally has `create_form` and `get_form_embed` (embed snippet), which have no CLI command yet. Install the embed's `javascript` script (its `recommendedSnippet`) whenever the page can run scripts, static sites included: only the script carries the signed signup token and bot check. The form appears right after the script tag; when the script must load elsewhere (page head, tag manager, site-wide layout), put the returned `placeholder` div where the form should appear (one placeholder per script tag). `nativeForm` and `fetch` have weaker spam protection (bots get through, or with bot protection on every signup must confirm by email), so use them only where scripts cannot run and tell the user the returned `reducedProtectionWarning`

## Popups

```bash
sequenzy popups list --json
sequenzy popups get pop_123 --json
sequenzy popups create --name "Welcome offer" --template discount-offer --list list_123
sequenzy popups create --name "Scratch card" --template scratch-to-reveal \
  --reward-json '{"value":"10% off your first order","code":"WELCOME10"}'
sequenzy popups update pop_123 --reward-json '{"coverStyle":"holographic","coverPattern":"sparkle"}'
sequenzy popups update pop_123 --status draft
sequenzy popups duplicate pop_123 --name "Welcome offer v2"
sequenzy popups embed pop_123
sequenzy popups delete pop_123
```

Behavior:

- `popups list|get|create|update|duplicate|embed|delete` call `/api/v1/popups`; MCP parity: `list_popups`, `get_popup`, `create_popup`, `update_popup`, `duplicate_popup`, `get_popup_embed`, `delete_popup`
- popups are published on create unless `--status draft`; `--list` is optional and omitting it captures into every list
- `--trigger-json`, `--targeting-json`, `--schedule-json`, `--frequency-json`, `--visual-json`, `--reward-json` (and their `-file` variants) merge key by key; `--blocks-json/-file` replaces the complete block array, so read `popups get <id> --json` first
- `--reward-json` (MCP `reward`) turns the popup into a scratch card: visitors scratch or tap to reveal the public `teaser`, click Claim, sign up, and then see the private `value` and optional `code`. Style keys: `coverStyle` (gold, silver, rose-gold, holographic, accent, custom), `coverColor`, `coverTextColor`, `coverPattern` (sheen, sparkle, plain), `coverImageUrl` (https, host needs CORS), `prizeBackgroundColor`, `prizeTextColor`, `cardRadius` (0-32); copy keys: `heading`, `subheading`, `teaserEyebrow`, `teaser`, `claimText`, `coverText`
- the value and code never appear in the embed script; a successful signup returns them and saves them on the subscriber as the `discount` attribute, so welcome emails use `{{discount.value}}` and `{{discount.code}}` (the discount-code block uses the code by default; a create-discount step in the same sequence overrides it). A `discount` the contact already has from another source is kept
- while the reward is enabled, `value` is required, the popup cannot redirect (send `--redirect-url ""`), cannot be a `floating-bar`, and no form field may write a `discount` attribute; the CLI prints a `Reward:` line when content is included
- only put a `code` that already exists in the user's store; never invent one

## Landing Pages

```bash
sequenzy landing-pages list
sequenzy landing-pages get lp_123
sequenzy landing-pages create "Spring promo" --template default
sequenzy landing-pages create "Spring promo" --content-file ./page.json
sequenzy landing-pages update lp_123 --name "Spring promo v2" --content-file ./page-v2.json
sequenzy landing-pages publish lp_123
sequenzy landing-pages unpublish lp_123
sequenzy landing-pages duplicate lp_123 --name "Autumn promo"
sequenzy landing-pages delete lp_123
sequenzy landing-pages connect-domain pages.example.com
sequenzy landing-pages update-domain-settings --domain pages.example.com --verify
```

Behavior:

- CRUD maps to `GET/POST/PATCH/DELETE /api/v1/landing-pages[/:id]`, plus `/publish`, `/unpublish`, and `/duplicate` actions and `/api/v1/landing-pages/domain` for custom domains
- pages are created as drafts; publish only after reviewing. When `--content-json/-file` is omitted, a valid default page is generated from `--template`
- a duplicate is always a draft with its own slug, views, and conversions; without `--name` it is called "<original name> (copy)"
- custom domains require a CNAME record pointing to `pages.sequenzydns.com`
- MCP parity: `list_landing_pages`, `get_landing_page`, `create_landing_page`, `update_landing_page`, `publish_landing_page`, `unpublish_landing_page`, `duplicate_landing_page`, `delete_landing_page`, `connect_landing_page_domain`, and `update_landing_page_domain_settings`

## Sequences

```bash
sequenzy sequences list
sequenzy sequences get seq_123
sequenzy sequences create onboarding --trigger event_received --event-name signup.completed --goal "Guide new users to activation" --email-count 4
sequenzy sequences create onboarding --trigger contact_added --list-id list_123 --steps-file ./steps.json
sequenzy sequences create winback --trigger tag_added --tag-name cancelled --steps-file ./discount-steps.json
sequenzy sequences create lapsed --trigger segment_exited --segment-id seg_active_customers --goal "Win back customers who stop buying"
sequenzy sequences update seq_123 --steps-file ./sequence-updates.json
sequenzy sequences update seq_123 --branch-file ./branch.json
sequenzy sequences render seq_123 --out preview.html
sequenzy sequences test seq_123 --node-id node_email_2 --to you@example.com
sequenzy sequences enable seq_123
sequenzy sequences disable seq_123
sequenzy sequences duplicate seq_123 --name "Onboarding v2"
sequenzy sequences from-example linear/onboarding --brief "Push people to invite a teammate"
sequenzy sequences from-example linear/onboarding --steps 1,2,4
sequenzy sequences templates --category mobile_app
sequenzy sequences create-from-template mobile-trial-conversion
sequenzy sequences archive seq_123
sequenzy sequences unarchive seq_123
sequenzy sequences enrollments seq_123 --status active waiting
sequenzy sequences enrollments seq_123 --all --csv enrollments.csv
sequenzy sequences pause-enrollments seq_123
sequenzy sequences resume-enrollments seq_123
sequenzy sequences create "Black Friday countdown" --trigger manual --enrollment-mode one_time --key-dates-timezone America/New_York --key-date "Black Friday starts=2026-11-27T00:00:00" --key-date "Black Friday ends=2026-11-29T23:59:00" --steps-file ./countdown-steps.json
sequenzy sequences update seq_123 --key-dates-timezone America/New_York --key-date "Black Friday starts=2026-11-27T00:00:00"
sequenzy sequences update seq_123 --send-spread-hours 6
sequenzy sequences enroll-audience seq_123 --segment-id seg_past_buyers
sequenzy sequences enroll-audience seq_123 --all --apply --wait
sequenzy sequences enroll-audience seq_123 --list-ids list_1 --apply --schedule-at 2026-11-15T09:00:00Z --keep-enrolling
sequenzy sequences enroll-audience seq_123 --segment-id seg_past_buyers --apply --data-json '{"sale_ends_at":"2026-11-29T23:59:00Z","discount_percent":20}'
sequenzy sequences enroll-audience seq_123 --apply --audience-json '{"type":"rules","include":[],"includedSubscriberIds":["sub_1","sub_2"]}'
sequenzy sequences update seq_123 --auto-enroll-list-ids list_1
sequenzy sequences update seq_123 --clear-auto-enroll
sequenzy sequences audience-enrollments seq_123
sequenzy sequences audience-enrollment seq_123 aer_abc
sequenzy sequences cancel-audience-enrollment seq_123 aer_abc
sequenzy sequences schedule seq_123 --monthly 1,last --at 10:00 --timezone Europe/London --segment-id seg_members
sequenzy sequences schedule seq_123 --daily --at 09:30 --all
sequenzy sequences schedule seq_123 --monthly last --at 09:00 --all --until 2027-06-30T23:59:00Z --enrollment-mode one_time
sequenzy sequences schedule seq_123
sequenzy sequences unschedule seq_123
sequenzy sequences delete seq_123
sequenzy sequences enroll seq_123 --email one@example.com two@example.com
sequenzy sequences enroll seq_123 --emails-file ./vips.csv
sequenzy sequences enroll seq_123 --email one@example.com --target-node-id node_email_2
sequenzy sequences cancel-enrollments seq_123 --subscriber-id sub_123 --reason "Converted"
sequenzy sequences cancel-enrollments seq_123 --field-path order.id --field-values ord_123,ord_456
sequenzy sequences cancel-enrollments seq_123 --field-values price_123 --apply
sequenzy sequences pause-subscribers seq_123 --email ada@example.com --reason "Project blocked"
sequenzy sequences resume-subscribers seq_123 --email ada@example.com
```

Behavior:

- `sequences list`: `GET /api/v1/sequences` with `--status`, `--search`, `--label`, `--limit`, and `--offset` filters; each sequence includes `emailCount`, its number of email-sending steps (an A/B test step counts once)
- `sequences get`: `GET /api/v1/sequences/:id`; with `ab_tests:read`, `--json` includes full blocks for every sequence A/B variant at `sequence.emails[].abTest.variants[].blocks`, while the step-level subject, preview text, and blocks remain control variant A only
- `sequences create`: `POST /api/v1/sequences`. Trigger settings are top-level fields (`--trigger`, `--list-id`); step delays in `--steps-json/--steps-file` are objects such as `"delay": { "days": 2 }` or `delayMs`. Fields the API ignores (for example a nested `triggerConfig`, `delay: 2` or `delayDays`), a list ID not found in the company, and a `contact_added` trigger with no list or `listScope` still create the draft but come back as `warnings`; fix them before `sequences enable` (MCP: `create_sequence`). `sequences update` reports ignored fields and unknown lists the same way, and `sequences enable` prints readiness warnings such as a list-less `contact_added` trigger that enrolls every new contact
- `sequences update`: `PUT /api/v1/sequences/:id`
- `sequences check <id> --node <nodeId>`: `POST /api/v1/sequences/:sequenceId/nodes/:nodeId/check`; same checks and flags as `campaigns check`, plus `--variant` for A/B nodes. Run it for each email step before activating
- `sequences render`: `GET /api/v1/sequences/:sequenceId/nodes/:nodeId/render`; same personalization and output flags as `campaigns render`, plus `--variant` for A/B nodes
- `sequences test --node-id <id> --to <email>` sends only the selected saved email step; it does not enable the sequence or enroll subscribers - use `sequences get` first to find the email step nodeId (MCP: `send_sequence_test_email`)
- `sequences enable`: `POST /api/v1/sequences/:id/enable`
- `sequences disable`: `POST /api/v1/sequences/:id/disable`
- `sequences duplicate`: `POST /api/v1/sequences/:id/duplicate`; email templates, graph topology, and sequence A/B tests are copied independently (MCP: `duplicate_sequence`)
- `sequences templates [--category company|all|<websiteType>]`: `GET /api/v1/sequences/templates`; the dashboard's ready-made templates, filtered to the company category by default with templates built for it first. Mobile journeys (`mobile-trial-conversion`, `mobile-billing-recovery`, `mobile-cancellation-winback`, `mobile-paywall-abandon`, `mobile-annual-renewal-reminder`, `mobile-expiration-winback`, `mobile-lapsed-reengagement`, `mobile-new-install-onboarding`) trigger on `saas.trial_started`, `saas.payment_failed`, `saas.cancelled`, `saas.purchase.yearly`, `saas.churn`, the app-sent `paywall_viewed`, `app.screen_viewed` inactivity and `contact_added` (MCP: `list_sequence_templates`)
- `sequences create-from-template <templateId> [--name]`: `POST /api/v1/sequences/from-template`; creates a draft exactly as the dashboard does. Push-first journeys branch on `has_push_device` (an active device on a platform with APNs/FCM/web push set up, not reported as notifications denied or not yet asked): reachable contacts get push and in-app, everyone else email; waits land in 09:00-21:00 in each contact's timezone; email steps respect the frequency cap; the continue condition becomes the stop condition and an attribution goal is created. Emails are AI-written; review push and in-app copy before `sequences enable`. Calendar (key-date) templates return 400. Each success creates another sequence (MCP: `create_sequence_from_template`)
- Branch condition `has_push_device` (no extra fields) is also available in `create_sequence` / `edit_sequence_graph` branches
- `sequences from-example <url|brand/sequence>`: `POST /api/v1/sequences/from-example`; clones a public email gallery sequence into a draft with the example's trigger family (signup, `ecommerce.cart_abandoned`, `ecommerce.order_placed`, or the `inactive` tag) and send timing, up to 12 emails. AI writes each email in the company's brand in the background; check `sequences get <id>` until enrichment is complete. Optional `--brief`, `--name`, `--email-style visual|plain` and `--steps 1,2,4` (sent as `stepNumbers`: which of the example's emails to clone, by their 1-based position in the gallery sequence, 1 to 12 distinct positions; each kept email keeps its original timing from the trigger; the response's `example.stepNumbers` lists them; MCP: `stepNumbers`). The draft sends nothing until enabled, and each successful call creates another sequence; if it reports enrichment `not_queued` with a warning, open the sequence in the dashboard instead of running it again (MCP: `create_sequence_from_example`)
- `sequences preview-example <url|brand/sequence> [--website <site>] [--brief] [--json]`: `POST /api/v1/sequences/from-example/preview`; rewrites the first 3 emails of a gallery sequence for your brand or another `--website` without creating anything. Requires `sequences:write`.
- `sequences archive` / `unarchive` hide or restore a sequence without deleting it (MCP: `archive_sequence`, `unarchive_sequence`)
- `sequences enrollments`: `GET /api/v1/sequences/:id/enrollments`; defaults to active, waiting, and paused enrollments, filters by `--status`, `--node-id`, `--subscriber-id`, and `--email`, and exports with `--all --csv <file>`. `waitUntil` is when a waiting enrollment resumes. Get node IDs from `sequences get` or `stats --sequence` (MCP: `list_sequence_enrollments`)
- `sequences pause-enrollments` stops new entrants while existing active and waiting recipients keep moving (the sequence must be active; use `disable` to freeze current recipients too); `resume-enrollments` reopens entry (MCP: `pause_sequence_enrollments`, `resume_sequence_enrollments`)
- `sequences delete`: `DELETE /api/v1/sequences/:id`
- `sequences enroll`: `POST /api/v1/sequences/:id/enroll`
- `sequences cancel-enrollments`: `POST /api/v1/sequences/:id/enrollments/cancel`
- `sequences pause-subscribers`: `POST /api/v1/sequences/:id/enrollments/pause`; holds the named contacts (`--subscriber-ids`, `--email`, up to 500) on their current step with optional `--reason`. Paused contacts get no steps, keep their place and entry data, cannot be re-enrolled in the same sequence, and are still ended by unsubscribes, bounces, and `cancel-enrollments`. `in_progress` means a step was running; retry shortly (MCP: `pause_sequence_subscribers`)
- `sequences resume-subscribers`: `POST /api/v1/sequences/:id/enrollments/resume`; continues paused contacts from the same step with waits kept wall-clock based (MCP: `resume_sequence_subscribers`)
- `sequences enroll-audience`: `POST /api/v1/sequences/:id/enroll-audience` (estimate only without `--apply`; `--all`, `--list-ids`, `--segment-id`, or `--audience-json/-file`; `--wait` polls until done; `--schedule-at <iso>` starts later, cancellable before then; `--keep-enrolling` also sets `audienceAutoEnroll` so later joiners of the same audience enter until the last key date; `--data-json <json>`/`--data-file <file>` attach run-level data, a JSON object up to 8 KB that every enrolled contact keeps and the sequence's emails and conditions read as `{{enrollment.<field>}}`, returned as `data` on the run; auto-enroll syncs carry no run data). No per-call cap; skips contacts already in the sequence; one run per sequence at a time. For hand-picked contacts beyond the 500 cap of `sequences enroll`, pass `--audience-json '{"type":"rules","include":[],"includedSubscriberIds":[...]}'` (the dashboard's Subscribers selection bar starts the same run) (MCP: `enroll_sequence_audience` with `scheduledFor` and `data`)
- `sequences update --auto-enroll-all|--auto-enroll-list-ids|--auto-enroll-segment-id|--auto-enroll-json` (+ `--auto-enroll-starts-at <iso>` to hold the sync until a scheduled initial enrollment) / `--clear-auto-enroll`: `audienceAutoEnroll` on `PUT /api/v1/sequences/:id`; the sequence stays manual, a sync re-checks the audience every few minutes and ends itself after the last key date or when the trigger leaves manual (MCP: `update_sequence` `audienceAutoEnroll` / `clearAudienceAutoEnroll`)
- `sequences audience-enrollments` / `audience-enrollment <id> <runId>` / `cancel-audience-enrollment <id> <runId>`: `GET /api/v1/sequences/:id/audience-enrollments`, `GET .../audience-enrollments/:runId` and `POST .../audience-enrollments/:runId/cancel` (MCP: `list_sequence_audience_enrollments`, `get_sequence_audience_enrollment`, `cancel_sequence_audience_enrollment`). Runs report `includedSubscriberCount` for hand-picked contacts; the API and CLI JSON return the full `audience.includedSubscriberIds`, while MCP returns only the first 20 with `includedSubscriberIdsTruncated: true`
- `sequences schedule <id>` / `unschedule <id>`: `GET`, `PUT` and `DELETE /api/v1/sequences/:id/recurring-enrollment` (MCP: `get_sequence_recurring_enrollment`, `set_sequence_recurring_enrollment` with flat `frequency`/`weekdays`/`time`/`timezone` fields, numeric `monthDays` plus `lastDayOfMonth: true` instead of `last`, and `remove: true` to delete). Makes a manual-trigger sequence recurring for sends not tied to an event (end-of-month updates, balance reminders, daily digests): `--daily`, `--weekly mon,fri` (or 0-6, 0 = Sunday), or `--monthly 1,15,last` (`last` is the last day; days past a short month's end run on its last day), with `--at HH:MM`, `--timezone <IANA>` (default: the machine's zone; runs follow daylight saving) and an audience (`--all`, `--list-ids`, `--segment-id`, `--audience-json/-file`), re-evaluated at every run. Without a frequency it shows the schedule, `upcomingRuns` and the last run or skip. Each run is an audience enrollment run with source `recurring`: contacts who finished an earlier run enter again, contacts still in the sequence are skipped, `one_time` sequences never re-enroll anyone. Nothing enrolls until the first scheduled time; occurrences while the sequence is paused, disabled or closed are skipped, and a run that cannot start within 6 hours is skipped. Needs `--trigger manual` and no `audienceAutoEnroll`; changing the trigger away from manual switches it off. `--disable` saves it switched off. `--until <iso>` stops runs after a date (saving replaces the schedule, so omit it for no end date; `nextRunAt` becomes null once nothing is left). `--enrollment-mode unlimited|one_time` sets who enters each run (everyone who matches, or only people who never entered) by changing the sequence's enrollment mode, which also applies to enrollments started by hand (MCP: `endsAt`, `enrollmentMode`). Requires `sequences:write`
- dashboard-aware responses include `url` on sequence records and `appUrls` on the top-level JSON when the company can be resolved

Goals and inbound webhooks:

- `sequences goals list|create|update|delete` manage conversion goals on `/api/v1/sequences/:id/goals[/:goalId]`; `create <sequenceId> <name>` and `update` accept `--active`/`--inactive` (MCP: `list_sequence_goals`, `create_sequence_goal`, `update_sequence_goal`, `delete_sequence_goal`)
- `sequences webhook get|configure|rotate <sequenceId>` manage the sequence's inbound trigger webhook; `configure` accepts `--field-mapping-json/-file` and `--sample-payload-json/-file` (with `--clear-*` variants), and `rotate` replaces the signing secret (MCP: `get_sequence_inbound_webhook`, `configure_sequence_inbound_webhook`, `rotate_sequence_inbound_webhook_secret`)

Caveats:

- CLI sequence creation supports either AI `--goal` mode or explicit `--steps-json` / `--steps-file` mode
- explicit create steps can include `{ "type": "create_discount" }`; emails after that action can reference `{{discount.code}}`, `{{discount.percentOff}}`, and related `discount.*` merge tags
- discount action sequences require a connected Stripe integration before activation
- `--email-count` is only meaningful with `--goal`
- `--email-count` accepts 1 to 10 generated emails
- trigger-specific options depend on `--trigger`
- updates accept either step payloads or email payloads via `--steps-*` or `--emails-*`, not both; entries can target a step by `nodeId`, `emailId`, or array order
- `--insert-steps-json/-file` adds new linear steps (including outbound webhook and SMS steps); `--node-updates-json/-file` and `--graph-edit-json/-file` edit and rewire existing nodes (MCP: `insert_sequence_step`, `update_sequence_node`, `update_sequence_nodes`, `edit_sequence_graph`)
- Sequences as code: `sequenzy sequences pull <key> --dir sequences` (or `--all`, or `--id seq_123 --key onboarding` to adopt an unkeyed sequence) writes one YAML/JSON definition per sequence in the readable format: `trigger: { event: user.signed_up }` and `steps` in run order (`wait: 2d`, `email: { subject, html | blocks | template: <email id> }`, `branch: [{ if: { tag: trial }, steps: [...] }]` with `else: [...]`, `split` with `percent`, `continueIf`, `tag`, `untag`, `end: true`), where nested paths rejoin at the next step and the end is implicit (`--raw` returns the explicit steps-plus-connections format; a template is copied into the step on every push, so later template edits show in the dry run); `sequenzy sequences new <key>` writes a starter file; `sequenzy sequences push sequences --dry-run` shows the changes and `sequenzy sequences push sequences` applies them (MCP: `get_sequence_definition`, `push_sequence_definition`; API: `GET`/`PUT /api/v1/sequences/definitions/{key}`, `GET /api/v1/sequences/{sequenceId}/definition`). Steps are matched by key; missing steps are removed and their waiting contacts continue to the next step. A push never changes status; active sequences need `--confirm-live-change`. Pushed sequences are `managedBy: code` and read-only in the dashboard except on/off, pause and test sends; A/B test steps pass through unchanged; webhook header values stay `[REDACTED]`.
- SMS steps use `{"type":"sms","text":"..."}` (optional `label`, `ineligibleAction skip|exit`, `imageUrls`); edit existing ones with `--sms-steps-json/-file`. Update Subscriber steps use `type="update_subscriber"` with attribute updates like `{{event.plan}}`; edit with `--subscriber-update-steps-json/-file`
- inserting steps or branches into an active sequence requires `--confirm-structural-change`
- `--stop-condition-json/-file` sets the sequence stop condition (e.g. `{"type":"has_tag","value":"customer"}`; `{"type":"none","value":null}` clears it). Stop conditions are re-evaluated before every step including the first, so `does_not_have_tag` / `removed_from_list` act as an allowlist: guarded-out contacts still enroll and are cancelled at the trigger node. Clearing the guard does not retry contacts it already cancelled - re-enroll them with `sequences enroll`, which skips the `one_time` check
- create and update share trigger flags (`--trigger`, `--list-id`, `--tag-name`, `--segment-id`, `--event-name`, `--integration-slug`/`--integration-event-key`, `--inactive-days`, `--min-count`/`--time-window-days`) plus `--property-filters-json/-file` to only start when event properties match (e.g. scope a purchase sequence to one product)
- `--enrollment-mode matching_field` with `--enrollment-field-path` (e.g. `order.id`, `product.providerVariantId`) enables product- or variant-specific event sequences; Shopify replenishment and back-in-stock sequences default to it
- sender identity is set per sequence with `--from-email`/`--from-name`/`--sender-profile-id` and `--reply-to`/`--reply-to-name`/`--reply-profile-id`; `--bcc-emails` blind-copies team inboxes on every sequence email (`--clear-bcc-emails` removes)
- `--sending-window-start/-end/-timezone` hold every email step until the allowed local send window; add `--sending-window-days weekdays` for working days only and `--clear-sending-window` to remove it
- `--trigger segment_exited --segment-id <id>` enrolls active contacts who stop matching a saved segment from activation onward; unsubscribing or bouncing does not count as leaving, and nobody is enrolled when the sequence is turned on. Add an `entered_segment` stop condition for the same segment to stop the run if they come back
- `--respect-frequency-cap` (create or update) makes the sequence respect the company frequency cap: an email step is skipped for a contact who already got the cap's number of campaign or marketing sequence emails in its window, and the contact continues to the next step. `--ignore-frequency-cap` turns it off (the default). Earlier emails from the same enrollment count; transactional emails never count, and transactional steps are never skipped. Nothing is skipped until a company cap is set with `sequenzy frequency-cap set`. API/MCP field: `frequencyCapEnabled`. Leave it off for time-sensitive flows such as cart recovery
- `--active-subscribers-only` (create or update) keeps unsubscribed and bounced contacts out of the sequence. By default they still enter on tag, event, list and contact triggers so non-marketing steps (tags, webhooks, transactional emails) run for them, and only their marketing emails are skipped. `--include-suppressed-subscribers` restores that default. Pending double opt-in contacts still wait at the trigger. API/MCP field: `activeSubscribersOnly`
- `--trigger manual` never enrolls anyone automatically; use it for one-time countdowns (Black Friday, launches), or add `sequences schedule` to re-enroll an audience daily, weekly or monthly. Set key dates with repeated `--key-date "Label=2026-11-27T00:00:00"` plus `--key-dates-timezone`, or `--key-dates-json/-file` (`{"timezone":"...","dates":[{"label":"...","at":"..."}]}`); keys are slugs of the labels (`black_friday_starts`); zone-less times are read in the key-dates timezone. Steps then wait with `"waitUntilKeyDate":{"key":"black_friday_starts","days":7}` (`direction` before/after, `pastAction` skip/continue/exit, default skip so late enrollees only get what is still ahead). Changing key dates on a live sequence re-times waiting contacts; removing a key date (or `--clear-key-dates`) is rejected while a step still waits for it. Sends are spread out: each contact gets their own time within 4 hours (after a moment, or leading up to a step timed before one); change it with `--send-spread-hours` (0 is exact) or `keyDates.sendWindow`. Write deadline emails with the end time ("ends tonight at 11:59 PM"), never "1 hour left". After `enable`, run `sequences enroll-audience` (MCP: `keyDates`, `waitUntilKeyDate`, `enroll_sequence_audience`)
- per-contact date timelines (due dates, renewals, anniversaries): steps wait with `"waitUntil":{"field":"dueDate","source":"attribute","days":140,"direction":"before","pastAction":"skip"}`. `source` is `event` (default, trigger event properties) or `attribute` (the contact's custom attributes, any trigger, read when the step is reached). `pastAction` defaults to `continue` (move on right away when the date already passed); use `skip` on each wait so late joiners only get what is still ahead, and `continue` on a final wait everyone should reach. Store dates as ISO strings (`2027-02-15`) or Unix timestamps
- contact-local send times (9am for one email, 1pm for the next, each in the contact's own timezone): put a delay step before each email with `"waitUntilWeekday":{"days":["monday","tuesday","wednesday","thursday","friday","saturday","sunday"],"startTime":"09:00","endTime":"09:30","timezone":"Europe/Amsterdam","timezoneSource":"subscriber"}`. `timezoneSource` `subscriber` reads the contact's `timezone` field and uses `timezone` as the fallback for contacts without one; the default `fixed` uses `timezone` for everyone. Contacts already inside the window continue immediately. To send N days later at a set local time, add `"minimumWait":{"days":6}` to the same `waitUntilWeekday` instead of a separate fixed delay step: the contact waits at least that long, then continues at the next window. A sequence `--sending-window-*` window is always one fixed timezone
- `--pause-new-enrollments` / `--resume-new-enrollments` toggle entry from within `update`; `--label`/`--clear-labels` and `--user-cancellable`/`--not-user-cancellable` round out the metadata flags
- branch insertion uses `--branch-json` or `--branch-file` with condition types `has_tag`, `does_not_have_tag`, `in_list`, `in_segment`, `event_received`, `link_clicked`, and `field_*`; branch paths may set `targetNodeId`/`elseTargetNodeId` to wire directly to existing nodes, including the completion node
- branch condition fields are `tagId`/`tagName`, `listId`, `segmentId`/`segmentName`, `eventName`, `linkUrl`, `activityScope`, or `fieldName`/`fieldValue`; omit `linkUrl` to match any clicked link
- for `event_received` and `link_clicked`, set `activityScope` to `this_sequence`, `previous_email`, or `ever`; omitting it checks the contact's full history
- `enroll` takes exactly one email source: repeated `--email`, `--emails-json`, or `--emails-file`, with the same file formats as `lists add-subscribers` and the same 500-email batching
- `enroll` only enrolls active subscribers; unknown emails are reported as `notFound`, and inactive or already-enrolled subscribers count as `skipped`
- `enroll` requires the sequence to be accepting entrants (enabled and not paused for enrollment)
- `enroll` starts subscribers at the first step after the trigger unless `--target-node-id` points at a specific non-trigger node; the result reports `enrolled`, `skipped`, `notFound`, `targetNodeId`, and `scheduledFor`
- MCP uses `enroll_subscribers_in_sequence` with `emails` (max 500 per call) and optional `targetNodeId`
- `cancel-enrollments` requires a sequence ID and exactly one target: `--all`, `--subscriber-id`, `--subscriber-ids`, or `--field-values`; use `--all` to fully stop a live sequence when enrollments came from a segment and share no entry field value
- `--field-values` matches active/waiting enrollments by the stored entry event property at `--field-path`, or the sequence's configured `enrollmentFieldPath` when `--field-path` is omitted
- CLI cancellation is a dry run unless `--apply` is passed; use dry runs for field-value/bulk checks before mutating enrollments
- MCP uses `cancel_sequence_enrollments` with the same target rule; set `dryRun: false` to apply field-value cancellation

## A/B Tests

```bash
sequenzy ab-tests list
sequenzy ab-tests list --sequence seq_123
sequenzy ab-tests get ab_123
sequenzy ab-tests stats ab_123 --period 7d
sequenzy ab-tests stats ab_123 --start "2026-05-01T00:00:00Z" --end "2026-05-31T00:00:00Z"
sequenzy ab-tests restart ab_123 --source-variant var_b --test-type content --variant-count 3
sequenzy ab-tests update ab_123 --test-percentage 30 --winner-criteria click_rate
sequenzy ab-tests update ab_123 --winner-criteria goal_value --winner-goal default-revenue
sequenzy ab-tests update ab_123 --winner-criteria event_rate --winner-event trial.converted
sequenzy ab-tests update-variant ab_123 var_b --subject "New subject"
sequenzy ab-tests update-variant ab_123 var_b --blocks-file ./variant-b.json
sequenzy ab-tests create camp_123 --test-percentage 30 --duration-minutes 120 --winner-criteria click_rate
sequenzy ab-tests create camp_123 --variants-json '[{"subject":"Alternative subject"}]'
sequenzy ab-tests add-variant ab_123 --subject "Alternative subject" --blocks-file ./variant.json
sequenzy ab-tests delete-variant ab_123 var_b --yes
sequenzy ab-tests delete ab_123 --yes
```

Behavior:

- `ab-tests list`: `GET /api/v1/ab-tests`, optionally with `?sequenceId=...` via `--sequence`
- `ab-tests get`: `GET /api/v1/ab-tests/:id`
- `ab-tests update`: `PATCH /api/v1/ab-tests/:id` with `--name`, `--test-percentage`, `--duration-minutes`, `--winner-criteria`, `--test-type`, and `--winner-threshold`; campaign tests use percentage/duration, sequence tests use `--test-type` and `--winner-threshold`; add `--confirm-live-change` when the settings affect an active test or a test with recorded activity (MCP: `update_ab_test`)
- `ab-tests stats`: `GET /api/v1/ab-tests/:id/stats`; bot opens/clicks are excluded by default, pass `--include-bots` for raw engagement. The response includes `significance` for the winner metric (`status` `insufficient_data`, `not_significant`, or `significant` at 95% confidence, plus `leaderVariantLabel`, `confidence`, `pValue`, and `relativeLift`), and the human output prints a Significance line. Once a winner is selected, significance compares only the test-phase sends and ignores the period. Report a `not_significant` leader as ahead, not as a proven winner; automatic winner selection does not wait for significance (MCP: `get_ab_test_stats`)
- `ab-tests restart`: `POST /api/v1/ab-tests/:id/restart`
- `ab-tests update-variant`: `PATCH /api/v1/ab-tests/:id/variants/:variantId`
- `ab-tests create`: `POST /api/v1/ab-tests`
- `ab-tests add-variant`: `POST /api/v1/ab-tests/:id/variants`
- `ab-tests delete-variant`: `DELETE /api/v1/ab-tests/:id/variants/:variantId`
- `ab-tests delete`: `DELETE /api/v1/ab-tests/:id`

Caveats:

- for a sequence A/B step, discover variant IDs and audit copy with `sequences get <sequenceId> --json`; use `ab-tests get` when you also need test settings, localization, or stats
- `stats` uses `--period` (`1h`, `24h`, `7d`, `30d`, `90d`) or both `--start` and `--end`; custom ranges max at 90 days
- `restart` only applies to sequence A/B tests with a selected winner; options are `--source-variant`, `--test-type subject|content`, `--winner-threshold` (10-1000), and `--variant-count` (2-4 including control)
- `update-variant` accepts `--subject`, `--preview-text`, and either HTML or blocks flags, not both; campaign variants are editable only in draft, while sequence variants remain editable and require `--confirm-live-change` once the parent sequence is active or the test has activity
- `create` targets a campaign: the campaign must be in draft or rejected status and must not already have an A/B test
- `create` builds variant A automatically as the control from the campaign's email; extra variants from `--variants-json`/`--variants-file` use `{subject, previewText?, blocks?}` objects
- `create` accepts `--name`, `--test-percentage` (5-50, default 20), `--duration-minutes` (15-1440, default 240), and `--winner-criteria open_rate|click_rate|goal_conversion_rate|goal_value|event_rate` (default open_rate)
- `--winner-criteria goal_conversion_rate|goal_value` needs `--winner-goal <goalId|default-revenue>` and judges variants by goal conversions attributed to each variant (an open or click within the goal's window; for campaigns, revenue and campaign goals also credit a recipient who received the email in that window); `goal_value` with `default-revenue` picks the variant that made the most money per delivered email. `--winner-criteria event_rate` needs `--winner-event <name>` and judges by recipients who fire it after receiving the variant. When no variant converts, campaign tests fall back to click rate and sequence tests keep splitting; criteria, goal and event lock once a campaign test starts. `ab-tests stats --json` reports per-variant `outcome`. MCP: `winnerGoalId`/`winnerEventName` on `create_ab_test`/`update_ab_test`
- `add-variant` requires `--subject` and only works while the test is in draft status; when a sequence test's parent sequence is active, add `--confirm-live-change`
- `delete-variant` cannot remove variant A (the protected control) and must leave at least 2 variants; a test holds at most 5 variants; when a sequence test's parent sequence is active, add `--confirm-live-change`
- `delete` is blocked for running tests, and the linked campaign must be draft or rejected
- `create`, `add-variant`, and `delete-variant` support campaign and sequence A/B tests (`create --automation-node` converts a sequence email node and needs `--confirm-live-change` on active sequences); `delete` supports campaign A/B tests only
- MCP parity: `list_ab_tests`, `get_ab_test`, `get_ab_test_stats`, `restart_ab_test`, `update_ab_test_variant`, `create_ab_test`, `add_ab_test_variant`, `delete_ab_test_variant`, and `delete_ab_test`. `update_sequence`, `update_sequence_node`, and `update_template` cannot edit sequence variant copy. If `update_ab_test_variant` is missing from the tool list, enable it on the Sequenzy connector instead of writing through another email tool. The **Safer agent access** preset includes the required `ab_tests:read`, `ab_tests:write`, and `sequences:write` scopes

## AI Generation

```bash
sequenzy generate email "Welcome a new user to our analytics product"
sequenzy generate email "Product launch announcement" --style branded --tone friendly
sequenzy generate sequence "Onboard a new workspace admin" --count 4 --days 14
sequenzy generate subjects "April product launch" --count 8
sequenzy generate sms "Flash sale reminder" --count 3
```

Behavior:

- `generate email`: `POST /api/v1/generate/email`
- `generate sequence`: `POST /api/v1/generate/sequence`
- `generate subjects`: `POST /api/v1/generate/subjects`
- `generate sms`: `POST /api/v1/generate/sms`; drafts SMS copy for `type: "sms"` sequence steps and test sends
- `--json` returns the raw API response for agent/tool parsing

Caveats:

- generated content is draft content and should be reviewed before sending
- `generate sequence --count` accepts 1 to 10 emails
- `generate email` supports optional `--style` and `--tone`
- MCP parity: `generate_email`, `generate_sequence`, `generate_subject_lines`, and `generate_sms`

## Team

```bash
sequenzy team list
sequenzy team invite teammate@example.com --role admin
sequenzy team invite marketer@example.com --role marketer
sequenzy team invite finance@example.com --role viewer --billing-access
sequenzy team cancel-invitation inv_123 --yes
```

Behavior:

- `team list`: `GET /api/v1/team`; returns the owner, members, and pending or expired invitations
- `team invite`: `POST /api/v1/team/invitations` with `{ email, role, canManageBilling? }`
- `team cancel-invitation`: `DELETE /api/v1/team/invitations/:invitationId`

Caveats:

- `--role` must be `admin`, `marketer`, `viewer`, or `restricted`. `marketer` can edit and send marketing but cannot manage workspace settings, transactional mail, team, or billing; `restricted` is for explicitly shared direct links. Do not combine `marketer` or `restricted` with `--billing-access`
- inviting and cancelling invitations requires owner or admin access; `--billing-access` can only be granted by the company owner
- existing Sequenzy users are added to the team immediately; new emails receive an invitation that expires after 14 days
- run `team list` first to find invitation IDs before cancelling
- `cancel-invitation` prompts for confirmation; pass `--yes` to skip
- MCP parity: `list_team_members`, `invite_team_member`, and `cancel_team_invitation`

## Inbox

```bash
sequenzy inbox address
sequenzy inbox address --local-part support --domain support.acme.com
sequenzy inbox address --reset
sequenzy inbox list --status open --unread
sequenzy inbox list --search "refund" --page 2 --limit 50
sequenzy inbox list --spam
sequenzy inbox list --sent-to admin@acme.com
sequenzy inbox recipients
sequenzy inbox spam conv_123 conv_456
sequenzy inbox not-spam conv_123
sequenzy inbox get conv_123
sequenzy inbox reply conv_123 --text "Thanks for reaching out!"
sequenzy inbox reply conv_123 --html-file ./reply.html --subject "Re: your question"
sequenzy inbox reply conv_123 --text "Happy to help" --sender-profile-id sp_123
sequenzy inbox reply conv_123 --text "Customer asked for a refund" --note
sequenzy inbox reply conv_123 --text "Invoice attached" --attach ./invoice.pdf
sequenzy inbox forward conv_123 msg_456 --to sales@example.com
sequenzy inbox close conv_123
sequenzy inbox close conv_123 conv_456 conv_789
sequenzy inbox reopen conv_123
sequenzy inbox mark-read conv_123
sequenzy inbox mark-unread conv_123
```

Behavior:

- `inbox address`: `GET /api/v1/conversations/inbox-address`; prints the inbox address (`inbox+{companyId}@inbound.sequenzy.com`, plus custom-domain variants), whether receiving is on, and retention days; `--json` also returns `attachmentsAvailable`
- `inbox address --local-part <name> --domain <domain>` / `--reset`: `PUT /api/v1/conversations/inbox-address` with `{ localPart, domain }` (both null to reset; requires `companies:manage`); the branded address is `<name>@<domain>` on one of your receiving domains (see Receiving Domains); any other address on that domain also lands in the inbox, the address starts receiving once the receiving domain verifies (`customAddress.status` `pending` → `active`), and changing or resetting an active one stops the old address immediately
- `inbox list`: `GET /api/v1/conversations` with optional `status` (`open`, `closed`, `all`), `search`, `unread`, `spam` (`--spam`: list the Spam folder; other lists leave spam out), `recipient` (`--sent-to <address>`: conversations that started at that inbox address), `page`, and `limit` (1-100, default 20) query parameters; each conversation includes `lastMessagePreview` (latest subscriber or team reply, notes excluded, or `null`), shown as `Last reply:` in human output
- `inbox get`: `GET /api/v1/conversations/:conversationId`; returns the conversation with its full message history, including message IDs and attachments with a signed `downloadUrl` (valid one hour) for stored files
- `inbox reply`: `POST /api/v1/conversations/:conversationId/messages`; `--attach <file>` (repeatable, up to 10 files, 15 MB total) sends base64 `attachments`
- `inbox forward <conversationId> <messageId> --to <email>`: `POST /api/v1/conversations/:conversationId/messages/:messageId/forward`; emails a copy of one received or sent message with its attachments, recorded as a `system` message; optional `--sender-profile-id`
- `inbox mark-unread`: `POST /api/v1/conversations/:conversationId/unread`
- `inbox close` and `inbox reopen`: with one ID, `POST /api/v1/conversations/:conversationId/status` with `{ status: "closed" | "open" }`; with 2-100 IDs, `POST /api/v1/conversations/bulk/status` with `{ conversationIds, status }`, printing updated, already-in-status and not-found counts (exit status 1 when any ID is not found; `--json` prints `updatedIds`, `unchangedIds` and `notFoundIds`)
- `inbox mark-read`: `POST /api/v1/conversations/:conversationId/read`; reports how many messages were marked read
- `inbox spam <ids...>` / `inbox not-spam <ids...>`: `POST /api/v1/conversations/bulk/spam` with `{ conversationIds, spam }` (up to 100 IDs; `conversations:write`); prints moved, already-there and not-found counts (exit status 1 when any ID is not found). Flagged mail to inbox addresses already lands in Spam on its own
- `inbox recipients`: `GET /api/v1/conversations/recipients`; lists the inbox addresses conversations started at, for `--sent-to`

Caveats:

- the inbox collects replies to campaigns, sequences, and transactional email, plus any email sent to the inbox address (`context.type` `inbox`); inbox address email does not fire `email.replied` webhooks or automations and is not auto-forwarded
- receiving must be on (`replyTrackingEnabled` on the company, or Settings > Inbox) for any email to arrive; turning it on returns `409 receiving_domain_required` when the workspace has no verified receiving domain and has never received a conversation, and a receiving domain's first verification turns it on by itself
- mail the inbound spam or virus scan flags goes to the Spam folder (`spam: true` on the conversation) instead of being dropped; it is not linked to a subscriber or threaded, and `inbox list` only shows it with `--spam`. Each conversation started at an inbox address has `recipientAddress`
- attachments need server attachment storage (`attachmentsAvailable`); received email and attachments are kept at least 90 days
- each forward request sends a new copy; do not retry a successful forward, and confirm the recipient with the user before forwarding
- `reply` requires a body from `--text` and/or `--html-file`
- `--note` adds an internal note instead of emailing the subscriber
- `--sender-profile-id` sends the reply from that sender profile (verified domain required; not allowed with `--note`); without it the reply is sent from the API key owner's email address. Find IDs with `sequenzy sender-profiles list`; MCP uses `senderProfileId` on `reply_to_conversation`
- outbound replies are sent asynchronously by a worker, so the message starts in `pending` delivery status; they also reopen closed conversations
- MCP parity: `get_inbox_address`, `update_inbox_address`, `list_conversations`, `get_conversation`, `reply_to_conversation` (with base64 `attachments`), `forward_conversation_message`, `update_conversation_status`, `bulk_update_conversation_status`, `bulk_update_conversation_spam`, `list_conversation_recipients`, `mark_conversation_read`, and `mark_conversation_unread`
- when a conversation has a `recipientAddress` ("Sent to"), check `sender-profiles list` and reply with `--sender-profile-id` from the profile whose email equals that address, if one exists

## Webhooks

```bash
sequenzy webhooks list
sequenzy webhooks create --name CI --url https://example.com/hook --event email.bounced subscriber.unsubscribed
sequenzy webhooks create --name "All events" --url https://example.com/hook
sequenzy webhooks update wh_123 --url https://example.com/new-hook
sequenzy webhooks update wh_123 --event email.bounced email.complained
sequenzy webhooks update wh_123 --disable
sequenzy webhooks delete wh_123 --yes
sequenzy webhooks test wh_123
sequenzy webhooks deliveries wh_123 --limit 50
sequenzy webhooks replay wh_123 del_456
```

Behavior:

- `webhooks list`: `GET /api/v1/webhooks`
- `webhooks create`: `POST /api/v1/webhooks` with `{ name, url, events? }`
- `webhooks update`: `PATCH /api/v1/webhooks/:id` with at least one of `--name`, `--url`, `--event`, `--enable`, or `--disable`
- `webhooks delete`: `DELETE /api/v1/webhooks/:id`; this permanently deletes the endpoint and its delivery history
- `webhooks test`: `POST /api/v1/webhooks/:id/test`
- `webhooks deliveries`: `GET /api/v1/webhooks/:id/deliveries`, optionally with `?limit=` (1-100)
- `webhooks replay`: `POST /api/v1/webhooks/:id/deliveries/:deliveryId/replay`

Caveats:

- valid event types are `email.sent`, `email.delivered`, `email.delivery_delayed`, `email.bounced`, `email.failed`, `email.complained`, `email.opened`, `email.clicked`, `email.replied`, `email.received`, `email.unsubscribed`, `campaign.sent`, `sms.sent`, `sms.delivered`, `sms.failed`, `sms.opted_out`, `subscriber.invalid`, `subscriber.created`, `subscriber.updated`, `subscriber.unsubscribed`, `subscriber.list_subscribed`, `subscriber.list_unsubscribed`, `subscriber_import.completed`, `sequence.finished`, `sequence.failed`, and `poll.answered`; omit `--event` to use the default set
- `email.received` is opt-in (not in the default set): new mail to your inbox addresses and receiving domains, not replies to your emails (those are `email.replied`); it is not sent for mail the inbound scan flags as spam or a virus
- `create` returns a signing secret exactly once and it cannot be retrieved later; handle it as sensitive output. Do not paste credential material into chat, logs, tickets, or public transcripts. Save it only to a user-approved secure destination such as a password manager, secret store, encrypted file, or local `.env` file outside version control, then report the storage location and a short fingerprint.
- `--enable` and `--disable` are mutually exclusive; changing the URL or re-enabling resets the failure circuit breaker
- Sequenzy disables an endpoint automatically after every delivery fails for 7 days (`list` shows "Disabled automatically", the API returns `autoDisabledAt`) and emails the workspace owner; once the receiver returns 2xx, re-enable it with `--enable`
- the webhook must be enabled to receive a test event
- run `webhooks deliveries <id>` first to find delivery IDs before replaying
- `delete` prompts for confirmation; pass `--yes` to skip
- MCP parity: `list_webhooks`, `create_webhook`, `update_webhook`, `delete_webhook`, `test_webhook`, `list_webhook_deliveries`, and `replay_webhook_delivery`

## Geofences

```bash
sequenzy geofences list --group stores
sequenzy geofences create --name "Soho store" --lat 51.5136 --lng -0.1365 --radius 200 --dwell 600 --group stores --external-id store-0042
sequenzy geofences update geo_123 --radius 300 --clear-dwell
sequenzy geofences update geo_123 --pause
sequenzy geofences delete geo_123 --yes
sequenzy geofences import stores.csv
```

Behavior:

- `geofences list`: `GET /api/v1/geofences`, with `--group`, `--active true|false`, `--limit` (1-500) and `--cursor` from the previous page
- `geofences get`: `GET /api/v1/geofences/:id`
- `geofences create`: `POST /api/v1/geofences`; `--name`, `--lat`, `--lng` and `--radius` are required
- `geofences update`: `PATCH /api/v1/geofences/:id` with at least one field flag; `--clear-dwell`, `--clear-group` and `--clear-external-id` send `null`; `--pause` and `--resume` set `active`
- `geofences delete`: `DELETE /api/v1/geofences/:id`; past visits stay in contact history
- `geofences import`: reads a CSV (headers name, latitude, longitude, radius, dwell, cooldown, group, external_id, active) or a GeoJSON of Point features and sends `POST /api/v1/geofences/import` in batches of 1,000, upserting by external ID

Caveats:

- signed-in app users entering, leaving or staying in a geofence record `app.geofence_entered`, `app.geofence_exited` and `app.geofence_dwelled` with `geofenceId`, `geofenceName`, `geofenceGroup` and `geofenceExternalId`; events carry no coordinates
- radius 100-10,000 m (200+ recommended), dwell 60-14,400 s (Sequenzy computes dwell, not the phone), cooldown 300-604,800 s (default 3,600), at most 10,000 geofences per workspace and 100 transitions per contact per day
- trigger a sequence on a visit with an event trigger on a geofence event plus a property filter (`geofenceGroup equals stores` or `geofenceId one_of [...]`)
- segment with the `geofence` filter field: value `transition:target:timeRange` (or `transition:target:count:timeRange` for at_least/less_than_count), transition `entered|exited|dwelled`, target `any`, `group=<group>` or `id=<id>[,<id>...]`, e.g. `entered:group=stores:30d`
- every import row needs an external ID; rows without one, or with invalid fields, are skipped and listed with their row number
- scopes: `geofences:read`, `geofences:write`, `geofences:delete`
- MCP parity: `list_geofences`, `get_geofence`, `create_geofence`, `update_geofence`, `delete_geofence`, and `import_geofences` (standard MCP only; not on the ChatGPT or Muse connectors)

## API Keys

```bash
sequenzy api-keys create
sequenzy api-keys create --name "CI deploy key" --company comp_123
sequenzy api-keys create --preset transactional_sender --name "Order emails"
sequenzy api-keys create --scopes "subscribers:read,subscribers:write,events:write"
sequenzy api-keys list
sequenzy api-keys revoke key_123 --yes
```

Behavior:

- `create` sends `POST /api/v1/api-keys`; keys default to full access, restrict with `--preset` (`full_access`, `read_only`, `agent_safe`, `ai_drafting`, `data_ingest_safe`, `data_ingest_automations`, `transactional_sender`, `marketing_sender`) or explicit comma-separated `--scopes` (overrides `--preset`)
- `list` returns metadata only (ID, name, prefix, current-key marker); secrets and stored hashes are never returned
- `revoke` cannot be undone; run `api-keys list` first and verify the exact ID and prefix (`api-keys delete` is a compatibility alias for revoke)
- MCP parity: `create_api_key`, `list_api_keys`, `revoke_api_key`, and `delete_api_key`

Caveat:

- newly created API credential material is returned only at creation time; handle it as sensitive output. Do not paste it into chat, logs, tickets, or public transcripts. Save it only to a user-approved secure destination such as a password manager, secret store, encrypted file, or local `.env` file outside version control, then report the storage location and a short fingerprint.

## Integrations

```bash
sequenzy integrations suggestions
sequenzy integrations catalog --provider polar
sequenzy integrations connect polar --api-key $POLAR_KEY --webhook-secret $POLAR_WH_SECRET
sequenzy integrations list
sequenzy integrations get int_123
sequenzy integrations activity --status failed
sequenzy integrations sync int_123
sequenzy integrations enable-sync int_123
sequenzy integrations disable-sync int_123
sequenzy integrations pixel int_123
sequenzy integrations enable-pixel int_123
sequenzy integrations guide --framework nextjs
sequenzy integrations attio int_123
sequenzy integrations set-attio-lists int_123 --map list_abc=field-guide --tag-map vip=key-accounts
sequenzy integrations set-attio-lists int_123 --from-attio key-accounts=list_abc --from-attio-tag key-accounts=vip --enable-removals
```

Behavior:

- `suggestions`: `GET /api/v1/integrations/suggestions` (`account:read`); what to connect next, from what onboarding found on the company website (Clerk, Supabase, PostHog, Segment, Mixpanel, Amplitude, Webflow, Wix, WordPress, WooCommerce, Shopify) minus connected providers. Payment providers are never guessed: when the site lists pricing and nothing handles payments, `paymentProviders` lists every payment provider for the user to pick. `scanComplete: false` means the site is still being read, so an empty list is not "nothing found"
- `catalog`: `GET /api/v1/integrations/catalog`; works whether or not the provider is connected - its `connectFields` list what a provider needs, and its events are the ones sequences can trigger on
- `disconnect <id>` / MCP `disconnect_integration`: `POST /api/v1/integrations/{id}/disconnect`; Lemon Squeezy and SparkLoop only. Requires `integrations:manage` and owner/admin access for personal keys. Stops local ingestion before managed webhook cleanup. Manual webhooks and existing subscribers remain. A non-null `cleanupWarning` means locally disconnected; repeat disconnect to retry Lemon Squeezy cleanup, or delete the leftover webhook in SparkLoop. Other providers use the dashboard.
- `connect`: `POST /api/v1/integrations/connect`; covers API-key / webhook-secret providers (Polar, Paddle, Dodo, Lemon Squeezy, Whop, RevenueCat, Superwall, Adapty, Creem, Chargebee, Clerk, PostHog, Segment, Mixpanel, Amplitude, Affonso, Attio, SparkLoop). Mixpanel and Amplitude take only `--webhook-secret`, and the CLI generates and prints one when it is omitted: Mixpanel uses it as the Basic auth password of a Webhook destination and syncs each exported cohort as a `mixpanel-<cohort>` tag (it cannot stream raw events); Amplitude uses it as an `X-Webhook-Secret` header and streams events as `product.<event type>`, profile updates from identify calls and the Users stream, and cohorts as `amplitude-<cohort>` tags (`--event-allowlist` and `--include-internal-events` scope its events at connect; change them later without the secret with `integrations set-amplitude-events <id>`, `PATCH /api/v1/integrations/{id}/amplitude`, or the `update_amplitude_settings` MCP tool, because reconnecting replaces the secret). The first sync of a cohort tags current members without starting automations, and `integrations get` lists synced cohorts with their tags. SparkLoop takes `--api-key` (`--webhook-secret` is optional: the webhook authentication token, only to verify SparkLoop's header instead of a secret in the webhook URL), registers its own SparkLoop webhook, and needs `--account-id pub_...` only when the account has several publications (the error lists them); partner referrals for that publication become subscribers and trigger `sparkloop.referral_pending` / `sparkloop.referral_confirmed` / `sparkloop.referral_rejected`. RevenueCat takes a secret API v2 key plus `--webhook-secret` set to the authorization header value configured on the RevenueCat webhook (or its HMAC signing secret); it is webhook-only, so `sync` does not apply, and contacts are matched by `externalId` = RevenueCat app user ID, then by the `$email` attribute (from the event or the RevenueCat API), then by an app user ID that is an email address; unmatched app users show as skipped integration activity. Superwall takes only `--webhook-secret` set to the `whsec_` signing secret of the Superwall webhook pointed at the returned URL; it is webhook-only, so `sync` does not apply, and contacts are matched by `externalId` = the user ID passed to Superwall's `identify()` (or the original app user ID), then by the `email` user attribute, then by a user ID that is an email address; sandbox events and unmatched users show as skipped integration activity. PostHog events without an email reach the contact whose `externalId` (or stored `posthogDistinctId`) equals the event's `distinct_id` when `--match-by-distinct-id` / `settings.matchByDistinctId` is on; it is the default for new connections, never creates contacts, and `--no-match-by-distinct-id` turns it off (a PostHog reconnect keeps the other event settings). OAuth and app-install providers (Stripe, Shopify, Supabase, GitHub, WooCommerce) connect and disconnect in the dashboard only. Whop also connects through the Sequenzy app in the Whop App Store, linked in the browser by a Whop business admin with no key or webhook; `integrations get` then shows `details.installSource: "whop_app"`, and `sync` / `disconnect` work as usual. Whop webhook secrets are pasted exactly as shown (`ws_...`, or `whsec_...` on older webhooks). Reconnecting replaces stored credentials, and the response includes the webhook URL to configure at the provider
- pass secrets via environment variables instead of flags to keep them out of shell history; credentials, access tokens, and webhook secrets are never returned by read commands
- `list` / `get`: connected integrations and one integration's detail - `get` lists every event the provider emits, the tags each applies through sync rules, and which sequences trigger on it
- `activity`: `GET /api/v1/integrations/activity`; retained for 24 hours - use `--status failed` when an integration reports connected but contacts are not appearing
- `sync <id>` queues a catalog/backfill re-sync (Stripe, Polar, Paddle, Dodo, Lemon Squeezy, Creem, Chargebee, Whop); returns immediately, poll `integrations get` to watch `syncStatus`; fails with a conflict if a sync is already running
- `enable-sync` / `disable-sync` toggle bulk imports and backfills while keeping the connection, credentials, and live webhook delivery active
- `pixel <id>` (Shopify only) reads live pixel status from the store - check it before trusting product views, cart activity, or browse abandonment, because without the pixel those events never arrive and any sequence they trigger silently never fires; `enable-pixel` is idempotent, starts on the next storefront visit, and backfills nothing
- `guide` prints the same integration code examples the MCP `get_integration_guide` tool returns
- `attio <id>` / MCP `get_attio_mapping`: `GET /api/v1/integrations/{id}/attio`; Sequenzy lists, live Attio people-lists, every saved map in both directions, `syncRemovals`, and `inbound` health (`off`, `active`, or `error` with what to fix). Needs `account:read` + `lists:read`; tag names come from `tags list`
- `set-attio-lists <id>` / MCP `update_attio_settings`: `PATCH /api/v1/integrations/{id}/attio` with the stored token (never reconnect to change mappings). Sequenzy → Attio: `--map` (list → Attio list) and `--tag-map` (tag → Attio list) upsert the person and add them to the Attio list when they join the list or get the tag. Attio → Sequenzy: `--from-attio` (Attio list → list id) and `--from-attio-tag` (Attio list → tag) create or update the subscriber and join the list or apply the tag, which triggers list and tag automations. Each flag replaces that map; `--clear-*` clears one. Inbound maps make Sequenzy register an Attio webhook and need `webhook:read-write` on the Attio token; without it the save fails with instructions. `--enable-removals` mirrors removals both ways (default add-only). Only changes after saving sync, and Sequenzy's own Attio writes are not echoed back. Needs `integrations:manage`
- MCP parity: `connect_integration`, `list_integrations`, `list_integration_capabilities`, `list_integration_suggestions`, `get_integration`, `list_integration_activity`, `sync_integration`, `set_integration_sync_enabled`, `get_integration_pixel`, `activate_integration_pixel`, `get_integration_guide`, `get_attio_mapping`, and `update_attio_settings`

## Sender Profiles And Tracking

```bash
sequenzy sender-profiles list
sequenzy sender-profiles update sender_abc123 --name "SnapCount"
sequenzy sender-profiles update reply_abc123 --name "SnapCount" --reply
sequenzy tracking settings
sequenzy tracking update --clicks on --strict-bot-filtering on
sequenzy tracking update --unsubscribes off
sequenzy tracking update --store-content off
sequenzy tracking update --auto-utm on --utm-source sequenzy --utm-campaign "{{email.subject}}"
sequenzy tracking update --double-opt-in on
```

Behavior:

- `sender-profiles list`: `GET /api/v1/sender-profiles`; shows which profiles are account defaults and whether each sender address sits on a verified sending domain
- `sender-profiles update` renames one profile in place (`--reply` treats the ID as a reply-to profile) and never changes the account defaults - change defaults with `sequenzy companies update --sender-profile-id`; colliding renames are rejected with the ID of the profile already using that name; requires the `companies:manage` scope
- `tracking settings` / `tracking update`: `GET`/`PATCH /api/v1/tracking-settings`, covering open/click/unsubscribe tracking, `--strict-bot-filtering`, `--attribution-window-hours`, `--double-opt-in`, and auto-UTM (`--auto-utm` with `--utm-source/medium/campaign/content/term` templates, `--reset-utm`)
- `--unsubscribes off` (MCP: `unsubscribeTrackingEnabled: false`) routes unsubscribe links directly to `https://sequenzy.com`, even with a custom tracking domain, for subsequent sends Actual unsubscribes and their email attribution are still recorded
- `--store-content off` (MCP: `emailContentStorageEnabled: false`) keeps no rendered body once an email is sent, stores the email's name in place of its subject, and stores no IP address, user agent or country for opens and clicks; view-in-browser links stop working
- tracking updates are partial (omitted flags keep current values) and apply to emails sent afterwards; UTM templates support placeholders such as `{{email.subject}}` and `{{link.text}}`
- `--double-opt-in on` makes new contacts start pending until they confirm; it needs a sender profile and provisions the confirmation email automatically; existing active contacts are unaffected
- reply tracking is set with `sequenzy companies update`; the company tracking domain is managed with `sequenzy tracking domain`
- MCP parity: `list_sender_profiles`, `update_sender_profile`, `get_tracking_settings`, and `update_tracking_settings`

## Shopify Automation Settings

```bash
sequenzy shopify settings get
sequenzy shopify settings update --cart-abandonment on --cart-delay-hours 4
sequenzy shopify settings update --browse-abandonment on --price-drop on --price-drop-min-percent 10
```

Behavior:

- `GET`/`PATCH /api/v1/shopify/automation-settings`; requires a connected Shopify integration, and `get` shows effective values (platform defaults apply until the store overrides them)
- browse abandonment emails shoppers who viewed a product but didn't buy; cart abandonment fires `ecommerce.cart_abandoned` with the full cart after inactivity; price drop alerts recent viewers when a product's price falls
- each family has delay/cooldown/threshold flags plus a `--reset-*` flag to return to defaults; updates are partial
- if no sequence handles `ecommerce.price_drop`, Sequenzy sends a default price-drop email to active subscribers
- MCP parity: `get_shopify_automation_settings` and `update_shopify_automation_settings`

## SMS

```bash
sequenzy sms settings
sequenzy sms update num_abc123 --link-shortening off
sequenzy sms send-test "+15550100" --text "Test from Sequenzy"
sequenzy generate sms "Flash sale reminder"
```

Behavior:

- `sms settings`: `GET /api/v1/sms/settings`; `readyToSend` in the JSON output tells you whether SMS sequence steps will actually send (add-on enabled, eligible plan, active number)
- `sms update <number-id> --link-shortening <on|off>`: `PATCH /api/v1/sms/numbers/{numberId}` with `linkShorteningEnabled`; per number, on (the default) replaces every link with a click-tracked short link, off sends that number's links exactly as written (the customer's own tracking links) and its SMS clicks are no longer tracked; applies to messages prepared afterwards, requires the `companies:manage` scope
- `sms send-test`: `POST /api/v1/sms/test`; sends a real text and charges credits, limited to 5 test sends per hour, bypasses quiet hours, and is excluded from step stats
- add SMS steps to sequences with `type: "sms"` in `sequences create --steps-*` or `update --insert-steps-*`; steps only send when the add-on is enabled
- MCP parity: `get_sms_settings`, `update_sms_number_label` (including `linkShorteningEnabled`), `send_test_sms`, and `generate_sms`

## Push

```bash
sequenzy push settings
sequenzy push web --enable
sequenzy push ios set --key-file AuthKey_ABC123DEFG.p8 --key-id ABC123DEFG --team-id DEF123GHIJ --bundle-id com.example.app
sequenzy push android set --service-account-file ./firebase-key.json
sequenzy push devices list --email jane@example.com
sequenzy push devices register --platform ios --token 8f2c...e1 --email jane@example.com
sequenzy push send-test --email you@example.com --title "Test" --body "Hello"
sequenzy push campaigns create --name "Flash sale" --title "24h sale" --body "30% off" --all-contacts
sequenzy push campaigns estimate --segment seg_123 --platforms ios
sequenzy push campaigns send cmp_123 --yes
sequenzy push campaigns stats cmp_123
sequenzy push live-activities list --email jane@example.com
sequenzy push live-activities start --email jane@example.com --activity-type DeliveryAttributes --activity-id order-1234 --attributes-json '{"orderNumber":"1234"}' --content-state-json '{"status":"preparing","minutesAway":30}' --alert-title "Order confirmed"
sequenzy push live-activities update --email jane@example.com --activity-id order-1234 --content-state-json '{"status":"out_for_delivery","minutesAway":8}' --priority low
sequenzy push live-activities end --email jane@example.com --activity-id order-1234 --content-state-json '{"status":"delivered","minutesAway":0}' --dismissal-date 0
```

Behavior:

- `push settings`: `GET /api/v1/push/settings`; shows web push, APNs, and Firebase readiness, last credential errors, active device counts per platform, and the app opt-in rate (`devices.permissions`: iOS/Android devices by the notification permission the SDK reported, `unknown` for SDKs that predate reporting)
- `push web`: `PUT /api/v1/push/settings/web`; the first `--enable` generates VAPID keys; the site must serve `/sequenzy-sw.js` with `importScripts("https://api.sequenzy.com/sequenzy-sw.js")` and call `sequenzy.subscribeToPush()` from a click
- `push ios set` / `push android set`: `PUT /api/v1/push/settings/ios|android` with the .p8 key or Firebase service account; secrets are encrypted and never returned; `remove` subcommands clear them
- `push devices`: `GET`/`POST /api/v1/push/devices` and `DELETE /api/v1/push/devices/{id}`; app backends register APNs/FCM tokens with an email or subscriber ID; tokens are never returned in full. Apps using the mobile SDKs register their own tokens (`source: "mobile_sdk"`) with a publishable key whose `--app-ids` lists the app. `--permission granted|provisional|ephemeral|denied|not_determined` records the device's notification permission (the SDKs report it themselves); the contact's `pushPermission` attribute holds the best status across their app devices, for push primer segments
- `push send-test`: `POST /api/v1/push/test`; one device or every device of a contact, 200 per company per rolling 24 hours, excluded from stats
- `push campaigns`: `/api/v1/push/campaigns` estimate (contacts with an active device), create, update, send (now or `--schedule`), unschedule, cancel, duplicate, stats; only contacts with an active device on a set-up platform receive it; `send` confirms unless `--yes` or `--schedule`
- add push steps to sequences with `type: "push"` and `title`/`body` in `sequences create --steps-*` or `update --insert-steps-*`; steps skip until push is set up
- `push live-activities`: iOS Live Activities over APNs (same .p8 key). `list` (`GET /api/v1/push/live-activities`) shows push-to-start tokens per device and activity type, update tokens per running activity, and per-type counts. `start` (`POST .../start`, iOS 17.2+) needs `--email` or `--subscriber-id`, `--activity-type` (the Swift ActivityAttributes name), `--activity-id`, content state JSON, attributes JSON with every field of the app's attributes struct (iOS silently drops a start whose attributes do not decode) and an alert; Sequenzy adds `sequenzy.activityId` to the attributes. Timestamps are Unix seconds or ISO dates; milliseconds are rejected. `update` and `end` target every running copy of that contact's activity, so they also need `--email` or `--subscriber-id` (tokens of other devices under the same id are never sent to); `end` needs the final content state and takes `--dismissal-date` (0 or a past date removes it now). Each returns `tokenCount`; 0 means nothing was sent (no device linked to that contact can start the type, because the app has not called `identify` with an identity token, or no running copy has reported its update token yet, which takes a few seconds after a start), not an error. Updates are safe to repeat; a repeated start starts another copy. Content state dates decode as seconds since 2001-01-01 unless the app's struct says otherwise; the APNs payload must fit 4 KB. The app reports tokens with the iOS SDK's `Sequenzy.observeLiveActivities(of:)` (React Native and Flutter: `registerLiveActivityToken` / `liveActivityEnded`); Android has no Live Activities
- push campaigns use `campaigns:read|write|send` scopes, devices use `subscribers:read|write`, credentials need `integrations:manage`, Live Activity start/update/end need `transactional:send` and listing needs `subscribers:read`
- MCP parity: `get_push_settings`, `update_web_push_settings`, `set_apns_credentials`, `set_fcm_credentials`, `list_push_devices`, `register_push_device`, `send_test_push`, `create_push_campaign`, `send_push_campaign`, `get_push_campaign_stats`, `list_live_activities`, `start_live_activity`, `update_live_activity`, `end_live_activity`, and the other push tools

## Push imports

```bash
sequenzy push imports preflight --source onesignal
sequenzy push imports start --source onesignal --app-id 1b2c3d4e-0000-4000-8000-00000000abcd --api-key-file onesignal.key --wait
sequenzy push imports start --source braze --braze-endpoint rest.iad-01.braze.com --segment seg_all_users --api-key-file braze.key
sequenzy push imports start --source customer_io --region eu --segment 12 --api-key-file cio.key --platforms ios
sequenzy push imports start --source csv --file devices.csv --yes
sequenzy push imports list
sequenzy push imports get pimp_123 --wait
sequenzy push imports resume pimp_123
sequenzy push imports cancel pimp_123 --yes
```

Behavior:

- `/api/v1/push/imports` (preflight, create, rows, start, get, list, cancel); `subscribers:read` for reads, `subscribers:write` for writes, like push devices
- `start` creates a draft, prints its warnings (APNs or Firebase not set up, APNs on sandbox, credentials must match, web push excluded) and asks before starting unless `--yes`; a declined draft is kept for `resume` or `cancel`
- sources: OneSignal (App API key + App ID; CSV export, about 2,000 records/s, one export per account at a time), Braze (REST key with `users.export.segment`, REST endpoint, segment; ZIP export, not available when Braze exports to the customer's own bucket), Customer.io (App API key, region, segment; App API at 10 requests/s), CSV (`token` + `platform` columns, `external_id` or `email`, optional `status`, `app_id`, `last_active`, `attribute.<name>`; files up to 256 MB, sent in parts automatically, and the import cannot start until every part arrived; split larger files or use the source's API). Pass the source key with `--api-key-file` or `PUSH_IMPORT_API_KEY` rather than a flag; it is encrypted and deleted once devices are read
- only iOS (APNs) and Android (FCM) devices are imported; web push subscriptions are tied to the old provider's VAPID keys and are skipped. iOS tokens that are Firebase tokens and Firebase installation IDs are rejected as invalid
- opted-in devices link to a contact by external ID, then email; otherwise a contact is created (no lists, no sequences), push-only with no email or phone when the device has only an external ID; an email owned by a contact with another external ID is skipped as `identity_conflict`; opted-out devices are stored as unsubscribed; devices already in Sequenzy are left as they are (`matched`); the SDK registering an imported token updates the same device
- `--no-attributes` stops copying source tags/attributes; otherwise only keys a contact lacks are filled
- results: `imported`, `matched`, `unsubscribed`, `skipped`, `invalid`, `subscribersCreated`, with reason counts; one import runs per workspace; `resume` continues a failed or stalled import from its last checkpoint without importing anything twice; `cancel` keeps devices already imported; `--wait` exits with status 1 when the import fails or stalls
- importing never sends anything; the first sends retire tokens Apple or Google reject (uninstalled apps, OneSignal's shared Firebase project)
- MCP parity: `get_push_import_preflight`, `create_push_import`, `add_push_import_rows`, `start_push_import`, `get_push_import`, `list_push_imports`, `cancel_push_import`

## In-App Messages

```bash
sequenzy in-app list --email jane@example.com
sequenzy in-app list --external-id user_42 --kind card --status all
sequenzy in-app event iam_123 --type dismissed
sequenzy in-app delete iam_123 --yes
sequenzy in-app stats node_321
sequenzy in-app templates --json
sequenzy in-app write --brief "Trial ends in 3 days; nudge them to upgrade" --format modal
sequenzy in-app html validate --file survey.html
sequenzy in-app html set seq_123 node_321 --file survey.html --no-close-button
sequenzy in-app list --email jane@example.com --formats modal,banner,fullscreen,html
```

Behavior:

- add in-app steps to sequences with `type: "in_app"` and `title`/`body` (plus optional `kind` message|card, `format` modal|banner|fullscreen, `position` top|bottom for banners or bottom (sheet, default)|center for modals, `eyebrow` (short line above the title, up to 40 characters), `imageUrl`, `imagePlacement` top|background for modals and full screens, up to 2 `buttons` `{label, action: open_url|dismiss|request_push_permission, url}` (url only for `open_url`; `request_push_permission` makes a push primer: the app shows the OS notification prompt, or opens its notification settings when the contact turned them off), string `data`, `expiresAfterDays` 1-365, `pinned` for cards, and `style` `{preset: brand|soft|bold|dark, backgroundColor, textColor, buttonColor, buttonTextColor, cornerRadius 0-32, buttonRadius 0-40}` built from the brand) in `sequences create --steps-*` or `update --insert-steps-*`; each contact gets one item per step, stored in their in-app feed
- nothing is sent by email or push: the customer's app fetches the feed (browser: `POST /api/v1/in-app/feed` with the publishable key and a backend-minted identity token; backend: `GET /api/v1/in-app/messages`), renders it, and reports events; Settings > In-app has a copy-ready prompt for an AI coding tool
- `in-app list`: `GET /api/v1/in-app/messages`; `--status open` (default) is what the app should show now (messages not yet displayed/clicked/dismissed, cards not dismissed, nothing expired), `--status all` is history; identify the contact with `--email`, `--external-id`, or `--subscriber-id`; open items with a `request_push_permission` button are left out unless `--actions request_push_permission` says the app handles it (the mobile SDKs list it themselves)
- `in-app event`: `POST /api/v1/in-app/messages/{id}/events` with `displayed`, `clicked`, `dismissed`, or `read`; repeats change nothing except the click count; messages show once, cards stay until dismissed; on a push primer click add `--push-permission granted|provisional|ephemeral|denied|not_determined` (the permission the app read after asking): kept once per item and written to the contact's `pushPermission` attribute
- `in-app delete`: `DELETE /api/v1/in-app/messages/{id}`; confirms unless `--yes`
- `in-app stats`: `GET /api/v1/in-app/steps/{stepId}/stats`; created, displayed, clicked, dismissed, plus `pushPermissionGranted` / `pushPermissionDenied` for push primers
- `in-app templates`: `GET /api/v1/in-app/templates`; each template's `config` is a complete `in_app` step without a label, and its link buttons have no `url` until you add one
- custom HTML messages: an `in_app` step with `format: "html"`, `html` (up to 100 KB of HTML/CSS/JS; Braze Liquid like `{{${email_address}}}` is converted to merge tags, `{{${braze_id}}}` becomes `{{contactId}}`, Liquid without an equivalent is rejected) and `showCloseButton` (default true; turn off when the HTML calls `sequenzy.close()` or `brazeBridge.closeMessage()`); `title` is the accessible name. The document gets a JS bridge (`sequenzy.close/openUrl/logClick/track/setAttributes/setName`, plus Braze's `brazeBridge`/`appboyBridge`) and runs sandboxed (opaque-origin iframe on the web, isolated WebView on mobile). Survicate's Braze In-App Message snippet works pasted as is; its answers reach Sequenzy only with the dashboard's "Forward Survicate answers" snippet (events `survicate_question_answered`/`survicate_survey_completed`) or a Survicate webhook
- feeds leave `html` messages out unless the caller lists `html` in `formats` (`in-app list --formats`, public feed `formats`), so older SDKs never show them as blank messages; SDKs show them automatically (React Native needs `webView={WebView}` from react-native-webview; web needs `data-sequenzy-in-app` on the snippet)
- `in-app html validate --file`: `POST /api/v1/in-app/html/validate` (`sequences:read`); returns size, Braze conversions, script hosts a CSP must allow, `closesItself`, warnings and errors; exits 1 when not valid
- `in-app html set <sequenceId> <stepId> --file`: `PUT /api/v1/sequences/{id}` with a typed `nodeUpdates` change (`format: "html"`, `html`, optional `--title`, `--no-close-button`, `--confirm-live-change` for active sequences)
- `in-app event --button-id`: which control a click in an HTML message hit (Braze `logClick` id rules)
- `in-app write`: `POST /api/v1/in-app/copy` with `--brief`, optional `--kind`, `--format`, `--image`; returns `eyebrow`, `title`, `body` and button labels and saves nothing (20 a minute per workspace)
- scopes: feed and events use `subscribers:read|write`, stats and templates use `sequences:read`, writing copy uses `sequences:write`
- mobile apps: the iOS, Android, React Native and Flutter SDKs render the feed with the same design as the composer preview, and also record screen views, storefront events, profile updates and form signups; see the Mobile SDKs docs
- MCP parity: `list_in_app_messages`, `record_in_app_event`, `delete_in_app_message`, `get_in_app_step_stats`, `list_in_app_templates`, `write_in_app_copy`, `validate_in_app_html`, `formats` on `list_in_app_messages`, `buttonId` on `record_in_app_event`, and `type: "in_app"` (including `format: "html"` with `html`/`showCloseButton`) in `create_sequence`, `insert_sequence_step` and `update_sequence_node`

## Sync Rules

```bash
sequenzy sync-rules get
sequenzy sync-rules update --rules-file ./rules.json
sequenzy sync-rules update --reset
```

Behavior:

- `GET`/`PUT /api/v1/sync-rules`; sync rules map integration events to tags applied on subscribers
- `--rules-json`/`--rules-file` replace the rule set; `--reset` restores defaults
- MCP parity: `get_sync_rules` and `update_sync_rules`

## Notification Preferences

```bash
sequenzy account notifications get
sequenzy account notifications set --new-subscriber instant --campaign-completed instant
```

Behavior:

- `GET`/`PATCH /api/v1/notification-preferences`; these are the caller's own settings, not the workspace's - teammates keep their own
- new-subscriber notifications fall back to a daily summary automatically once a day passes the instant cap, and imports never trigger them
- `daily` is not valid for `--campaign-completed`: a campaign finishes once, so there is nothing to roll up
- `--account-health off|instant` controls the account health check's findings for the caller: inside the Monday weekly report when they get it, otherwise as their own email; on by default for the workspace owner, opt-in for members. `off` stops both
- MCP parity: `get_notification_preferences` and `update_notification_preferences`

## Websites

```bash
sequenzy websites list --company comp_123
sequenzy websites add example.com --company comp_123
sequenzy websites add mail.example.com --mail-from-prefix bounce
sequenzy tracking domain set links.example.com
sequenzy websites check example.com --company comp_123
sequenzy websites verify example.com --company comp_123
sequenzy websites upgrade-dns example.com --company comp_123
sequenzy websites guide --framework nextjs --use-case transactional
```

Behavior:

- `websites list`: `GET /api/v1/websites`
- `websites add`: `POST /api/v1/websites`; optional `--mail-from-prefix` (default `rp`; new domains also get a second return path, usually `<label>2` (`rp2` by default); publish the returned names) applies only at creation. `dnsRecords.trackingRecord` is the optional company tracking domain CNAME, created under the first domain (`links.<domain>`); it never gates verification.
- `tracking domain` / `tracking domain set <hostname>` / `tracking domain verify` / `tracking domain remove --yes`: `GET`/`PUT`/`POST .../verify`/`DELETE /api/v1/tracking-domain`; the company tracking domain every sending domain uses. MCP: `get_tracking_domain`, `set_tracking_domain`, `verify_tracking_domain`, `remove_tracking_domain`. Removing breaks links and images in emails already sent; changing keeps them working while the old CNAME stays.
- `frequency-cap` / `frequency-cap get` / `frequency-cap set --max-emails <1-50> --window-hours <1-168>` / `frequency-cap clear`: `GET`/`PUT`/`DELETE /api/v1/frequency-cap` (read `account:read`, write `companies:manage`, owner/admin only); the company rule of at most N marketing emails per contact in a rolling window. MCP: `get_frequency_cap`, `set_frequency_cap`, `clear_frequency_cap`. Only sequences with `--respect-frequency-cap` are capped; campaigns count toward it but always send.
- `account-health` / `account-health get` / `account-health run` / `account-health settings [--enabled|--no-enabled] [--autonomy draft_fixes|report_only]` / `account-health insight <id> dismiss|snooze|resolve|reopen [--snooze-days <1-90>]`: `GET /api/v1/account-health` (`analytics:read`), `PATCH /api/v1/account-health/settings` (`companies:manage`, owner/admin only), `POST /api/v1/account-health/runs` and `PATCH /api/v1/account-health/insights/:id` (`sequences:write`). `account-health fix <insightId>`: `POST /api/v1/account-health/insights/:id/fix` (`sequences:write`) builds the inactive draft sequence an `unhandled_event` or `missing_sequence` finding asks for (`missing_sequence` is a standard lifecycle sequence such as welcome or re-engagement the workspace does not run yet; its evidence holds the suggested name, trigger and steps) and writes its emails with AI like a template, returning `{sequenceId, created, enrichmentStatus}` (`enrichmentStatus` is `processing` or `not_queued`, present for a new draft or an existing one that still had unwritten steps, absent once every email exists); repeat calls return the same draft, writing only steps that still have no email (then with `enrichmentStatus`), never rewriting existing ones. Each insight lists `actions` (kind, label, targetId, path, confirm, api): run `create_sequence` with `fix`, `activate_sequence` with `sequences enable`, `pause_sequence` with `sequences disable`, and confirm with the user before activating or pausing. `account-health feedback <insightId> useful|not_useful [--comment <text>|--clear-comment]`: `POST /api/v1/account-health/insights/:id/feedback` (`analytics:read`, so viewers can answer) records whether a finding was useful to the key owner, returning `{insightId, feedback: {rating, comment, updatedAt}}`; one answer per person per insight, any status, a repeat replaces the rating and keeps the earlier comment unless `comment` is sent (`null` clears it, up to 2,000 characters). It goes to the Sequenzy team and changes nothing in the workspace; `account-health` shows it as each insight's `feedback`. Only send it when the user says whether a finding helped. `over_emailing` findings (at least 25 people got 4+ marketing emails within 24 hours in the last 7 days; evidence names the campaigns, sequences and marketing Send API email (`type: "api"`) behind it and the current `frequencyCap`) are fixed first, when a listed sequence has `enrollsEveryTime` and a `peakEnrollmentsPerPerson` of 3 or more, by `sequences update <id> --enrollment-mode one_time` on it (it re-enrolls the same people every time its trigger fires), then with `frequency-cap set --max-emails 1 --window-hours 16` when `frequencyCap` is null (action `open_frequency_cap_settings`; when a cap is already on, read it with `frequency-cap get` and only tighten it) and `sequences update <id> --respect-frequency-cap` on the uncapped sequences listed that can wait (tips, nudges, promotions, not welcome or onboarding) (action `apply_frequency_cap`, `targetId` is the sequence), after confirming with the user; when the sources are only campaigns or Send API email the cap does not help, so suggest spacing those out instead; `neglected_subscribers` findings (active subscribers with an email who joined over 90 days ago and got no marketing email in 90 days, while the workspace does send marketing email and no `campaign_gap` finding already covers it; `estimated` when sampled) call for a re-engagement campaign the user plans. `unengaged_signups` findings (at least 100 contacts who joined in the last 60 days with the same consumer mailbox provider (Gmail, Yahoo, Outlook; business domains are never reported) and first list, `listName` in evidence, got 2 or more emails each and almost never opened or clicked while the other new signups did) usually mean a bot filling a signup form with real people's addresses, or a bought list: suggest bot protection and double opt-in on the form feeding that list, then unsubscribing the cohort after the user confirms (action `review_subscribers` opens the list). Transactional email never counts toward either. MCP parity: `get_account_health`, `update_account_health_settings`, `run_account_health_check`, `update_account_health_insight`, `create_account_health_fix`, `submit_account_health_feedback`. Checks need more than 1,000 active subscribers and an email sent in the last 14 days (`409 NOT_ELIGIBLE`); manual runs are limited to one per 10 minutes, wait a day after a check that left findings open (both `429 RATE_LIMITED` with `retryAfterSeconds`), and never email. Poll `account-health` until `runInProgress` is false. Drafted fixes are inactive sequences named for the business with the trigger, timing and titled email steps; the check writes no email, so run `account-health fix <insightId>` (or open the draft in the dashboard) to write them before `sequences enable` succeeds. Checks run every Monday at 05:00 UTC (fixed; the AI budget is fixed too and paid by Sequenzy). Findings reach people inside the Monday weekly report or as their own email for anyone who does not get the report; who gets them is each person's own `account_health` notification (`sequenzy notifications set --account-health off|instant`, MCP `update_notification_preferences`), on by default for the owner.
- `websites configure`: deprecated `PATCH /api/v1/websites/:domain`; sets `<--tracking-prefix>.<domain>` as the company tracking domain when none is set; a different one changes nothing and the response says why. MCP: `configure_sending_domain`.
- `websites check`: `GET /api/v1/websites/:domain`; reads stored verification and sending-readiness status
- `websites verify`: `POST /api/v1/websites/:domain/verify`; runs a fresh DNS check. DNS verification and readiness to send are separate outcomes.
- `websites upgrade-dns <domain> [--mail-from-prefix <label>]`: `POST /api/v1/websites/:domain/dns-upgrade` (`websites:write`); recommended, optional one-time upgrade of a verified domain on the previous record set to the current per-domain CNAMEs (better deliverability and security) without removing it; it can't be cancelled once started. Only when `website.dnsUpgrade.status` is `available` (`check` and `list` print `DNS upgrade: available`); an older SES-only domain also needs a working DMARC record, otherwise `400` "Add a DMARC record for this domain before upgrading its DNS records." and the status is `unavailable`, as it is for Amazon's three-CNAME DKIM domains and domains mid records migration. Prints the four CNAMEs to add next to the current records (`sq1`/`sq2._domainkey`, the return path, default `rp`, then `rp1` and `sqrp` if taken or already in DNS, and `<label>2` for SES, moving to `bounces`/`sesbounces` if in use); nothing is removed and the domain keeps sending on its current records. About an hour after the required ones are visible on public DNS (Google and Cloudflare resolvers) the domain switches by itself; `websites verify` checks now but does not skip the wait. Sending is normally not interrupted at the switch; if that isn't possible for a domain, Amazon SES sends can be held a few minutes. The domain also gets a new 2048-bit DKIM key; the CNAMEs stay the same. `check` then lists the old records that can optionally be deleted after `deleteOldRecordsAfter` (8 days later; for an older SES-only domain, the old return path MX and TXT at `send.<domain>` and the DKIM TXT, while DMARC stays). Errors: `400` not eligible or label has DNS records / is the current return path or tracking name, `409` already in progress, `404` unknown domain. MCP: `upgrade_sending_domain_dns`.
- `websites guide`: `POST /api/v1/integration-guide`

## Receiving Domains

```bash
sequenzy receiving-domains
sequenzy receiving-domains add support.acme.com
sequenzy receiving-domains get support.acme.com
sequenzy receiving-domains verify support.acme.com
sequenzy receiving-domains remove support.acme.com --yes
```

Behavior:

- `receiving-domains` / `receiving-domains list`: `GET /api/v1/receiving-domains`; prints each domain's status, error, reserved-until time and the DNS records to publish
- `receiving-domains add <domain>`: `POST /api/v1/receiving-domains` with `{ domain }`; `201` with `created: true`, or `200` with `created: false` when the workspace already has it
- `receiving-domains get <domain>`: `GET /api/v1/receiving-domains/:domain`; `<domain>` is the name or the receiving domain ID
- `receiving-domains verify <domain>`: `POST /api/v1/receiving-domains/:domain/verify`; checks DNS and SES now; the first verification of a domain added with `receiving-domains add` turns Inbox on
- `receiving-domains remove <domain>`: `DELETE /api/v1/receiving-domains/:domain`; prompts for confirmation (`--yes` skips it) and returns the removed domain
- scopes: `websites:read` to read, `websites:write` to add and verify, `websites:delete` to remove; add, verify and remove are owner or admin only (view-only access gets `403`)
- errors: `400` `invalid_domain` / `reserved_domain`, `404` `not_found`, `409` `domain_taken` (another workspace has it) / `domain_has_mailbox` (its MX already points at another mail service) / `limit_reached` (one per workspace; checked before the MX lookup), `503` `dns_check_failed` (MX lookup got no answer; retry in a minute)
- `ReceivingDomain`: `{ id, domain, status, records, error, claimExpiresAt, verifiedAt, lastCheckedAt, createdAt }`; `records` are `{ type: "MX" | "TXT", name, value, priority?, status: "pending" | "verified" | "misconfigured" }`
- MCP parity: `list_receiving_domains`, `add_receiving_domain`, `get_receiving_domain`, `verify_receiving_domain`, `remove_receiving_domain` (destructive)

Caveats:

- one receiving domain per workspace, used for replies to emails from all sending domains once verified (until then replies use Sequenzy's shared address); workspaces that set up several before keep them, and replies prefer the sender's own domain or one on the same root, else the oldest verified one
- `verified`: mail arrives and new reply addresses use the domain; `pending`: publish the records (a new name is reserved for 7 days, `claimExpiresAt`); `failed`: something broke, mail that still arrives is accepted, but new reply addresses use Sequenzy's address until it is fixed
- publish the MX record, plus the TXT record when listed
- a domain that already receives email elsewhere (Google Workspace, Microsoft 365, Cloudflare Email Routing...) is refused so that mailbox keeps working: use a subdomain such as `support.acme.com`
- removing a domain stops all mail to it, including replies to emails already sent with reply addresses on it, and clears a branded inbox address on it; confirm with the user first

## Feedback

Send feedback only when the user explicitly asks you to send it. Before submitting, tell the user that the message goes to the Sequenzy team. Follow the active MCP tool's data restrictions; omit credentials, unrelated subscriber data, email content, and raw API/debug payloads.

```bash
sequenzy feedback "No command to bulk-delete campaigns by label" --category missing_capability
sequenzy feedback "Segment count and list output disagree for seg_123" --category bug --context "Auditing a re-engagement segment"
```

Behavior:

- sends `POST /api/v1/feedback`
- body shape is `{ message, source: "cli", category?, context? }`
- categories: `missing_capability`, `bug`, `docs`, `ux`, `praise`, `other` (default `other`)
- MCP equivalent: `submit_feedback` (message, optional category and context; source is set to `mcp` automatically)

Caveat:

- feedback is fire-and-forget: it is delivered straight to the Sequenzy team and there is no way to query it afterwards

## Sending Domains And Reply DNS

- `sequenzy websites add <domain>` creates a sending domain and returns its DNS.
- `sequenzy websites check <domain>` reads stored DNS and readiness.
- `sequenzy websites verify <domain>` refreshes verification and prints the DNS
  records.
- Use `--company <id>` to select the company and `--json` for exact API output.
- `sequenzy tracking domain set <hostname>` sets the company tracking domain
  every sending domain uses; it never blocks sending.
- `sequenzy websites upgrade-dns <domain>` moves an older verified domain onto
  the current records in place (recommended, optional, once; it can't be cancelled).
- MCP equivalents: `add_sending_domain`, `check_website`, `verify_sending_domain`,
  `upgrade_sending_domain_dns`,
  `set_tracking_domain`.

Receiving mail (inbox addresses and replies) is not part of sending-domain
setup: use `sequenzy receiving-domains` (see Receiving Domains). `inbound*`
fields that may still appear in `website.dnsRecords` describe an older reply
setup.

## Commands To Treat As Unsupported

Treat these requested workflows as unsupported in the CLI even though related nouns exist:

- campaign immediate send; there is no "send now" command, so schedule with a near-future `--at` timestamp instead
- form creation and embed snippets: CLI covers `forms list` and `forms update` only; use MCP `create_form` / `get_form_embed` or the dashboard
- image asset upload: MCP `upload_image_asset` only, PNG/JPEG/GIF/WebP up to 10MB

## Operational Caveats

- prefer `SEQUENZY_API_KEY` for automation instead of interactive login
- use `--json` when another tool or agent needs structured output; dashboard-aware commands add `url`/`appUrls` fields when possible
- destructive commands (`delete`, `delete-variant`, `cancel-invitation`, and similar) prompt for confirmation; pass `--yes` (or `-y`) to skip, and note that `--yes` is required when stdin is not a TTY, which covers most agent and CI runs
- `campaigns cancel` deliberately skips the confirmation prompt so a bad send can be stopped fast
- `webhooks create` returns a one-time signing secret; handle it as sensitive output because it cannot be retrieved later. Do not paste credential material into chat, logs, tickets, or public transcripts. Save it only to a user-approved secure destination such as a password manager, secret store, encrypted file, or local `.env` file outside version control, then report the storage location and a short fingerprint.
- when the user asks for a workflow outside the current CLI surface, say so directly, choose between dashboard or direct API use instead of inventing commands. Send feedback only when explicitly requested, after telling the user it goes to the Sequenzy team

## design.md

- `sequenzy design-md get [--company ID] [--json]` (alias `pull`): print the raw markdown on stdout and `version: ...` on stderr; `--json` prints `markdown`, `version`, `designSystem`.
- `sequenzy design-md update [FILE|-] [--dry-run] [--expected-version VERSION] [--company ID] [--json]` (alias `push`): save an edited document from a file or stdin; prints the change summary, warnings and new version. `--dry-run` saves nothing.
- MCP equivalents: `get_design_md`, `update_design_md` (`markdown` required; optional `expectedVersion`, `dryRun`, `companyId`), and the read-only `sequenzy://design-md` resource.
- GET/PUT `/api/v1/design-md`; see the [design.md workflow](use-cases.md#designmd) for save semantics, errors and conflict recovery.

## Saved AI styles

- `sequenzy email-ai-style get [--company ID] [--json]`: inspect `style`, `revisionId`, `canManage`.
- `sequenzy email-ai-style save EMAIL_ID (--if-unset | --expected-style-id REVISION) [--canvas-file PATH] [--layout-rules IDS | --without-layout-rules] [--notes TEXT] [--company ID] [--json]`: capture stored email appearance or a complete unsaved canvas, plus detected layout habits (all kept by default; `--layout-rules` takes comma-separated rule IDs from `style.layout.rules`, `--without-layout-rules` keeps none) and optional design notes (500 characters max).
- `sequenzy email-ai-style clear --expected-style-id REVISION [--company ID] [--json]`: conditionally clear the current default.
- MCP equivalents: `get_email_ai_style`, `save_email_ai_style`, `clear_email_ai_style`. Save requires `emailId`, `expectedStyleId`; clear requires a nonempty `expectedStyleId`. Optional `companyId` selects the workspace. Optional save `canvas`, `layoutRuleIds` (omit for all, `[]` for none) and `notes` match the API schema.
- GET/PUT/DELETE `/api/v1/email-ai-style`; see the [saved-style workflow](use-cases.md#saved-ai-email-style) for role, validation and conflict recovery rules.

## Background subscriber operations

- `sequenzy subscribers operations start --kind add_tags --tag vip --audience-json @audience.json --request-key KEY --json`
- `sequenzy subscribers operations list --json`
- `sequenzy subscribers operations get ID --json`
- `sequenzy subscribers operations cancel ID --json`

Every command supports `--company ID`. Start accepts `--audience-json` (inline
JSON or `@file`), `--tag` and optional `--trigger-automations`. Omit the audience
for all contacts. Supply a stable request key, or retain the CLI-generated key
printed to stderr before the request. Retry identical inputs with that key
after an uncertain response.

MCP equivalents: `start_subscriber_operation`, `list_subscriber_operations`,
`get_subscriber_operation` and `cancel_subscriber_operation`. Start requires
`kind: "add_tags"`, `tags` and `requestKey`; optional `audience` and
`triggerAutomations` match the API contract.

## Saved email components

```bash
sequenzy components list --json
sequenzy components get cmp_123 --json
sequenzy components create "Promo banner" --blocks-file ./banner.json
sequenzy components update cmp_123 --name "Spring banner"
sequenzy components duplicate cmp_123 --name "Promo banner (winter)"
sequenzy components delete cmp_123 --yes
```

Behavior:

- `components list|get|create|update|duplicate|delete` call `/api/v1/email-components`; MCP parity: `list_email_components`, `get_email_component`, `create_email_component`, `update_email_component`, `duplicate_email_component`, `delete_email_component`
- Rename with `update --name` (MCP `update_email_component` with only `name`). Names are unique per company; a taken name returns 409. A rename does not bump `version`.
- `duplicate` copies description, type and blocks into a new component named "<name> (Copy)", then "(Copy 2)" and so on; pass `--name` (MCP `name`) to choose one. The copy is never pinned as a default, so duplicating the default footer gives a regular component and leaves the default unchanged.
- Inserted components are copied into emails, so renaming, duplicating or deleting never changes emails that already use them.

## Apply a default footer to existing emails

You can save for future emails only, or preview and apply to selected `sequences`,
`campaigns`, `transactional`, and `templates`. Campaigns must be draft or scheduled;
sent and in-progress content stays unchanged. Draft A/B variants and localizations
are included. Customized footers are preserved unless you explicitly include them.
Raw HTML, missing or ambiguous footers, and content shared with a protected owner
are skipped with reasons.

Preview is read-only. Review the affected counts, skipped reasons, and optional
before/after HTML, then apply with the returned token and identical blocks,
metadata, and scope options. If the relevant saved content changes, application
returns `409`; preview again. A successful application saves the default and
selected content atomically. It does not send emails.

Layout previews use the email theme and locale, with placeholder personalization.
They are not subscriber-specific inbox previews. You can request a particular
sample by its affected item `id` and `kind` (`email`, `ab_variant`, or `localization`).

```bash
sequenzy components footer preview --blocks-file ./footer.json \
  --apply-to sequences,campaigns,transactional,templates \
  --output-dir ./footer-preview --json
sequenzy components footer set --blocks-file ./footer.json \
  --apply-to sequences,campaigns,transactional,templates \
  --preview-token TOKEN --yes
```

Use `--include-customized` on both commands only when you want customized footers
replaced. `--render-preview` returns HTML in JSON; `--output-dir` also writes
`footer.html` and numbered before/after files. Use `--sample-id ID --sample-kind
localization` to inspect a specific localized version. All commands accept
`--company ID`. Without `--apply-to`, setting the footer retains future-only behavior.

Use `preview_default_email_component` with `slot: "footer"`, `blocks`,
`application: { scopes: ["sequences", "campaigns", "transactional", "templates"],
includeCustomized: false }`, and `renderPreview: true`. Inspect
`renderedPreview.footerHtml` and `renderedPreview.samples[].beforeHtml/afterHtml`.
Pass the identical inputs and `previewToken: application.token` to
`set_default_email_component`. You can also supply `sample: { id, kind }` to
preview an affected version. Omitting `application` keeps future-only saves.

## Live sequence tests with event properties

`sequenzy sequences test-run <sequenceId> --subscriber <subscriberId> --event-properties '{"cart_id":"cart_123","event_ids":["event_1"]}' --speed-multiplier 120 --json` starts a real test via `POST /api/v1/sequences/{sequenceId}/test-runs`. Use `test-run-get <sequenceId> <runId> --json` to inspect via GET on the run URL. Both support `--company`.

MCP equivalents: `start_sequence_test_run` accepts `sequenceId`, `subscriberId`, optional `customVariables` object, optional integer `speedMultiplier` (60–10000, default 120), and optional `companyId`; `get_sequence_test_run` accepts `sequenceId`, `runId`, and optional `companyId`. Start needs sequences:activate and subscribers:read; inspect needs sequences:read and subscribers:read. JSON output returns `run` with status, step logs, recipient and timing/error fields; creation also returns jobId. Human output prints ID/status and any error.

Event data must be an object (omit or {} for none; null/scalar/array roots invalid). Nested arrays/objects are retained for event.\* references, without recording an event. Only one active same-company subscriber with email is supported. Live tests execute real actions; emails are marked as tests. 409 indicates an active duplicate run. Inspect failures before retrying: completed actions are not rolled back and a new test can repeat them. Queue jobs have one ordinary attempt, but stalled-job recovery can replay actions after worker loss; enqueue failures mark the run failed. Existing `sequences test` / `send_sequence_test_email` still test one saved email step; `simulate_sequence` stays a dry run.

On the OpenAI-reviewed MCP surface, `customVariables` uses the same restricted personal-data checks as event properties, including text nested in objects or arrays.

### Reuse received event data for sequence tests

Use `sequenzy events sample <eventName> --company <companyId> --json`, MCP `get_event_sample`, or `GET /api/v1/events/sample?eventName=<eventName>` to read the latest retained payload in your workspace. Requires `subscribers:read`. This includes older and custom events across all subscribers; `sample: null` means none exists. Copy `sample.properties` into the test run's `customVariables` (CLI `--event-properties`) and edit as needed. The dashboard's **Use latest received event** button replaces the JSON field. Copying data does not change the selected recipient or fire an event. Clear the field, omit the properties, or pass `{}` to test without overrides. Lookup errors are safe to retry; starting a real test still has delivery side effects.

## Renaming your company in footers

When you change your company name in Settings, select the option to also replace
matching names in existing email footers. Only footer company names exactly equal
to the previous name change. Saved components and editable emails are included;
custom names, body copy, sent or sending campaigns and active A/B tests are preserved.
The operation does not send emails. Existing open editor drafts may still contain
the old name; reload them before continuing to edit.

With the API or MCP `update_company`, pass `name`, `renameMatchingFooters: true`
and `previousCompanyName` from get company. In the CLI, use
`sequenzy companies update comp_123 --name Grove --rename-matching-footers --previous-company-name Linear`.
The option defaults to false. A stale previous name returns 409 with no changes;
refresh the company and confirm again. Repeating a completed rename is safe.

Only the new `renameMatchingFooters: true` option additionally requires `emails:write`, `templates:write`, `campaigns:write`, `sequences:write`, `transactional:write` and `ab_tests:write`. Personal keys also require workspace owner or admin access. Ordinary company updates keep their existing permissions.

### Progress blocks

For a recipient's progress toward a goal (trial days, onboarding steps, installments), use a `progress` block: `variant` `bar`, `segments` or `steps`, `value` and `max`, and `valueSource`/`maxSource` set to a custom attribute or event field such as `onboardingStepsDone` or `event.paidInstallments` so each contact sees their own numbers (contacts without a number skip the block; add a numeric fallback such as `onboardingStepsDone|0` to show it anyway). Run `sequenzy blocks progress` (MCP `get_email_block_schema`) for every field.

### Cart design assistance

`sequenzy blocks preview-cart --items-file items.json --fields '{"title":"name"}' --scenario many --price-unit minor --company COMPANY --json` calls `POST /api/v1/email-blocks/line-items/assist`. Inline `--items` is also supported. MCP `preview_cart_items` uses `items`, `itemFields`, `scenario`, and `priceUnit`. Supply at most 50 objects. Scenarios are real (default, unchanged clone), one, many (12 rows), empty, missing-images and long-names. Nonempty sample scenarios synthesize a sample when no items are supplied. This authenticated operation accepts existing restricted keys and never reads company data, saves or sends.

Responses include suggestions (field/path/example), priceCandidates (path/example/unknown units), previewItems, scenario, isSample and Compact/Classic/Showcase presets. Apply suggestions explicitly and preserve existing mappings. For numeric prices select `priceUnit: "minor"` for cents or `"major"` for major-unit amounts. The separate total remains in cents. Validation errors return 400; auth returns 401/403. Transport retries are safe because assistance has no side effects.

Read current blocks using existing campaign/sequence/template/transactional detail commands, then save chosen `itemFields`, `priceUnit`, `imageSize` (32–120), `rowSpacing` (0–32), `fontSize` (12–24), `imageFit` (cover/contain) and `showPrices` using existing block replacement workflows. Preserve unrelated fields. Remove optional properties to reset, never use null. Existing render commands/tools accept scenario items under `variables` at the block's source; view resulting HTML at desktop/mobile widths. Rendered rows still respect maxItems. Previewing never updates recipients or event samples.

## Script input and structured recovery

Supported text-file options such as `--html-file`, `--blocks-file`, `--steps-file`,
and `--canvas-file` accept `-`. Positional subscriber/event import files accept
`-`, and `--audience-json @-` reads audience JSON. Use one stdin input per command
and regular files for other inputs; binary product uploads require paths.
Piped confirmation workflows still require `--yes`.

With `--json`, parse stderr as JSON Lines. Terminal failures use
`{ success: false, error: { code, message, howToFix, docsUrl, statusCode?, retryAfterSeconds? } }`
and a nonzero exit. Earlier diagnostics use `type: "warning"` or `type: "recovery"`;
keep `requestKey` from recovery records before retrying subscriber operations.
Success data remains on stdout. Partial event imports can also return their
counts and row failures on stdout with a nonzero exit and no terminal stderr
error; inspect stdout even when the command fails. MCP failures retain `isError` and text alongside
the error envelope in `structuredContent`; strict-profile errors omit raw API
context. Preserve partial-import counts and row failure details.

`retryAfterSeconds` is advisory, derived from a valid API Retry-After header.
Both clients retry a read (GET) up to 3 times within about 3 seconds after a
502, 503, 504 or network error, waiting out a `Retry-After` of 5 seconds or
less; they never retry a write. An uncertain email send must reuse the
original idempotency key and input, and an uncertain subscriber operation must
reuse its request key. Inspect existing status before repeating side effects.

### Campaign audience status

- `campaigns list --json` and MCP `list_campaigns` include `hasAudience`: an explicit targeting choice, not a final recipient count. Human CLI output labels configured draft audiences. `campaigns from-audience` saves matching contact IDs directly in the draft without creating a list or enrolling contacts.

### Running campaign A/B controls

Use `ab-tests get <id> --json` / `get_ab_test` to inspect actual variant content,
`progress`, original audience percentage, `testStartedAt`, `testEndsAt`, and any
`pendingSampleUpdate`. The winning metric does not identify which content differs.
Update via `ab-tests update <id> --test-percentage 30 --duration-minutes 120` /
`update_ab_test` with `testPercentage` and `testDurationMinutes`. Duration is total
minutes from the original start, 15–1440; an elapsed deadline requests selection
immediately. Percentage is 5–50 of the full original audience. Committed sends
keep their variants; the worker waits for previous jobs and can reject a shrink.
The winning metric cannot change during campaign testing. Paused campaigns stay
paused. Previously issued settings keys keep their existing scopes.

Repeat the same percentage to retry pending work safely. Discard only a failed
request with `--cancel-sample-update` / `cancelSampleUpdate: true`, without a new
percentage. To stop a running campaign test early and let its criteria pick the
winner from the results so far, use `--end-now` / `endTestNow: true` (needs
`campaigns:send`; it sends the winner to the remaining audience). GET after an uncertain response, since settings may have saved before
enqueue failed. Capture `updatedAt` when reviewing changes and pass
`--expected-updated-at` / `expectedUpdatedAt` for stale-update protection.
Use `ab-tests select-winner <id> <variantId>` / `select_ab_test_winner`
only when winner delivery is authorized; it ends the comparison and queues the
remaining audience. Repeat the same winner to repair interrupted delivery.
Pending sample changes block selection. Finishing early requires existing
`ab_tests:write` and `campaigns:send` scopes; sample/time updates use `ab_tests:write`.

On a sequence A/B test, the same command/tool selects or changes the winner,
including one picked automatically at the test sample size, when the user asks
to promote a variant. Contacts who already got a variant keep it; everyone who
reaches the step afterwards gets the new winner. Sequence tests need
`ab_tests:write` and `sequences:write` (not `campaigns:send`), plus
`--confirm-live-change` / `confirmLiveChange: true` while the sequence is active.
Use `ab-tests resume <id>` / `resume_ab_test` when the user wants to keep
testing a sequence test that already has a winner: it clears the winner, splits
contacts again, keeps results, and waits for a manual `select-winner`. Turn
automatic selection back on with `ab-tests update <id> --auto-select-winner` /
`update_ab_test` `autoSelectWinner: true` only when the user asks.

When reducing a campaign sample, only queue jobs whose sends have never started and that have no committed recipients can be withdrawn. Active jobs and pending transport retries finish first, so the minimum can rise before the change applies. Retrying preserves the request; discarding a failed change keeps work already performed, including withdrawn sample jobs. Recipients without committed sends remain eligible for the eventual winner.

### Campaign variations (Canvas)

Variations are alternative versions of a campaign's email, compared side by side
on the editor's Canvas tab. They never change what the campaign sends until
`use`. Labels are `V1`, `V2`, ... for versions of the email and `V2.1`, `V2.2`,
... for branches of `V2`; labels are never reused.

| Task                          | CLI                                                                                                                      | MCP                                                         | API                                                       |
| ----------------------------- | ------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------- | --------------------------------------------------------- |
| List                          | `sequenzy campaigns variations list <campaign-id>`                                                                       | `list_campaign_variations`                                  | `GET /api/v1/campaigns/{campaignId}/variations`           |
| Get one                       | `sequenzy campaigns variations get <campaign-id> <variation-id>`                                                         | `get_campaign_variation`                                    | `GET .../variations/{variationId}`                        |
| Generate 1-4 with AI          | `sequenzy campaigns variations generate <campaign-id> --prompt "..." [--count 3] [--parent <variation-id>] [--style close\|fresh\|bold] [--wait]` | `generate_campaign_variations` | `POST .../variations/generate` (202) |
| Save content as a variation   | `sequenzy campaigns variations create <campaign-id> --name "..." --blocks-file blocks.json`                              | `create_campaign_variation`                                 | `POST .../variations`                                     |
| Rename, replace content, move | `sequenzy campaigns variations update <campaign-id> <variation-id> [--name] [--blocks-json] [--email-theme-json] [--font-family] [--position x,y \| --reset-position]` | `update_campaign_variation` | `PATCH .../variations/{variationId}` |
| Change one with AI            | `sequenzy campaigns variations edit <campaign-id> <variation-id> --prompt "..." [--sections h1,cta]` | `edit_campaign_variation` | `POST .../variations/{variationId}/edit` |
| Options for selected sections | `sequenzy campaigns variations section-options <campaign-id> --sections h1,cta --prompt "..." [--variation <id>] --json` | `generate_campaign_variation_section_options`               | `POST .../variations/section-options`                     |
| Discard / restore             | `sequenzy campaigns variations discard <campaign-id> <variation-id>`, then `restore` with the same ids                   | `discard_campaign_variation` / `restore_campaign_variation` | `DELETE .../variations/{variationId}`, `POST .../restore` |
| Use in the campaign           | `sequenzy campaigns variations use <campaign-id> <variation-id>`                                                         | `use_campaign_variation`                                    | `POST .../variations/{variationId}/use`                   |

- Generation does not wait. Poll `list` (or pass `--wait`) until no variation is
  `generating`. Each succeeds or fails on its own; one still generating after 10
  minutes is reported as `failed`. Retrying creates new variations.
- An email can have at most 8 variations generating at once; a request past
  that returns `409`. Wait for the running ones to finish instead of retrying.
- `--parent` / `parentVariationId` builds on a ready variation; new versions stay
  close to it unless you pass `--style` / `style`. `bold` designs each version
  anew with its own layout, `emailTheme` and `fontFamily`; use it when the user
  asks for something completely different.
- `edit` changes one ready variation with AI and saves it (synchronous, up to a
  minute). `409` means it is not ready or changed meanwhile: retry. `400` means
  the AI changed nothing; the error says why.
- `use` is draft-only and also applies the variation's own theme and font. When
  the email's current content is not already a variation, it is saved first as
  "Before <label>" and returned as `savedPrevious`, so the previous version is
  never lost; variations that follow the email's look keep the one they had.
- Section options save nothing: swap an option's `replacements` into the
  variation's blocks by id and save them with `update`.
- Discard needs `campaigns:write`, not `campaigns:delete`, and `restore` undoes it.

### Sequence emails with AI (Emails view)

The sequence editor's Emails view shows every email of a sequence side by side
and changes all of them with one AI request. The CLI, MCP and API do the same
request and save the result (or return it with a dry run).

| Task | CLI | MCP | API |
| ---- | --- | --- | --- |
| Change every email, or the ones the prompt names | `sequenzy sequences edit-emails <sequence-id> --prompt "..."` | `edit_sequence_emails` | `POST /api/v1/sequences/{sequenceId}/emails/edit` |
| Change listed emails | `... --emails email_1,email_2` | `emailIds` | `emailIds` |
| Change sections of one email | `... --emails email_2 --sections hero1,cta1` | `emailIds` + `sectionIds` | `emailIds` + `sectionIds` |
| See the changes without saving | `... --dry-run --json` | `dryRun: true` | `dryRun: true` |
| Design variations of one email | `sequenzy sequences variations generate <sequence-id> --email <email-id> --prompt "..." [--wait]` | `generate_sequence_email_variations` | `POST /api/v1/sequences/{sequenceId}/emails/{emailId}/variations/generate` |
| List or preview them | `sequences variations list <sequence-id> --email <email-id>`; `sequences render <sequence-id> --node <node-id> --variation <variation-id>` | `list_sequence_email_variations`; `render_email` + `variationId` | `GET .../emails/{emailId}/variations`; render with `variationId` |
| Use one for the email, or every email's style | `sequences variations use <sequence-id> <variation-id> --email <email-id> [--all] [--dry-run]` | `use_sequence_email_variation` (`scope: "all"`) | `POST .../variations/{variationId}/use` |
| Discard one | `sequences variations discard <sequence-id> <variation-id> --email <email-id>` | `discard_sequence_email_variation` | `DELETE .../variations/{variationId}` |

- Without `--emails` / `emailIds` the prompt decides: every email unless it
  names some ("email 2", "the last email").
- A look change (background, colors, fonts) is made identical across the
  emails it restyles, so they keep matching.
- Each email reports `changed`, `unchanged` (with why) or `failed`; failed
  emails can be sent again on their own with `--emails`. Changed emails are saved
  (`saved: true`) unless it is a dry run, and on an active sequence they go out
  with the next sends.
- Emails written in HTML are edited as HTML and keep their theme. A/B test
  steps and steps without an email are listed in `skipped`; edit A/B variants
  with `update_ab_test_variant`.
- Needs `sequences:write`. Synchronous; up to 12 emails per request (batch
  longer sequences with `--emails`). A `503` means the AI couldn't tell which
  emails the prompt means: retry or pass `--emails`. After a timeout, read the
  sequence before retrying, since changes may already be saved.
- For exact values (one background color, a preset) use `update_sequence_nodes`
  instead of the AI.
- Variations never change the email until `use`. Generation returns at once;
  poll the list (or `--wait`) until each is `ready` or `failed`. `use` saves the
  variation's blocks, theme and font into the email, which keeps its subject and
  preview text; with `--all` / `scope: "all"` every other email takes its style
  exactly, keeping its words. The previous design is not kept, so `--dry-run`
  first. `edit-emails` answers `400` to a "make a few variations" prompt. In MCP
  Apps clients the list and generate tools show the variations rendered.

### Company-wide goals in campaign lists

`sequenzy campaigns goals list <campaign-id>` and MCP `list_campaign_goals` use
`GET /api/v1/campaigns/{campaignId}/goals`. The existing `goals` array contains
campaign-specific goals. `companyGoals` contains automatically applied Settings
goals, including inactive records, with their original scope, triggers and windows.
Human CLI output labels them separately; JSON and MCP retain both arrays. Custom
company-wide goals require an open or click; campaign-specific goals can count
a conversion after a send alone. Manage company-wide goals in Settings, and do
not pass their IDs to campaign goal update/delete. Restricted members cannot read
these Settings definitions. A failed list request can be retried without side effects.

For a paid-member list, use `sequenzy lists update list_123 --allow-member-unsubscribe` to allow existing members to opt out without making the list public. Use `--no-allow-member-unsubscribe` to disable. Create supports the same flags. API and MCP use boolean `allowMemberUnsubscribe`: default false on create, omission preserves on update, false clears, null rejected. Public lists retain their normal behavior. Read the stored setting with `sequenzy lists --json` or MCP `list_lists`; after an uncertain create, inspect before retrying.

## Interactive email and sequence previews

In clients that support MCP Apps, including compatible ChatGPT and Claude connections, you can review your saved emails and sequences directly in the conversation.

- `render_email` opens the rendered email with **Desktop** (640px) and **Mobile** (375px) views, its subject, preview text and personalization warnings. Pass a campaign ID, template ID, or sequence ID plus node ID using the existing tool inputs. It renders your saved content through Sequenzy's email renderer. Personalization and locale options remain available through the same tool.
- `preview_sequence({ companyId, sequenceId })` opens the saved sequence as a connected diagram with triggers, delays, branches and actions. Select an email to render it, switch between available A/B variants, or use the **Emails** tab to browse the sequence's emails. Random splits show their configured allocation. **Refresh** reloads saved content, and failed requests offer an explicit retry.

Supporting workflows use compact cards in the same Sequenzy style:

- `open_image_upload({ companyId })` opens an image picker. Choose a PNG, JPEG, GIF or WebP up to 10 MB, optionally describe it, then select **Upload image**. Opening the widget does not write anything. Submission uses `upload_image_asset` with your existing permissions and returns the saved asset to your assistant. After an uncertain failure, check your image library before retrying; uploads are never automatically retried.
- `monitor_subscriber_import({ companyId, importId })` shows counts and progress for an existing import. It polls `get_subscriber_import` every five seconds while running, for up to five minutes. Completion, blocked status, errors or leaving the view stop polling. **Refresh status** restarts monitoring. This does not start or retry imports.

Both widgets pin the company explicitly. Clients without MCP Apps can use `upload_image_asset` and `get_subscriber_import` directly; the same operations are available through the existing REST API and CLI.

The sequence preview requires an explicit company ID from `get_account` and keeps every email render pinned to that company. Previews never activate sequences, enroll subscribers or send email. A/B previews require the existing access to variant content; unavailable variants are shown as unavailable instead of being replaced with the control email.

Email content is isolated from the widget. Scripts, forms, nested frames and link navigation are disabled; external stylesheets and fonts are not loaded. HTTPS email images may load from their original hosts, subject to the client's policy. The widget itself bundles its logo and font and uses authenticated MCP tool calls without exposing credentials. Actual email-client rendering can differ, so use test sends for final inbox verification.

Clients without MCP Apps still receive the existing rendered HTML or sequence data. The same workflows are available through the existing public render and sequence-read endpoints and CLI render/sequence commands. No new REST endpoint or CLI command is needed for this presentation layer.

## B2B accounts

Use `sequenzy accounts list`, `get`, `upsert`, `members`, `add-member`, `remove-member`, `event`, `events`, and `delete` to manage customer-owned organizations and their contacts. The dashboard calls accounts Organizations, and `sequenzy organizations` is the same command. Organization attributes are available as `organization.<name>` segment fields and sequence conditions and as `{{organization.<name>}}` merge tags (`account.*` is an older alias). Account events are recorded on the account timeline and delivered to `owners` (falling back to admins), `admins`, or `all`; use `none` to record without delivery. Pass `--event-id` when retries must resume only failed recipients. Account writes require the subscriber scopes, and account events also require `events:write`. Accounts here are your customers' organizations, not your Sequenzy account (`sequenzy account`). The workspace turns Accounts on with its first account; if contacts already use an `account` or `account.*` custom attribute, that first upsert fails with 409 until the attribute is renamed. Until Accounts is on, `subscribers event --account` is ignored (the CLI prints a warning and JSON output includes `accountIgnored`). Bulk-created accounts start with every contact as a member, so account events sent to owners or admins reach nobody; find them with `sequenzy accounts list --without-event-recipients` (MCP `list_accounts` with `withoutEventRecipients: true`) and set roles with `accounts add-member <externalId> --email <email> --role owner|admin`. In sequences started by account events, use `{{event.organization.*}}` merge tags (the organization the event was sent for; `{{organization.*}}` is the contact's primary organization; the `account` spellings still work). Matching-field enrollment on `organization.externalId` (or `account.externalId`) means one run per organization at a time: only the first member the event reaches enrolls, so do not use it for alerts every admin should get.

`sequenzy accounts suggestions [--min-contacts <n>] [--limit <n>]` lists work email domains that several contacts share (default 3 contacts, 25 suggestions), with a few sample emails each, skipping personal and disposable providers, the workspace's sending domains, domains where a contact already belongs to an account and domains an account already uses. It is read-only (`subscribers:read`). `sequenzy accounts accept-suggestions <domain...>` (up to 25, `subscribers:write`) creates one account per domain (external ID and domain set to the domain) with the domain's unassigned contacts as members, or adds them to the one existing account that uses the domain. Results report `created`, `updated` or `skipped` (`no_contacts`, `multiple_accounts`, `already_in_account`); retries are safe, and no sync rules or segment-entered sequences run. MCP parity: `list_account_suggestions` and `accept_account_suggestions`.

When the app already sends an organization ID, create accounts from it instead. `sequenzy accounts detect-org-ids` (read-only, `subscribers:read`) lists event properties from the last 180 days and contact attributes that look like one (such as `workspaceId` or `account_id`), with organization counts and a matching name key. `sequenzy accounts preview-org-id <propertyKey> [--source event|attribute] [--name-key <key>] [--limit <n>]` (read-only) shows the biggest accounts it would create: the name each gets (from `--name-key`, otherwise the work email domain most of its contacts share, preferring a customer domain over the workspace's own), contact counts, sample emails and the ID. `sequenzy accounts create-from-org-id <propertyKey> [--source] [--name-key] [--wait] [--yes]` (`subscribers:write`) shows that preview, asks for confirmation and starts a background run that creates one account per ID and adds its contacts as members; a run already in progress for the key is reported with `alreadyRunning`. Check it with `sequenzy accounts org-id-job <jobId>` (`queued`, `running`, `completed` with counts, `failed` with the error). Existing names, domains and roles are kept, nothing is sent, no sync rules or segment-entered sequences run, and reruns are safe; the first run returns 409 while contacts use an `account` or `account.*` attribute. MCP parity: `detect_account_organization_ids`, `preview_accounts_from_organization_id`, `create_accounts_from_organization_id` and `get_account_organization_id_job`.

### Capture submission history

Use `sequenzy submissions <type> <id> --json` or MCP `list_capture_submissions`
to inspect immutable accepted payloads and labels. Requires `subscribers:read` plus `widgets:read` for forms/popups or
`landing_pages:read` for landing pages. Filter using `--field session --value morning` (MCP `field`
and `value`); both are required together. Follow `nextCursor` with unchanged
filters. CLI `--csv` exports all matching pages; MCP `format: "csv"` adds a CSV
string for one page. Tracking covers forms, popups and landing pages. Reconstructed history is explicitly marked with `payload.recovery`; treat its date as an evidence event time, not a verified submission time.
Records contain normalized accepted answers, not raw headers/tokens or current
profile values, and are not proof of double opt-in. Contact/form/company deletion
removes snapshots. Never invent historical answers or automatically resubmit a
form to recover a missing record: retries can repeat subscriber side effects.

For reconstructed submissions, preserve `payload.recovery` provenance and describe source attribution as inferred. CLI human output labels event time. CSV exports containing recovered rows append `record_origin`, `timestamp_meaning` and `recovered_at`. Do not fabricate missing answers or perform an operator recovery through subscriber writes.

If `enroll-audience --apply --keep-enrolling` starts enrollment but cannot save keep-enrolling, the command exits nonzero and still reports the started run ID. JSON output includes `partialSuccess: true`, `autoEnrollError`, and `recovery` alongside the enrollment result. Follow the configuration-only `sequences update` recovery command; do not repeat the enrollment command.
