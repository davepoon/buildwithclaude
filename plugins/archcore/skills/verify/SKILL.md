---
name: verify
description: Run plugin integrity checks — validates configs, scripts, skills, hooks, agents, and runs test suite.
disable-model-invocation: true
---

# /archcore:verify

Comprehensive plugin integrity verification. Run after structural changes to the plugin.

## When to use

- After modifying bin/ scripts, hooks, skills, agents, rules, or JSON configs
- Before creating a pull request
- After merging upstream changes
- When something seems broken

## Execution

### Step 1: Run automated test suite

Run the test suite using Bash:

```
make test
```

If bats-core is not installed, install it first: `brew install bats-core` (macOS) or `apt install bats` (Linux).

Report: total tests, passed, failed. If any fail, list the failed test names and investigate.

### Step 2: Run ShellCheck (if available)

```
make lint
```

If shellcheck is not installed, skip this step and note it.

### Step 3: JSON config quick-check

```
make check-json
```

### Step 4: Manual cross-reference verification

Only if tests pass. Check these items that automated tests may not fully cover:

1. **README accuracy**: Verify the skill count, agent count, and hook count in README.md match reality:
   - Count skills: `ls -d skills/*/SKILL.md | wc -l`
   - Count agents: `ls agents/*.md | wc -l`
   - Compare with numbers stated in README.md

2. **Archcore docs consistency**: If `.archcore/` documents describe plugin components (component-registry.doc.md, plugin-architecture.spec.md), spot-check that they reflect current state.

3. **MCP server availability**: Run `mcp__archcore__list_documents()` to verify MCP tools are functional. If it errors, report the error.

### Step 5: Live hook smoke test (optional)

If the user wants a deeper check:

1. Try writing to a `.archcore/*.md` file using the Write tool — it should be **blocked** by the PreToolUse hook.
2. Create a test document using `mcp__archcore__create_document` — the PostToolUse hook should validate afterward.

## Output Format

Present results as:

```
## Plugin Verification Report

| Phase | Status | Details |
|-------|--------|---------|
| Test suite (N tests) | PASS/FAIL | X passed, Y failed |
| ShellCheck | PASS/SKIP | clean or N warnings |
| JSON configs | PASS/FAIL | all valid or which failed |
| Cross-references | PASS/WARN | any mismatches found |
| MCP tools | PASS/FAIL | functional or error |

**Result: X/Y phases passed.**
```

If any phase fails, list specific issues as action items.
