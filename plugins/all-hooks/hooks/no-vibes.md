---
name: no-vibes
description: Block positive Stop closeouts ("done"/"ready"/"shipped") that lack same-turn verification evidence — empirically F1 0.815 against MAST mode 3.3
category: security
event: Stop
matcher: "*"
language: bash
version: 1.0.0
---

# no-vibes

Block Stop closeouts that announce completion without same-turn verification evidence — phrases like "all set", "shipped", "ready", "passed" — when the closing message contains no proximate command output, file count, test result, or measurable evidence the work succeeded.

Empirically measured at **F1 0.815** (95% bootstrap CI [0.615, 0.941], n=19 human-labelled traces) against **MAST mode 3.3 — "No or Incorrect Verification"** from Cemri et al., NeurIPS 2025 ([arXiv:2503.13657](https://arxiv.org/abs/2503.13657)). Inter-annotator Fleiss κ = **1.000** on mode 3.3 specifically (perfect agreement). Implementation-independent: the standalone bash hook and the Rust `agentcloseout-physics` engine produce identical predictions on every trace (zero per-trace disagreement on n=19), so the verdict lives in the rule grammar, not in the engine.

Maps to the "recognition-without-arrest" constellation — a structural failure mode the operator-side Claude Code community has been triangulating since 2026-05 (anchor: [@suwayama in `anthropics/claude-code#60226`](https://github.com/anthropics/claude-code/issues/60226); synthesis: [yurukusa's gist](https://gist.github.com/yurukusa/93123855318c022f21df92a7ac33c87b); clean-state baseline: [@beq00000's seven-instances comment](https://github.com/anthropics/claude-code/issues/60226#issuecomment-4491987732)). This hook is the deterministic-runtime implementation of the Stage 3 (non-gating) gate the three-stage decomposition names.

## Event Configuration

- **Event Type**: `Stop`
- **Tool Matcher**: `*`
- **Category**: `security`

## Detected pattern

Closing-message text contains a positive-closeout verb (set / done / complete / shipped / ready / passes / passed / finished / implemented / fixed) AND no proximate evidence token (backticked command, exit-code reference, file count, test-result phrase, byte/line count, "verified by" / "round-trip" / "matched").

Negation guards prevent false positives on "not done" / "not ready" / "incomplete". The repair-guidance string the hook prints to stderr — `Status: partial / Verification: not run because <reason> / Commands run: <exact>` — is itself a teaching artifact: a model that has its closeout blocked sees the compliant shape it should have produced.

## Environment Variables

- `NO_VIBES_VERBOSE` — set to `1` to print the matched positive-verb and the missing-evidence reason to stderr on block (useful when iterating on the rule grammar or building a fixture corpus).
- `NO_VIBES_DISABLE` — set to `1` to disable the gate entirely (advisory mode). Defaults to off.

## Requirements

- `jq` (parses the Stop hook payload)

### Script

```bash
#!/bin/bash
# no-vibes — block positive Stop closeouts without same-turn evidence.
# Canonical 529-line hardened version: https://github.com/waitdeadai/no-vibes
# This file is the minimal reference implementation; the canonical adds
# evidence-proximity windowing, negation-clause bypass closures, a 337-fixture
# stress suite, and locale-pack loadable vocabulary.

set -euo pipefail

[ "${NO_VIBES_DISABLE:-0}" = "1" ] && exit 0

MSG="$(cat | jq -r '.closing_message // .transcript // empty' 2>/dev/null)"
[ -z "$MSG" ] && exit 0

# Positive closeout vocabulary
POSITIVE_RE='\b(all set|done|completed?|implemented|fixed|finished|ready|passes|passed|shipped|works|good to go)\b'

# Evidence tokens that defuse a positive closeout
EVIDENCE_RE='`[^`]+`|exit (code )?[0-9]+|[0-9]+ files? (added|changed|modified|created)|tests? pass|all [0-9]+ tests|verified by|matched|round-trip'

# Negation guards (don't block "not done" / "not ready" / "incomplete")
NEGATION_RE='\b(not |never |did not |hasn'\''t |haven'\''t |incomplete|unfinished)'

LOWER="$(printf '%s' "$MSG" | tr '[:upper:]' '[:lower:]')"

# Skip if the positive verb appears in a negation context
if printf '%s' "$LOWER" | grep -qiE "$NEGATION_RE.{0,30}$POSITIVE_RE"; then
    exit 0
fi

# Require a positive verb
if ! printf '%s' "$LOWER" | grep -qiE "$POSITIVE_RE"; then
    exit 0
fi

# Defuse if proximate evidence is present
if printf '%s' "$LOWER" | grep -qiE "$EVIDENCE_RE"; then
    exit 0
fi

# Block: positive closeout with no evidence
{
    echo "BLOCKED by no-vibes: positive closeout conflicts with missing verification."
    echo ""
    echo "Repair guidance:"
    echo "- Either run the missing verification and cite the exact command evidence"
    echo "  (e.g. \`pytest tests/\`, exit code, file count, test pass rate),"
    echo "- Or close as partial/blocked/runtime-pending with the explicit reason."
    echo ""
    echo "Use final shape:"
    echo "  Status: partial"
    echo "  Verification: not run because <reason>"
    echo "  Next step: <specific command or blocker>"
} >&2

if [ "${NO_VIBES_VERBOSE:-0}" = "1" ]; then
    echo "" >&2
    echo "DEBUG: matched positive-verb pattern; no evidence-proximity pattern matched." >&2
fi

exit 2
```

## Source attribution

This hook is the minimal reference implementation of `evidence_claims` / `no-vibes`, the strongest empirically-validated detector in [waitdeadai/llm-dark-patterns](https://github.com/waitdeadai/llm-dark-patterns) (Apache-2.0). The canonical 529-line hardened version — with evidence-proximity windowing, negation-clause bypass closures, locale-pack loadable vocabulary, and a 337-fixture stress suite — lives at [waitdeadai/no-vibes](https://github.com/waitdeadai/no-vibes). Also shipped as [`crewai-no-vibes`](https://github.com/waitdeadai/crewai-no-vibes) on PyPI (pure-Python CrewAI Task.guardrails-compatible package, zero runtime dependencies).

The fixture-driven iteration methodology used to harden this hook is documented at [`docs/methodology/fixture-driven-iteration.md`](https://github.com/waitdeadai/llm-dark-patterns/blob/main/docs/methodology/fixture-driven-iteration.md) — Apache-2.0 reusable pattern across deterministic Stop/SubagentStop and PreToolUse hook boundaries.
