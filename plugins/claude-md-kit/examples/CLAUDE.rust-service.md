# CLAUDE.md — Ledger API

> Rules for AI coding agents. Terse and imperative — read every session. Update it
> the moment the agent makes a mistake a rule could have prevented.
>
> This is a *filled-in example* for a Rust backend service (axum + sqlx + tokio).
> Adapt the specifics to your project; the shape is the point.

## What this is
A Rust HTTP API (axum) that records financial ledger entries. Correctness and
data integrity matter more than raw feature velocity — a wrong balance is worse
than a missing endpoint.

## Run / test / build
- Build: `cargo build` — **must compile with zero warnings** (`RUSTFLAGS="-D warnings"`).
- Run: `cargo run` — serves on `http://localhost:8080` (needs a running Postgres; see below).
- Test: `cargo test` — one test: `cargo test balance_never_negative`.
- Lint: `cargo clippy --all-targets -- -D warnings` — **must pass before every commit.**
- Format: `cargo fmt` — CI runs `cargo fmt --check`; never commit unformatted code.
- DB: `docker compose up -d db` then `sqlx migrate run`. `DATABASE_URL` in `.env`.

## Golden rules
1. **Verify before claiming done.** Changes to product code must be exercised: run
   the relevant `cargo test`, or hit the route with `curl`. `cargo build` passing
   is necessary, not sufficient — don't imply it works from a compile alone.
2. **Match the surrounding code.** Idiomatic Rust: return `Result<T, AppError>`,
   propagate with `?`, no `.unwrap()`/`.expect()` outside tests and `main`.
3. **Smallest change that solves it.** No drive-by refactors. No new crate without
   flagging it and why — every dependency is attack surface and compile time.
4. **Ask before the expensive mistake.** Migrations, anything in `src/domain/money.rs`,
   or changes to the error/response contract — plan first.
5. **Commit at each green increment** (compiles + clippy clean + tests pass).

## Architecture (the non-obvious parts)
- **Business logic lives in `src/domain/`**, free of axum and sqlx types — pure
  functions over plain structs, unit-tested without a database. Handlers in
  `src/routes/` are *thin*: extract + validate input, call a domain function, map
  the result to a response. Never put logic in a handler.
- **Money is `i64` minor units (cents)**, wrapped in a `Money` newtype in
  `src/domain/money.rs`. Never `f64` for currency. Arithmetic that can overflow
  uses `checked_add`/`checked_sub` and returns an error, never wraps or panics.
- **DB:** sqlx with compile-time-checked queries (`query!`/`query_as!`). After
  changing SQL or the schema, run `cargo sqlx prepare` so offline builds pass in CI.
  Migrations are append-only in `migrations/` — never edit a migration that has run.
- **Async:** tokio. Never block the runtime — no `std::fs`, blocking DB calls, or
  `std::thread::sleep` inside an async fn; use the tokio equivalents or
  `spawn_blocking`.
- **Errors:** one `AppError` enum in `src/error.rs` implementing `IntoResponse`.
  Handlers return `Result<Json<T>, AppError>`; the enum maps each variant to a
  status code + a JSON body. Domain code returns typed errors, never `String`.
- **Config:** parsed once at startup into a `Config` struct (envy/Zod-equivalent).
  Add new env vars there, not scattered `std::env::var` reads.

## Conventions
- Modules and files `snake_case`; types `PascalCase`; consts `SCREAMING_SNAKE_CASE`.
- Public items get a `///` doc comment saying *why*, not *what*.
- Prefer borrowing (`&str`, `&[T]`) in signatures; clone only when you must, and
  only after it's shown to matter.
- Tests: unit tests in a `#[cfg(test)] mod tests` next to the code; integration
  tests hitting real routes in `tests/`. Test behavior and edge cases (overflow,
  empty input, concurrent writes), not implementation details.
- No `unsafe` without a `// SAFETY:` comment justifying every invariant — and flag
  it in the PR.

## Do NOT touch
- `src/domain/money.rs` and anything under `migrations/` without a plan — money
  and irreversible schema changes.
- `.env*`, `docker-compose.yml`, CI in `.github/` — flag needed changes instead of
  editing.
- `Cargo.lock` by hand — let cargo manage it.

## When stuck
State your plan and the single assumption you're least sure about before writing
more than a few lines. For anything touching balances, name the overflow and the
concurrent-write case explicitly.

---
*Free starter and more examples: https://fablerlabs.com/claude-md-generator*
