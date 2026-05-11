# ADR Content Contract

Plugin runtime asset. Loaded by skills creating ADRs (`decide`, `standard`,
`capture` in ADR mode). Companion to `skills/_shared/precision-rules.md`.

## Mandatory sections

1. **Context** — the trigger making this decision necessary.
   - MUST contain one concrete problem, measurement, or constraint. Generic
     framing ("we needed a better solution") is forbidden.
   - MUST contain at least one reference to existing code, config, metric, or
     external authority — OR an `[assumption]` marker if the decision is
     forward-looking and no codebase evidence exists yet.
   - 2–4 sentences. Bullet lists are forbidden in this section.

2. **Decision** — the chosen path.
   - MUST be one sentence containing the specific choice with version/name.
     Bare categorical statements ("we chose a relational database") are
     forbidden.
   - Required form: concrete instances ("Adopted PostgreSQL 16.2 on AWS RDS
     db.r7g.xlarge with Multi-AZ replication").

3. **Alternatives Considered** — what else was evaluated.
   - MUST list at least 2 alternatives.
   - Each alternative MUST have a name/version and an explicit rejection reason
     as a complete sentence using an active verb (`rejected because`,
     `ruled out because`, `deferred because`).
   - Bare lists ("MySQL was also considered.") are forbidden.

4. **Consequences** — what changes as a result.
   - MUST separate positive consequences (what this enables) from
     negative/tradeoff consequences (what this costs or constrains).
   - Each consequence MUST be falsifiable (with units and measurement context)
     OR marked `[expected]` if not yet measurable.

## Recommended section

5. **Superseded when** — strongly recommended. SHOULD list 2 or more specific
   conditions under which this ADR should be revisited or replaced.
   - Vague triggers ("revisit if requirements change") are forbidden.
   - Required form: measurable conditions ("revisit if daily transaction volume
     exceeds 50M (current max tested: 5M)").

## Forbidden sections

The body MUST NOT contain a section enumerating other `.archcore/` documents
(e.g., `## Related Documents`, `## References` listing ADRs/RFCs/rules,
`### Related Artifacts`). Cross-document links live in the relation graph,
managed by `mcp__archcore__add_relation`. The body MAY cite source code
(`@path/to/file`), commits, dashboards, and external authorities. See
`skills/_shared/precision-rules.md` Rule 5.

## Rationale

MADR 4.0 (September 2024) ships full and minimal templates; the plugin
standardizes on the full template by default. The mandatory four sections
(Context, Decision, Alternatives Considered, Consequences) follow the original
Nygard 2011 formulation, retained across MADR revisions and ThoughtWorks
Technology Radar (Adopt status since November 2017). Alternatives are treated
as mandatory rather than recommended (a stricter stance than MADR full) because
decisions without recorded alternatives lose the most reusable information —
why the chosen path was preferred. "Superseded when" is recommended rather than
mandatory because some genuinely terminal decisions (e.g., choice of license)
have no realistic supersession path.

## Examples

### Good

```markdown
## Context
Session-based auth in the gateway path was causing 3–5s latency spikes under
>200 concurrent users (Grafana dashboard #42, March 2024). Sessions lived
in-process memory, blocking horizontal scaling.

## Decision
Adopted JWT with ES256 signatures, validated at the API gateway (Kong v3.4)
with public-key rotation every 90 days.

## Alternatives Considered
1. Session-based auth + Redis backing — rejected because the gateway latency
   budget (~50ms p99) cannot absorb a Redis round-trip per request (measured
   18ms RTT).
2. OAuth2 opaque tokens with introspection — ruled out because the team has no
   identity-provider operational experience (assessed 2024-03-15).

## Consequences
- Reduces p99 auth latency from 4.2s to <80ms under load profile L2.
- Adds public-key rotation operational burden (90-day cadence, runbook
  required).
- [expected] Opens path to multi-region deployment (no shared session state).

## Superseded when
- Daily JWT issuance exceeds 100M (current: 8M).
- Team adopts a managed identity provider (e.g., AWS Cognito, Auth0).
```

### Bad

```markdown
## Context
We needed a robust, scalable auth solution.

## Decision
We chose JWT.

## Alternatives Considered
- Sessions
- OAuth

## Consequences
- Improves performance.
- Easier to scale.
```
