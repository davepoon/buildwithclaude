# Set-level review playbook

`SKILL.md` covers what makes one requirement good. This covers what makes a *set* of them
buildable. Every check here operates between requirements, or between the requirements
document and the safety artifacts beside it — which is exactly where a per-requirement
pass finds nothing and a design review finds everything.

Run these in order. Conflicts first: until the numbers agree there is nothing to adjudicate
downstream, and a coverage finding raised against a document that contradicts itself is
wasted effort.

---

## 1. Conflict sweep

**The defect.** The same physical quantity carries different values, or the same value at
different measurement points, in different places. Each statement looks correct on its own.
Two implementers build two different systems.

**Method.** Extract every quantitative claim in the document set into one table — one row
per statement, not per quantity — then sort by quantity and look for groups with more than
one distinct row.

| Quantity | Value | Unit | Measurement point | Source |
|---|---|---|---|---|
| Enclosure temperature limit | 85 | °C | Junction | `SYS-R-003` |
| Enclosure temperature limit | 85 | °C | Enclosure internal | `C-R-001` |
| Enclosure temperature limit | `max_operating_temp_C` | °C | Enclosure internal, per-asset | `A-001` |
| Ambient design limit | 50 | °C | Ambient | `SH-R-001` |

Four rows, one quantity, three measurement points, and a fixed constant competing with a
per-asset attribute. Junction, enclosure-internal, and ambient are separated by tens of
degrees, so at most one of these is right.

**Read the companion documents.** Most conflicts of this kind are invisible inside the
requirements file. They only appear when you open the anchor catalog, the hazard log, the
FMEA, or the ICD and compare. If a companion document is referenced, read it before
reporting; if it is referenced and missing, that is itself a finding.

**Resolving one.** Prefer the statement that is (a) physically measurable, (b) tied to a
certification basis, and (c) already implemented by a runtime mechanism. Where a fixed
constant competes with a per-asset attribute, the per-asset attribute almost always wins —
a constant is a copy of one asset's rating that escaped into the specification. Say which
one you adopted and why, in the rationale.

---

## 2. Window arithmetic

**The defect.** A rate or a percentage is stated against a window that makes it absurd,
usually because the figure was written for a different window and re-scoped without being
recomputed.

**Method.** For every percentage and every rate, multiply it out against its stated window
and read the result aloud.

> `Traffic signal uptime ≥ 99.95 % during declared dust event.`
>
> Dust event ≈ 3 h = 10,800 s. 0.05 % of 10,800 s = **5.4 s** of permitted downtime,
> including reboot, for the whole event.

That is not an availability target, it is an annual figure someone re-pointed at an event
window. The fix is usually to split it: keep the original number on the window it was
written for, and state the per-event obligation in terms the event can actually be measured
in — an outage-duration bound and an outage-count bound.

Same move applies to ingest rates (`100,000 endpoints at 1 Hz aggregate` — is that
100,000 msg/s or 1 msg/s?), retention periods, and anything phrased "per".

---

## 3. Budget closure

**The defect.** A parent requirement states an end-to-end number; the children allocate
pieces of it; nobody ever added them up.

**Method.** For each parent with a deadline or a budget, table the children and sum.

| Stage | Requirement | Allocation |
|---|---|---|
| Ingest to queryable | `SYS-R-001` | 5 s |
| Anomaly evaluation | `SYS-R-014` | 5 min 0 s |
| Alert composition and publication | `SYS-R-015` | 4 min 0 s |
| **Allocated** | | **9 min 5 s** |
| **Reserve** | | **55 s** |

Three things to check, and the third is the one that gets missed:

1. Does the sum fit under the parent? State the reserve explicitly — an unstated reserve is
   an unmanaged one.
2. Is every stage covered, or is there a gap the budget silently assumes is free?
3. **Does the parent's measurement window match what the budget measures?** A budget that
   closes from "the qualifying sample" may over-run from "the physical threshold crossing",
   because the sampling interval sits between them. If the parent does not say which, that
   ambiguity is a finding — and closing the budget on the favorable reading without
   flagging it is how a reviewer hides a schedule problem.

---

## 4. Coverage matrices

**The defect.** A hazard, anchor, or failure mode with no requirement. This is the finding
that gets people hurt, and it is structurally invisible from inside the requirements
document — nothing there points at what is missing.

**Method.** Enumerate from the safety artifacts, not from the requirements. Walk the anchor
catalog, the hazard log, and the FMEA, and for each entry find the requirement. Rows with
an empty cell are the report.

| Anchor | Severity | Stated by | Breach behavior | Covered |
|---|---|---|---|---|
| `A-001` Thermal envelope | Critical | `SR-THM-001` | `SR-THM-002` | yes |
| `A-006` Anti-islanding | Critical | — | — | **NO** |

Two columns, not one: *stated by* is the nominal obligation, *breach behavior* is what
happens when it is violated. A requirement that states a limit and never says what happens
when the limit is exceeded is half a requirement.

Check the counts, too. If the anchor catalog runs to `A-007` and the constraints table
stops at `C-R-005`, two anchors have no requirement and the truncation is the finding.

Run the same matrix the other way for orphans: a Critical constraint that traces upward to
no stakeholder need means either the need is missing or the constraint is unjustified.

---

## 5. Off-nominal coverage

**The defect.** Every requirement describes the happy path. The specification says nothing
about saturation, staleness, drift, disconnection, or component unavailability — all of
which the FMEA already enumerated.

**Method.** One row per FMEA failure mode. Each needs two requirements: how the system
*detects* it, and what it *does*. If the FMEA names a detection mechanism, that is a
requirement waiting to be written.

| Failure mode | Detection | Response |
|---|---|---|
| Sensor drift from dust | `SYS-R-022` | Mark `Suspect`, exclude from alerting |
| Comms loss | `SYS-R-021` | Mark `Stale`, exclude from anchor results |
| Ingest saturation | `SYS-R-009` | Shed in defined priority order |
| Reasoner unavailable | `SYS-R-023` | Critical anchors still evaluated |

A count of zero `If … then` requirements in a document that has a hazard log is always a
finding, no matter how good the nominal requirements are.

Two off-nominal cases are missed most often: **the safety monitor's own dependencies** (if
the analysis service is down, does anything still watch the Critical limits?), and **the
false-clear direction** on any sensor — a reading that wrongly says "safe" is more dangerous
than one that wrongly says "alarm", and usually only the second has a requirement.

---

## 6. One vocabulary

**The defect.** The same concept carries different enums in different sections, so nothing
can be sorted, filtered, or rolled up.

**Method.** Grep the enum columns. A document with `Must` / `Should` in one table, nothing
in the next, and `Critical` / `Error` / `Warning` in a third has three priority
vocabularies — and the third is a log-severity scale, which is not a priority at all.

Also check for prose that contradicts its own table: a section header calling constraints
"non-negotiable" over a table marking one of them `Warning` is a contradiction a reader has
to resolve by guessing.

---

## 7. Field completeness

**The defect.** Missing `rationale` on a handful of requirements out of dozens. Reading for
this by eye fails reliably — check it mechanically, including on documents you just wrote.

```python
import re
BLOCK = r'\n(?=### (?:SH-R|SYS-R|F-R|ICD|SR-[A-Z]+|SEC-R)-)'   # adapt to the doc's ID scheme
FIELDS = ['Type', 'Priority', 'Status', 'Verification', 'Rationale']

txt = open('requirements.md').read()
missing = {f: [] for f in FIELDS}
n = 0
for b in re.split(BLOCK, txt):
    m = re.match(r'### ([A-Z-]+-\d+)', b)
    if not m:
        continue
    n += 1
    body = b.split('\n### ')[0]
    for f in FIELDS:
        if f'**{f}**' not in body:
            missing[f].append(m.group(1))

print(f'{n} requirements')
for f, ids in missing.items():
    print(f'  missing {f}: {len(ids)} {ids or ""}')
```

Pair it with a referential-integrity pass: collect every ID that is *defined*, every ID that
is *referenced*, and diff. A `derived_from` pointing at an ID that no longer exists is a
broken trace that reads as a good one.

---

## 8. Trace plausibility

**The defect.** Traces that exist, satisfy a tooling check, and mean nothing — a child
whose stated parent does not motivate it.

**Method.** Read each pair as a sentence: *"We need `SYS-R-001` **because** `SH-R-005`."*

> "We need 100,000 msg/s ingest capacity **because** the city wants to stop duplicating
> asset registries."

No. Capacity has nothing to do with duplication. Traceability tools check that the link
resolves, never that it holds — so this one is always a human read.

Watch for a parent that is topically adjacent but causally wrong (a flood requirement traced
to a heat event), and for a child that claims to satisfy a parent's number without ever
showing the allocation closing. That second one is check 3.

---

## Reporting

Order findings by what stops the review first — conflicts, unverifiable, leakage, coverage,
document-wide — not by document order. Give each finding the requirement IDs it touches and
the concrete failure: *what would be built wrong*, not *which rule it breaks*.

Re-reviewing a repaired document produces a **disposition ledger**:

| Finding against v0.1 | Disposition | Now stated by |
|---|---|---|
| Thermal threshold stated three ways | Closed | `SR-THM-001`, `SYS-R-010/011` |
| Ingest rate ambiguous by 100,000× | **Closed on assumption** | `SYS-R-001`, `OPEN-01` |
| No `verified_by` link anywhere | **Carried forward** | `VER-012…084`, `OPEN-14` |

Three dispositions, and the last two matter more than the first:

- **Closed** — the finding no longer applies to the text.
- **Closed on assumption** — you supplied a value the owner never gave you. Name the owner
  and the date. Collect these in their own section; they are what the approver has to
  confirm before baselining, and burying them in a ledger row is how they get missed.
- **Carried forward** — structurally resolved, completion tracked as an open item.

A repaired document is `Proposed`, not baselined, until every assumption is confirmed and
every open item is closed. Say that plainly at the top of the report — a closure record that
reads like an approval is worse than no closure record.
