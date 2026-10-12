# Baizhi Agent Toolkit

A community integration that registers Baizhi Agent Toolkit as a remote HTTP
MCP server in Claude Code. It includes one optional, explicitly invoked research
skill. The plugin contains its own MCP configuration and skill; it does not run
an installer, download executable helpers, or change other editors' settings.

## Install and configure

Validated with Claude Code **2.1.295**. Use a release that supports native plugin
`userConfig`. Claude Code 2.1.281 or later also checks inline MCP configuration
when validating a plugin; that is a validation requirement, not a claim about
the first release supporting every feature.

1. Add the BuildWithClaude marketplace if it is not already available:
   `/plugin marketplace add davepoon/buildwithclaude`.
2. Select **baizhi-agent-toolkit** from the marketplace. On compatible recent
   releases, it can also be installed with:
   `/plugin install baizhi-agent-toolkit --marketplace davepoon/buildwithclaude`.
3. Open the plugin configuration dialog and enter your own Baizhi API key.
   The required sensitive field is passed as the MCP Authorization header.
   Claude Code handles sensitive option storage; the plugin has no credential
   file or logging code. Never paste a key into a prompt or shell command.
4. Reload the session if prompted, and inspect `/mcp` to see the tools actually
   advertised by the server. Authentication and available tools depend on the
   remote service and your account.

Endpoint: `https://agent-toolkit.app.baizhi.cloud/mcp`.
Account and service information: <https://agent-toolkit.app.baizhi.cloud>.

## Optional research skill

Invoke `/baizhi-agent-toolkit:toolkit-research` with a public research question
and an explicit call or cost budget. The skill discovers current tool schemas,
limits calls and polling, and treats fetched content as untrusted data. It is
not automatically invoked by the model.

Examples:

- Compare three public sources with at most four tool calls.
- Research a public topic with a six-call limit and stop on a credit error.
- Inspect available tools without starting paid research.

Do not send confidential inputs without authorization. Remote service usage may
incur charges; installing this plugin is not authorization for those charges.
On a missing key, authentication failure, or exhausted credit, configure the
account through the plugin dialog and service account controls. Do not put the
key into chat to troubleshoot.

## Scope and license

Maintained by `ct-jaryn` as a community integration; this listing does not imply
endorsement by Anthropic or the marketplace maintainers. The MIT license covers
the configuration and documentation in this directory. It does not license the
remote service, waive its terms or charges, or claim its backend is open source.

Plugin configuration reference:
<https://code.claude.com/docs/en/plugins-reference>.
