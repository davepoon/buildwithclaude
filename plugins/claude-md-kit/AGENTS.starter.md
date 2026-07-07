# AGENTS.md — [PROJECT NAME]

> Tool-agnostic rules for AI coding agents (Claude Code, Cursor, Codex, Copilot,
> …). `AGENTS.md` is the emerging cross-tool convention: put shared project
> knowledge here so every agent reads the same map. Keep it terse and imperative —
> it's loaded every session. Update it the moment an agent makes a mistake a rule
> could have prevented.

## What this is
[One or two sentences: what the project does and who uses it.]

## Setup / run / test / build
- Install: `[e.g. pnpm install]`
- Dev: `[e.g. pnpm dev — app on http://localhost:3000]`
- Test: `[e.g. pnpm test — one file: pnpm test path/to/file]`
- Typecheck: `[e.g. pnpm typecheck]`
- Lint/format: `[e.g. pnpm lint / pnpm format]`

## Golden rules
1. **Verify before claiming done.** Changes to product code must be *exercised* —
   run the test, hit the endpoint, load the page — not just typechecked. If you
   can't verify it, say so instead of implying it works.
2. **Match the surrounding code.** Mirror the naming, structure, and idioms of the
   file you're editing. Consistency beats personal preference.
3. **Smallest change that solves it.** No drive-by refactors, no unrequested
   renames, no new dependencies without flagging first.
4. **Ask before the expensive mistake.** Schema migrations, deleting data, touching
   auth/payments — surface a plan first.
5. **Commit at each green increment** with a clear message.

## Architecture (the non-obvious parts)
- [Where the important code lives, and the rule about it.]
- [Data layer + migration rule.]
- [Auth/state/config gotchas.]

## Conventions
- [Naming, error handling, tests, imports.]

## Do NOT touch
- [Legacy/generated/infra/secret paths — flag instead of editing.]

## When stuck
State your plan and the single assumption you're least sure about *before* writing
more than a few lines.

---

## Tool-specific files (optional)

Keep shared knowledge here; put tool-specific bits in each tool's own file, which
can just point back to this one:

- **Claude Code** — `CLAUDE.md` (also reads `AGENTS.md`).
- **Cursor** — `.cursor/rules/*.mdc` (or legacy `.cursorrules`).
- **Codex / Copilot** — `AGENTS.md` (this file).

A one-line `CLAUDE.md` that says `See @AGENTS.md` keeps everything in sync.
