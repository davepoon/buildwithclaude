# CLAUDE.md — Acme Dashboard

> Rules for AI coding agents. Terse and imperative — read every session. Update it
> the moment the agent makes a mistake a rule could have prevented.
>
> This is a *filled-in example* for a Next.js + TypeScript SaaS. Adapt the specifics
> to your project; the shape is the point.

## What this is
A Next.js 15 (App Router) SaaS dashboard for tracking marketing spend. Users are
non-technical small-business owners, so UI copy stays plain and errors are never
raw stack traces.

## Run / test / build
- Install: `pnpm install`
- Dev: `pnpm dev` — app on http://localhost:3000
- Test: `pnpm test` (Vitest) — one file: `pnpm test src/domain/billing.test.ts`
- E2E: `pnpm e2e` (Playwright) — needs `pnpm dev` running
- Typecheck: `pnpm typecheck` — **must pass before every commit**
- Lint/format: `pnpm lint` / `pnpm format` (Biome) — runs on pre-commit hook

## Golden rules
1. **Verify before claiming done.** Changes to product code must be exercised: run
   the Vitest for logic, hit the route or load the page for UI. Don't imply it works
   from a typecheck alone.
2. **Match the surrounding code.** Server Components by default; add `"use client"`
   only when you need hooks/interactivity.
3. **Smallest change that solves it.** No drive-by refactors. No new dependency
   without flagging it and why.
4. **Ask before the expensive mistake.** Prisma schema changes, anything under
   `src/lib/auth/` or `src/domain/billing/` — plan first.
5. **Commit at each green increment.**

## Architecture (the non-obvious parts)
- **Business logic lives in `src/domain/`**, framework-free and unit-tested. Route
  handlers (`src/app/api/**/route.ts`) and Server Actions are *thin* — they parse
  input, call a domain function, shape the response. Never put logic in a route.
- **Data:** Prisma + Postgres. Migrations in `prisma/migrations` — create them with
  `pnpm prisma migrate dev`, never hand-edit the DB or the generated client.
- **Auth:** Clerk. `useUser()` is client-only; server code reads the session via
  `auth()` in `src/lib/auth/session.ts`. Never trust a `userId` from the request
  body — always derive it from the session.
- **Money:** all amounts are integer cents (`bigint`), formatted only at the view
  edge in `src/lib/money.ts`. Never do float math on currency.
- **Env:** validated in `src/env.ts` (Zod). Add new vars there, not scattered
  `process.env` reads.

## Conventions
- Components `PascalCase`; hooks `useX`; files `kebab-case.tsx`.
- Data fetching in Server Components or Server Actions; no client-side `fetch` to
  our own API from within the app.
- Errors: throw typed errors from `src/errors.ts`; the error boundary renders a
  plain-language message. Never swallow an error silently.
- Tests co-located as `*.test.ts`; test behavior, not implementation details.
- Imports use the `@/` alias, not deep relative paths.

## Do NOT touch
- `src/lib/auth/` and `src/domain/billing/` without a plan — auth and payments.
- `prisma/schema.prisma` output / generated Prisma client.
- `.env*`, CI config in `.github/` — flag needed changes instead of editing.

## When stuck
State your plan and the single assumption you're least sure about before writing
more than a few lines.

---
*Free starter and more examples: https://fablerlabs.com/claude-md-generator*
