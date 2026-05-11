# Cross-Cutting Pattern Detection

Surfaces **one** candidate rule when the repo shows a consistent cross-cutting convention worth codifying. Used only in `medium` mode — small repos rarely need it, large repos defer cross-cutting detection to per-domain passes.

Deliberately conservative: false positives are more harmful than missed patterns. Better to surface nothing than to invent a rule.

## Signal budget

Scan at most 200 source files. Skip if no pattern meets the trigger threshold. Never propose more than one candidate.

## Heuristic H1 — Shared log prefix

### Detect

Grep across source files for string literals matching `\[[A-Z][A-Za-z0-9 _-]+\]` that appear inside a logging call. Logging calls to scan for:

- `console.log`, `console.info`, `console.warn`, `console.error`
- `logger.(info|warn|error|debug|trace)`
- `log.(info|warn|error|debug)`
- `debugLog\s*\(`
- `print\s*\(` (Python)
- `fmt.Println\s*\(`, `log.Println\s*\(` (Go)
- `slog.(Info|Warn|Error|Debug)` (Go)

### Trigger

- ≥ 3 distinct source files use a `[...]` prefix inside their first logging call, AND
- The prefixes are per-module (different files use different prefixes) rather than a single shared string.

### Candidate rule

> Prefix logs with `[<ModuleName>]` matching the module of origin. Used to filter by module in debug sessions.

## Heuristic H2 — Shared middleware / guard wrap

### Detect

Parse entry-point files (per `detect-entry-points.md`) for function wrappers/decorators applied at definition time.

- TS/JS: `app.use(X)`, `export default withX(handler)`, `handler.use(X)`.
- Python: `@authenticated`, `@login_required`, `@require_auth`, `@jwt_required` stacked at ≥ 3 handler definitions.
- Go: `middleware.Chain(X, Y, Z)` constructions where the same middleware ID recurs.
- Java: `@PreAuthorize`, `@Secured`, `@RolesAllowed`.

### Trigger

≥ 3 handler definitions share at least one identical wrapper/decorator name (excluding framework-builtins like `@app.route` itself).

### Candidate rule

> All HTTP handlers MUST be wrapped with `<middlewareName>`. Do not expose a handler without this guard.

## Heuristic H3 — Shared import with consistent alias

### Detect

Grep imports across source files for modules imported from a local path (`./`, `../`, or the repo's own package name) with ≥ 3 uses of the same named import.

- TS/JS: `import { logger } from '../lib/logger'`, `import { db } from '@/db'`.
- Python: `from app.logger import logger`.
- Go: imports of internal packages where the same aliased identifier is used.

### Trigger

- ≥ 5 distinct files import the same symbol from the same local module, AND
- There exists an obvious alternative direct dependency (e.g., `winston`, `pino`, `log/slog`) that some files could have imported instead but don't.

### Candidate rule

> Use the shared `<symbol>` from `<path>`; do not import `<underlying-lib>` directly.

## Selection (if multiple triggered)

If multiple heuristics trigger, pick one in priority order: **H2 > H1 > H3**. Auth guards matter most; log prefixes are very common to codify; shared-import conventions are the weakest signal.

## Output

One candidate shown to user:

> Detected cross-cutting pattern: <one-line description of the rule>. Seen in: <path-1>, <path-2>, <path-3> (+ N more).
>
> Codify as a rule? (y/n)

On `y`, direct user to `/archcore:standard` (passes a draft rule as context). Do NOT auto-invoke — the user should confirm the exact phrasing through the standard flow. On `n` or no trigger, skip silently.

## Deliberately excluded in MVP

- Call-graph analysis.
- Type-level conventions (e.g. "every API response uses `ApiResponse<T>`").
- File-structure conventions (e.g. "every module has a `types.ts`") — easy to false-positive without more data.
- Error-handling conventions (promising but requires parsing try/catch shapes).

These are all good candidates for a future iteration but the MVP keeps detection deliberately narrow.
