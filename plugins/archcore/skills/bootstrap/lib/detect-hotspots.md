# Hotspot Ranking

Selects a small set of source modules most worth capturing as `spec` / `adr` / `rule` documents. Used in all three modes for the capture-candidate proposal.

## Score

For each source file (per `detect-modules.md` allowlist, after exclusions):

```
score = LOC + 0.7 * companion_test_LOC
```

Where `LOC` is the source file's line count and `companion_test_LOC` is the sum of LOC of its test partners (per `detect-modules.md` "Test-LOC companion lookup").

The 0.7 weight reflects the signal that heavily-tested code is important *and* its tests amplify its LOC, but the source file itself is the primary artifact — don't let a 2000-line test suite out-rank a 400-line critical module with 600 LOC of tests.

## Minimum thresholds

A file enters the candidate pool only if BOTH:

- `LOC > 100`, AND
- EITHER `companion_test_LOC > 50` OR `LOC > 200`.

Rationale: either the file is substantial enough on its own, or the team invested ≥ 50 LOC in testing it — that investment is a signal the contract matters.

## Top-N by mode

| Mode | N candidates |
|---|---|
| small | 3 |
| medium | 5 |
| large (per selected domain) | 3 |

If the candidate pool has fewer than N files, list all. If the pool is empty, skip the hotspot step entirely and surface in the closing message:

> No modules above the hotspot threshold detected. Run `/archcore:capture <path>` on demand when you identify a module worth documenting.

## Suggested doc type (heuristic)

Pick the most likely archcore type per candidate. This is a hint for the user; they can override.

| Heuristic | Suggestion |
|---|---|
| `test_ratio > 1.5` (i.e. tests outweigh source) | `spec` — heavily tested contract |
| File contains ≤ 5 exported public symbols, ≥ 100 LOC | `spec` — concentrated public surface |
| Filename contains `config`, `policy`, `strategy`, `options` | `adr` — decision surface |
| Filename contains `middleware`, `adapter`, `handler`, `wrapper`, and ≥ 3 siblings share the suffix | `task-type` — repeating extension pattern |
| Filename contains `utils`, `helpers`, `common` | (suppress — utility modules rarely warrant a spec) |
| Default | `spec` |

The `task-type` suggestion also flags a potential sibling pattern — when ≥ 3 siblings share the suffix, add a separate line to the closing message:

> Detected N sibling files matching `<pattern>`. Run `/archcore:standard` to codify the shape as a `task-type` doc for future additions.

## One-line rationale template per candidate

```
<relative-path> — <LOC> LOC source, <companion_test_LOC> LOC tests. Suggested: <doc-type>. <short reason>.
```

Where "short reason" is:

- For `spec` by test-ratio: `heavily tested (<ratio>:1)`.
- For `spec` by symbol count: `small public surface, substantial internals`.
- For `adr`: `filename suggests decision surface`.
- For `task-type`: `sibling pattern with <count> peers`.

## Presentation

Show candidates as a numbered list. At the end, a single hint:

> To capture any of these, run `/archcore:capture <path>` for modules, `/archcore:decide` for decisions, `/archcore:standard` for rules.

Do NOT auto-invoke those skills — let the user walk through on their own pace.

## Per-domain scoping (large mode)

When invoked from large mode's per-domain pass, the candidate pool is restricted to files under the selected domain's path. The top-N is 3 per domain. The rationale lines prefix the candidate path with the domain tag:

```
[domain:billing] apps/billing/src/invoice-calculator.ts — 312 LOC source, 540 LOC tests. Suggested: spec. heavily tested (1.7:1).
```

## Git-activity bonus (optional)

If `git` is available, add:

```
score += 0.3 * commits_last_90_days
```

Where `commits_last_90_days` is:

```
git log --since=90.days --oneline -- <file> | wc -l
```

This biases ranking toward files under active change, which tend to be where context gaps hurt most. Gracefully skip when `git` is unavailable or repo is shallow.

## Stability

Ranking is a ranked list, not a hard boundary — a file with score 260 ranked #4 is very similar to one at #3. When the candidate pool has many near-ties at the cutoff, the closing message can nudge:

> Other candidates just below the cutoff: <path-1>, <path-2>. Consider `/archcore:capture` on these if the top-N list feels incomplete.
