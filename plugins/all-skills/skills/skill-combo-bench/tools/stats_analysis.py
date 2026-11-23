"""Paired statistical analysis and predeclared group-sequential stopping rules."""

from __future__ import annotations

import argparse
import json
import math
import random
import statistics
from dataclasses import asdict, dataclass
from pathlib import Path
from typing import Any, Iterable


def _finite(value: float | None) -> float | None:
    """Convert non-finite statistics to None so reports never emit NaN/Infinity."""
    if value is None:
        return None
    return float(value) if math.isfinite(value) else None


def _sanitize(value: Any) -> Any:
    """Recursively replace non-finite floats with None for strict JSON output."""
    if isinstance(value, float):
        return value if math.isfinite(value) else None
    if isinstance(value, dict):
        return {key: _sanitize(item) for key, item in value.items()}
    if isinstance(value, (list, tuple)):
        return [_sanitize(item) for item in value]
    return value


def _describe(values: list[float]) -> dict[str, Any]:
    """Report run/pair-level distribution summaries."""
    if not values:
        return {"n": 0, "mean": None, "median": None, "standard_deviation": None, "iqr": None}
    ordered = sorted(values)
    q1 = ordered[len(ordered) // 4]
    q3 = ordered[(3 * len(ordered)) // 4]
    return {"n": len(values), "mean": statistics.fmean(values), "median": statistics.median(values),
            "standard_deviation": statistics.stdev(values) if len(values) > 1 else 0.0, "iqr": q3 - q1}


def paired_t_test(a: Iterable[float], b: Iterable[float], alpha: float = 0.05) -> dict[str, Any]:
    """Analyze matched pairs and expose normality/outlier limitations."""
    left, right = list(a), list(b)
    if len(left) != len(right) or len(left) < 2:
        return {"status": "N/A", "reason": "Equal-length paired arrays with n>=2 are required", "n": min(len(left), len(right))}
    differences = [x - y for x, y in zip(left, right)]
    sd = statistics.stdev(differences)
    if sd == 0:
        return {"status": "N/A", "method": "paired_t_test", "n": len(differences), "statistical_unit": "PAIR",
                "mean_difference": statistics.fmean(differences), "ci_95": [0.0, 0.0],
                "reason": "Zero variance in paired differences; t statistic is undefined",
                "assumptions": "Degenerate pairs (identical values); report as no observed variation, not as significance."}
    try:
        from scipy import stats
    except ImportError:
        return {"status": "BLOCKED", "reason": "scipy is required for t distribution", "n": len(left)}
    result = stats.ttest_rel(left, right)
    mean = statistics.fmean(differences)
    standard_error = sd / math.sqrt(len(differences))
    critical = stats.t.ppf(1 - alpha / 2, len(differences) - 1)
    return {"status": "PASS", "method": "paired_t_test", "n": len(differences), "statistical_unit": "PAIR",
            "mean_difference": mean, "ci_95": [mean - critical * standard_error, mean + critical * standard_error],
            "t_statistic": _finite(float(result.statistic)), "degrees_of_freedom": len(differences) - 1,
            "p_value": _finite(float(result.pvalue)), "cohens_dz": mean / sd if sd else None, "alpha": alpha,
            "assumptions": "Inspect paired-difference distribution and outlier sensitivity; do not use for unpaired data."}


def wilcoxon_signed_rank(a: Iterable[float], b: Iterable[float], alpha: float = 0.05, zero_method: str = "wilcox") -> dict[str, Any]:
    """Run a paired signed-rank test with explicit zero and symmetry handling."""
    left, right = list(a), list(b)
    if len(left) != len(right) or not left:
        return {"status": "N/A", "reason": "Equal-length non-empty pairs are required", "n": 0}
    differences = [x - y for x, y in zip(left, right)]
    if all(value == 0 for value in differences):
        return {"status": "N/A", "method": "wilcoxon_signed_rank", "n": len(left), "zero_method": zero_method,
                "reason": "All paired differences are zero; signed-rank test is undefined",
                "assumptions": "Report as no observed variation rather than a non-significant result."}
    try:
        from scipy import stats
    except ImportError:
        return {"status": "BLOCKED", "reason": "scipy is required for Wilcoxon test", "n": len(left)}
    try:
        result = stats.wilcoxon(differences, zero_method=zero_method, alternative="two-sided")
    except ValueError as exc:
        return {"status": "N/A", "reason": str(exc), "n": len(left), "zero_method": zero_method}
    nonzero = [value for value in differences if value != 0]
    effect = sum(value > 0 for value in nonzero) / len(nonzero) if nonzero else None
    return {"status": "PASS", "method": "wilcoxon_signed_rank", "n": len(left),
            "statistic": _finite(float(result.statistic)), "p_value": _finite(float(result.pvalue)),
            "rank_biserial_like_positive_fraction": effect, "zero_method": zero_method,
            "alpha": alpha, "ci_95": bootstrap_mean_ci(differences, seed=0)["ci_95"],
            "assumptions": "Pairs and approximate symmetry of differences require review; use permutation/bootstrap if unreasonable."}


def bootstrap_mean_ci(values: Iterable[float], *, resamples: int = 2000, seed: int = 42, confidence: float = 0.95) -> dict[str, Any]:
    """Bootstrap the supplied independent pair/run units with a fixed seed."""
    data = list(values)
    if not data:
        return {"status": "N/A", "ci_95": [None, None], "n": 0}
    rng = random.Random(seed)
    means = [statistics.fmean(data[rng.randrange(len(data))] for _ in data) for _ in range(resamples)]
    means.sort()
    tail = (1 - confidence) / 2
    low = means[min(len(means) - 1, int(tail * resamples))]
    high = means[min(len(means) - 1, int((1 - tail) * resamples))]
    return {"status": "PASS", "n": len(data), "mean": statistics.fmean(data), "ci_95": [low, high], "resamples": resamples,
            "seed": seed, "resampling_unit": "SUPPLIED_PAIR_OR_RUN", "ci_method": "PERCENTILE"}


def paired_permutation_test(a: Iterable[float], b: Iterable[float], *, permutations: int = 5000, seed: int = 42) -> dict[str, Any]:
    """Swap paired labels under exchangeability and compute a two-sided p-value."""
    left, right = list(a), list(b)
    if len(left) != len(right) or not left:
        return {"status": "N/A", "reason": "Equal-length non-empty pairs required", "n": 0}
    differences = [x - y for x, y in zip(left, right)]
    observed = abs(statistics.fmean(differences))
    rng = random.Random(seed)
    exceed = 0
    for _ in range(permutations):
        estimate = abs(statistics.fmean(value if rng.random() < 0.5 else -value for value in differences))
        exceed += estimate >= observed - 1e-15
    return {"status": "PASS", "method": "paired_sign_permutation", "n": len(differences),
            "mean_difference": statistics.fmean(differences), "p_value": (exceed + 1) / (permutations + 1),
            "permutations": permutations, "seed": seed, "exchangeability": "Sign swaps must be exchangeable within each pair."}


def holm_correction(p_values: Iterable[float], alpha: float = 0.05) -> dict[str, Any]:
    """Control family-wise error for a predeclared family of comparisons."""
    values = list(p_values)
    order = sorted(range(len(values)), key=lambda index: values[index])
    adjusted = [0.0] * len(values)
    running = 0.0
    rejected: list[bool] = [False] * len(values)
    for rank, index in enumerate(order):
        candidate = (len(values) - rank) * values[index]
        running = max(running, candidate)
        adjusted[index] = min(1.0, running)
    for rank, index in enumerate(order):
        if values[index] <= alpha / (len(values) - rank):
            rejected[index] = True
        else:
            break
    return {"method": "HOLM", "alpha": alpha, "adjusted_p_values": adjusted, "rejected": rejected, "n_comparisons": len(values)}


@dataclass
class GroupSequentialDesign:
    """Bonferroni group-sequential normal boundaries with fixed looks."""

    max_sample_size: int
    batch_size: int
    min_sample_size: int
    alpha: float = 0.05
    primary_endpoint: str = "task_success"

    def __post_init__(self) -> None:
        if self.max_sample_size <= 0 or self.batch_size <= 0 or self.min_sample_size <= 0:
            raise ValueError("Sequential sample sizes must be positive")
        self.looks = list(range(self.min_sample_size, self.max_sample_size + 1, self.batch_size))
        if self.looks[-1] != self.max_sample_size:
            self.looks.append(self.max_sample_size)

    def evaluate(self, differences: Iterable[float]) -> dict[str, Any]:
        """Evaluate only at predeclared looks using a union-bound error guarantee."""
        values = list(differences)
        n = len(values)
        if n not in self.looks:
            return {"status": "WAIT", "n": n, "next_look": next((look for look in self.looks if look > n), None),
                    "stop": False, "primary_endpoint": self.primary_endpoint}
        try:
            from scipy.stats import norm
        except ImportError:
            return {"status": "BLOCKED", "reason": "scipy is required for normal boundaries", "n": n}
        boundary = float(norm.ppf(1 - self.alpha / (2 * len(self.looks))))
        mean = statistics.fmean(values)
        sd = statistics.stdev(values) if n > 1 else 0.0
        z_score = mean / (sd / math.sqrt(n)) if sd > 0 else (math.inf if mean > 0 else -math.inf if mean < 0 else 0.0)
        stop = abs(z_score) >= boundary or n == self.max_sample_size
        reason = "EFFICACY_OR_HARM_BOUNDARY" if abs(z_score) >= boundary else "MAX_SAMPLE_SIZE" if n == self.max_sample_size else "CONTINUE"
        return {"status": "PASS", "method": "BONFERRONI_GROUP_SEQUENTIAL_NORMAL", "n": n, "look_number": self.looks.index(n) + 1,
                "total_looks": len(self.looks), "z_score": z_score, "absolute_boundary": boundary, "stop": stop,
                "stop_reason": reason, "alpha": self.alpha, "primary_endpoint": self.primary_endpoint,
                "limitations": "Asymptotic normal paired differences; all looks and maximum N must be preregistered."}


def read_jsonl(path: str | Path) -> list[dict[str, Any]]:
    """Read a JSONL results file."""
    with Path(path).open("r", encoding="utf-8") as handle:
        return [json.loads(line) for line in handle if line.strip()]


def compare_conditions(records: list[dict[str, Any]], condition_a: str, condition_b: str, outcome: str) -> dict[str, Any]:
    """Pair records by task and repeat, excluding missing or non-comparable runs."""
    indexed = {(item.get("task_id"), item.get("repeat_index", 0), item.get("condition_id")): item for item in records}
    keys = {(item.get("task_id"), item.get("repeat_index", 0)) for item in records}
    a: list[float] = []
    b: list[float] = []
    excluded = 0
    for task, repeat in sorted(keys):
        left = indexed.get((task, repeat, condition_a))
        right = indexed.get((task, repeat, condition_b))
        if left is None or right is None or left.get(outcome) is None or right.get(outcome) is None:
            excluded += 1
            continue
        a.append(float(left[outcome]))
        b.append(float(right[outcome]))
    differences = [x - y for x, y in zip(a, b)]
    return {"comparison": f"{condition_a}-{condition_b}", "outcome": outcome, "description": _describe(differences),
            "paired_t": paired_t_test(a, b), "wilcoxon": wilcoxon_signed_rank(a, b),
            "bootstrap": bootstrap_mean_ci(differences), "permutation": paired_permutation_test(a, b),
            "excluded_pairs": excluded, "multiple_comparison": "Apply Holm across the predeclared family; no confirmatory claim from one run."}


def main(argv: list[str] | None = None) -> int:
    """CLI for paired analysis of benchmark results."""
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--input", required=True)
    parser.add_argument("--condition-a", default="AB")
    parser.add_argument("--condition-b", default="N")
    parser.add_argument("--outcome", default="task_success")
    parser.add_argument("--output")
    args = parser.parse_args(argv)
    result = compare_conditions(read_jsonl(args.input), args.condition_a, args.condition_b, args.outcome)
    payload = json.dumps(_sanitize(result), ensure_ascii=False, indent=2, allow_nan=False)
    if args.output:
        Path(args.output).write_text(payload + "\n", encoding="utf-8")
    print(payload)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

# FILE END: tools/stats_analysis.py
