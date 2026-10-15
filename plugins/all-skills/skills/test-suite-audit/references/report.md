# Reading the audit report

## Labels

| Label | Meaning |
|---|---|
| Measured | Observed directly in this run. |
| Inferred | Derived from measurements (for example coverage overlap). Needs review before acting. |
| Unverified | Based on one sample or incomplete evidence. |
| Not assessed | No evidence collected (mode, budget, or missing tooling). |

## Mutant statuses

| Status | Meaning |
|---|---|
| killed | A test that passed in every baseline run failed or errored with the mutant applied. |
| survived | The mutant compiled, its first line executed (activation check), and no covering test failed. |
| uncovered | No in-scope test covers the mutated lines; not executed. |
| not_activated | Tests ran but the mutated line never executed (mocks, alternative imports, subprocesses). Not a gap. |
| invalid | Does not compile, or tests cannot be collected/imported. Not a kill. |
| timeout | Ran longer than 10x the expected time plus 10 s. |
| infrastructure_failure | pytest crashed or returned an unexpected exit code. |
| activation_unknown | The activation monitor was unavailable. |

## Populations

- **classical**: mutmut's operators (comparisons, constants, arithmetic, arguments).
- **deletion**: whole-function body replaced with `return None` or a constant matching the
  return annotation (`body:<value>`), and single call statements replaced with `pass`
  (`call-delete`).

The two are reported separately and never combined into one score.

## Detection rate

`K / (K + S + U)`: killed over killed, survived and uncovered. Other statuses are excluded
from the ratio and counted beside it. The rate describes this sample of mutants only. It is
not a percentage of real bugs caught.

## Candidate pseudo-tested function

Every body replacement of the function ran, executed, and survived, under the tests that
cover it. One surviving replacement alone does not earn this label. A function whose body
replacements were all killed can still contain calls that nobody checks: see the
`removed-calls` finding.

## Findings you should not make from this report

- "Tests A and B are redundant" from overlap alone.
- "This mutant is equivalent" without human review.
- "The suite catches N% of bugs."
- Savings from summing test durations. Only paired wall-time runs show a speed-up.
