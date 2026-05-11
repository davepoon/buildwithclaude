---
name: review
argument-hint: "[--deep] [category or tag]"
description: "Review documentation health. Default: compact dashboard (counts, status breakdown, relations, orphans). With --deep: full audit with coverage gaps, staleness, relation health, and prioritized recommendations. Activate when user asks 'show status', 'how many docs', 'dashboard', 'review the docs', 'audit the knowledge base', 'documentation gaps'. For code-drift detection use /archcore:actualize."
---

# /archcore:review

Review Archcore documentation health. Default mode is a compact dashboard; `--deep` runs a full audit with prioritized recommendations.

## When to use

- "Show status" / "How many docs do we have?" / "Dashboard" → default short mode
- "Review the docs" / "Audit the knowledge base" / "Documentation gaps?" → `--deep`

**Not review:**
- Creating new documentation → `/archcore:capture`, `/archcore:plan`, `/archcore:decide`
- Reading applicable rules/ADRs/specs before coding → `/archcore:context`
- Picking up where work left off → `/archcore:context`
- Stale docs after code drift → `/archcore:actualize`

## Routing table

| Signal | Mode | Scope |
|---|---|---|
| No arguments | → short dashboard | All documents |
| `--deep` | → full audit | All documents |
| `--deep <category\|tag\|type>` | → full audit, filtered | Filter applied |
| `<category\|tag\|type>` (no `--deep`) | → full audit, filtered | Same as `--deep <filter>` |

The dashboard is project-wide by design — it doesn't take filters. Any non-flag argument implies the user wants more than counts, so route to deep mode.

## Execution

### Step 1: Gather data

Call `mcp__archcore__list_documents` and `mcp__archcore__list_relations`. If a filter argument is present, apply it in-memory to the document list before analysis.

### Step 2 (short mode — default): Present dashboard

Output the four tables, then a one-line issues summary. Data only, no analysis.

**Documents by Category**

| Category | Count |
|---|---|
| Vision | _n_ |
| Knowledge | _n_ |
| Experience | _n_ |
| **Total** | _n_ |

**Documents by Status**

| Status | Count |
|---|---|
| draft | _n_ |
| accepted | _n_ |
| rejected | _n_ |

**Documents by Type** — list each type with count, skip types with 0.

**Relations**

| Type | Count |
|---|---|
| related | _n_ |
| implements | _n_ |
| extends | _n_ |
| depends_on | _n_ |

**Issues** — orphaned documents (no relations), high draft count. One line each, no explanations.

End with: _For a full audit with recommendations, run `/archcore:review --deep`._

### Step 2 (deep mode — `--deep` or any non-flag arg): Analyze and report

Check for:

**Coverage gaps:**
- ADRs without rules/guides (decisions not codified)
- PRDs without plans (requirements without implementation path)
- Rules without guides (standards without instructions)
- Empty categories or types with zero documents

**Staleness:**
- Documents stuck in `draft` that may need `accepted` or `rejected`
- Documents with stale content indicators

**Relation health:**
- Orphaned documents (no incoming or outgoing relations)
- Plans without `implements` to a PRD
- Specs without `implements` to requirements
- Broken chains (ISO cascade with gaps)

**Tag hygiene:**
- Tags used only once (potential inconsistency)
- Related documents with different tags

Report with these sections:

1. **Overview** — totals by category and status
2. **Gaps** — missing documents or relations with specific recommendations
3. **Staleness** — documents needing attention
4. **Orphans** — documents with no relations
5. **Actions** — prioritized list of fixes, most impactful first

## Result

Short mode: compact dashboard, data only. Deep mode: actionable report with prioritized fixes — findings and recommendations only, no verbose analysis.
