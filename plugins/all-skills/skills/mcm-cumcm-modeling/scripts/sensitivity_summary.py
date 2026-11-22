#!/usr/bin/env python3
"""Summarize existing one-factor perturbation experiments from a CSV contract."""
import argparse
import csv
import json
import math
from collections import defaultdict
from pathlib import Path


def number(value, field, row_number):
    try:
        result = float(value)
    except (TypeError, ValueError) as exc:
        raise ValueError(f"Row {row_number}: invalid {field}") from exc
    if not math.isfinite(result):
        raise ValueError(f"Row {row_number}: non-finite {field}")
    return result


def relative_change(new, old):
    return None if old == 0 else (new - old) / abs(old)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("csv_file")
    parser.add_argument("--output")
    parser.add_argument("--json", action="store_true")
    args = parser.parse_args()
    required = ["question", "parameter", "baseline_input", "perturbed_input", "baseline_output", "perturbed_output"]
    try:
        records = []
        grouped = defaultdict(list)
        with open(args.csv_file, "r", encoding="utf-8-sig", newline="") as handle:
            reader = csv.DictReader(handle)
            missing = [c for c in required if c not in (reader.fieldnames or [])]
            if missing:
                raise ValueError("Missing columns: " + ", ".join(missing))
            for row_number, row in enumerate(reader, start=2):
                x0 = number(row["baseline_input"], "baseline_input", row_number)
                x1 = number(row["perturbed_input"], "perturbed_input", row_number)
                y0 = number(row["baseline_output"], "baseline_output", row_number)
                y1 = number(row["perturbed_output"], "perturbed_output", row_number)
                input_relative = relative_change(x1, x0)
                output_relative = relative_change(y1, y0)
                elasticity = None if input_relative in (None, 0) or output_relative is None else output_relative / input_relative
                baseline_decision = (row.get("baseline_decision") or "").strip()
                perturbed_decision = (row.get("perturbed_decision") or "").strip()
                reversed_decision = None if not baseline_decision or not perturbed_decision else baseline_decision != perturbed_decision
                record = {
                    "question": row["question"], "parameter": row["parameter"],
                    "input_absolute_change": x1 - x0, "input_relative_change": input_relative,
                    "output_absolute_change": y1 - y0, "output_relative_change": output_relative,
                    "local_elasticity": elasticity, "decision_reversed": reversed_decision,
                }
                records.append(record)
                grouped[(row["question"], row["parameter"])].append(record)
        if not records:
            raise ValueError("No observations")
        summary = []
        for (question, parameter), items in sorted(grouped.items()):
            elasticities = [abs(r["local_elasticity"]) for r in items if r["local_elasticity"] is not None]
            reversals = [r["decision_reversed"] for r in items if r["decision_reversed"] is not None]
            summary.append({
                "question": question, "parameter": parameter, "n": len(items),
                "max_absolute_local_elasticity": max(elasticities) if elasticities else None,
                "any_decision_reversal": any(reversals) if reversals else None,
            })
        report = {"records": records, "summary": summary, "warnings": [
            "Local elasticity is not global sensitivity; zero baselines produce null relative measures.",
            "Decision reversal needs substantive interpretation; this script does not test significance."
        ]}
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
