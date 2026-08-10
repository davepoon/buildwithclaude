---
name: red-handed-audit
description: "Check whether the tests the agent said passed actually ran. Reads the Claude Code session transcript and git state locally, then reports each gap with a timestamp and the quoted line. No model calls, nothing leaves the machine."
category: development-code
---

# Red-handed Audit

Audit the current session's claims against its own record. If the agent said the tests pass, this checks that a test run actually happened, that it did not fail, and that no expected value was quietly rewritten to match a bug.

## When to Use This Skill

- The agent reported passing tests and you want to confirm a run actually happened
- A test suite got smaller and you want to know when and why
- You are reviewing a finished session before trusting its summary

## What This Skill Does

1. Runs `npx --yes @jinhyuk9714/red-handed@latest audit` in the project directory
2. The CLI reads the local Claude Code transcript and the git working tree
3. Nine deterministic checks compare what was said with what was done
4. Each finding comes with a timestamp and the quoted line it came from

No model is called. The same session gives the same verdict every time.

## How to Use

### Basic Usage

```
Audit this session. Did the tests I was told about actually run?
```

The skill runs:

```bash
npx --yes @jinhyuk9714/red-handed@latest audit
```

Useful variations:

```bash
npx --yes @jinhyuk9714/red-handed@latest audit --all      # every session for this project
npx --yes @jinhyuk9714/red-handed@latest stats            # counts across the whole machine
npx --yes @jinhyuk9714/red-handed@latest audit --lang ko  # report in Korean
```

## Example

**User**: "Before I merge this, check whether the tests really ran."

**Output**:
```
CAUGHT  claim-vs-fail
  14:02:31  "All 33 tests pass."
  14:01:58  npx vitest run … exit 1, 2 failed
  The last run before the claim failed. Nothing ran after it.
```

A clean session prints nothing to accuse. That is the common case.

## Tips

- `CAUGHT` needs two things at once: the session shows it happening and the code still shows it now
- `SUSPICIOUS` means the pattern is there but the motive is not established
- Verification the tool cannot read counts as verification it did not see, so browser tests and custom scripts only ever reach `SUSPICIOUS`
- Exit code 1 means findings at the CAUGHT tier. That is the tool working, not an error
