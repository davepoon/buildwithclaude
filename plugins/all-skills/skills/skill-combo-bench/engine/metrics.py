"""V6.0 metrics with explicit denominators, missing-value rules, and units."""

from __future__ import annotations

import math
import statistics
from collections import defaultdict
from typing import Any, Iterable


EXCLUDED_TI = {"SAFE_REFUSAL", "NOT_APPLICABLE", "TOOL_FAILED_EXTERNALLY"}


def weighted_rule_compliance(assertions: Iterable[dict[str, Any]]) -> dict[str, Any]:
    """Compute RC_run; N/A assertions are excluded rather than treated as passes."""
    eligible = [item for item in assertions if item.get("status", item.get("result")) != "N/A" and not item.get("not_applicable", False)]
    denominator = sum(float(item.get("weight", 1.0)) for item in eligible)
    if denominator <= 0:
        return {"value": None, "status": "N/A", "eligible_count": 0, "failed_count": 0, "weight_denominator": 0.0}
    passed_weight = sum(float(item.get("weight", 1.0)) for item in eligible if item.get("status", item.get("result")) == "PASS")
    failed = sum(1 for item in eligible if item.get("status", item.get("result")) == "FAIL")
    return {"value": passed_weight / denominator, "status": "PASS", "eligible_count": len(eligible),
            "failed_count": failed, "weight_denominator": denominator}


def turn_weighted_rc(turns: Iterable[dict[str, Any]], alpha: dict[int, float] | None = None) -> dict[str, Any]:
    """Aggregate turn RC with predeclared weights; zero-weight turns are excluded."""
    alpha = alpha or {}
    values = []
    for index, turn in enumerate(turns, start=1):
        weight = float(alpha.get(turn.get("turn_index", index), turn.get("alpha", 1.0)))
        rc = turn.get("rc")
        if rc is not None and weight > 0:
            values.append((float(rc), weight))
    denominator = sum(weight for _, weight in values)
    return {"value": sum(rc * weight for rc, weight in values) / denominator if denominator else None,
            "weight_denominator": denominator, "eligible_turns": len(values)}


def rc_breakdown(assertions: Iterable[dict[str, Any]]) -> dict[str, Any]:
    """Report RC globally and by skill, probe family, and turn, with failure counts and denominators."""
    items = list(assertions)

    def summarise(group: list[dict[str, Any]]) -> dict[str, Any]:
        result = weighted_rule_compliance(group)
        return {"rc": result["value"], "failed": result["failed_count"], "eligible": result["eligible_count"],
                "weight_denominator": result["weight_denominator"], "status": result["status"]}

    buckets: dict[str, dict[str, list[dict[str, Any]]]] = {"skill": defaultdict(list),
                                                          "probe_family": defaultdict(list),
                                                          "turn": defaultdict(list)}
    for item in items:
        buckets["skill"][str(item.get("skill_id", "UNKNOWN"))].append(item)
        buckets["probe_family"][str(item.get("probe_family", "UNKNOWN"))].append(item)
        buckets["turn"][str(item.get("turn_index", "UNKNOWN"))].append(item)
    overall = weighted_rule_compliance(items)
    return {"global": {"rc": overall["value"], "failed": overall["failed_count"], "eligible": overall["eligible_count"],
                       "weight_denominator": overall["weight_denominator"], "status": overall["status"]},
            "by_skill": {key: summarise(value) for key, value in sorted(buckets["skill"].items())},
            "by_probe_family": {key: summarise(value) for key, value in sorted(buckets["probe_family"].items())},
            "by_turn": {key: summarise(value) for key, value in sorted(buckets["turn"].items(), key=lambda kv: kv[0])},
            "na_excluded": sum(1 for item in items if item.get("status") == "N/A")}


def skill_inactivation(probes: Iterable[dict[str, Any]]) -> dict[str, Any]:
    """Compute behavioral TI while excluding safe refusals and external tool failures."""
    eligible = [item for item in probes if item.get("failure_class") not in EXCLUDED_TI and item.get("status") != "N/A"]
    failed = [item for item in eligible if item.get("status") == "FAIL"]
    by_skill: dict[str, list[dict[str, Any]]] = defaultdict(list)
    for item in eligible:
        by_skill[item.get("skill_id", "UNKNOWN")].append(item)
    return {"value": len(failed) / len(eligible) if eligible else None, "failed_eligible_probes": len(failed),
            "total_eligible_probes": len(eligible),
            "by_skill": {skill: {"value": sum(p.get("status") == "FAIL" for p in items) / len(items), "total": len(items)}
                         for skill, items in by_skill.items()}}


def synergy(y_n: float, y_a: float, y_b: float, y_ab: float) -> float:
    """Return interaction on the supplied outcome scale: AB-A-B+N."""
    return y_ab - y_a - y_b + y_n


def paired_synergy(records: Iterable[dict[str, Any]], outcome: str = "task_success") -> dict[str, Any]:
    """Compute paired interactions using task/repeat pairs, never turns as samples."""
    groups: dict[tuple[Any, Any], dict[str, float]] = defaultdict(dict)
    for record in records:
        if record.get("condition_id") in {"N", "A", "B", "AB"} and record.get(outcome) is not None:
            groups[(record.get("task_id"), record.get("repeat_index", 0))][record["condition_id"]] = float(record[outcome])
    complete = [values for values in groups.values() if all(key in values for key in ("N", "A", "B", "AB"))]
    effects = [synergy(v["N"], v["A"], v["B"], v["AB"]) for v in complete]
    means = {condition: statistics.fmean(v[condition] for v in complete) if complete else None for condition in ("N", "A", "B", "AB")}
    return {"value": statistics.fmean(effects) if effects else None, "effects": effects, "n": len(effects),
            "statistical_unit": "TASK_REPEAT_PAIR", "condition_means": means,
            "scale_note": "Bounded outcomes may exhibit ceiling/floor effects; AB>A,B alone is not super-additivity."}


def context_efficiency(successful_task_score: float, token_usage: dict[str, Any], normalization: int = 1000) -> dict[str, Any]:
    """Compute score per normalized total tokens; zero tokens yields N/A."""
    if normalization <= 0:
        raise ValueError("normalization must be positive")
    total = int(token_usage.get("total", sum(int(token_usage.get(key, 0)) for key in ("input", "output", "cached", "tool"))))
    return {"value": successful_task_score / (total / normalization) if total > 0 else None,
            "status": "PASS" if total > 0 else "N/A", "total_tokens": total, "normalization": normalization,
            "token_usage": token_usage}


def cost_per_success(records: Iterable[dict[str, Any]], *, pricing_available: bool = True, pricing_source: str = "UNSPECIFIED") -> dict[str, Any]:
    """Compute observed CPS or explicitly report unknown/token-only cost."""
    values = list(records)
    successes = sum(bool(item.get("task_success")) for item in values)
    failed_cost = sum(float(item.get("cost", 0.0)) for item in values if not item.get("task_success"))
    if not pricing_available:
        return {"value": None, "status": "TOKEN_USAGE_ONLY" if any(item.get("token_usage") for item in values) else "COST_UNKNOWN",
                "successful_run_count": successes, "pricing_source": pricing_source}
    total = sum(float(item.get("cost", 0.0)) for item in values)
    return {"value": total / successes if successes else None, "status": "PASS" if successes else "N/A", "total_observed_cost": total,
            "successful_run_count": successes, "failed_run_cost": failed_cost, "pricing_source": pricing_source,
            "estimate_not_invoice": True}


def robustness_scores(records: Iterable[dict[str, Any]]) -> dict[str, Any]:
    """Keep strict recovery separate from graceful degradation and safe stops."""
    eligible = [item for item in records if item.get("fault_eligible", True)]
    counts = {label: 0 for label in ("RECOVERED", "GRACEFUL_DEGRADED", "SAFE_STOP", "FAILED", "LOOPED", "CRASHED", "TIMED_OUT")}
    for item in eligible:
        label = item.get("robustness_class", "FAILED")
        counts[label] = counts.get(label, 0) + 1
    n = len(eligible)
    return {"RS_strict": counts["RECOVERED"] / n if n else None,
            "RS_safe": (counts["RECOVERED"] + counts["GRACEFUL_DEGRADED"] + counts["SAFE_STOP"]) / n if n else None,
            "eligible_fault_runs": n, "counts": counts, "fault_weighting": "UNWEIGHTED; report by fault type before weighted aggregation"}


def mutation_score(records: Iterable[dict[str, Any]]) -> dict[str, Any]:
    """Compute detected-or-correctly-handled valid mutations over all valid mutations."""
    values = list(records)
    valid = [item for item in values if item.get("valid", item.get("is_valid", False))]
    killed = [item for item in valid if item.get("detected", item.get("killed", False))]
    by_operator: dict[str, list[dict[str, Any]]] = defaultdict(list)
    for item in valid:
        by_operator[item.get("operator_id", "UNKNOWN")].append(item)
    return {"value": len(killed) / len(valid) if valid else None, "valid_mutations": len(valid), "killed_mutations": len(killed),
            "surviving_mutations": len(valid) - len(killed), "invalid_mutations": len(values) - len(valid),
            "by_operator": {key: {"total": len(items), "killed": sum(bool(i.get("detected", i.get("killed", False))) for i in items)}
                            for key, items in by_operator.items()}}


def percentile(values: Iterable[float], quantile: float) -> float | None:
    """Return linearly interpolated percentile without external dependencies."""
    ordered = sorted(float(value) for value in values)
    if not ordered:
        return None
    if not 0 <= quantile <= 1:
        raise ValueError("quantile must be between 0 and 1")
    position = (len(ordered) - 1) * quantile
    lower, upper = math.floor(position), math.ceil(position)
    return ordered[lower] + (ordered[upper] - ordered[lower]) * (position - lower)


def engineering_metrics(records: Iterable[dict[str, Any]]) -> dict[str, Any]:
    """Report run-level engineering metrics without hiding denominators."""
    values = list(records)
    n = len(values)
    tool_calls = [call for item in values for call in item.get("tool_calls", [])]
    latencies = [float(item["latency_ms"]) for item in values if item.get("latency_ms") is not None]
    return {"n_runs": n, "task_success_rate": sum(bool(i.get("task_success")) for i in values) / n if n else None,
            "schema_validity": sum(i.get("schema_valid") is True for i in values) / n if n else None,
            "tool_call_success_rate": sum(c.get("status") == "PASS" for c in tool_calls) / len(tool_calls) if tool_calls else None,
            "tool_argument_validity": sum(c.get("error_type") != "INVALID_TOOL_ARGUMENT" for c in tool_calls) / len(tool_calls) if tool_calls else None,
            "recovery_rate": sum(i.get("robustness_class") == "RECOVERED" for i in values) / n if n else None,
            "loop_rate": sum(i.get("status") == "LOOPED" for i in values) / n if n else None,
            "timeout_rate": sum(i.get("status") == "TIMED_OUT" for i in values) / n if n else None,
            "latency_median_ms": percentile(latencies, 0.5), "latency_p95_ms": percentile(latencies, 0.95)}


# FILE END: engine/metrics.py
