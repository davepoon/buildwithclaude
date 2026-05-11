# Run-instructions extraction catalog

Reference data for `/archcore:bootstrap` Step 2. Edit this file to tune extraction.

## Monorepo detection

A repo is a monorepo if **any** of the following is true:

- A file named `pnpm-workspace.yaml` exists at the repo root.
- A file named `turbo.json` exists at the repo root.
- A file named `nx.json` exists at the repo root.
- A file named `lerna.json` exists at the repo root.
- There are **at least 2 `package.json` files** under `apps/` OR under `packages/` (anywhere under those directories, not just direct children).

When detected, the guide must have:

- A top-level "Prerequisites" section.
- A top-level "Workspace install" section (the single `pnpm install` / `yarn install` / `turbo install` command that primes all apps).
- One subsection per detected app (named after its directory) containing the app's own `dev` / `build` / `test` commands.

## README section regex

First section whose heading matches (case-insensitive):

```
^#{1,3}\s+(getting\s+started|quick\s*start|installation|install|development|dev\s+setup|setup|local\s+development|running\s+locally|running\s+the\s+app|run)\b
```

Stop extracting when the next heading at the same or higher level appears.

## Command-block extraction

Fenced code blocks to consider (language tag, case-insensitive):

```
bash | sh | shell | zsh | console | terminal | cmd
```

Also consider bare fenced blocks (no language tag) — but only if they contain at least one line that looks like a shell command (starts with a known command name from the keep-list below, or with `$` prompt).

Keep a command line if its first token (after an optional leading `$` or `>` prompt marker) matches any of:

- **Install:** `npm`, `pnpm`, `yarn`, `bun`, `pip`, `pipx`, `poetry`, `uv`, `bundle`, `gem`, `composer`, `cargo`, `go`, `mix`, `sbt`, `mvn`, `gradle`, `./gradlew`, `mise`, `asdf`
- **Run / test / lint:** the same prefixes with second tokens like `install`, `add`, `dev`, `start`, `run`, `exec`, `test`, `run test`, `build`, `lint`, `format`, `check`, `watch`
- **Env / setup:** `cp`, `mv` (only if target file is `.env` or similar), `docker`, `docker-compose`, `make`, `just`

Drop lines that are obviously not setup commands: `git clone`, `curl`, `wget`, `rm`, `rmdir`, `sudo apt`, `brew install`. Those are environment-level and don't belong in the project run guide.

Strip leading `$`, `>`, `# ` prompt markers before emitting.

## Prerequisites detection

Read directly from manifests; emit only what is declared, never guess versions:

| Source | Field | Example emitted line |
|--------|-------|----------------------|
| `package.json` | `engines.node` | `Node.js <version-spec>` |
| `package.json` | `engines.pnpm` | `pnpm <version-spec>` |
| `package.json` | `engines.bun` | `Bun <version-spec>` |
| `package.json` | `packageManager` | `<tool>@<version>` |
| `pyproject.toml` | `project.requires-python` | `Python <version-spec>` |
| `Cargo.toml` | `package.rust-version` | `Rust <version>` |
| `go.mod` | `go <version>` directive | `Go <version>` |
| `Gemfile` | `ruby '<version>'` | `Ruby <version>` |
| `composer.json` | `config.platform.php` or `require.php` | `PHP <version-spec>` |

If nothing is declared, omit the Prerequisites section entirely — do not pad it.

## Templates

### Single-app template

```markdown
## Prerequisites

- {runtime 1}
- {runtime 2}

## Install

```sh
{install command}
```

## Run locally

```sh
{dev command}
```

## Test

```sh
{test command}
```
```

Rules:
- Drop any section whose content is empty (e.g., no test command detected → omit the Test section entirely).
- `Prerequisites` as a bullet list; commands as fenced `sh` blocks.
- Do not interleave prose — the guide is a minimal command reference, not an explainer.
- Total body ≤ 15 lines (not counting the outer triple-backticks above, which are illustrative).

### Monorepo template

```markdown
## Prerequisites

- {runtime 1}
- {runtime 2}
- {package manager and its version from packageManager, if present}

## Workspace install

```sh
{root install command, e.g., pnpm install}
```

## Apps

### {app-1-name}

```sh
{cd apps/{app-1-name} && {app-1 dev command}}
```

### {app-2-name}

```sh
{cd apps/{app-2-name} && {app-2 dev command}}
```

## Test

```sh
{workspace-wide test command, if present}
```
```

Rules:
- Each app subsection ≤ 6 lines.
- If an app has no detectable dev command from its own `package.json` `scripts`, fall back to `{package manager} dev` at that path, not at repo root.
- Prefer workspace-aware commands when the package manager supports them (e.g., `pnpm --filter <name> dev` is acceptable as an alternative to `cd`).

## When extraction is inconclusive

Order of fallbacks — stop at the first that produces usable output:

1. README section (primary).
2. `scripts:` in `package.json` (or equivalent: `[tool.poetry.scripts]`, `Cargo.toml [[bin]]`, `Gemfile` via `Rakefile`, `composer.json` `scripts`).
3. Ask the user a single open question.

Never guess commands. If all three paths fail, skip Step 2 with an informative message.
