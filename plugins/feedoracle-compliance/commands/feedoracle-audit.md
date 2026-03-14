---
description: Verify audit trail integrity or query decision history
category: business-finance
argument-hint: <verify|history> [client_id]
---

Manage the FeedOracle tamper-proof audit trail.

If the user says "verify" or "check integrity":
1. Call audit_verify with the provided client_id (or ask for it)
2. Report: valid/invalid, number of entries, chain head hash, break point (if any)

If the user says "history" or "show decisions":
1. Call audit_query with the provided client_id
2. Present decisions in a timeline format:

## Audit Trail - [client_id]
Chain integrity: Valid (N entries)

| # | Date | Asset | Decision | Reasoning |
|---|------|-------|----------|-----------|
| 1 | 2026-03-14 | USDC | PASS | MiCA verified, peg stable |
| 2 | 2026-03-14 | EURC | WARN | Peg deviation 0.67% |
| 3 | 2026-03-14 | USDT | BLOCK | Significant issuer threshold exceeded |

Chain hash: sha256:4b0552da...

If no client_id is provided, ask the user for it.
Note: To log new decisions, use audit_log - but only when the user explicitly requests it.
