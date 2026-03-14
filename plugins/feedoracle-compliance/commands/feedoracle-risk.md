---
description: Compare stablecoin risk across multiple tokens
category: business-finance
argument-hint: <SYMBOL1> <SYMBOL2> [SYMBOL3...]
---

Compare the compliance and risk profile of the stablecoins provided by the user.

Steps:
1. For each symbol, call compliance_preflight to get PASS/WARN/BLOCK
2. For each symbol, call peg_deviation to get current peg status
3. For each symbol, call evidence_profile to get evidence grade A-F

Present results as a comparison table:

## Stablecoin Risk Comparison

| Token | Preflight | Peg Dev | Evidence Grade | Verdict |
|-------|-----------|---------|----------------|---------|
| USDC  | PASS      | 0.01%   | A              | LOW RISK |
| EURC  | PASS      | 0.12%   | B+             | LOW RISK |
| USDT  | WARN      | 0.03%   | C              | MEDIUM RISK |

Evidence: All responses ES256K-signed, verifiable via JWKS.

After the table, provide a brief summary noting key differences and any risk flags.
If the user provides only one symbol, suggest comparing it against USDC and EURC as benchmarks.
