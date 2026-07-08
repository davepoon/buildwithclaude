---
name: onboard
description: Set up CIAgent regression testing for the AI agent in this repo — write a runner, record golden baselines, generate a test spec, and verify it. Use when the user asks to add tests, evals, or regression testing for their AI agent, or to set up CIAgent.
allowed-tools: Bash(ciagent *), Bash(pip install *), Bash(python -c *), Read, Grep, Glob, Write, Edit
---

# Onboard CIAgent into this repo

You are setting up CIAgent (`pip install ciagent`) so this repo's AI agent has
recorded golden baselines and a runnable regression suite. The end state: the
user can run `ciagent test --runs 3` and see a stability report for their agent.

Work through the steps in order. Do not skip the cost gate in step 4.

## 1. Find the agent and install CIAgent

- Locate the agent: search for LLM SDK usage (`openai`, `anthropic`, `langgraph`,
  `langchain`) and for the function or endpoint that takes a user message and
  returns the agent's answer.
- Install with the matching extra so trace capture hooks the SDK:
  `pip install "ciagent[openai]"`, `[anthropic]`, `[langgraph]`, or `[all]`.
- Sanity check: `ciagent --version` then `ciagent doctor` (it reports what is
  missing; a missing spec is expected at this point).

## 2. Write the runner

Create `agentci_runner.py` at the repo root (or inside the package if the repo
has one clear package):

```python
def run_for_agentci(query: str) -> str:
    """CIAgent entry point: one query in, final answer text out."""
    # import the user's agent and invoke it ONCE, no chat history
    ...
    return final_answer_text
```

Rules:
- Return the final answer **string**. CIAgent wraps the call in its own trace
  capture, so LLM calls and tool calls are recorded automatically — do not
  build Trace objects unless the repo already produces them.
- Fresh context per call: no shared history between queries.
- Reuse the repo's own config/env loading so the runner works from the repo root.
- Verify it imports and answers before going further:
  `python -c "from agentci_runner import run_for_agentci; print(run_for_agentci('hello'))"`.

## 3. Choose queries

Write `agentci_queries.txt`, one query per line — 8 to 15 queries:

- Cover the agent's main jobs (mine the README, docs, knowledge base, prompts,
  and existing tests for what it is supposed to handle).
- Include at least 2 out-of-scope queries the agent should refuse or deflect.
- Prefer queries whose correct answers contain **hard facts** (prices, dates,
  limits, names) — those become deterministic checks in step 6.

## 4. Cost gate — ask before running live

Recording baselines runs the real agent once per query, on the user's API keys.
State the query count and a cost ballpark, and **ask the user to confirm**
before step 5. If there are no API keys or the user declines: write
`agentci_spec.yaml` by hand instead (same queries, `runner:` set), validate with
`ciagent test --mock`, and tell the user which step to resume later.

## 5. Record golden baselines

```bash
ciagent bootstrap --runner agentci_runner:run_for_agentci \
  --queries agentci_queries.txt --agent <agent-name> --yes
```

This runs every query, saves each trace as a golden baseline under
`./baselines/<agent-name>/`, and writes `agentci_spec.yaml` with path and cost
budgets derived from the recorded traces. Read the printed answers as they
stream by — if an answer is visibly wrong, that query should not be golden:
fix the agent or the query, delete that baseline file, and rerun.

## 6. Add correctness checks

The generated spec has path and cost budgets but no correctness checks. Add a
`correctness:` block per query, derived from the recorded baseline answers and
the repo's docs/KB — never from what you wish the agent said:

```yaml
correctness:
  expected_in_answer: ["30 days"]          # hard facts, AND
  any_expected_in_answer: ["$9.95", "9.95"] # phrasing variants, OR
  not_in_answer: ["I don't know"]           # forbidden content
```

Check facts, not phrasing. If the repo has a knowledge-base directory, run
`ciagent generate-checks --kb <dir> --dry-run` and review its candidates —
every surviving candidate was already validated against the recorded goldens.

## 7. Verify

```bash
ciagent test --mock                      # structure check, zero API calls
ciagent test --yes --format json         # live run (covered by step 4 approval)
ciagent test --runs 3 --yes              # stability report
```

Exit codes: 0 = pass (flaky-but-passing is 0), 1 = correctness failure in every
run, 2 = infra/config error. In the stability report, flips labeled
`agent-variance` mean the agent's answer changed (an agent problem); flips
labeled `judge-flake` mean the eval itself is unstable (a check/judge problem).

If a check fails, fix the agent or fix a factually wrong check. Do not loosen a
correct check to make the run green — report the failure to the user instead.

## 8. Wire CI and hand off

- `ciagent init` scaffolds a GitHub Actions workflow (add `--hook` for a
  pre-push hook if the user wants it).
- Commit: runner, `agentci_queries.txt`, `agentci_spec.yaml`, `baselines/`,
  and the workflow.
- Tell the user: how many goldens were recorded, the suite score, anything
  flaky (with its flip source), and that `ciagent test --runs 3` is the
  command to watch after future agent changes.
