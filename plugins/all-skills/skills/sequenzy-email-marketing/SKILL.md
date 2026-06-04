---
name: sequenzy-email-marketing
description: Agent guide for operating Sequenzy. Use when Codex needs to authenticate, inspect identity, manage subscribers, create or edit campaigns/sequences/templates, generate draft email content, send a transactional email, read delivery stats, or decide whether a requested Sequenzy workflow is currently supported. Prefer the CLI when it is implemented, and fall back to the dashboard or direct API use when the current CLI surface is only partial.
category: email
---

# Sequenzy Email Marketing

## Overview

Use this skill when the task is to operate Sequenzy, not to change Sequenzy's source code. Prefer the `sequenzy` CLI for supported workflows, treat `packages/mcp/src/tools/index.ts` as the MCP source of truth when the task goes through MCP tools, and explicitly call out when a requested workflow is not wired in the current implementation.

## Ground Rules

1. Treat `packages/cli/src/index.tsx` as the source of truth for which commands are actually wired.
2. Treat `packages/cli/src/commands/` and `packages/cli/src/api.ts` as the source of truth for CLI behavior, payload shape, and API routes.
3. Treat `packages/mcp/src/tools/index.ts` as the source of truth for MCP tool names, arguments, and preflight validation.
4. Do not promise support for commands or tools that only appear in docs or `--help` text without an attached implementation.
5. Prefer `sequenzy login` for interactive auth and `SEQUENZY_API_KEY` for automation.
6. Prefer inspection before mutation whenever the workflow allows it.

## Supported Workflows

Read [references/use-cases.md](references/use-cases.md) before executing anything non-trivial. The currently implemented CLI flows are:

- login and logout
- local auth/session check with `whoami`
- account inspection with `account`
- company inspection or creation with `companies list|get|create`
- stats overview or stats by campaign/sequence ID
- subscribers `list`, `add`, `get`, and `remove`, with `list` fetching every page by default and supporting tag, segment, and list filters
- lists `list`, `create`, `add-subscribers`, and `import` alias for bulk list population from emails, JSON, CSV, or newline files
- tags `list`
- segments `list`, `create`, and `count`, including `--match any`, nested filter roots, custom event filters, and saved-segment composition filters
- templates `list`, `get`, `create`, `update`, and `delete`, with `list` supporting label filters and `create`/`update` accepting labels, raw HTML, or Sequenzy block JSON
- campaigns `list`, `get`, `create`, `update` including label and reply-to updates, `schedule`, and `test`, with `list` supporting label filters, `create` accepting labels plus raw HTML, Sequenzy block JSON, or prompt-generated content, `update` accepting labels plus raw HTML or Sequenzy block JSON, and `schedule` returning a review preview link
- MCP template and campaign tools support labels on list/create/update; MCP `update_campaign` also supports `replyTo` and `replyProfileId`, and MCP `schedule_campaign` schedules draft or already scheduled campaigns
- MCP `search_subscribers` supports list filters through `list`, `listId`, or `listName`; MCP `add_subscribers_to_list` accepts up to 500 emails per call
- sequences `list`, `get`, `create`, `update`, `enable`, `disable`, `delete`, and `cancel-enrollments`, including explicit discount action steps, cancellation by subscriber ID or event-property field values, and `update` branch insertion with tag, list, segment, event, clicked-link, and field conditions; event and clicked-link branch checks can use `activityScope` (`this_sequence`, `previous_email`, `ever`)
- AI generation with `generate email`, `generate sequence`, and `generate subjects`
- dashboard URL generation with CLI `urls`, MCP `get_app_urls`, and `appUrls`/`url` fields on campaign, sequence, template, and company results
- websites `list`, `add`, `check`, and `guide`
- API key creation with `api-keys create`
- send one transactional email by template or raw HTML

## Unsupported Or Placeholder Workflows

Treat missing subcommands as unsupported even when the noun exists. For example: campaign immediate send, pause/cancel flows, list deletion, and tag mutation are not available through the current CLI handlers. Bulk list population is supported through `sequenzy lists add-subscribers` and its `sequenzy lists import` alias, not through `subscribers add`.

## Execution Pattern

1. Check auth first with `sequenzy whoami` or by verifying `SEQUENZY_API_KEY` is set.
2. Pick the narrowest command that matches the use case.
3. Validate IDs, recipient email, subject, template, or content input before issuing a mutation.
4. Surface CLI limitations directly instead of inventing a workaround.
5. If the workflow is unsupported in the CLI, say whether the next-best path is the Sequenzy dashboard or direct API use.
6. When you create, inspect, or schedule a campaign, sequence, template, or company and the user may want to review/edit it, surface the dashboard URL from `url`, `previewUrl`, or `appUrls` in the tool/CLI output. If needed, generate it with `sequenzy urls` or MCP `get_app_urls`.
7. Call out implementation caveats that matter operationally, such as `whoami` using cached local auth state, sequence creation supporting both `--goal` and explicit step modes, explicit discount steps requiring Stripe before activation, generated sequences being capped at 10 emails, `campaigns test` being a stubbed success path in the current backend, and conditional email content requiring block JSON rather than raw HTML.

## Dashboard URLs

Use `SEQUENZY_APP_URL` as the dashboard base when it is set; otherwise default to `https://sequenzy.com`.

Prefer actual URLs returned by the CLI/MCP result:

- sequence editor: `/dashboard/company/{companyId}/sequences/{sequenceId}`
- campaign editor: `/dashboard/company/{companyId}/campaign/{campaignId}`
- campaign preview/review: `/dashboard/company/{companyId}/campaign/{campaignId}?step=review`
- template/email editor: `/dashboard/company/{companyId}/emails/{emailId}`
- settings: `/dashboard/company/{companyId}/settings`
- settings tab: `/dashboard/company/{companyId}/settings?tab={tab}`

Useful settings tabs include `domain`, `tracking`, `localization`, `integrations`, `events`, `tags`, `goals`, `sync-rules`, `api-keys`, `widgets`, and `team`.

## References

- [references/command-reference.md](references/command-reference.md): exact command shapes, env vars, behavior, and caveats.
- [references/use-cases.md](references/use-cases.md): decision trees and examples for the most common agent tasks.
