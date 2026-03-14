---
name: feedoracle-compliance
category: business-finance
description: MiCA compliance evidence and stablecoin risk scoring. Use when the user asks about stablecoin compliance, MiCA status, peg stability, or needs verifiable evidence for audit workflows.
---

# FeedOracle Compliance Intelligence

You have access to FeedOracle's 27 MCP tools for compliance evidence in regulated tokenized markets. Every response is ES256K-signed and JWKS-verifiable.

## Tool Selection Guide

**MiCA compliance:** mica_status for single token, mica_full_pack for full evidence, mica_market_overview for market-wide

**Stablecoin risk:** peg_deviation for current peg, peg_history for 30-day trend, compliance_preflight for PASS/WARN/BLOCK

**Reserve and custody:** reserve_quality for composition, custody_risk for custodian analysis

**Audit trail:** audit_verify to check chain integrity, audit_query to list decisions, audit_log to log (user-initiated only)

**Natural language:** ai_query routes to the right evidence API automatically

## Response Guidelines

1. Always cite the request_id and status from tool responses
2. Reference ES256K signature and JWKS URL for verifiability
3. Present data factually - let the user draw conclusions
4. For write tools (audit_log, kya_register): only invoke on explicit user request
