# GSD Plugin -- Get Shit Done for Claude Code

**Based on:** [GSD 1.41.0](https://github.com/gsd-build/get-shit-done/releases/tag/v1.41.0) base tree by **TACHES** (Lex Christopherson)

**Plugin version:** `2.42.1`

A performance-optimized plugin packaging of [GSD](https://github.com/gsd-build/get-shit-done) for Claude Code. Skills load on demand instead of via prose-bloated CLAUDE.md, adds an MCP-backed project state surface, auto-resumes across `/compact`, and bundles everything (including the GSD SDK as of v2.42.0) into a single-install plugin with no external prerequisites.

## Installation

GSD Plugin installs *inside* a Claude Code session, not from your host shell. Three commands at the Claude Code prompt:

```
/plugin marketplace add jnuyens/gsd-plugin
/plugin install gsd@gsd-plugin
/reload-plugins
```

That's it. No `npm install`, no `gsd-sdk` global. Slash commands, agent definitions, hooks, and the MCP server all activate after `/reload-plugins`.

> First-time-on-this-machine note: `/plugin marketplace add` clones over SSH, so prime GitHub's host key once with `ssh -T git@github.com` from your shell before running the install commands.

## What GSD Plugin provides

- **83 slash commands** (`/gsd:*`) for project planning, execution, debugging, and verification
- **33 agent definitions** for specialized workflow roles (planner, executor, researcher, verifier, debugger, UI auditor, etc.)
- **MCP server** exposing project state as queryable resources and mutation tools
- **Bundled GSD SDK** (v2.42.0+) — the plugin ships its own `gsd-sdk` binary, no `get-shit-done-cc` global install required
- **Hooks** for session-start context loading, workflow enforcement, checkpoint on compact, tool-use monitoring, and rate-limit fallback hints
- **Auto-resume across `/compact`** — PreCompact hook writes `.planning/HANDOFF.json`; on the next session, SessionStart auto-invokes `/gsd:resume-work` so Claude continues at the same phase/plan/task with zero manual intervention
- **Templates and references** for planning artifacts, summaries, verification checklists, and MVP-mode (vertical-slice planning + TDD execution + UAT verification)
- **Memory integration** — phase outcomes persist across sessions via Claude Code's memdir

## What changed from upstream GSD

| Aspect | Upstream GSD | This plugin |
|--------|--------------|-------------|
| Install | `npx get-shit-done-cc` | `/plugin marketplace add jnuyens/gsd-plugin && /plugin install gsd@gsd-plugin` (inside Claude Code) |
| External prerequisites | `node`, `npm`, `get-shit-done-cc` global package | None (SDK bundled inside the plugin since v2.42.0) |
| Context overhead | ~3,000-5,000 tokens/turn via CLAUDE.md | ~200 tokens (~92% reduction at idle) |
| Skill isolation | Inline execution | `context: fork` sub-agent isolation |
| State access | BashTool roundtrips to gsd-tools | MCP resources + tools (with stdio ndjson framing fixed in v2.40.2) |
| Memory | None | memdir auto-recall across sessions |
| Auto-resume | Manual restart after `/compact` | PreCompact + SessionStart hooks restore position automatically |
| Agent definitions | Inline prompt role descriptions | `.claude/agents/*.md` with typed frontmatter |

## Quick start

After install:

1. Start a new project: `/gsd:new-project`
2. Plan your first phase: `/gsd:plan-phase`
3. Execute: `/gsd:execute-phase`
4. Verify: `/gsd:verify-work`

For an MVP-style vertical slice with TDD execution and UAT verification: `/gsd:mvp-phase`.

## Updating

Enable auto-update for the marketplace in Claude Code settings and updates apply automatically at startup. For manual updates, type at the Claude Code prompt:

```
/plugin marketplace update gsd-plugin
/plugin install gsd@gsd-plugin
/reload-plugins
```

Note: Step 1 refreshes the marketplace index but does not upgrade the installed plugin. Step 2 installs the new version on disk; Step 3 makes Claude Code pick it up without restarting.

## Migrating from legacy install

If you previously installed GSD via `get-shit-done-cc` or manual setup, most migration happens automatically on your first session after installing the plugin: legacy `~/.claude/get-shit-done/` is moved to `~/.claude/get-shit-done-legacy/`, legacy MCP server / hook / command / skill / agent entries are removed, and the plugin's own copies take over. You'll see a migration summary in the session output.

After confirming the plugin works:

```bash
# Now safe as of v2.42.0 -- the plugin bundles the SDK
npm uninstall -g get-shit-done-cc

# Optional: drop the backup once you're confident
rm -rf ~/.claude/get-shit-done-legacy/
```

> **Earlier note:** versions ≤ v2.41.0 told users to uninstall `get-shit-done-cc` while the plugin still needed its `gsd-sdk` binary, which silently broke every `/gsd:*` command (issue #4 reported by @ThomasHezard, confirmed by @herman925). v2.41.1 corrected the README; v2.42.0+ removed the prerequisite entirely by bundling the SDK.

The `/gsd:update` command is deprecated. Use `/plugin marketplace update gsd-plugin` to update.

## Recent improvements

A few user-visible fixes shipped since the original v1.33.0 catalog entry:

- **v2.42.0–v2.42.1** — Bundled SDK; `/plugin install gsd@gsd-plugin` is now the only install step, no `npm install -g` of anything required ([#4](https://github.com/jnuyens/gsd-plugin/issues/4))
- **v2.41.0** — Upstream sync to GSD 1.41.0; new `/gsd:mvp-phase` workflow + 8 MVP/SPIDR/user-story references; new workflows for `/gsd:add-backlog`, `/gsd:debug`, `/gsd:thread`
- **v2.40.2** — MCP stdio transport switched to ndjson framing; `claude mcp list` now reports `gsd: ✓ Connected` and the eight `gsd_*` MCP tools are reachable ([#3](https://github.com/jnuyens/gsd-plugin/issues/3))
- **v2.40.1** — Suppressed false-positive "subagents not installed" warning for plugin users
- **CI hardening** — every release now runs an install-smoke test in a clean `debian:trixie` container that catches "works on my laptop, broken on a fresh install" failures before they ship

## Credits

- **[GSD (Get Shit Done)](https://github.com/gsd-build/get-shit-done)** by TACHES (Lex Christopherson) — the original workflow framework this plugin is based on
- Plugin packaging, MCP integration, token optimization, bundled SDK, and memory system by Jasper Nuyens
- Community contributors (issues + patches): @Sovereigntymind, @jesse-smith (#3); @ThomasHezard, @herman925 (#4)

## License

MIT
