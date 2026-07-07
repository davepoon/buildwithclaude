# CLAUDE.md — dstat (Python CLI)

> Rules for AI coding agents. Terse and imperative — read every session. Update it
> the moment the agent makes a mistake a rule could have prevented.
>
> This is a *filled-in example* for a Python CLI + library (uv + pytest + ruff).
> Adapt the specifics; the shape is the point.

## What this is
`dstat` — a command-line tool + importable library for summarizing tabular data
files. Ships as a CLI (`dstat report data.csv`) and a public Python API
(`from dstat import summarize`). Both surfaces are supported; don't break either.

## Run / test / build
- Install (dev): `uv sync` — creates `.venv`, installs with dev extras
- Run the CLI: `uv run dstat --help`
- Test: `uv run pytest` — one test: `uv run pytest tests/test_summary.py::test_median`
- Typecheck: `uv run mypy src` — **must pass before every commit**
- Lint/format: `uv run ruff check --fix` / `uv run ruff format`
- Build dist: `uv build`

## Golden rules
1. **Verify before claiming done.** Run `uv run pytest` for logic changes and
   actually invoke the CLI (`uv run dstat report examples/sample.csv`) for
   CLI-facing changes. Don't imply it works from mypy alone.
2. **Match the surrounding code.** Type hints on every public function; Google-style
   docstrings on anything exported.
3. **Smallest change that solves it.** No new runtime dependency without flagging it
   — this tool prides itself on a tiny dependency tree (stdlib + `click`).
4. **Ask before the expensive mistake.** Changing the public API in `src/dstat/__init__.py`
   or CLI flags is a breaking change — plan and note it in `CHANGELOG.md` first.
5. **Commit at each green increment.**

## Architecture (the non-obvious parts)
- **Pure logic in `src/dstat/core.py`** — no I/O, no `click`, fully unit-tested.
  The CLI layer (`src/dstat/cli.py`) parses args and prints; it calls into `core`.
  Never read files or print inside `core`.
- **The public API is exactly what `src/dstat/__init__.py` re-exports.** Anything
  not exported there is private and may change freely.
- **Errors:** raise `DstatError` (from `errors.py`) for user-facing problems; `cli.py`
  catches it and exits non-zero with a plain message. Let genuine bugs raise and
  traceback.
- **No global state.** Config is passed explicitly, never read from module globals.

## Conventions
- `snake_case` functions/vars, `PascalCase` classes, modules lowercase.
- Tests in `tests/`, mirroring `src/` layout; test behavior via the public API, not
  private helpers.
- Prefer stdlib; reach for a dependency only when it removes real complexity.
- Keep functions small and pure where possible — it makes them testable.

## Do NOT touch
- Public signatures in `src/dstat/__init__.py` / `cli.py` flags without a plan +
  CHANGELOG entry.
- `pyproject.toml` dependency list — flag additions instead of adding silently.
- Generated `dist/`, `.venv/`.

## When stuck
State your plan and the single assumption you're least sure about before writing
more than a few lines.

---
*Free starter and more examples: https://fablerlabs.com/claude-md-generator*
