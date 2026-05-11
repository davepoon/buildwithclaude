# Scale Detection

Classifies a repo into `small` / `medium` / `large`. Used by `SKILL.md` Step 0.5 to branch the bootstrap flow.

## Signals

Compute three counts in a single filesystem pass:

1. **`domain_count`** — top-level subdirectories under a conventional root that pass the cohesion rule (≥ 2 source files > 50 LOC) AND are not in the utility-exclusion list.
2. **`module_count`** — source files > 100 LOC, excluding test files, generated code, vendored deps. See `detect-modules.md`.
3. **`entry_point_count`** — files matching entry-point patterns. See `detect-entry-points.md`. Used for reporting and for entry-point inventory; not part of classification.

## Classification thresholds

Evaluate rows top-to-bottom. First match wins. Rows are written so every `(domain_count, module_count)` pair matches exactly one row.

| Mode       | Condition                                     |
| ---------- | --------------------------------------------- |
| **small**  | `domain_count ≤ 1` AND `module_count ≤ 15`    |
| **medium** | `domain_count ≤ 2` AND `module_count ≤ 40`    |
| **large**  | otherwise (`domain_count ≥ 3` OR `module_count > 40`) |

Examples:

- `(1, 10)` → small (matches row 1).
- `(2, 10)` → medium (row 1 fails on `domain_count ≤ 1`; row 2 passes).
- `(1, 30)` → medium (row 1 fails on `module_count ≤ 15`; row 2 passes).
- `(2, 45)` → large (row 1 and 2 fail on `module_count`).
- `(5, 10)` → large (rows 1 and 2 fail on `domain_count`).

## Override

User may force a mode with `--mode=small|medium|large` on the bootstrap invocation. When overridden, Step 0.5 announces both the detected mode and the forced mode, e.g.:

> Mode: medium (forced, detected=small). Override with `--mode=X` or drop the flag to auto-detect.

## Conventional roots (priority order)

When multiple of these exist, prefer the earlier entry — monorepo roots are more authoritative than `src/`.

1. `apps/` — monorepo workspace (each subdir is a candidate domain).
2. `packages/` — monorepo workspace.
3. `services/` — microservices layout.
4. `internal/` — Go internal packages (each subdir is a domain).
5. `cmd/` — Go commands (each subdir is an entry point, not a domain).
6. `src/` — most common single-root convention.
7. `app/` — Rails / Next.js App Router.
8. `modules/`, `domains/`, `pkg/`, `lib/`.
9. Repo root (fallback) — if nothing above exists, enumerate top-level source directories directly.

## Utility-name exclusion (applied to `domain_count` only)

Subdirectories with these names do NOT count as domains, even if they pass the cohesion rule:

- `utils`, `util`, `helpers`, `helper`
- `common`, `shared`, `core`
- `types`, `typings`, `constants`, `config`, `configs`
- `test`, `tests`, `__tests__`, `__fixtures__`, `fixtures`
- `vendor`, `node_modules`, `dist`, `build`, `out`, `target`, `coverage`
- `generated`, `__generated__`
- `docs`, `documentation`, `examples`, `scripts`

`lib/` is ambiguous — if it's the sole top-level directory, treat as single-domain repo; if it sits alongside other directories that also qualify, exclude it as utility.

## Border cases

- **Monorepo with one real app + empty `packages/`**: `domain_count` effectively = 1 → classify as small or medium by module count. Don't let an empty workspace bump the tier.
- **Giant single-domain library** (one `src/` with 60 modules): module-count triggers `large`. Override with `--mode=medium` if the team finds large-mode noise unhelpful.
- **Repo with only stubs** (subdirs with < 50 LOC files): `domain_count` = 0, `module_count` low → small.
- **Flat repo, no conventional root**: enumerate top-level source files directly. `domain_count` = 0. Classify by `module_count` alone.
