# Stack detection catalog

Reference data for `/archcore:bootstrap` Step 1. Edit this file to extend detection; the skill reads it at runtime.

## Manifests to probe

Read in order, stop at the first match per language. Polyglot repos may have several manifests — collect signals from each.

| File | Language / ecosystem |
|------|---------------------|
| `package.json` | JavaScript / TypeScript (Node, Bun, Deno via npm interop) |
| `pyproject.toml` | Python (modern: Poetry, PDM, Hatch, uv) |
| `Pipfile` | Python (Pipenv) |
| `requirements.txt` | Python (pip) |
| `Cargo.toml` | Rust |
| `go.mod` | Go |
| `Gemfile` | Ruby |
| `composer.json` | PHP |
| `*.csproj`, `*.fsproj`, `*.vbproj` | .NET |
| `pom.xml` | Java (Maven) |
| `build.gradle`, `build.gradle.kts` | Java / Kotlin (Gradle) |
| `mix.exs` | Elixir |
| `Package.swift` | Swift |

Dependency sections to read per manifest (top-level / direct only — never transitive):

- `package.json` → `dependencies` + `devDependencies` + `peerDependencies`
- `pyproject.toml` → `[project] dependencies`, `[tool.poetry.dependencies]`, `[tool.poetry.dev-dependencies]`
- `Cargo.toml` → `[dependencies]`, `[dev-dependencies]`
- `go.mod` → `require` blocks
- `Gemfile` → `gem` entries
- `composer.json` → `require`, `require-dev`

## Signal allowlist

Only these entries count toward the final stack signal set. The list is deliberately opinionated: frameworks, runtimes, primary persistence, primary UI, primary styling, primary state.

### Frameworks (web / app)

**JavaScript / TypeScript:** `next`, `nuxt`, `remix`, `astro`, `sveltekit`, `@angular/core`, `@nestjs/core`, `express`, `fastify`, `koa`, `hono`, `elysia`, `hapi`
**Python:** `django`, `flask`, `fastapi`, `starlette`, `tornado`, `bottle`, `pyramid`
**Ruby:** `rails`, `sinatra`, `hanami`
**Go:** `gin-gonic/gin`, `labstack/echo`, `gofiber/fiber`, `go-chi/chi`
**Rust:** `actix-web`, `axum`, `rocket`, `warp`, `poem`
**Java / Kotlin:** `org.springframework.boot:spring-boot-starter`, `io.ktor:ktor-server-core`
**PHP:** `laravel/framework`, `symfony/symfony`, `slim/slim`

### Runtimes

`node` (engines field in package.json), `bun`, `deno`

### Persistence (primary DB / ORM)

**JavaScript / TypeScript:** `prisma`, `drizzle-orm`, `typeorm`, `sequelize`, `mongoose`, `@prisma/client`, `kysely`, `postgres`, `mysql2`, `better-sqlite3`
**Python:** `sqlalchemy`, `django` (built-in ORM), `peewee`, `tortoise-orm`, `psycopg`, `psycopg2`, `asyncpg`, `pymongo`
**Ruby:** `activerecord`, `sequel`
**Go:** `gorm.io/gorm`, `ent/ent`, `uptrace/bun`, `jackc/pgx`
**Rust:** `diesel`, `sqlx`, `sea-orm`
**Java / Kotlin:** `org.jetbrains.exposed:exposed-core`, Spring Data (`org.springframework.data:*`)

Note the primary store separately when detectable (postgres / mysql / sqlite / mongodb) — infer from driver names.

### UI libraries

**JavaScript / TypeScript:** `react`, `vue`, `svelte`, `solid-js`, `preact`, `@angular/core`, `lit`, `htmx.org`, `qwik`

### Styling

`tailwindcss`, `styled-components`, `@emotion/react`, `@emotion/styled`, `stitches`, `@stitches/react`, `sass`, `css-modules`, `vanilla-extract`, `@chakra-ui/react`, `@mui/material`, `@mantine/core`, `@radix-ui/themes`

### State management

**JavaScript / TypeScript:** `redux`, `@reduxjs/toolkit`, `zustand`, `jotai`, `recoil`, `valtio`, `@reatom/core`, `mobx`, `xstate`, `effector`, `pinia`, `vuex`

### Testing (runners only — mention the primary one)

`vitest`, `jest`, `mocha`, `ava`, `playwright`, `cypress`, `@playwright/test`, `pytest`, `rspec`, `minitest`, `phpunit`, `cargo test` (implicit), `go test` (implicit), `junit`, `testng`

## Exclusions

Never count these, even when present in top-level deps:

- `@types/*`
- `eslint`, `eslint-*`, `@eslint/*`, `@typescript-eslint/*`
- `prettier`, `prettier-*`
- `typescript` (infer TS from `.ts` extensions, not from the compiler dep)
- `@babel/*`, `babel-*`
- `webpack`, `vite`, `rollup`, `parcel`, `esbuild`, `swc`, `turbopack`, `rspack` — build tools; don't call them stack signals
- `husky`, `lint-staged`, `commitlint`
- `dotenv`, `dotenv-*`
- `chalk`, `kleur`, `colors`, `picocolors`, `chokidar`, `fs-extra`, `minimist`, `commander`, `yargs` — generic plumbing

## Rule template

Start from this skeleton. Drop any line whose placeholder has no detected signal. Never leave `{…}` unfilled. The body must be ≤ 6 lines total.

```
Code in {language(s)}.
Build with {framework} (do not introduce alternative frameworks without an ADR).
Persist via {persistence-lib} when adding storage; default to {primary-store}.
Style with {styling-lib} classes/components; do not introduce alternative styling.
Manage state with {state-lib}.
Test with {test-runner} as the primary runner.
```

Examples of valid composed outputs:

```
Code in TypeScript.
Build with Next.js (do not introduce alternative frameworks without an ADR).
Persist via Prisma when adding storage; default to PostgreSQL.
Style with Tailwind classes; do not introduce alternative styling.
Manage state with Zustand.
```

```
Code in Python.
Build with Django (do not introduce alternative frameworks without an ADR).
Persist via Django ORM; default to PostgreSQL.
Test with pytest as the primary runner.
```

## When detection is inconclusive

- **No recognized manifest** → fall back to file-extension majority vote on the top-level source directories (`src/`, `lib/`, `app/`, or repo root). Max 2 languages.
- **Manifest exists but no allowlisted dep** → the rule becomes just the language line. That's still useful. Do not pad with generic content.
- **Multiple equally-popular candidates in one category** (e.g., both `react` and `vue` — rare but possible in monorepos) → pick the one in the most top-level `package.json` files, or ask the user to disambiguate if the count ties.
