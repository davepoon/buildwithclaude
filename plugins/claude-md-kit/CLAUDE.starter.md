# CLAUDE.md — [PROJECT NAME]

> Rules file for AI coding agents (Claude Code, Cursor, etc.). Keep it terse and
> imperative — it's read by an agent every session, not by a human once. Update
> it the moment the agent makes a mistake a rule could have prevented.

## What this is
[One or two sentences: what the project does and who uses it. E.g. "A Next.js
SaaS dashboard for tracking X. Users are non-technical small-business owners."]

## Run / test / build
- Install: `[e.g. pnpm install]`
- Dev: `[e.g. pnpm dev — app on http://localhost:3000]`
- Test: `[e.g. pnpm test — Vitest; pnpm test <file> for one]`
- Typecheck: `[e.g. pnpm typecheck]`
- Lint/format: `[e.g. pnpm lint / pnpm format — Biome, runs on commit]`

## Golden rules
1. **Verify before claiming done.** Changes to product code must be *exercised*,
   not just typechecked — run the test, hit the endpoint, load the page. If you
   can't verify it, say so explicitly instead of implying it works.
2. **Match the surrounding code.** Mirror the naming, structure, and idioms of
   the file you're editing. Consistency beats your personal preference.
3. **Smallest change that solves it.** No drive-by refactors, no renaming things
   you weren't asked to touch, no new dependencies without flagging it first.
4. **Ask before the expensive mistake.** If a change is hard to reverse (schema
   migration, deleting data, touching auth/payments), surface a plan first.
5. **Commit at each green increment** with a clear message. Small commits.

## Architecture (the non-obvious parts)
- [Where the important code lives — e.g. "Business logic in `src/domain/`;
  routes are thin controllers in `src/api/`. Never put logic in routes."]
- [Data layer — e.g. "Prisma + Postgres. Migrations in `prisma/migrations`;
  never edit the DB schema by hand."]
- [State/auth/config gotchas — e.g. "Auth via Clerk; `useUser()` is client-only.
  Server code reads the session from `auth()` in `src/lib/auth.ts`."]

## Conventions
- [Naming — e.g. "Components PascalCase; hooks `useX`; files kebab-case."]
- [Errors — e.g. "Throw typed errors from `src/errors.ts`; never swallow."]
- [Tests — e.g. "Co-locate `*.test.ts`; test behavior, not implementation."]
- [Imports — e.g. "Use `@/` alias, not deep relative paths."]

## Do NOT touch
- [e.g. "`/legacy` — being deprecated, don't extend it."]
- [e.g. "Generated files: `*.gen.ts`, `schema.prisma` output."]
- [Anything infra/secret — `.env`, CI config — flag instead of editing.]

## When stuck
State your plan and the single assumption you're least sure about *before*
writing more than a few lines. A wrong assumption caught early saves a wrong
diff caught late.
