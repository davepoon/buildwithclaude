# Domain Detection

Enumerates bounded contexts / domain slices of the repo. Used in `large` mode for the top-level map and domain-selection dialog, and in `medium` mode to inform entry-point grouping.

## Algorithm

1. Pick the conventional root per `detect-scale.md` priority list. If multiple roots exist, prefer monorepo roots (`apps/`, `packages/`, `services/`).
2. Enumerate immediate subdirectories of the chosen root.
3. For each subdir:
   - Skip if name is in the utility-exclusion list (see `detect-scale.md`).
   - Count source files (extensions per `detect-modules.md`) with LOC > 50, excluding test files.
   - If count ≥ 2, record as a domain: `(name, relative_path, file_count, total_loc)`.
4. If fewer than 2 domains result, the repo is effectively single-domain.

## Monorepo special case

When root is `apps/`, `packages/`, or `services/`:

- Each subdir is a candidate domain, **bypassing the utility-exclusion list** — workspace names are first-class, not conventional utility names.
- Cohesion rule still applies (≥ 2 files > 50 LOC).
- A workspace with a single file, only config, or only `package.json` does not count as a domain.
- If the root has both `apps/` and `packages/`, treat them as one combined domain list (each subdir of each is a candidate).

## Auto-summary per domain (one-liner for top-level map)

For each detected domain, derive a one-line description in this priority order:

1. **Domain README**: if `<domain-path>/README.md` exists, read the first heading and its immediately following paragraph. Extract ≤ 120 chars, single line, no markdown.
2. **Domain manifest signals**: if the domain has its own `package.json` / `pyproject.toml` / `Cargo.toml` / `go.mod`, extract the top 3 dependencies from the stack-signal allowlist (per `detect-stack.md`). Format: `"Uses <a>, <b>, <c>."`.
3. **Shape fallback**: `"<file_count> modules (<top_language>)."` — language inferred from the dominant extension.

## Ranking (for domain-selection dialog in large mode)

Rank domains by:

```
rank_score = total_loc + 50 * file_count + 0.5 * recent_commit_weight
```

Where `recent_commit_weight` is the count of commits touching files under the domain's path in the last 90 days:

```
git log --since=90.days --name-only --pretty=format: -- <domain_path>/ \
  | grep -c -v '^$'
```

If `git` is unavailable (shallow clone, git missing) or the repo has no commit history, drop the git term and rank by `total_loc + 50 * file_count`.

## Presentation

Show the top 5 ranked domains to the user. The rest are listed in the closing message under:

> Also detected: <domain-a>, <domain-b>, … — run `/archcore:bootstrap --domain=<name>` later to drill into these.

## Domain tags

When the user selects domains in the dialog, tag the top-level map `doc` with `domain:<slug>` for each selected domain. Slug rules:

- Lowercase, alphanumeric + hyphens.
- Slashes → hyphens (`apps/billing-api` → `apps-billing-api`).
- Dots → hyphens.
- Prefix with `domain:` literal (e.g. `domain:billing`, `domain:apps-billing-api`).

These tags enable `/archcore:context` to scope queries to a specific domain.
