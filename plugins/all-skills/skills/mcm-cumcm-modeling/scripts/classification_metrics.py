#!/usr/bin/env python3
"""Compute binary-classification counts and metrics without third-party packages."""
import argparse
import csv
import json
import math
from pathlib import Path


def ratio(numerator, denominator):
    return None if denominator == 0 else numerator / denominator


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("csv_file")
    parser.add_argument("--actual", required=True)
    parser.add_argument("--predicted", required=True)
    parser.add_argument("--positive", required=True)
    parser.add_argument("--output")
    parser.add_argument("--json", action="store_true")
    args = parser.parse_args()
    try:
        counts = {"tp": 0, "fp": 0, "tn": 0, "fn": 0}
        with open(args.csv_file, "r", encoding="utf-8-sig", newline="") as handle:
            reader = csv.DictReader(handle)
            missing = [c for c in [args.actual, args.predicted] if c not in (reader.fieldnames or [])]
            if missing:
                raise ValueError("Missing columns: " + ", ".join(missing))
            for row_number, row in enumerate(reader, start=2):
                actual = str(row[args.actual]).strip()
                predicted = str(row[args.predicted]).strip()
                if actual != args.positive:
                    actual_negative = True
                else:
                    actual_negative = False
                if predicted != args.positive:
                    predicted_negative = True
                else:
                    predicted_negative = False
                if actual_negative and predicted_negative:
                    counts["tn"] += 1
                elif not actual_negative and not predicted_negative:
                    counts["tp"] += 1
                elif actual_negative:
                    counts["fp"] += 1
                else:
                    counts["fn"] += 1
        n = sum(counts.values())
        if n == 0:
            raise ValueError("No observations")
        tp, fp, tn, fn = counts["tp"], counts["fp"], counts["tn"], counts["fn"]
        precision = ratio(tp, tp + fp)
        recall = ratio(tp, tp + fn)
        specificity = ratio(tn, tn + fp)
        f1 = None if precision is None or recall is None or precision + recall == 0 else 2 * precision * recall / (precision + recall)
        mcc_denominator = math.sqrt((tp + fp) * (tp + fn) * (tn + fp) * (tn + fn))
        report = {
            "n": n,
            "positive_label": args.positive,
            "confusion_matrix": counts,
            "accuracy": (tp + tn) / n,
            "precision": precision,
            "recall_sensitivity": recall,
            "specificity": specificity,
            "f1": f1,
            "balanced_accuracy": None if recall is None or specificity is None else (recall + specificity) / 2,
            "mcc": None if mcc_denominator == 0 else (tp * tn - fp * fn) / mcc_denominator,
            "warnings": [
                "All labels other than the exact positive label are treated as negative; validate labels before use.",
                "Choose metrics and thresholds from error costs; this script does not assess calibration or leakage."
            ],
        }
        text = json.dumps(report, ensure_ascii=False, indent=2 if args.json or args.output else None)
        if args.output:
            output = Path(args.output)
            output.parent.mkdir(parents=True, exist_ok=True)
            output.write_text(text + "\n", encoding="utf-8")
        print(text)
        return 0
    except (OSError, ValueError) as exc:
        print(json.dumps({"error": str(exc)}, ensure_ascii=False))
        return 2


if __name__ == "__main__":
    raise SystemExit(main())
