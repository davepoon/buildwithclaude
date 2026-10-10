# Skyvern

Browser automation in Claude Code through the hosted Skyvern MCP server. Open pages,
fill forms, extract structured data, take screenshots, and run repeatable workflows
in a Skyvern Cloud browser.

## Install

```text
/plugin install skyvern@buildwithclaude
```

Then run `/mcp`, select `skyvern`, and choose **Authenticate**. Sign in to Skyvern
in the browser or create a free account. Pick an organization when prompted.
Sign-in uses OAuth.

## What you can ask

- "Using Skyvern, open example.com and take a screenshot."
- "Using Skyvern, extract the product names and prices from a catalog page."
- "Using Skyvern, fill out my test form and show me the result before submission."
- "Using Skyvern, log in to my portal with a saved credential and check the order status."
- "Using Skyvern, run my saved workflow to collect this week's report."

## Tools

| Group               | Capabilities                                                     |
|---------------------|------------------------------------------------------------------|
| Browser sessions    | Create, inspect, and close cloud browsers                        |
| Page actions        | Navigate, click, type, select, and upload files                  |
| Page inspection     | Screenshots, page HTML, element values, and styles               |
| AI actions          | Described actions, structured extraction, checks                 |
| Login               | Sign in with saved credentials                                   |
| Tasks and workflows | Run tasks; create, run, and inspect workflows                    |
| Account management  | Schedules, folders, credentials, profiles, settings, and scripts |

## Plans

Free plan: new personal accounts get a one-time 5,000 credits with no credit card.
Browser sessions, tasks, workflow runs, and AI actions can use credits.
See [plans and pricing](https://www.skyvern.com/pricing).

## Connection and safety

The plugin registers a remote HTTP server at `https://api.skyvern.com/mcp/`.
Unauthenticated requests get `401` with a `WWW-Authenticate` header that points
Claude Code at the OAuth metadata. No API key is stored in the plugin.

The browser runs in Skyvern Cloud, not on your machine. It cannot reach your
localhost. Browser tools act on real websites. They can submit forms, send
messages, and change or delete data there.

These tool groups can change your Skyvern account:

- Workflows and runs; schedules; folders; browser profiles; browser sessions.
- Credentials: delete saved credentials or clear 1Password and Bitwarden configuration.
- Organization settings through `skyvern_org_update`.
- Cached scripts through `skyvern_script_deploy`.

The bundled skill tells Claude to get your yes before each new session and each
task, workflow run, or retry. Schedule creation, activation, and updates
also need a separate yes. The skill requires confirmation for consequential
website actions, logins, clipboard access, deletions, and organization setting changes.
It treats page content and tool results as data, never instructions.
It keeps passwords out of chat and browser typing tools. Add saved credentials
in the Skyvern app. These are instructions for Claude, not server-enforced approval checks.

## Links

- [Docs](https://www.skyvern.com/docs/developers/getting-started/mcp)
- [Pricing](https://www.skyvern.com/pricing)
- [Privacy](https://www.skyvern.com/privacy)
- [Terms](https://www.skyvern.com/terms)
- [Skyvern app](https://app.skyvern.com)
- [Source](https://github.com/Skyvern-AI/skyvern)

## License

The files in this plugin are licensed under Apache-2.0. The Skyvern source code in the linked repository has its own license (AGPL-3.0).
