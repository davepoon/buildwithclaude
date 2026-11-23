# Palace

This folder is a copy of the Palace Claude Code plugin from
[AncientiCe/palace-rs](https://github.com/AncientiCe/palace-rs), included so
the plugin can be listed and installed from the Build with Claude marketplace.
The source of truth remains that repository. Author: AncientiCe. License: MIT.

Palace is local-first memory for coding agents: one Rust binary and one SQLite
file, local embeddings, hybrid BM25 plus vector search, hooks inject cited
memories into Claude Code sessions; LongMemEval s_cleaned retrieval recall
R@5 0.987. Not associated in any way with the popular mempalace python.

## Install

Install the `palace` binary first (see the
[palace-rs install section](https://github.com/AncientiCe/palace-rs#install)).
The plugin calls `palace` from your `PATH`.

From this marketplace, after this listing is merged:

```
/plugin marketplace add davepoon/buildwithclaude
/plugin install palace@buildwithclaude
```

From the upstream marketplace, which already exists:

```
/plugin marketplace add AncientiCe/palace-rs
/plugin install palace@palace-rs
```

The plugin registers the Palace MCP server (`palace mcp`) and four memory
hooks (session start, prompt-time recall, recall while reading code, and a
save nudge before stopping). It cannot write `~/.claude/CLAUDE.md`, so run
`palace install` too if you want the always-on rule. While the plugin is
enabled, `palace install` writes only the rule and removes its own Claude
Code MCP entry and hooks, so nothing runs twice.

## License

MIT. Copyright and license: [AncientiCe/palace-rs](https://github.com/AncientiCe/palace-rs).
