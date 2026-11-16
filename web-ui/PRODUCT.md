# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Claude users, mostly Claude Code developers, who want to find something to install: a plugin, skill, subagent, command, hook, MCP server or theme. They arrive either knowing what they want (search) or wanting to see what is popular and new (browse).

## Product Purpose

Build with Claude (buildwithclaude.com) is a discovery index for the Claude ecosystem. It aggregates community plugins, skills and MCP servers from many marketplaces and registries, alongside a curated first-party collection of subagents, commands, hooks, skills, plugins and themes. Success is a visitor finding and installing something useful.

## Positioning

One place to search across every kind of Claude extension and every community marketplace, rather than a single marketplace's own catalog. The site's own marketplace (`davepoon/buildwithclaude`) is one source among many, not the headline.

## Operating Context

Items are installed from the terminal or the Claude desktop app with a copied command. Detail pages carry the install command; the homepage's job is finding.

## Capabilities and Constraints

- Search is Meilisearch-backed, shared by the hero field and the ⌘K palette.
- Popularity signals that exist: skills have weekly installs (from skills.sh) and repo stars; plugins have repo stars; MCP servers have Docker pulls and GitHub stars.
- Themes, subagents, commands and hooks have no popularity signal. They are never shown with a rank or a "trending" claim; they appear as featured or rotating picks.
- No history is stored for any signal, so rank movement (up/down) cannot be shown.
- The database can be unreachable at build or request time; every DB-backed section must render sensibly from local files alone.

## Brand Commitments

- Name: Build with Claude.
- Keep the current look: near-black ground, terracotta accent, Instrument Serif headings, Outfit body, JetBrains Mono for code and data (confirmed 2026-11-16).
- Search stays the primary action, centered on the homepage.

## Evidence on Hand

Live catalog counts and rankings from the database; local markdown collections under the repo root; theme previews linked from authors' repos; community stories under `/stories`. No testimonials or usage numbers beyond these.

## Product Principles

1. Finding comes before installing our marketplace.
2. Every number on screen is a real, labelled signal.
3. All content types are first-class, including the ones without metrics.
