#!/usr/bin/env python3
"""Compute deterministic regression and prediction-interval metrics from CSV."""
import argparse
import csv
import json
import math
from pathlib import Path


def finite_float(value, label, row_number):
    try:
        number = float(value)
    except (TypeError, ValueError) as exc:
        raise ValueError(f"Row {row_number}: invalid {label}: {value!r}") from exc
    if not math.isfinite(number):
        raise ValueError(f"Row {row_number}: non-finite {label}")
    return number


def summarize(rows):
    if not rows:
        raise ValueError("No complete observations")
    n = len(rows)
    errors = [r["predicted"] - r["actual"] for r in rows]
    abs_errors = [abs(e) for e in errors]
    mse = sum(e * e for e in errors) / n
    actuals = [r["actual"] for r in rows]
    mean_actual = sum(actuals) / n
    sst = sum((a - mean_actual) ** 2 for a in actuals)
    mape_rows = [r for r in rows if r["actual"] != 0]
    mape = None
    if mape_rows:
        mape = 100 * sum(abs((r["predicted"] - r["actual"]) / r["actual"]) for r in mape_rows) / len(mape_rows)
    smape_values = []
    for r in rows:
        denominator = abs(r["actual"]) + abs(r["predicted"])
        smape_values.append(0.0 if denominator == 0 else 200 * abs(r["predicted"] - r["actual"]) / denominator)
    result = {
        "n": n,
        "mae": sum(abs_errors) / n,
        "rmse": math.sqrt(mse),
        "mse": mse,
        "bias_predicted_minus_actual": sum(errors) / n,
        "mape_percent": mape,
        "mape_excluded_zero_actual": n - len(mape_rows),
        "smape_percent": sum(smape_values) / n,
        "r2": None if sst == 0 else 1 - sum(e * e for e in errors) / sst,
    }
    interval_rows = [r for r in rows if r["lower"] is not None and r["upper"] is not None]
    if interval_rows:
        covered = sum(r["lower"] <= r["actual"] <= r["upper"] for r in interval_rows)
        result["interval_n"] = len(interval_rows)
        result["interval_coverage"] = covered / len(interval_rows)
        result["interval_mean_width"] = sum(r["upper"] - r["lower"] for r in interval_rows) / len(interval_rows)
    return result


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("csv_file")
    parser.add_argument("--actual", required=True)
    parser.add_argument("--predicted", required=True)
    parser.add_argument("--lower")
    parser.add_argument("--upper")
    parser.add_argument("--group")
    parser.add_argument("--output")
    parser.add_argument("--json", action="store_true")
    args = parser.parse_args()
    if bool(args.lower) != bool(args.upper):
        parser.error("--lower and --upper must be provided together")

    try:
        with open(args.csv_file, "r", encoding="utf-8-sig", newline="") as handle:
            reader = csv.DictReader(handle)
            required = [args.actual, args.predicted]
            if args.lower:
                required += [args.lower, args.upper]
            if args.group:
                required.append(args.group)
            missing = [name for name in required if name not in (reader.fieldnames or [])]
            if missing:
                raise ValueError("Missing columns: " + ", ".join(missing))
            rows = []
            for row_number, raw in enumerate(reader, start=2):
                row = {
                    "actual": finite_float(raw[args.actual], args.actual, row_number),
                    "predicted": finite_float(raw[args.predicted], args.predicted, row_number),
                    "lower": finite_float(raw[args.lower], args.lower, row_number) if args.lower else None,
                    "upper": finite_float(raw[args.upper], args.upper, row_number) if args.upper else None,
                    "group": raw[args.group] if args.group else None,
                }
                if row["lower"] is not None and row["lower"] > row["upper"]:
                    raise ValueError(f"Row {row_number}: lower exceeds upper")
                rows.append(row)
        report = {"overall": summarize(rows), "groups": {}, "warnings": [
            "Metrics do not establish causal validity, absence of leakage, or model adequacy.",
            "Interpret interval coverage together with interval width and nominal coverage."
        ]}
        if args.group:
            for name in sorted({r["group"] for r in rows}):
                report["groups"][name] = summarize([r for r in rows if r["group"] == name])
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
