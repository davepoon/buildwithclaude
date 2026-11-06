---
name: sequenzy-email-marketing
description: Primary agent guide for operating Sequenzy as an email-marketing platform. Use when an AI agent needs to authenticate, inspect identity, manage subscribers, create or edit campaigns/sequences/templates, control the campaign lifecycle (cancel, pause, resume, delete, duplicate), run campaign A/B tests, mutate lists/tags/segments, enroll subscribers into sequences, invite team members, triage and reply to inbox conversations, manage outbound webhooks, generate draft email content, send transactional email, read delivery stats, or decide whether a requested Sequenzy email-marketing workflow is currently supported. Prefer this over the generic sequenzy skill when both seem relevant.
category: email
---

# Sequenzy Email Marketing

## Overview

Use this as the default skill for Sequenzy email-marketing/product operations: subscribers, lists, tags, segments, campaigns, sequences, templates, AI email generation, transactional sends, delivery stats, dashboard URLs, CLI/MCP behavior, and currently-supported workflow checks. Prefer the `sequenzy` CLI for supported workflows, treat the MCP server's tool list as the MCP source of truth when the task goes through MCP tools, and explicitly call out when a requested workflow is not wired in the current implementation. If both `sequenzy` and `sequenzy-email-marketing` match, load this skill first.

## Ground Rules

1. Treat `sequenzy --help` and `sequenzy <command> --help` from the installed CLI as the source of truth for which commands and flags are actually wired.
2. Treat the MCP server's tool list (tool names, descriptions and input schemas) as the source of truth for MCP tool names, arguments, and validation.
3. Treat the [API reference](https://docs.sequenzy.com/api-reference) as the source of truth for request and response shapes.
4. Do not promise support for commands or tools that appear only in docs. Confirm them in `--help` or the MCP tool list, and report runtime "not implemented" or "unsupported" errors as limitations.
5. Prefer `sequenzy login` for interactive auth and `SEQUENZY_API_KEY` for automation.
6. Prefer inspection before mutation whenever the workflow allows it.

Create a draft directly from a complete selected group with `campaigns from-audience --selection-json` or `--selection-file` (MCP `create_campaign_for_audience`). Preserve every filter and all selected IDs; membership is frozen, while send eligibility stays live. Review selectedCount and eligibleCount before editing and scheduling.

## Supported Workflows

For MCP tool effect annotations and feedback attribution, read [MCP effect disclosures](references/use-cases.md#mcp-effect-disclosures).

Read [references/use-cases.md](references/use-cases.md) before executing anything non-trivial. The currently implemented CLI flows are:

- login and logout
- local auth/session check with `whoami`
- account inspection with `account`
- company inspection, creation, or brand/sender-identity updates with `companies list|get|create|update`
- stats overview or stats by campaign, sequence, or transactional ID, with custom `--start`/`--end` ranges, `--email-type` and `--mailbox-provider` scoping, `--include-bots`, and campaign `clickedLinks` plus poll/NPS `polls` arrays (sequence stats carry the same summaries per email step in `steps[].polls`)
- raw delivery/engagement event listing with `events --campaign|--sequence`, and per-delivery inspection with `email-sends list|get` plus bounce-suppression cleanup with `suppressions get|remove`
- subscribers `list`, `add`, `update`, `get`, and `remove`, with `list` fetching every page by default and supporting tag, segment, and list filters; `add` and `update` set native profile names via `--first-name` / `--last-name` (MCP `add_subscriber` / `update_subscriber`: `firstName` / `lastName`), so never store names in custom attributes; both also handle native phone numbers and SMS consent; `add` covers explicit list IDs with `subscribers:write`, while imports into explicit lists and dedicated list membership operations require `lists:write`; omitting list IDs keeps the default-list behavior
- background filtered-audience tagging with `subscribers operations start|list|get|cancel`; inspect failure samples, reuse request keys after uncertain starts, and reconcile uncertain contact updates before retrying
- contacts under Sequenzy review are held: a campaign whose audience includes them returns `waiting_approval` for every account and size, sequence emails to them pause the enrollment, and `emailType: "marketing"` transactional sends to them stay `pending` with an `errorMessage` starting "Held for review"; report this to the user instead of retrying or re-importing, which does not release them
- bulk subscriber imports with `subscribers import` / `import-status`, subscriber notes, custom event triggering with `subscribers event` (live or `--occurred-at` backfill), and bulk tag operations with `subscribers tags add|remove`
- B2B accounts with `accounts list|get|upsert|members|add-member|remove-member|event|events|delete|suggestions|accept-suggestions`; `suggestions` groups contacts by shared work email domain (read-only) and `accept-suggestions <domain...>` creates only the domains the user confirms; organization (account) attributes reach members as `organization.*` segment fields, sequence conditions and merge tags (`account.*` still works), event-started sequences can enroll once per organization with matching field `organization.externalId`, and account events can deliver to owners, admins, all members, or record only (customer organizations, not `sequenzy account`)
- lists `list`, `create`, `update`, `delete`, `add-subscribers`, `remove-subscribers`, and `import` alias for bulk list population from emails, JSON, CSV, or newline files
- tags `list`, `create`, `update`, and `delete`, with bare `sequenzy tags` still listing tag definitions for backwards compatibility
- segments `list`, `create`, `update`, `delete`, and `count`, including `--match any`, nested filter roots, custom event filters, push device/activity filters, and saved-segment composition filters
- templates `list`, `get`, `create`, `update`, and `delete`, with `list` supporting label filters and `create`/`update` accepting labels, raw HTML, or Sequenzy block JSON
- campaigns `list`, `get`, `create`, `update` including label and reply-to updates, `schedule`, and `test`, with `list` supporting label filters, `create` accepting labels plus raw HTML, Sequenzy block JSON, or prompt-generated content, `update` accepting labels plus raw HTML or Sequenzy block JSON, and `schedule` returning a review preview link; `create` and `schedule` both accept the audience via `--segment` or `--target-lists-json`/`--target-lists-file`
- campaign lifecycle control with `campaigns cancel` (stops scheduled, paused, waiting-approval, or sending campaigns immediately, no confirmation prompt), `campaigns unschedule` (returns a scheduled campaign or recurring series to draft), `campaigns pause` and `campaigns resume` for an active send (resume supports `--spread-over-hours`), `campaigns update`/`campaigns schedule --max-recipients <count>` to send to only the first N matching subscribers (`--clear-max-recipients` removes the cap), `campaigns create`/`campaigns update --attach <files...>` to send files such as a PDF report with every email (`--clear-attachments` removes them), `campaigns delete` (blocked while sending, scheduled, or paused - cancel first), and `campaigns duplicate` with `--mode campaign|ab_test|variant`
- For capped A/B campaigns, use at least one recipient per variant plus one for the winner. Raise or explicitly clear a rejected limit before scheduling again.
- campaign audience inspection with `campaigns audience`, true-to-send HTML previews with `campaigns render` / `templates render` / `sequences render` (subscriber or ad-hoc personalization, locale, tracking, `--out`), pre-send checks with `campaigns check` / `templates check` / `sequences check --node` (live broken-link and image verification plus the editor's content rules; `--fail-on error` for scripts), recurring sends with `campaigns schedule --repeat weekly|monthly`, and post-send re-engagement with `campaigns resend-to-non-openers` Preserve hard `excludedCampaignOpenerIds` through manual adjustments and repeated resends; audiences use live membership. Recreate older drafts missing this metadata from the original campaign, then review before scheduling.
- ab-tests `list`, `get`, `stats`, `restart`, `update-variant`, `create`, `add-variant`, `delete-variant`, and `delete`; create/add-variant/delete-variant/delete work on campaign A/B tests in draft status, variant A is the protected control, and `restart` reruns a finished sequence A/B test. For a sequence A/B step, `sequences get --json` and MCP `get_sequence` expose each variant's full blocks when `ab_tests:read` is granted; edit them only through `ab-tests update-variant` / `update_ab_test_variant`
- campaign variations (the editor's Canvas tab) with `campaigns variations list|get|generate|create|update|section-options|discard|restore|use` and the matching MCP `*_campaign_variation(s)` tools: generate returns at once (poll or `--wait`), nothing changes the campaign until `use` (drafts only, previous content kept as a variation), and variations are not A/B tests
- sequence-wide AI edits (the sequence editor's Emails view) with `sequences edit-emails <id> --prompt "..." [--emails ids] [--sections ids] [--dry-run]` and MCP `edit_sequence_emails`: without `--emails` the prompt decides (every email unless it names some), a look change is identical across the emails it restyles, each email reports changed/unchanged/failed, and changed emails are saved unless it is a dry run; emails written in HTML are edited as HTML, and A/B test steps are skipped; to try a few designs of one email first, use `sequences variations generate <id> --email <emailId> --prompt "..." --wait` / `generate_sequence_email_variations`, then `sequences variations use <id> <variationId> --email <emailId> [--all] [--dry-run]` / `use_sequence_email_variation` (nothing changes until use)
- MCP template and campaign tools support labels on list/create/update; MCP `update_campaign` also supports `replyTo` and `replyProfileId`, and MCP `schedule_campaign` schedules draft or already scheduled campaigns
- MCP `search_subscribers` supports list filters through `list`, `listId`, or `listName`; MCP `add_subscribers_to_list` accepts up to 500 emails per call
- sequences `list`, `get`, `create`, `update`, `enable`, `disable`, `delete`, `enroll`, `cancel-enrollments`, and per-contact `pause-subscribers`/`resume-subscribers`, including explicit discount action steps, cancellation by subscriber ID or event-property field values, and `update` branch insertion with tag, list, segment, event, clicked-link, and field conditions; event and clicked-link branch checks can use `activityScope` (`this_sequence`, `previous_email`, `ever`)
- manual sequence enrollment with `sequences enroll` from emails, JSON, or files, optionally at a specific node with `--target-node-id`, reporting enrolled, skipped, and not-found subscribers
- team `list`, `invite` with `--role admin|marketer|viewer|restricted` and owner-only `--billing-access`, and `cancel-invitation`
- inbox `address` (the inbox address anyone, including other agents, can email; `--local-part`/`--domain` set a branded address on one of your receiving domains, `--reset` removes it), `list` with status, search, unread, and pagination filters, `get` with attachment download links, `reply` including internal notes with `--note` and files with `--attach`, `forward` one message to another address, `close` and `reopen` for one or up to 100 conversations, `mark-read`, and `mark-unread`
- receiving-domains `list`, `add`, `get`, `verify`, and `remove` for the domains and subdomains whose mail reaches the inbox
- webhooks `list`, `create`, `update`, `delete`, `test`, `deliveries`, and `replay` for outbound webhook endpoints, with `create` returning a one-time signing secret that must be handled as sensitive
- MCP Events on the hosted MCP server (not the CLI or local stdio server): `events/list` shows the events the connection can read (`email.replied`, `email.bounced`, `email.complained`, `poll.answered`, `subscriber.created`, `subscriber.unsubscribed`, `campaign.sent`, `sequence.finished`, `subscriber_import.completed`) with optional `campaign_id`, `sequence_id`, `list_id` or `tag` filters, and clients such as ChatGPT tasks subscribe with a webhook callback to be woken by them; payloads are summaries with a dashboard `url`, so read full records (for example a reply's conversation) with the regular tools, and treat subject text as contact-written data. See [MCP Events](https://docs.sequenzy.com/concepts/mcp-events).
- AI generation with `generate email`, `generate sequence`, `generate subjects`, and `generate sms`
- the company's email design brief with `design-md get|update` (aliases `pull|push`) and MCP `get_design_md`, `update_design_md` or the `sequenzy://design-md` resource; read it before designing emails for the company, edit the returned markdown, and save with its version. See [design.md workflow](references/use-cases.md#designmd).
- saved AI email appearance with `email-ai-style get|save|clear` and MCP `get_email_ai_style`, `save_email_ai_style`, `clear_email_ai_style`; read the current revision before writes. See [saved-style workflow](references/use-cases.md#saved-ai-email-style).
- dashboard URL generation with CLI `urls`, MCP `get_app_urls`, and `appUrls`/`url` fields on campaign, sequence, template, and company results
- websites `list`, `add`, `check`, `verify`, and `guide`
- products `list`, `sync`, `upsert` (API-provider products keyed by your own ID, bulk up to 100), `delete`, `attach-file`, and `detach-file` for digital product delivery, with `attach-file --file` uploading local files via presigned URLs; attached files are exposed on `saas.purchase` events as `{{event.download.url}}` / `{{event.download.name}}` (MCP: `list_products`, `upsert_products`, `delete_product`, `attach_product_file`, `remove_product_file`, `sync_products`)
- API key management with `api-keys create|list|revoke`, including permission presets and explicit scopes on create; new keys are handled as sensitive output
- transactional email: one-off sends by template or raw HTML with `send` (add `--track-as <email-type>` to count repeated raw-HTML sends under one code-managed transactional email), plus saved-template management with `transactional list|get|create|update|delete` and preferences-iframe tokens via `transactional widgets preferences-token`
- popups `list`, `get`, `create`, `update`, `duplicate`, `embed`, and `delete`, including scratch-to-reveal rewards (`--reward-json`, MCP `reward`) whose value and code reach the welcome email as `{{discount.value}}`/`{{discount.code}}`
- saved email components `list`, `get`, `create`, `update` (including rename), `duplicate`, and `delete` (`sequenzy components ...`, MCP `*_email_component`)
- forms `list` and `update` (MCP additionally: `create_form`, `get_form_embed`) and full landing-page management with `landing-pages` including publish/unpublish, duplicate, custom domains, and DNS verification
- sequence operations beyond CRUD: `render`, per-node `test` sends, `duplicate`, `archive`/`unarchive`, enrollment listing with CSV export, `pause-enrollments`/`resume-enrollments`, conversion `goals`, and inbound trigger `webhook get|configure|rotate`
- template AI/manual localization with `templates localizations set|sync`, and company-wide translation of sequence and transactional emails with `templates localizations coverage|translate-missing`
- integrations: `catalog`, `connect` (API-key/webhook-secret providers; OAuth providers connect in the dashboard), `list`, `get`, `activity`, `sync`, `disconnect` (Lemon Squeezy, including cleanup retry, and SparkLoop), `enable-sync`/`disable-sync`, Shopify `pixel`/`enable-pixel`, two-way Attio sync with `attio`/`set-attio-lists`, and `guide`
- Meta Ads audience syncs with `audience-syncs list|ad-accounts|create|update|delete|sync`
- warehouse sync in from Snowflake/BigQuery/Redshift/Postgres with `warehouse connections list|get|create|update|delete|test|preview` and `warehouse syncs list|get|create|update|delete|run|runs` (MCP: `create_warehouse_connection`, `preview_warehouse_query`, `create_warehouse_sync`, `run_warehouse_sync`, `list_warehouse_sync_runs` and related tools)
- warehouse data exports to S3/GCS buckets with `data-exports list|get|create|update|delete|test|run|runs` (MCP: `list_data_exports`, `create_data_export`, `update_data_export`, `delete_data_export`, `test_data_export`, `run_data_export`, `list_data_export_runs`)
- deliverability and sending config: `sender-profiles list|update`, `tracking settings|update` (open/click tracking, direct sequenzy.com unsubscribe links with `--unsubscribes off`, `--store-content off` to keep no email content, subjects or open/click IP addresses, strict bot filtering, attribution window, double opt-in, auto-UTM), and sequence/step-level sending windows
- Shopify automation settings with `shopify settings get|update` (browse abandonment, cart abandonment, price drop)
- SMS operations with `sms settings`, `sms update` (label, brand prefix, link shortening), `sms send-test`, SMS sequence steps, and `generate sms`
- push notifications with `push settings`, `push web`, `push ios set` / `push android set`, `push devices`, `push send-test`, `push campaigns`, and `type: "push"` sequence steps for web, iOS, and Android
- moving a push audience from OneSignal, Braze, Customer.io or a CSV with `push imports preflight|start|get|list|resume|cancel` (MCP `get_push_import_preflight`, `create_push_import`, `add_push_import_rows`, `start_push_import`, `get_push_import`, `list_push_imports`, `cancel_push_import`): show the preflight warnings before starting, because imported APNs/FCM tokens only work with the same bundle ID, Apple team and Firebase project; web push is never imported; opted-out devices stay unsubscribed; contacts are matched by external ID then email and created quietly for opted-in devices (push-only, with no email or phone, when the device has only an external ID). See [push imports](references/command-reference.md#push-imports)
- iOS Live Activities with `push live-activities list|start|update|end` (MCP `list_live_activities`, `start_live_activity`, `update_live_activity`, `end_live_activity`): start remotely on one contact's iPhones (iOS 17.2+, alert required, attributes must include every field of the app's struct), then update or end every running copy by the same contact and your `activityId` (end needs the final content state); `tokenCount: 0` means nothing was sent. Confirm with the user before starting one, since a repeated start shows a second activity
- in-app messages and content cards with `type: "in_app"` sequence steps (modal, banner, fullscreen, card, or `html`: custom HTML/CSS/JS such as a Survicate survey or Braze custom HTML, shown sandboxed by the SDKs with a JS bridge, Braze Liquid converted) that the customer's app (or the Sequenzy SDKs) fetches and renders, plus `in-app list`, `in-app event`, `in-app delete`, `in-app stats`, `in-app templates` (ready-made step configs), `in-app write` (AI copy from a brief), and `in-app html validate|set` (check a custom HTML document, put it on a step); a button with `action: "request_push_permission"` (template `push-primer`) is a push primer that asks for notification permission, with results in `in-app stats`, the app opt-in rate in `push settings`, and the contact's `pushPermission` attribute for segments
- mobile apps: the iOS, Android, React Native and Flutter SDKs identify contacts, `track` custom events, register push tokens and show in-app messages and cards with a publishable key restricted by `web-tracking create|update --app-ids com.example.app` (MCP `allowedAppIds` on `create_web_tracking_key` / `update_web_tracking_key`) plus an identity token the app's backend mints with `POST /api/v1/web-tracking-identities`; never put a secret key in an app. App events cannot use built-in names such as `saas.purchase`
- mobile app companies: set `websiteType: mobile_app` (`companies update --category mobile_app`, MCP `update_company`) to get push-first journeys from `sequences templates` / `list_sequence_templates`; create them with `sequences create-from-template` / `create_sequence_from_template` (RevenueCat, Superwall and Adapty events; `has_push_device` branch with email fallback; daytime waits in each contact's timezone)
- integration event-to-tag sync rules with `sync-rules get|update`
- personal notification preferences with `account notifications get|set`
- account health with `account-health` (report), `account-health run`, `account-health settings` (`--enabled`/`--no-enabled` for the fixed Monday 05:00 UTC check, `--autonomy draft_fixes|report_only`; findings ride in the Monday weekly report and each person opts out with `notifications set --account-health off`) and `account-health insight <id> dismiss|snooze|resolve|reopen`, `account-health fix <insightId>` to build the draft sequence a finding asks for, `account-health feedback <insightId> useful|not_useful [--comment <text>|--clear-comment]` to pass on whether a finding helped the user (it reaches the Sequenzy team only and changes nothing; send it only when the user says so) (MCP: `get_account_health`, `update_account_health_settings`, `run_account_health_check`, `update_account_health_insight`, `create_account_health_fix`, `submit_account_health_feedback`); checks need more than 1,000 active subscribers and an email sent in the last 14 days, drafted fixes are inactive sequences named for the business with titled email steps; the check writes no email, they are written when the draft is opened in the dashboard or `account-health fix <insightId>` is run for it, and nothing is sent or activated
- single-contact `createdAt` values at most one hour old remain eligible for signup notifications; older dates and bulk imports do not notify on creation, but double opt-in confirmation can still notify, and sequence enrollment defaults are unchanged
- product feedback with `feedback`, sending missing-capability reports, bug reports, and other product feedback straight to the Sequenzy team (MCP: `submit_feedback`; not on the OpenAI-reviewed route)

## Company Tracking Domain

Tracked links use one company tracking domain, shared by every sending domain
(for example `links.example.com`). The first sending domain creates it on its
root and returns its CNAME as `website.dnsRecords.trackingRecord`; publish it
with the other records. It is optional and never blocks verification or
sending: until it verifies, or if it breaks or is removed, links use the shared
Sequenzy domain. Read it with `tracking domain` or `get_tracking_domain`. Set
or change it with `tracking domain set <hostname>` or
`set_tracking_domain` (any subdomain works; confirm the hostname with the user
first), check it with `tracking domain verify` or `verify_tracking_domain`, and
remove it with `tracking domain remove --yes` or `remove_tracking_domain` only
after the user confirms: links and images in emails already sent through it
stop working.
Changing it keeps those links working while the old CNAME stays.
`websites configure` and `configure_sending_domain` are deprecated.

New sending domains publish their bounce subdomain as one CNAME
(`website.bounceRecords.cnameRecord`, the `Bounce:` line in the CLI), which
also works where the DNS host blocks custom MX records. Domains added earlier
show SPF TXT and MX records instead (`bounceRecords.style` is `mx_txt`); keep
those. Never publish both at the same name.

When `dnsRecords.platformDnsRecords` is present (domains added from October
2026), publish those CNAMEs instead of the DKIM TXT in `byodkimRecord`: the
`sq1` and spare `sq2` DKIM selectors and an `rp2` return-path CNAME (`bounces`
on domains added October 14, 2026, `srp` on some domains added October 15, 2026). Publish all of them; only entries with
`required: true` block verification, and that return-path CNAME, once it
resolves, aligns SPF on every email.

Use `sequenzy websites add <domain>`, `websites check <domain>`, and
`websites verify <domain>` for sending-domain setup and verification. MCP
provides `add_sending_domain`, `check_website` (`get_sending_domain` on the
OpenAI-reviewed route), and `verify_sending_domain`.

When `website.dnsUpgrade.status` is `available` (a verified domain on the
previous record set, including an older SES-only domain that has a working
DMARC record; without one the start returns `400` and the status is
`unavailable`, so help the user add DMARC first), `websites upgrade-dns <domain>` or
`upgrade_sending_domain_dns` moves it onto the current per-domain CNAMEs
without removing it: a recommended, optional one-time upgrade to our new DNS
structure for better deliverability and security. Confirm with the user first,
since they must edit DNS.
Relay `dnsUpgrade.records` (four CNAMEs) to add next to the current records,
removing nothing; the domain keeps sending on its current records and switches
by itself about an hour after the required ones are visible on public DNS
(`websites verify` checks now but does not skip the wait). Sending is normally
not interrupted at the switch; if that isn't possible for a domain, emails sent
through Amazon SES can be held for a few minutes. The domain also gets a new
2048-bit DKIM key; the four CNAMEs stay the same. When `status` is
`completed`, tell them they may delete `oldRecords` (optional; each is marked `removed` once
gone from public DNS; `replacedRecords` lists them before the switch) after `deleteOldRecordsAfter` (8
days after the switch; for an older SES-only domain that includes the old
return path MX and TXT at `send.<domain>` and the DKIM TXT, and DMARC stays).
Once started, an upgrade can't be cancelled; until the switch it changes
nothing.

## Receiving Domains

A receiving domain is a domain or subdomain whose mail reaches the Sequenzy
inbox: mail to any address on it arrives. A workspace has one, and like the
tracking domain it serves every sending domain: once it is verified, replies to
emails from all sending domains come back to reply addresses on it. Until then,
replies use Sequenzy's shared address. Workspaces that set up several before
keep them; replies then prefer the sender's own domain or one on the same root,
else the oldest verified one. Adding a second one returns `409 limit_reached`.
Manage it with
`sequenzy receiving-domains` (`list`, `add <domain>`, `get <domain>`,
`verify <domain>`, `remove <domain> --yes`) or MCP `list_receiving_domains`,
`add_receiving_domain`, `get_receiving_domain`, `verify_receiving_domain` and
`remove_receiving_domain`. After adding one, publish its MX record (and the TXT
record when listed), then verify; the first verification turns Inbox on.
`verified` means mail arrives and new reply
addresses use it; `pending` means the records are not found yet (a new name is
reserved for 7 days); `failed` means something broke: mail that still arrives
is accepted, but new reply addresses use Sequenzy's address until it is fixed.
A domain that already receives email elsewhere (its MX points at Google
Workspace, Microsoft 365, Cloudflare Email Routing...) is refused with
`409 domain_has_mailbox`: suggest a subdomain such as `support.acme.com` and
confirm the name with the user. `503 dns_check_failed` means the MX lookup got
no answer; retry in a minute. Turning Inbox on with `replyTrackingEnabled`
(`companies update --enable-reply-tracking`, MCP `update_company`) returns
`409 receiving_domain_required` when the workspace has no verified receiving
domain and has never received a conversation; add a receiving domain instead.
Remove one only after
the user confirms: all mail to it stops, including replies to emails already
sent, and a branded inbox address on it is cleared. Sending domains
(`websites`, `add_sending_domain`) no longer set up receiving; `inbound*`
fields that may still appear in `website.dnsRecords` describe an older reply
setup.

## Unsupported Or Placeholder Workflows

Treat missing subcommands as unsupported even when the noun exists. The main remaining gaps: campaign immediate send (no "send now" command - schedule with a near-future `--at` timestamp instead), form creation and embed snippets (MCP `create_form` / `get_form_embed` only), and image asset upload (MCP `upload_image_asset` only, PNG/JPEG/GIF/WebP up to 10MB). Bulk list population is supported through `sequenzy lists add-subscribers` and its `sequenzy lists import` alias, not through `subscribers add`. Send feedback only when the user explicitly asks you to send it. Before submitting, tell the user that the message goes to the Sequenzy team. Follow the active MCP tool's data restrictions; omit credentials, unrelated subscriber data, email content, and raw API/debug payloads.

## Workspace Roles

Inspect `sequenzy account` or MCP `get_account` before choosing a privileged workflow. Account-key permissions combine selected scopes with your current workspace role; `roleRestrictedScopes` identifies scopes blocked by that role. `canSendLive` means at least one delivery workflow is available, not that every send tool is allowed.

Marketers can manage marketing content, subscribers, campaigns and sequences, including marketing test sends and unscheduling. They cannot use transactional sending or manage team, billing, integrations, API keys, sending identities or workspace settings. Choose existing sender/reply profiles; inline creation of a new profile is also restricted. Transactional-backed templates and their campaign, A/B and sequence sources stay protected through copies, previews, share links, analytics and retained send history. Use the narrowest eligible role; billing access cannot be granted to marketers or restricted members.

## Execution Pattern

1. Check auth first with `sequenzy whoami` or by verifying `SEQUENZY_API_KEY` is set. If MCP tools return `MCP_AUTH_REQUIRED`, the server has no key: relay the signup link and setup steps from `howToFix` to the user instead of retrying.
2. Pick the narrowest command that matches the use case.
3. Validate IDs, recipient email, subject, template, or content input before issuing a mutation.
4. Surface CLI limitations directly instead of inventing a workaround.
5. If the workflow is unsupported in the CLI, say whether the next-best path is the Sequenzy dashboard or direct API use. Submit feedback only if the user explicitly requests it, after explaining that it goes to the Sequenzy team.
6. When you create, inspect, or schedule a campaign, sequence, template, or company and the user may want to review/edit it, surface the dashboard URL from `url`, `previewUrl`, or `appUrls` in the tool/CLI output. If needed, generate it with `sequenzy urls` or MCP `get_app_urls`.
7. Destructive commands (`delete`, `delete-variant`, `cancel-invitation`, and similar) prompt for confirmation. Pass `--yes` (or `-y`) to skip the prompt; `--yes` is required when stdin is not a TTY, which covers most agent and CI runs.
8. Treat API keys, webhook signing secrets, and other one-time credentials as sensitive output. Do not paste raw secret values into chat, logs, tickets, or public transcripts. Capture them to a user-approved secure destination such as a password manager, secret store, encrypted file, or local `.env` file outside version control; otherwise redact the value and report only where it was saved plus a short fingerprint.
9. Call out implementation caveats that matter operationally, such as `whoami` using cached local auth state, sequence creation supporting both `--goal` and explicit step modes, explicit discount steps requiring Stripe before activation, generated sequences being capped at 10 emails, `campaigns test` queuing a real email rather than confirming delivery, and conditional email content requiring block JSON rather than raw HTML.

`campaigns test` requires a verified sending domain and returns `emailSendId` and `jobId`. Inspect delivery with `sequenzy email-sends get EMAIL_SEND_ID`. Use `websites check` to read stored status and `websites verify` to run a fresh DNS check; DNS verification and readiness to send are separate outcomes.

## Dashboard URLs

Use `SEQUENZY_APP_URL` as the dashboard base when it is set; otherwise default to `https://sequenzy.com`.

Prefer actual URLs returned by the CLI/MCP result:

- sequence editor: `/dashboard/company/{companyId}/sequences/{sequenceId}`
- campaign editor: `/dashboard/company/{companyId}/campaign/{campaignId}`
- campaign preview/review: `/dashboard/company/{companyId}/campaign/{campaignId}?step=review`
- template/email editor: `/dashboard/company/{companyId}/emails/{emailId}`
- settings: `/dashboard/company/{companyId}/settings`
- settings tab: `/dashboard/company/{companyId}/settings?tab={tab}`

`campaigns goals` / `list_campaign_goals` also show company-wide Settings goals in `companyGoals`. These already apply after an open or click within their window; do not recreate them as campaign goals merely to make them apply. Inactive goals remain listed. Manage company-wide definitions in Settings.

Useful settings tabs include `domain`, `tracking`, `localization`, `integrations`, `events` (includes sync rules), `tags` (includes labels), `goals`, `api-keys` (includes SMTP), `widgets`, and `team`. Older `sync-rules`, `labels` and `smtp` tab links still open the tab that contains them.

## References

- [references/command-reference.md](references/command-reference.md): exact command shapes, env vars, behavior, and caveats.
- [references/use-cases.md](references/use-cases.md): decision trees and examples for the most common agent tasks.

For default footer changes, preserve the requested scope and use the preview/token
workflow in [the command reference](references/command-reference.md#apply-a-default-footer-to-existing-emails).
Render before/after HTML when a visual check would help.

For event-driven sequence testing, use the live sequence test workflow in `references/command-reference.md`. Supply cart IDs and arrays as event properties, inspect the returned run before retrying, and account for real action side effects.

### Reuse received event data for sequence tests

Use `sequenzy events sample <eventName> --company <companyId> --json`, MCP `get_event_sample`, or `GET /api/v1/events/sample?eventName=<eventName>` to read the latest retained payload in your workspace. Requires `subscribers:read`. This includes older and custom events across all subscribers; `sample: null` means none exists. Copy `sample.properties` into the test run's `customVariables` (CLI `--event-properties`) and edit as needed. The dashboard's **Use latest received event** button replaces the JSON field. Copying data does not change the selected recipient or fire an event. Clear the field, omit the properties, or pass `{}` to test without overrides. Lookup errors are safe to retry; starting a real test still has delivery side effects.

When renaming a company, offer optional exact-match footer replacement with `update_company` (`name`, `renameMatchingFooters: true`, `previousCompanyName` from `get_company`). Preserve custom names and protected campaigns. Omit the flag unless requested; refresh and reconfirm on 409. See the command reference for CLI usage.

For footer typography, patch `emailTheme.typography` (`footerFontFamily`, `footerFontSize` 10-16px, `footerLineHeight` 1-2; `null` resets each) with `update_company`: it styles footer blocks and the auto-added footer, and a footer block's own `fontFamily` still wins. Change the auto-added footer's colors and copy with `update_company` `footerTheme`, a merge patch where `null` resets a field; do not replace `brandColors` for this. Edit the double opt-in confirmation email (`consent.doubleOptInEmailId` from `get_tracking_settings`) with `update_template`, keeping `{{DOUBLE_OPT_IN_URL}}` in the content: an edit without it returns 400.

For cart design, use `preview_cart_items` or `sequenzy blocks preview-cart` to inspect supplied items, suggest fields and preview edge cases. Confirm numeric price units explicitly; apply selected mappings and preset settings through existing block update tools. Scenario previews never save. See the command reference for inputs and reset behavior.

## Automation input and errors

Use `send --json --company COMPANY_ID` for scripted sends and provide one stable
`--idempotency-key` per logical email. Keep the accepted receipt and inspect its
`emailSendId`; queued does not mean delivered. Supported text-file inputs accept
`-` for stdin, with one logical stdin input per invocation; binary uploads still
require paths. Parse CLI stderr as JSON Lines, preserving warning/recovery
records and their request keys before terminal error envelopes. Inspect stdout
on nonzero exits too: partial event imports retain their counts and row failures
there without a terminal stderr error. MCP failures
include the error envelope in `structuredContent` while retaining `isError` and
text. Honor advisory `retryAfterSeconds`, but inspect status and reuse the
original key and input before repeating a write. Both clients retry a read
(GET) up to 3 times within about 3 seconds after a 502, 503, 504 or network
error; writes are never retried automatically.

For sequence review, keep the same sample contact across email steps and A/B variants. Use simulation to check readiness and the existing activation and enrollment commands when requested. See [use cases](references/use-cases.md).

Campaign A/B progress, live audience/time changes, early finish and recovery are described in [the command reference](references/command-reference.md#running-campaign-ab-controls).

## Transactional labels

Organize transactional templates with company labels using `transactional
create/update --label Billing Receipts`, `transactional list --label Billing`,
and `transactional update receipt --clear-labels`. MCP create/update/list tools
accept `labels`; `[]` clears assignments, while omission preserves them on
update. Get/list responses include label names. Labels only organize templates;
they do not send email. See the command reference for validation and retry behavior.

Private lists support `allowMemberUnsubscribe` in API/MCP and `--allow-member-unsubscribe` / `--no-allow-member-unsubscribe` for CLI list create/update. Default off; omission preserves on update, false clears, null is invalid. When enabled, current members see the name and may opt out; they cannot join or rejoin through preferences. Public lists ignore this stored setting.

## Interactive MCP previews

Use `render_email` to show a saved campaign, template or sequence email in desktop/mobile preview in MCP Apps clients. Before scheduling a campaign or activating a sequence, run `check_email` (CLI: `campaigns check`, `sequences check --node`, `templates check`) and fix `error` issues, especially `links.broken`; `restricted` links refused an automated check and only need a manual look. Use `preview_sequence` with explicit company and sequence IDs for a connected flow; click steps to render their saved emails and available A/B variants. Previews are read-only and never authorize sends, activation or enrollment. Respect personalization warnings and unavailable variant content. See the command reference for host restrictions and text-only fallbacks.

Keep email and sequence previews primary. For supporting workflows, use `open_image_upload` for an explicit user-submitted image and `monitor_subscriber_import` for an existing import. Pin `companyId`; check the image library before retrying uncertain uploads.

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

The submission-payload tool is available on standard MCP. The OpenAI-reviewed
MCP profile excludes it under its existing raw-payload restrictions; use the
dashboard, API or CLI for this workflow on that profile.

For reconstructed submissions, preserve `payload.recovery` provenance and describe source attribution as inferred. CLI human output labels event time. CSV exports containing recovered rows append `record_origin`, `timestamp_meaning` and `recovered_at`. Do not fabricate missing answers or perform an operator recovery through subscriber writes.
