"""Judge calibration metrics for continuous, ordinal, and categorical labels."""

from __future__ import annotations

import argparse
import json
import math
import random
import statistics
from pathlib import Path
from typing import Any

from tools.stats_analysis import bootstrap_mean_ci


def _ranks(values: list[float]) -> list[float]:
    """Assign average ranks to ties."""
    order = sorted(range(len(values)), key=lambda index: values[index])
    ranks = [0.0] * len(values)
    index = 0
    while index < len(values):
        end = index + 1
        while end < len(values) and values[order[end]] == values[order[index]]:
            end += 1
        rank = (index + end - 1) / 2 + 1
        for position in range(index, end):
            ranks[order[position]] = rank
        index = end
    return ranks


def pearson(a: list[float], b: list[float]) -> float | None:
    """Return linear correlation, distinct from absolute agreement."""
    if len(a) != len(b) or len(a) < 2:
        return None
    mean_a, mean_b = statistics.fmean(a), statistics.fmean(b)
    numerator = sum((x - mean_a) * (y - mean_b) for x, y in zip(a, b))
    denominator = math.sqrt(sum((x - mean_a) ** 2 for x in a) * sum((y - mean_b) ** 2 for y in b))
    return numerator / denominator if denominator else None


def spearman(a: list[float], b: list[float]) -> float | None:
    """Return rank correlation with average ranks for ties."""
    return pearson(_ranks(a), _ranks(b))


def cohen_kappa(a: list[Any], b: list[Any], *, weighted: bool = False, labels: list[Any] | None = None) -> float | None:
    """Compute observed/chance agreement, optionally quadratically weighted."""
    if len(a) != len(b) or not a:
        return None
    labels = labels or sorted(set(a) | set(b), key=str)
    index = {label: position for position, label in enumerate(labels)}
    matrix = [[0 for _ in labels] for _ in labels]
    for left, right in zip(a, b):
        matrix[index[left]][index[right]] += 1
    n = len(a)
    weights = [[((i - j) / max(1, len(labels) - 1)) ** 2 if weighted else float(i != j) for j in range(len(labels))] for i in range(len(labels))]
    row = [sum(line) / n for line in matrix]
    column = [sum(matrix[i][j] for i in range(len(labels))) / n for j in range(len(labels))]
    observed = sum(weights[i][j] * matrix[i][j] / n for i in range(len(labels)) for j in range(len(labels)))
    expected = sum(weights[i][j] * row[i] * column[j] for i in range(len(labels)) for j in range(len(labels)))
    return 1 - observed / expected if expected != 1 and expected != 0 else 1.0 if observed == expected else None


def icc_agreement_single(a: list[float], b: list[float]) -> float | None:
    """Compute two-way random absolute-agreement single-measure ICC(A,1) for two raters."""
    if len(a) != len(b) or len(a) < 2:
        return None
    n, k = len(a), 2
    values = [a, b]
    grand = statistics.fmean(a + b)
    row_means = [(x + y) / k for x, y in zip(a, b)]
    column_means = [statistics.fmean(column) for column in values]
    ms_rows = k * sum((mean - grand) ** 2 for mean in row_means) / (n - 1)
    ms_columns = n * sum((mean - grand) ** 2 for mean in column_means) / (k - 1)
    residual = sum((values[r][i] - row_means[i] - column_means[r] + grand) ** 2 for r in range(k) for i in range(n)) / ((n - 1) * (k - 1))
    denominator = ms_rows + (k - 1) * residual + k * (ms_columns - residual) / n
    return (ms_rows - residual) / denominator if denominator else None


def _score(record: dict[str, Any], *keys: str) -> float | None:
    """Read the first present numeric score across accepted field aliases."""
    for key in keys:
        value = record.get(key)
        if isinstance(value, (int, float)) and not isinstance(value, bool):
            return float(value)
    return None


def calibrate(records: list[dict[str, Any]], *, mae_max: float = 1.0, agreement_min: float = 0.6,
              critical_error_max: float = 0.2, human_review_ratio: float = 0.1, seed: int = 42) -> dict[str, Any]:
    """Calculate complementary calibration metrics and configurable gates."""
    pairs = []
    for item in records:
        human = _score(item, "human_score", "human_total_score")
        judge = _score(item, "judge_score", "judge_total_score")
        if human is not None and judge is not None:
            pairs.append((human, judge))
    if not pairs:
        return {"status": "N/A", "reason": "No paired human/judge scores; run an LLM Judge over the golden set first",
                "n": 0, "records_with_human": sum(_score(item, "human_score", "human_total_score") is not None for item in records),
                "records_with_judge": sum(_score(item, "judge_score", "judge_total_score") is not None for item in records)}
    human = [pair[0] for pair in pairs]
    judge = [pair[1] for pair in pairs]
    errors = [j - h for h, j in pairs]
    absolute = [abs(error) for error in errors]
    mae = statistics.fmean(absolute)
    rmse = math.sqrt(statistics.fmean(error ** 2 for error in errors))
    categorical_a = [item.get("human_label") for item in records if item.get("human_label") is not None and item.get("judge_label") is not None]
    categorical_b = [item.get("judge_label") for item in records if item.get("human_label") is not None and item.get("judge_label") is not None]
    critical_errors = sum(abs(error) > mae_max for error in errors) / len(errors)
    gates = {"mae": mae <= mae_max, "agreement": (cohen_kappa(categorical_a, categorical_b) if categorical_a else icc_agreement_single(human, judge)) is not None,
             "critical_errors": critical_errors <= critical_error_max, "human_review_ratio": 0 <= human_review_ratio <= 1}
    agreement_value = cohen_kappa(categorical_a, categorical_b) if categorical_a else icc_agreement_single(human, judge)
    gates["agreement"] = agreement_value is not None and agreement_value >= agreement_min
    return {"status": "PASS" if all(gates.values()) else "JUDGE_NOT_CALIBRATED", "n": len(pairs), "statistical_unit": "ANNOTATED_SAMPLE",
            "MAE": mae, "RMSE": rmse, "bias": statistics.fmean(errors), "Pearson_r": pearson(human, judge), "Spearman_rho": spearman(human, judge),
            "ICC_A_1": icc_agreement_single(human, judge), "Cohens_kappa": cohen_kappa(categorical_a, categorical_b) if categorical_a else None,
            "MAE_bootstrap": bootstrap_mean_ci(absolute, seed=seed), "critical_error_rate": critical_errors,
            "thresholds": {"mae_max": mae_max, "agreement_min": agreement_min, "critical_error_max": critical_error_max,
                           "human_review_ratio": human_review_ratio}, "gates": gates,
            "limitations": "Small synthetic smoke sets cannot establish general judge reliability; locked holdout must not tune prompts."}


def bias_report(records: list[dict[str, Any]], *, length_threshold: float = 0.5) -> dict[str, Any]:
    """Measure length preference, position preference, and refusal misjudgement when data allows."""
    result: dict[str, Any] = {"method": "JUDGE_BIAS_SCREEN", "length_threshold": length_threshold}

    # Length preference: correlation between answer length and judge score.
    length_pairs = []
    for item in records:
        judge = _score(item, "judge_score", "judge_total_score")
        answer = item.get("answer", item.get("candidate_answer"))
        if judge is not None and isinstance(answer, str):
            length_pairs.append((float(len(answer)), judge))
    if len(length_pairs) >= 3:
        corr = spearman([p[0] for p in length_pairs], [p[1] for p in length_pairs])
        result["length_preference"] = {"n": len(length_pairs), "spearman_rho": corr,
                                       "flag": bool(corr is not None and abs(corr) >= length_threshold),
                                       "note": "High |rho| suggests length-driven scoring; review before trusting scores."}
    else:
        result["length_preference"] = {"status": "NOT_RUN", "reason": "Need >=3 rows with answer text and judge score"}

    # Position preference: compare judge scores when the same item appears as first vs second.
    by_pair: dict[str, dict[str, float]] = {}
    for item in records:
        pair_id = item.get("pair_id")
        position = item.get("position")
        judge = _score(item, "judge_score", "judge_total_score")
        if pair_id is None or position not in {"A", "B", "first", "second"} or judge is None:
            continue
        by_pair.setdefault(str(pair_id), {})[str(position)] = judge
    deltas = [value["A"] - value["B"] for value in by_pair.values() if "A" in value and "B" in value]
    if deltas:
        result["position_preference"] = {"n": len(deltas), "mean_first_minus_second": statistics.fmean(deltas),
                                         "flag": abs(statistics.fmean(deltas)) > 0,
                                         "note": "Randomize A/B order and record it; nonzero mean indicates position bias."}
    else:
        result["position_preference"] = {"status": "NOT_RUN", "reason": "Need paired rows with pair_id and position A/B"}

    # Refusal misjudgement: safe refusals must not be scored as failures.
    refused = [(item.get("is_refusal"), _score(item, "judge_score", "judge_total_score")) for item in records]
    refusals = [(bool(r), s) for r, s in refused if r is not None and s is not None and r]
    if refusals:
        result["refusal_misjudgement"] = {"n": len(refusals),
                                          "mean_judge_score_on_refusal": statistics.fmean(s for _, s in refusals),
                                          "flag": statistics.fmean(s for _, s in refusals) == 0,
                                          "note": "A zero mean on safe refusals indicates refusal is being penalized."}
    else:
        result["refusal_misjudgement"] = {"status": "NOT_RUN", "reason": "Need rows with is_refusal and judge score"}

    result["overall_flag"] = any(section.get("flag") for section in result.values() if isinstance(section, dict))
    return result


def main(argv: list[str] | None = None) -> int:
    """Run calibration on development or locked holdout JSONL."""
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--dataset", required=True)
    parser.add_argument("--mae-max", type=float, default=1.0)
    parser.add_argument("--agreement-min", type=float, default=0.6)
    parser.add_argument("--critical-error-max", type=float, default=0.2)
    parser.add_argument("--human-review-ratio", type=float, default=0.1)
    parser.add_argument("--seed", type=int, default=42)
    parser.add_argument("--bias", action="store_true", help="Also screen for judge bias")
    parser.add_argument("--output")
    args = parser.parse_args(argv)
    with Path(args.dataset).open("r", encoding="utf-8") as handle:
        records = [json.loads(line) for line in handle if line.strip()]
    result = calibrate(records, mae_max=args.mae_max, agreement_min=args.agreement_min,
                       critical_error_max=args.critical_error_max, human_review_ratio=args.human_review_ratio, seed=args.seed)
    if args.bias:
        result["bias_screen"] = bias_report(records)
    payload = json.dumps(result, ensure_ascii=False, indent=2)
    if args.output:
        Path(args.output).write_text(payload + "\n", encoding="utf-8")
    print(payload)
    # N/A means the command succeeded but the dataset lacks paired judge scores; that is a result, not a crash.
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

# FILE END: tools/judge_calibration.py
