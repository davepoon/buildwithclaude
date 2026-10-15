---
name: test-suite-audit
category: testing-qa
description: Audit a Python/pytest test suite for behaviour no test would notice if it broke, order-dependent and intermittent tests, slow tests and misleading coverage, using mutation testing in a disposable copy. Use when the user asks to audit, review, speed up, prune or strengthen their test suite, or asks which tests are useful. Report-only.
---

# Test Suite Audit

Checks whether a pytest suite would actually catch faults. The `tsa` runner (from [agentic-verification](https://github.com/timini/agentic-verification)) copies the project, deletes function bodies and calls one at a time, runs mutmut's classical operators, repeats the suite in file and random order, and writes an evidence-backed report. Claude reads the report and explains it. Nothing in the user's checkout is edited.

## When to Use This Skill

- The user asks whether their tests are any good, or why bugs get past a suite with high coverage
- Before deleting or consolidating tests that look redundant
- Investigating slow or order-dependent tests
- Reviewing tests written by a coding agent

## What This Skill Does

1. **Baseline**: runs the suite three times in file order and, if pytest-randomly is installed, three times in random order; reports failing, varying and order-dependent tests.
2. **Coverage**: per-test line coverage, uncovered line numbers, and test pairs that run nearly the same lines (reported as something to investigate, never as redundancy).
3. **Deletion mutants**: replaces every function body with `None` or a type-appropriate constant and deletes every single call statement, then runs the covering tests. An activation check confirms the mutated line ran.
4. **Classical mutants**: a seeded sample of mutmut's operators fills the rest of the budget.
5. **Report**: findings labelled *measured*, *inferred*, *unverified* or *not assessed*, each with a replay command.

## How to Use

### Basic Usage

```
Audit the test suite in this repo
```

```
Which of these tests actually catch bugs? Use a 30 minute deep audit.
```

### Requirements

Python 3.12+ in the project's environment, with `pytest-cov` (and `pytest-randomly` for order checks), and `uv` on the machine.

### Steps Claude follows

1. Confirm it is a pytest project. If source or test discovery would be wrong, write a `test-suite-audit.toml` (keys: `python`, `source`, `tests`, `pytest_args`, `env`, `workers`) after asking.
2. State the budget: `quick` is 5 minutes (baseline, timings, coverage; no mutants); `deep` defaults to 30 minutes. Projects over about 3,500 executable lines need 30 minutes or more.
3. Run:
   ```bash
   uvx --from "git+https://github.com/timini/agentic-verification@v0.2.0#subdirectory=runner" tsa deep . --budget-minutes 30
   ```
   Use a Bash timeout above the budget. The last stdout line is JSON with the report paths.
4. Read `report.json` and `report.md` (see `references/report.md` for statuses and labels).
5. Summarise the top findings in report order with their labels and evidence, give one `tsa replay --run <dir> --mutant <id>` command, and list what was not assessed.

### Rules

- The runner measures; Claude interprets. Never state a number the report does not contain, and never upgrade a label.
- Report-only: do not edit, delete, skip or quarantine tests unless the user asks for a specific change after reading the report.
- Coverage overlap is never evidence that a test is redundant, and tests that are removable one at a time are not removable together. A surviving mutant is a candidate gap, not a proven bug; equivalence needs human review. `references/evidence.md` has the measurements behind these rules.

## Example

**User**: "Audit the tests in this repo"

**Output** (abridged from a real audit of marshmallow 4.3.1 with a 12-minute budget):
```
Deep audit complete (12 min budget). 1,186 tests passed in all 6 baseline runs; none varied.

1. 4 covered functions keep passing with their body removed (Measured):
   utils.is_generator, Context.__exit__, Validator._repr_args, Constant._validate_missing
2. 9 calls can be deleted with every test still green (Measured), e.g.
   schema.py:941 self.handle_error(...)
   Reproduce: tsa replay --run .test-suite-audit/<run> --mutant 5cfb44b6f32c59fd
3. 8,217 test pairs run nearly the same lines (Inferred): not evidence of redundancy.

Not assessed: equivalence of survivors; classical mutants outside the sample.
```

## Tips

- Run `deep` before deleting any test, and treat overlap findings as a reading list, not a deletion list.
- Surviving call deletions are usually unasserted side effects: logging, cache updates, events.
- Add `.test-suite-audit/` to `.gitignore`.
