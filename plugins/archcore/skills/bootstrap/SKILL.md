---
name: bootstrap
argument-hint: "[--mode=small|medium|large]"
description: "First-time onboarding: detect repo scale (small / medium / large) and seed scale-appropriate `.archcore/` documents — stack rule, run guide, entry-point inventory (medium+), top-level domain map (large), hotspot capture candidates, and optional imports from existing agent-instruction files (CLAUDE.md, AGENTS.md, .cursorrules, etc.). Activate when user says 'bootstrap archcore', 'initialize archcore', 'set up archcore', 'seed archcore', 'first-time setup', 'what should I do first', or asks how to start after a fresh install. Do NOT activate for creating individual documents (use /archcore:capture, /archcore:decide, /archcore:standard), for feature planning (use /archcore:plan), for documentation audits (use /archcore:review), or for loading existing context (use /archcore:context)."
---

# /archcore:bootstrap

First-time onboarding. Detects repo scale (small / medium / large) and seeds scale-appropriate `.archcore/` documents so push-mode (`check-code-alignment` hook) and pull-mode (`/archcore:context`) have substance to inject. Agent-file import (CLAUDE.md, AGENTS.md, .cursorrules) is the opt-in final step in every mode. Exact per-mode output is in the Routing Table below.

## Argument

`--mode=small|medium|large` — force a mode, overriding auto-detection.

## When to use

- Empty `.archcore/` — the SessionStart nudge points here.
- First session on a fresh clone / fresh install.
- User says: "bootstrap archcore", "initialize archcore", "set up archcore", "seed archcore", "first-time setup", "what should I do first".

**Not bootstrap** (route elsewhere):

- Recording a specific decision → `/archcore:decide`.
- Planning a feature → `/archcore:plan`.
- Documenting one module → `/archcore:capture`.
- Codifying a team standard → `/archcore:standard`.
- Reading applicable context before coding → `/archcore:context`.
- Docs health audit → `/archcore:review`.

## Routing table

**Mode routing** — Step 0.5 classifier, evaluated top-to-bottom, first match wins. The **empty** route is decided earlier in Step 0(b) and short-circuits the classifier entirely. Precise conditions for the rest in `lib/detect-scale.md`.

| Signal | Route | Seeded artifacts |
|---|---|---|
| No manifest AND no top-level source (Step 0b) | → **empty** | none — acknowledge-only, no placeholder docs |
| `--mode=X` flag | → forced `X` (detected mode still reported) | per row below |
| `domain_count ≤ 1` AND `module_count ≤ 15` | → **small** | stack rule, run guide |
| `domain_count ≤ 2` AND `module_count ≤ 40` | → **medium** | small + entry-point inventory |
| `domain_count ≥ 3` OR `module_count > 40` | → **large** | medium + top-level map + domain dialog |

Each non-empty mode additionally runs hotspot capture-candidate proposal (Step 6) and optional agent-file import (Step 8). Medium additionally runs cross-cutting rule candidate (Step 7). The empty route exits after Step 0.

**Follow-up routing** — closing-message hand-offs. Bootstrap surfaces these as todos; MUST NOT auto-invoke.

| User wants to... | → Invoke |
|---|---|
| Capture a hotspot module | `/archcore:capture <path>` |
| Record a decision | `/archcore:decide` |
| Codify a convention as a rule | `/archcore:standard` |
| Plan a feature | `/archcore:plan` |
| Drill into another domain (large) | `/archcore:bootstrap --domain=<name>` |
| Scope queries to a domain (large) | `/archcore:context domain:<slug>` |
| See what's loaded | `/archcore:review` (short mode) |

## Execution

### Pre-flight: lazy reading

Bootstrap MUST give the user fast feedback. The detection catalogs under `skills/bootstrap/lib/` are heavy (≥ 350 lines for scale alone) and they are read **lazily**: do NOT open any `lib/*.md` file until you reach the step that explicitly tells you to read it. Step 0 finishes before any `lib/` file is opened.

### Step -1: Initialize and acknowledge (fast)

Call `mcp__archcore__init_project()` exactly once. It is idempotent — safe on an already-initialized project (returns existing settings). It creates `.archcore/` and `settings.json` if missing.

Immediately after the call, give the user a one-line confirmation so they see something tangible without waiting for any detection:

- If the response includes `initialized: true` (created now) — print: *"Archcore initialized at `.archcore/`."*
- If `already_initialized: true` — print nothing here; the existing knowledge base will speak for itself in Step 0(a).

Do NOT ask the user to run `archcore init` in the terminal — `mcp__archcore__init_project` is the correct path in a plugin session.

### Step 0: Check state and source signal

Two cheap probes, in order. Each can short-circuit the whole skill. Neither reads anything under `lib/`.

#### Step 0(a) — Existing documents

Call `mcp__archcore__list_documents()` once. Derive:

- `has_stack_rule` — any `rule` whose title contains "stack" in `conventions/`.
- `has_run_guide` — any `guide` whose title contains "run" or "running" in `onboarding/`.
- `has_top_level_map` — any `doc` with tag `top-level-map`.
- `has_entry_points` — any `doc` with tag `entry-points`.
- `has_imports` — any document with tag `imported`.

If `has_stack_rule` AND `has_run_guide` are both true, reply:

> Bootstrap already seeded stack rule and run guide. Use `/archcore:context` to see what's loaded, or re-run a specific step (say "regenerate the stack rule", "refresh the entry-point inventory", etc.).

Then stop. Per-step idempotency checks (below) handle mode-specific artifacts when the user asks for a selective refresh.

#### Step 0(b) — Source-signal gate (empty-repo early exit)

Single filesystem probe — one shell call, no catalog reads. Detect whether the repository has any executable shape yet:

- **`has_manifest`** — at least one of these exists at the project root (depth ≤ 2 for monorepo workspaces): `package.json`, `pyproject.toml`, `Pipfile`, `requirements.txt`, `Cargo.toml`, `go.mod`, `Gemfile`, `composer.json`, `*.csproj`, `*.fsproj`, `*.vbproj`, `pom.xml`, `build.gradle`, `build.gradle.kts`, `mix.exs`, `Package.swift`.
- **`has_top_level_source`** — at least one file with a recognizable source extension exists anywhere under the project root, capped at depth 3, excluding `.archcore/`, `.git/`, `node_modules/`, `vendor/`, `dist/`, `build/`, `out/`, `target/`, `coverage/`, `.venv/`, `__pycache__/`, `.next/`, `.turbo/`. Extensions: `.ts`, `.tsx`, `.js`, `.jsx`, `.mjs`, `.cjs`, `.py`, `.rs`, `.go`, `.rb`, `.php`, `.java`, `.kt`, `.kts`, `.swift`, `.cs`, `.fs`, `.ex`, `.exs`, `.scala`, `.clj`, `.cljs`.

If BOTH are false, take the **empty** route. Reply with exactly:

> Archcore is ready at `.archcore/`. No source code detected yet — nothing to bootstrap.
>
> Re-run `/archcore:bootstrap` after the first manifest or source file lands. The SessionStart empty-state nudge will keep pointing here until then.

Then stop. **Do NOT** create placeholder documents (no "no stack selected yet" rule, no "no run command yet" guide). They have no practical value, they cost MCP roundtrips and tokens, and they suppress the SessionStart empty-state nudge — which is the user's primary breadcrumb back to bootstrap once code actually exists.

Otherwise (`has_manifest` OR `has_top_level_source`), proceed to Step 0.5.

### Step 0.5: Detect scale

Read `skills/bootstrap/lib/detect-scale.md`, `detect-domains.md`, and `detect-modules.md`.

1. **Parse `--mode=X`.** If provided and valid (`small|medium|large`), record the forced mode.
2. **Compute signals:**
   - `domain_count` — per `detect-domains.md`.
   - `module_count` — source files > 100 LOC, excluding tests and generated code.
   - `entry_point_count` — per `detect-entry-points.md` (informational only).
3. **Classify** per `detect-scale.md`. If `--mode` was forced, use the forced value but remember the auto-detected one for the announcement.
4. **Announce:**
   - Auto-detected: *"Mode: `<mode>` (detected from `<domain_count>` domains, `<module_count>` modules). Override with `/archcore:bootstrap --mode=X`."*
   - Forced: *"Mode: `<forced>` (forced; auto-detected was `<detected>`)."*
5. **Outline the flow:**
   - Small: Steps 1, 2, 6, 8.
   - Medium: Steps 1, 2, 4, 6, 7, 8.
   - Large: Steps 1, 2, 3, 4, 5, 6, 8. (Step 7 runs in medium mode only.)

### Step 1: Stack rule (all modes)

1. **Idempotency.** If `has_stack_rule`, show existing rule's title + path. Ask: *"Stack rule exists. Regenerate (overwrite), skip this step, or keep and continue?"* On regenerate, warn manual edits will be lost.
2. **Detect the stack.** Read `skills/bootstrap/lib/detect-stack.md` for manifests, allowlist, exclusions, template.

    Read in order, stopping at the first match per language: `package.json`, `pyproject.toml`, `Pipfile`, `requirements.txt`, `Cargo.toml`, `go.mod`, `Gemfile`, `composer.json`, `*.csproj`, `pom.xml`, `build.gradle*`. Polyglot repos: collect from each manifest.

    Extract top-level (declared, not transitive) dependencies. Apply the allowlist + exclusions from `detect-stack.md`. Cap at **5 signals total**.

    No manifest → file-extension fallback on top-level source dirs (`src/`, `lib/`, `app/`, repo root) for majority language(s), up to 2.
3. **Compose body** per `detect-stack.md` template. Drop lines whose placeholder has no signal. Imperative, no versions, no library enumerations. ≤ 6 lines.
4. **Create** via `mcp__archcore__create_document(type='rule', filename='project-stack', directory='conventions', title='Project stack', status='accepted', tags=['stack', 'conventions'], content=<body>)`.

    Report: *"Stack: <signals> → `.archcore/conventions/project-stack.rule.md`"*.

### Step 2: Run-the-app guide (all modes)

1. **Idempotency.** If `has_run_guide`, show existing guide's title + path. Ask same regenerate/skip/keep prompt as Step 1.
2. **Detect shape.** Read `skills/bootstrap/lib/extract-run-instructions.md`. Monorepo markers: `pnpm-workspace.yaml`, `turbo.json`, `nx.json`, `lerna.json`, OR ≥ 2 `package.json` under `apps/` or `packages/`. Monorepo path is default in large mode; in small/medium, only when detected.
3. **Extract commands** — two paths, first-match wins:
   - **README** — read `README.md` (or `README.{en,ru,*}.md` if absent). First section matching the regex in `extract-run-instructions.md`. Pull fenced ```bash/sh/shell/zsh``` blocks. Filter to install/run/test commands per `extract-run-instructions.md`.
   - **Scripts** — if README yields nothing: `scripts:` in `package.json` (or language equivalents: `[tool.poetry.scripts]`, `Cargo.toml [[bin]]`, `Rakefile` tasks, `composer.json scripts`). Pick `dev`, `start`, `build`, `test`, `lint` if present.
   - **Neither** — ask: *"I couldn't extract run commands automatically. In one line: how do you run this app locally?"* Use the answer verbatim.
4. **Detect prerequisites** from `engines` (package.json), `[project].python` (pyproject.toml), `rust-version` (Cargo.toml), `go` directive (go.mod). State as-is; do not invent.
5. **Compose body** per `extract-run-instructions.md`. Single-app ≤ 15 lines; monorepo per-app subsection ≤ 6 lines. Strip marketing prose — commands + prerequisites only.
6. **Create** via `mcp__archcore__create_document(type='guide', filename='running-the-project', directory='onboarding', title='Running the project locally', status='accepted', tags=['onboarding'], content=<body>)`.

    Report: *"Run commands from <README section X / package.json scripts / user answer> → `<path>`"*.

### Step 3: Top-level map (large mode only)

Skip unless mode is `large`.

1. **Idempotency.** If `has_top_level_map`, ask regenerate/skip/keep.
2. **Enumerate domains** per `detect-domains.md` ranking rule. Collect `(name, path, file_count, total_loc, auto_summary)` per domain.
3. **Compose body:**

    ```
    ## Domains

    | Domain | Path | Modules | Summary |
    |---|---|---|---|
    | <name> | `<path>` | <file_count> | <auto_summary> |

    ## Conventional roots

    <e.g. "Monorepo under `apps/` (N workspaces) and `packages/` (M shared libs).">

    ## How to drill in

    Run `/archcore:bootstrap --domain=<name>` for a focused per-domain pass later. Scope queries with `/archcore:context domain:<slug>`.
    ```

    If ranked domains > 10, include top 10 in the table; list the rest on an "Also detected" line.
4. **Create** via `mcp__archcore__create_document(type='doc', filename='top-level-map', directory='architecture', title='Top-level domain map', status='accepted', tags=['top-level-map', 'architecture'], content=<body>)`.

    Report: *"Top-level map → `.archcore/architecture/top-level-map.doc.md` (N domains)."*

### Step 4: Entry-point inventory (medium and large modes)

Skip in small mode.

1. **Idempotency.** If `has_entry_points`, ask regenerate/skip/keep.
2. **Enumerate entry points** per `detect-entry-points.md`. Bucket into HTTP, CLI, Worker, Cron, Other.
3. **Compose body** with one `##` section per non-empty bucket:

    ```
    ## HTTP
    - <path> — <signature>

    ## CLI
    - <path> — <signature>

    ## Workers
    - <path> — <queue name>

    ## Cron / scheduled
    - <path> — <schedule>

    ## Other
    - <path> — <short description>
    ```

    In large mode, additionally group by domain using domain tags from `detect-domains.md`.

    Nothing detected → single-line body:

    > No entry points detected automatically. This repo may be a pure library / SDK consumed by other projects.
4. **Create** via `mcp__archcore__create_document(type='doc', filename='entry-points', directory='architecture', title='Entry-point inventory', status='accepted', tags=['entry-points', 'architecture'], content=<body>)`.

    Report: *"Entry points: <http_count> HTTP / <cli_count> CLI / <worker_count> workers → `<path>`."*

### Step 5: Domain selection dialog (large mode only)

Skip unless mode is `large`.

1. **Present top 5 domains** from Step 3's ranked list, one line per domain.
2. **Ask:** *"Which domains are you working on right now? (pick 1–3 by name or number, or `skip` to defer.)"* Accept single name, comma-separated list, or `skip`.
3. **Tag the top-level map.** Call `mcp__archcore__update_document` on the map. Add `domain:<slug>` tags for each selected domain (slugs per `detect-domains.md` "Domain tags"). Preserve existing tags — do not remove them.
4. **Announce:** *"Focused on: <domain-a>, <domain-b>. Step 6 proposes hotspot captures within these."*
5. **Other domains.** Remember for the closing message: *"Other domains: <list>. Run `/archcore:bootstrap --domain=<name>` later to drill into any of them."*

### Step 6: Hotspot capture-candidate proposal (all modes)

1. **Scope.**
   - Small / medium: whole repo (minus generated code per `detect-modules.md`).
   - Large: union of paths under selected domains. If user said `skip` in Step 5, skip this step and note in closing.
2. **Rank** per `detect-hotspots.md`. Apply thresholds and top-N per mode (small/large: 3; medium: 5).
3. **Present** as numbered list with rationale template from `detect-hotspots.md`. Example:

    ```
    Hotspot capture candidates:

    1. src/token-mutex.ts — 137 LOC source, 396 LOC tests. Suggested: spec. heavily tested (2.9:1).
    2. src/token-rotation.ts — 235 LOC source, 968 LOC tests. Suggested: spec. heavily tested (4.1:1).
    3. src/auth-client.ts — 52 LOC source, 0 LOC tests. Suggested: spec. concentrated public surface.

    To capture any: run /archcore:capture <path>. For decisions: /archcore:decide. For rules: /archcore:standard.
    ```
4. **Empty pool.** No modules meet the threshold → use the exact closing text from `detect-hotspots.md`.
5. **Sibling patterns.** If `detect-hotspots.md` flagged ≥ 3 siblings, append its "Run `/archcore:standard` to codify..." line verbatim.
6. **Do NOT auto-invoke** `/archcore:capture`, `/archcore:decide`, or `/archcore:standard`. The output is a todo list; the user walks through at their own pace.

### Step 7: Cross-cutting rule candidate (medium mode only)

Skip in small and large modes.

1. **Detect** per `detect-cross-cutting.md`. Apply H1 / H2 / H3 heuristics. Pick at most one via priority H2 > H1 > H3.
2. **No candidate → skip silently.** Do not announce the step was skipped.
3. **One candidate** — show to user:

    > Detected cross-cutting pattern: <description>. Seen in: <path-1>, <path-2>, <path-3> (+ N more). Codify as a rule? (y/n)
4. **On `y`** — instruct the user: *"Run `/archcore:standard` and paste this draft as the starting rule."* Do NOT auto-invoke.
5. **On `n`** — skip silently.

### Step 8: Import agent-instruction files (opt-in, all modes)

Opt-in. Slowest, most token-intensive step — always confirm before starting.

1. **Detect candidates** per `skills/bootstrap/lib/agent-files.md`. For each probe path/glob: check existence, measure byte size. Empty set → announce *"No agent-instruction files found."* and finish.
2. **Estimate cost.** Sum bytes + count. Document yield estimate = `ceil(combined_bytes / 800)` (assumes ~800 bytes per extracted document block on average), capped at 25. Token estimate: `combined_bytes * 2` for extract, `~200 * file_count` for link.
3. **Cost tier — HIGH** if any: combined size > **50 KB** OR file count > **5** OR yield > **8**.
4. **Prompt:**
   - **Normal** — *"Found N files (X KB). Parsing will create up to ~Y documents. **do** / skip?"*
   - **HIGH** — prefix `⚠️ HIGH COST:` and require explicit `do` (not Enter/y/yes alone).

    Skip or declined HIGH → exit Step 8.
5. **Skip already-imported.** Call `mcp__archcore__list_documents(tags=['imported'])`. For each detected file, compute its slug per `agent-files.md` "Source slugging". Match against existing `source:<slug>` tags. Report: *"Skipping N files already imported."*
6. **Per-file mode.** For each remaining file: *"`{path}` ({size}) — link (default), extract, or skip?"*
   - **link** — one `doc`, single-line pointer body, zero content duplication.
   - **extract** — split into semantic blocks, route per `lib/extract-routing.md` into `rule` / `adr` / `doc`.
   - **skip** — omit from this run.

    Accept batch answers ("link all" / "skip all").
7. **Encoding: tag + body convention.** MCP strips unknown frontmatter fields; encode source identity in tags + body instead:

    - **Tags (mandatory):**
      - `imported` — literal marker.
      - `source:<slug>` — slug rules: lowercase alphanumeric + hyphens; dots → hyphens, slashes → hyphens; collapse repeated hyphens; preserve extension segment (prevents `.md`/`.mdc` collisions); leading `.` dropped before slugging. Examples: `AGENTS.md` → `source:agents-md`; `.cursorrules` → `source:cursorrules`; `.cursor/rules/styling.mdc` → `source:cursor-rules-styling-mdc`.
    - **Body first line (exact format):**

      ```
      > Imported from `<exact-relative-path>` on <ISO-8601-date>.
      ```

      Use repo-root-relative path. Current date in `YYYY-MM-DD`.
8. **Build create list.**
   - **Link mode** — `create_document(type='doc', title='Imported: <basename>', directory='imports', filename='imported-<slug>', status='accepted', tags=['imported', 'source:<slug>'], content=<pointer-line-only>)`. Body < 200 bytes (empty-state threshold — a stubby import must not defeat the SessionStart nudge on an otherwise-empty repo).
   - **Extract mode** — one document per semantic block per `extract-routing.md`. Same `imported` + `source:<slug>` tags, same pointer body first line + extracted content. Add `related` edges from each extracted document to an umbrella `doc` (create the umbrella first via link-mode rules).
9. **Dry-run preview.** Before any creates: *"Will create N documents: X rule(s), Y adr(s), Z doc(s). Confirm? (y/n)"* On `n`, cancel all Step 8 creates without partial state.
10. **Batch execute.** `create_document` per item. Then `add_relation` for extract-mode umbrella links. Individual failure → roll forward (surface error, continue; do not delete successful creates).
11. **Report** one line per file: *"`<path>` → created N documents (link/extract)"* or *"skipped"*.

### Closing message: outlook

Summarize what was created and what remains in the tracked-context outlook. Per-mode template.

**Small:**

> Done. Seeded: stack rule, run guide. Proposed: N hotspot captures.
>
> Over time: ADRs for non-trivial dependency choices (`/archcore:decide`), specs for hotspot modules (`/archcore:capture <path>`), a task-type for any repeating extension pattern (`/archcore:standard`). Edit a file matching the stack rule — relevant context auto-injects via `check-code-alignment`. Use `/archcore:context` to query what applies to a code area.

**Medium:**

> Done. Seeded: stack rule, run guide, entry-point inventory. Proposed: N hotspot captures[, 1 cross-cutting rule candidate].
>
> Over time: ADRs for architectural decisions (persistence, auth, observability), specs for hotspot modules, rules per cross-cutting concern (logging, error-handling, request-context), task-types for common change patterns. Run `/archcore:decide`, `/archcore:capture`, `/archcore:standard`, `/archcore:plan` as the work takes you there.

**Large:**

> Done. Seeded: workspace stack rule, monorepo run guide, top-level map (N domains), entry-point inventory. Focused on: <selected-domains>. Proposed: M hotspot captures in selected domains.
>
> Over time, each domain needs its own ADRs, specs, and task-types. Repo-wide: cross-cutting rules (logging, errors, auth, transactions, telemetry). Run `/archcore:bootstrap --domain=<name>` later for other domains. Use `/archcore:context domain:<slug>` to scope queries.

Always end with:

> Use `/archcore:review` for a dashboard, `/archcore:review --deep` for a health audit.

## Result

Mode-appropriate `.archcore/` seed:

- **Empty**: 0 seeded — `.archcore/` and `settings.json` only. Fast acknowledge + early exit. No catalog files read.
- **Small**: 2 seeded (`rule`, `guide`) + 3 hotspot proposals.
- **Medium**: 3 seeded (`rule`, `guide`, entry-point `doc`) + 5 hotspot proposals + ≤ 1 cross-cutting rule candidate.
- **Large**: 4 seeded (`rule`, `guide`, top-level-map `doc`, entry-point `doc`) + domain selection + 3-per-domain hotspot proposals.

All seeds idempotent. Agent-file import is opt-in and previewed. The empty route never creates placeholder documents — it keeps `.archcore/` functionally empty so the SessionStart nudge continues pointing the user back here.
