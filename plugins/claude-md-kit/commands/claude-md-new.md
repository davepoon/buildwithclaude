---
description: Scaffold a CLAUDE.md for this repo from battle-tested templates, filled in with the project's real commands
argument-hint: "[optional context, e.g. 'monorepo, deploys to Fly.io']"
---

Create a `CLAUDE.md` at the root of this repository. Follow these steps exactly.

## 0. Guard

If a `CLAUDE.md` (or `AGENTS.md`) already exists at the repo root, do NOT overwrite it.
Tell the user it exists and suggest `/claude-md-audit` instead, then stop — unless they
explicitly asked for a rewrite in their arguments.

## 1. Learn the project — facts, not guesses

Inspect the repo before writing anything:

- Manifests: `package.json` (scripts!), `pyproject.toml`, `Cargo.toml`, `go.mod`,
  `Makefile`, `justfile`, `Taskfile.yml`, `docker-compose.yml`, CI workflows in
  `.github/workflows/` (CI is the ground truth for how the project is really built
  and tested).
- Layout: top two levels of the tree; where source, tests, and config live.
- Tooling signals: lockfiles (pnpm/yarn/npm/uv/poetry/cargo), formatter/linter
  configs, `.env.example`, database migrations.
- README: setup steps worth preserving.

Every command you put in the CLAUDE.md must be one you found in a manifest, CI file, or
README — never invented. If you cannot find a test or run command, say so in the file
("no test runner configured") rather than guessing one.

## 2. Pick the template

Read `${CLAUDE_PLUGIN_ROOT}/CLAUDE.starter.md` for the structure. Then read the ONE
bundled example closest to this project and use it as the register/altitude reference:

- Next.js / TypeScript web app → `${CLAUDE_PLUGIN_ROOT}/examples/CLAUDE.nextjs-saas.md`
- Python CLI / library → `${CLAUDE_PLUGIN_ROOT}/examples/CLAUDE.python-cli.md`
- Rust service → `${CLAUDE_PLUGIN_ROOT}/examples/CLAUDE.rust-service.md`
- Unattended/autonomous agent → `${CLAUDE_PLUGIN_ROOT}/examples/CLAUDE.autonomous-agent.md`
- Anything else → starter only, adapt the section headings to what the repo needs.

## 3. Write CLAUDE.md

Rules (from `${CLAUDE_PLUGIN_ROOT}/FIELD-GUIDE.md` — read it if unsure):

- **A map, not wishes.** "Business logic lives in `src/domain/`; run `pnpm test <file>`
  for one test" — never "write clean code".
- **Terse, imperative bullets.** An agent reads this every session; a human reads it once.
- **Include:** how to run / test / lint / build (exact commands), the 3–8 non-obvious
  conventions of THIS repo, what not to touch, and a verification habit ("changes to
  product code must be exercised, not just typechecked").
- **Exclude:** anything derivable by reading the code, generic best practices, wish-list
  adjectives, and anything you could not verify in step 1.
- Target 30–80 lines. Shorter is better than padded.

Write the file, then show the user a 3-line summary of what you put in it and mention
anything you could not determine (e.g. "no e2e command found — add one if it exists").
