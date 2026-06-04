# Command Reference

## Source Of Truth

- Command registration: `packages/cli/src/index.tsx`
- Auth storage and config: `packages/cli/src/config.ts`
- HTTP requests: `packages/cli/src/api.ts`
- Implemented handlers: `packages/cli/src/commands/`

If docs and code disagree, trust the code.

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

Set `SEQUENZY_API_KEY` in the environment. `packages/cli/src/config.ts` checks this before local storage, so it is the safest path for automation.

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
sequenzy urls --company comp_123 --settings-tab integrations
sequenzy urls --company comp_123 --json
```

Behavior:

- uses `SEQUENZY_APP_URL` as the base URL, defaulting to `https://sequenzy.com`
- if `--company` is omitted, tries the current company from `GET /api/v1/account`
- returns route templates, settings tab values, and concrete URLs when a company ID is known
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
sequenzy stats --campaign camp_123
sequenzy stats --sequence seq_123
```

Behavior:

- no ID: `GET /api/v1/metrics?period=7d|30d|90d`
- `--campaign`: `GET /api/v1/metrics/campaigns/:id`
- `--sequence`: `GET /api/v1/metrics/sequences/:id`

Output includes:

- `sent`
- `delivered`
- `opened`
- `clicked`
- `unsubscribed`
- `openRate`
- `clickRate`

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
sequenzy subscribers add user@example.com --tag premium --attr name=John --attr plan=pro
sequenzy subscribers add user@example.com --tag premium --tag beta --company comp_123 --json
```

Behavior:

- sends `POST /api/v1/subscribers`
- body shape is `{ email, tags, customAttributes }`
- supports repeated `--tag` values
- supports `--company` and `--json`

### Get

```bash
sequenzy subscribers get user@example.com
sequenzy subscribers get user@example.com --company comp_123 --json
```

Behavior:

- sends `GET /api/v1/subscribers/:email`
- returns the full subscriber profile, including list memberships, sequence enrollments, email stats, and recent activity
- supports `--company` and `--json`

### Remove

```bash
sequenzy subscribers remove user@example.com
sequenzy subscribers remove user@example.com --hard
sequenzy subscribers remove user@example.com --company comp_123 --json
```

Behavior:

- without `--hard`, sends `PATCH /api/v1/subscribers/:email` with `{ status: "unsubscribed" }`
- with `--hard`, sends `DELETE /api/v1/subscribers/:email`
- supports `--company` and `--json`

## Transactional Send

### Template-based

```bash
sequenzy send user@example.com --template tmpl_123 --var name=John
```

### Raw HTML

```bash
sequenzy send user@example.com --subject "Hello" --html "<h1>Hi</h1>"
sequenzy send user@example.com --subject "Hello" --html-file ./email.html
```

Behavior:

- sends `POST /api/v1/transactional/send`
- body shape is `{ to, templateId, subject, html, variables }`

Validation enforced by the CLI:

- require either `--template` or `--html`/`--html-file`
- require `--subject` when sending raw HTML

## Companies, Lists, Tags, And Segments

### Companies

```bash
sequenzy companies list
sequenzy companies get comp_123
sequenzy companies create example.com --name Example
```

Behavior:

- `companies list`: `GET /api/v1/companies`
- `companies get`: `GET /api/v1/companies/:id`
- `companies create`: `POST /api/v1/companies`

### Lists

```bash
sequenzy lists list
sequenzy lists create Newsletter --description "Public newsletter list"
sequenzy lists create VIP --private --company comp_123
sequenzy lists add-subscribers list_123 --email one@example.com two@example.com
sequenzy lists add-subscribers list_123 --emails-json '["one@example.com","two@example.com"]'
sequenzy lists add-subscribers list_123 --emails-file ./batch-001.csv
sequenzy lists import list_123 --emails-file ./batch-001.csv
```

Behavior:

- `lists list`: `GET /api/v1/lists`
- `lists create`: `POST /api/v1/lists`
- create body shape is `{ name, description, isPrivate }`
- `lists add-subscribers` and `lists import`: `POST /api/v1/lists/:listId/subscribers`
- add-subscribers body shape is `{ emails, duplicateStrategy, enrollInSequences, optInMode }`
- the CLI splits large files into API-safe batches of up to 500 emails
- files may be newline-separated, CSV with an email column, a JSON email array, or a JSON object with `emails` or `subscribers`
- CSV headers named `email`, `e-mail`, `email address`, or `mail` are detected; otherwise the first column is used

### Tags

```bash
sequenzy tags
sequenzy tags --company comp_123 --json
```

Behavior:

- sends `GET /api/v1/tags`
- this is list-only; there are no tag mutation commands in the current CLI

### Segments

```bash
sequenzy segments list
sequenzy segments count seg_123
sequenzy segments create --name "Bought Pro" --stripe-product prod_pro
sequenzy segments create --name "3+ Pro Payments" --stripe-product prod_pro --purchase-operator at-least --payments 3
sequenzy segments create --name "VIP or Churn Risk" --match any --filter-json '[{"field":"tag","operator":"contains","value":"vip"},{"field":"emailOpened","operator":"is_not","value":"30d"}]'
sequenzy segments create --name "Active non-paying" --filter-json '{"kind":"group","id":"root","joinOperator":"and","children":[{"kind":"filter","id":"f1","field":"attribute","operator":"gte","value":"last_login_days_ago:0"},{"kind":"group","id":"g1","joinOperator":"or","children":[{"kind":"filter","id":"f2","field":"attribute","operator":"is_empty","value":"plan_end"},{"kind":"filter","id":"f3","field":"attribute","operator":"lt","value":"plan_end:2026-04-21"}]}]}'
```

Behavior:

- `segments list`: `GET /api/v1/segments`
- `segments count`: `GET /api/v1/segments/:id/count`
- `segments create`: `POST /api/v1/segments`
- `--filter-json` accepts either the legacy raw segment filter array or a nested filter `root` object
- `--match all|any` controls whether top-level filters are combined with `and` or `or`
- MCP/API use `filterJoinOperator: "and" | "or"` for the same behavior
- nested segment logic uses `{ "kind": "group", "joinOperator": "and" | "or", "children": [...] }`
- custom event filters use `field: "event"` with values like `saas.purchase:30d`, `saas.purchase:all`, or `saas.purchase:5:30d`
- saved segment composition uses `field: "segment"` with `operator: "is" | "is_not"` and the referenced segment id as `value`
- Stripe product filters use `field: "stripeProduct"` and product IDs, not product names
- threshold operators encode the count as `productId:count`, for example `prod_pro:3`

## Templates

```bash
sequenzy templates list
sequenzy templates list --label edm
sequenzy templates get tmpl_123
sequenzy templates create welcome --subject "Welcome" --label edm --html-file ./welcome.html
sequenzy templates create welcome --subject "Welcome" --blocks-file ./welcome-blocks.json
sequenzy templates update tmpl_123 --subject "Updated" --label edm --html-file ./welcome-v2.html
sequenzy templates update tmpl_123 --blocks-file ./welcome-v2-blocks.json
sequenzy templates delete tmpl_123
```

Behavior:

- `templates list`: `GET /api/v1/templates`, optionally with `?label=...`
- `templates get`: `GET /api/v1/templates/:id`
- `templates create`: `POST /api/v1/templates`
- `templates update`: `PUT /api/v1/templates/:id`
- `templates delete`: `DELETE /api/v1/templates/:id`

Caveats:

- list accepts `--label <labels...>` to filter by template label name
- create requires `name`, `subject`, and either `html` or `blocks`; it can also assign labels with `--label <labels...>`
- update accepts `name`, `subject`, `html`, `blocks`, and replacement labels with `--label <labels...>`
- `--blocks-json` and `--blocks-file` pass Sequenzy block arrays through directly
- conditional email content is only available through block JSON, using a block-level `condition` object
- raw HTML is still stored as a single text block by the current API path
- deletion can fail if the template is still referenced by a campaign or sequence

## Campaigns

```bash
sequenzy campaigns list
sequenzy campaigns list --status draft --label edm --company comp_123
sequenzy campaigns get camp_123
sequenzy campaigns create "April Launch" --prompt "Announce our new dashboard"
sequenzy campaigns create "April Launch" --subject "We shipped" --label edm --html-file ./campaign.html
sequenzy campaigns create "April Launch" --subject "We shipped" --blocks-file ./campaign-blocks.json
sequenzy campaigns update camp_123 --subject "Updated subject" --label edm
sequenzy campaigns update camp_123 --blocks-file ./campaign-v2-blocks.json
sequenzy campaigns update camp_123 --reply-to support@example.com
sequenzy campaigns update camp_123 --reply-profile reply_123
sequenzy campaigns schedule camp_123 --at "2026-06-01T14:00:00Z"
sequenzy campaigns schedule camp_123 --at "2026-06-01T14:00:00Z" --target-lists-json '{"type":"all"}'
sequenzy campaigns test camp_123 --to you@example.com
```

Behavior:

- `campaigns list`: `GET /api/v1/campaigns`, optionally with `?status=...` and `?label=...`
- `campaigns get`: `GET /api/v1/campaigns/:id`
- `campaigns create`: `POST /api/v1/campaigns`
- `campaigns update`: `PUT /api/v1/campaigns/:id`
- `campaigns schedule`: `POST /api/v1/campaigns/:id/schedule`
- `campaigns test`: `POST /api/v1/campaigns/:id/test`
- dashboard-aware responses include `url`, campaign review `previewUrl`, and `appUrls` when the company can be resolved

Caveats:

- list accepts `--status` and `--label <labels...>` filters
- create supports `name`, optional `subject` when `--prompt` is used, `html`, `blocks`, `--prompt`, `--style`, `--tone`, and labels with `--label <labels...>`
- update supports `name`, `subject`, `html`, `blocks`, replacement labels with `--label <labels...>`, `--reply-to`, and `--reply-profile`
- schedule requires `--at <datetime>` with a future ISO timestamp and a verified sending domain
- schedule can pass targeting with `--target-lists-json` or `--target-lists-file`; omit it to reuse saved targeting or default to all active subscribers
- `--spread-over-hours` accepts integers from 1 to 72 and takes precedence over send-time optimization
- `--prompt` generates draft campaign content through `POST /api/v1/generate/email`; do not combine it with HTML or block flags
- `--blocks-json` and `--blocks-file` pass Sequenzy block arrays through directly
- conditional email content is only available through block JSON, using block-level `condition` rules
- `--reply-to` resolves an existing reply profile by email and `--reply-profile` sets it directly by ID
- `--reply-to` and `--reply-profile` are mutually exclusive
- `campaigns get` now includes saved reply-to details when the campaign has a reply profile
- only draft campaigns can be updated through this API path
- there is no CLI command for immediate send, pausing, or cancelling campaigns
- in the current backend checkout, `campaigns test` returns a success message path rather than a confirmed email send

MCP parity:

- `list_templates` and `list_campaigns` accept `label`
- `create_template`, `update_template`, `create_campaign`, and `update_campaign` accept `labels`
- `update_campaign` accepts `name`, `subject`, `html`, `blocks`, `labels`, `replyTo`, and `replyProfileId`
- `schedule_campaign` accepts `campaignId`, `scheduledAt`, optional `targetLists`, `sendTimeOptimization`, and `spreadOverHours`
- `replyTo` and `replyProfileId` are mutually exclusive
- MCP rejects calls that omit all update fields before hitting the API
- MCP rejects unsupported extra update fields before hitting the API

## Sequences

```bash
sequenzy sequences list
sequenzy sequences get seq_123
sequenzy sequences create onboarding --trigger event_received --event-name signup.completed --goal "Guide new users to activation" --email-count 4
sequenzy sequences create onboarding --trigger contact_added --list-id list_123 --steps-file ./steps.json
sequenzy sequences create winback --trigger tag_added --tag-name cancelled --steps-file ./discount-steps.json
sequenzy sequences update seq_123 --steps-file ./sequence-updates.json
sequenzy sequences update seq_123 --branch-file ./branch.json
sequenzy sequences enable seq_123
sequenzy sequences disable seq_123
sequenzy sequences delete seq_123
sequenzy sequences cancel-enrollments seq_123 --subscriber-id sub_123 --reason "Converted"
sequenzy sequences cancel-enrollments seq_123 --field-path order.id --field-values ord_123,ord_456
sequenzy sequences cancel-enrollments seq_123 --field-values price_123 --apply
```

Behavior:

- `sequences list`: `GET /api/v1/sequences`
- `sequences get`: `GET /api/v1/sequences/:id`
- `sequences create`: `POST /api/v1/sequences`
- `sequences update`: `PUT /api/v1/sequences/:id`
- `sequences enable`: `POST /api/v1/sequences/:id/enable`
- `sequences disable`: `POST /api/v1/sequences/:id/disable`
- `sequences delete`: `DELETE /api/v1/sequences/:id`
- `sequences cancel-enrollments`: `POST /api/v1/sequences/:id/enrollments/cancel`
- dashboard-aware responses include `url` on sequence records and `appUrls` on the top-level JSON when the company can be resolved

Caveats:

- CLI sequence creation supports either AI `--goal` mode or explicit `--steps-json` / `--steps-file` mode
- explicit create steps can include `{ "type": "create_discount" }`; emails after that action can reference `{{discount.code}}`, `{{discount.percentOff}}`, and related `discount.*` merge tags
- discount action sequences require a connected Stripe integration before activation
- `--email-count` is only meaningful with `--goal`
- `--email-count` accepts 1 to 10 generated emails
- trigger-specific options depend on `--trigger`
- updates accept either step payloads or email payloads via `--steps-*` or `--emails-*`
- branch insertion uses `--branch-json` or `--branch-file` with condition types `has_tag`, `in_list`, `in_segment`, `event_received`, `link_clicked`, and `field_*`
- branch condition fields are `tagId`/`tagName`, `listId`, `segmentId`/`segmentName`, `eventName`, `linkUrl`, `activityScope`, or `fieldName`/`fieldValue`; omit `linkUrl` to match any clicked link
- for `event_received` and `link_clicked`, set `activityScope` to `this_sequence`, `previous_email`, or `ever`; omitting it checks the contact's full history
- `cancel-enrollments` requires a sequence ID and exactly one target: `--subscriber-id` or `--field-values`
- `--field-values` matches active/waiting enrollments by the stored entry event property at `--field-path`, or the sequence's configured `enrollmentFieldPath` when `--field-path` is omitted
- CLI cancellation is a dry run unless `--apply` is passed; use dry runs for field-value/bulk checks before mutating enrollments
- MCP uses `cancel_sequence_enrollments` with the same target rule; set `dryRun: false` to apply field-value cancellation

## AI Generation

```bash
sequenzy generate email "Welcome a new user to our analytics product"
sequenzy generate email "Product launch announcement" --style branded --tone friendly
sequenzy generate sequence "Onboard a new workspace admin" --count 4 --days 14
sequenzy generate subjects "April product launch" --count 8
```

Behavior:

- `generate email`: `POST /api/v1/generate/email`
- `generate sequence`: `POST /api/v1/generate/sequence`
- `generate subjects`: `POST /api/v1/generate/subjects`
- `--json` returns the raw API response for agent/tool parsing

Caveats:

- generated content is draft content and should be reviewed before sending
- `generate sequence --count` accepts 1 to 10 emails
- `generate email` supports optional `--style` and `--tone`

## API Keys

```bash
sequenzy api-keys create
sequenzy api-keys create --name "CI deploy key" --company comp_123
```

Behavior:

- sends `POST /api/v1/api-keys`
- body shape is `{ name }`

Caveat:

- the plain API key is returned only at creation time; save it immediately

## Websites

```bash
sequenzy websites list --company comp_123
sequenzy websites add example.com --company comp_123
sequenzy websites check example.com --company comp_123
sequenzy websites guide --framework nextjs --use-case transactional
```

Behavior:

- `websites list`: `GET /api/v1/websites`
- `websites add`: `POST /api/v1/websites`
- `websites check`: `GET /api/v1/websites/:domain`
- `websites guide`: `POST /api/v1/integration-guide`

## Commands To Treat As Unsupported

Treat these requested workflows as unsupported in the CLI even though related nouns exist:

- campaign immediate send, pause, cancel, or resume flows
- tag creation, update, or deletion
- list update or deletion

## Operational Caveats

- prefer `SEQUENZY_API_KEY` for automation instead of interactive login
- use `--json` when another tool or agent needs structured output; dashboard-aware commands add `url`/`appUrls` fields when possible
- when the user asks for a workflow outside the current CLI surface, say so directly and choose between dashboard or direct API use instead of inventing commands
