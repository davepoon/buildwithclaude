# Agent-instruction file catalog

Reference data for `/archcore:bootstrap` Step 8 (agent-instruction import). Edit this file to add new agent-instruction file types as the ecosystem grows.

## Probe paths

Check each in order. Paths can be exact filenames or globs. A file counts if it exists and is non-empty.

| Path / glob | Tool / convention |
|-------------|-------------------|
| `CLAUDE.md` | Claude Code (project-level memory) |
| `CLAUDE.local.md` | Claude Code (user-local overrides, usually gitignored) |
| `AGENTS.md` | Cross-tool convention (Claude Code reads it via import; OpenAI-adjacent tools use it too) |
| `.cursorrules` | Cursor (legacy single-file format) |
| `.cursor/rules/*.mdc` | Cursor 2.x (rule files with frontmatter-configurable scope) |
| `.cursor/rules/*.md` | Cursor 2.x (plain markdown rule files) |
| `.github/copilot-instructions.md` | GitHub Copilot (custom instructions) |
| `.github/instructions/*.md` | GitHub Copilot (modular instruction files) |
| `.windsurfrules` | Windsurf (single-file) |
| `.windsurf/rules/*.md` | Windsurf (modular) |
| `.junie/guidelines.md` | JetBrains Junie |
| `CONVENTIONS.md` | Aider (convention file at repo root) |

## Source slugging

Slug the source filename for use in the `source:<slug>` tag. Algorithm:

1. Start from the **repo-root-relative** path (e.g., `AGENTS.md`, `.cursor/rules/styling.mdc`, `.github/copilot-instructions.md`).
2. Lowercase everything.
3. Strip any leading dot from the first path segment (`.cursorrules` → `cursorrules`, but `.cursor/rules/styling.mdc` → `cursor/rules/styling.mdc` — the dot on `.cursor` is stripped, not inner dots).
4. Replace `/` with `-`.
5. Replace `.` with `-`.
6. Collapse any run of two or more `-` into a single `-`.
7. Remove any non-alphanumeric-non-hyphen character (defensive).
8. Trim leading / trailing `-`.

Examples:

| Source path | Slug |
|-------------|------|
| `AGENTS.md` | `agents-md` |
| `CLAUDE.md` | `claude-md` |
| `CLAUDE.local.md` | `claude-local-md` |
| `.cursorrules` | `cursorrules` |
| `.cursor/rules/styling.mdc` | `cursor-rules-styling-mdc` |
| `.cursor/rules/styling.md` | `cursor-rules-styling-md` |
| `.github/copilot-instructions.md` | `github-copilot-instructions-md` |
| `.github/instructions/testing.md` | `github-instructions-testing-md` |
| `.windsurfrules` | `windsurfrules` |
| `.junie/guidelines.md` | `junie-guidelines-md` |
| `CONVENTIONS.md` | `conventions-md` |

The extension stays in the slug deliberately — it prevents collisions between `styling.md` and `styling.mdc`, which Cursor treats as different files.

## Body first line (import pointer)

Exact format, used verbatim in link-mode and prepended to extract-mode content:

```
> Imported from `<exact-relative-path>` on <YYYY-MM-DD>.
```

Where:
- `<exact-relative-path>` — path from repo root as the user would type it (`AGENTS.md`, `.cursor/rules/styling.mdc`). Preserve casing, slashes, leading dots.
- `<YYYY-MM-DD>` — current UTC date when the import runs.

Rationale: the slug can't carry the full path (no slashes, no dots), so the pointer lives in the body where readers — human and AI — can navigate to the source file. The leading `>` marks it as a quote/pull-out so it reads as metadata, not body content.

## Link-mode body shape

Exactly the pointer line. Nothing else. Body length < 200 bytes so the imported stub does not trigger the "functionally populated" check in `bin/lib/empty-state.sh` — an empty repo with only link imports still shows the empty-state nudge until the user creates real documents.

Example body for a link import:

```
> Imported from `AGENTS.md` on 2026-04-23.
```

## Extract-mode body shape

Pointer line, then a blank line, then the extracted content. See `lib/extract-routing.md` for how content is selected per document type.

## Umbrella document for extract mode

When a file is imported in extract mode and yields multiple documents, also create **one** umbrella `doc` in link-mode shape (title `Imported: <basename>`, body = pointer only). Each extracted document gets a `related` edge back to the umbrella. Purpose: a single graph node per source file, so re-runs and removals can find and clean up all derived documents at once.
