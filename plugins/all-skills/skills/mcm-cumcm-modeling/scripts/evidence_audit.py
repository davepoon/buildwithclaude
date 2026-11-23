#!/usr/bin/env python3
"""Audit requirement status, evidence paths and unresolved evidence gaps."""
import argparse
import csv
import json
from pathlib import Path


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("csv_file")
    parser.add_argument("--root", default=".")
    parser.add_argument("--strict", action="store_true")
    parser.add_argument("--json", action="store_true")
    args = parser.parse_args()
    required = ["requirement_id", "question", "status", "result_path", "verification_path", "evidence_gap", "severity"]
    allowed_status = {"pending", "designed", "executed", "verified", "reproduced", "blocked"}
    errors, warnings = [], []
    seen = set()
    root = Path(args.root).resolve()
    try:
        with open(args.csv_file, "r", encoding="utf-8-sig", newline="") as handle:
            reader = csv.DictReader(handle)
            missing = [c for c in required if c not in (reader.fieldnames or [])]
            if missing:
                raise ValueError("Missing columns: " + ", ".join(missing))
            rows = list(reader)
        if not rows:
            raise ValueError("No requirements to audit")
        for index, row in enumerate(rows, start=2):
            rid = (row["requirement_id"] or "").strip()
            status = (row["status"] or "").strip().lower()
            prefix = f"row {index} ({rid or 'missing id'})"
            if not rid:
                errors.append(prefix + ": missing requirement_id")
            elif rid in seen:
                errors.append(prefix + ": duplicate requirement_id")
            seen.add(rid)
            if status not in allowed_status:
                errors.append(prefix + ": invalid status " + repr(status))
            result_path = (row["result_path"] or "").strip()
            verification_path = (row["verification_path"] or "").strip()
            if status in {"executed", "verified", "reproduced"}:
                if not result_path:
                    errors.append(prefix + ": executed status requires result_path")
                elif not (root / result_path).is_file():
                    errors.append(prefix + ": result file not found: " + result_path)
            if status in {"verified", "reproduced"}:
                if not verification_path:
                    errors.append(prefix + ": verified status requires verification_path")
                elif not (root / verification_path).is_file():
                    errors.append(prefix + ": verification file not found: " + verification_path)
            gap = (row["evidence_gap"] or "").strip()
            severity = (row["severity"] or "").strip().upper()
            if gap:
                message = prefix + ": unresolved evidence gap: " + gap
                if severity in {"P0", "P1"}:
                    errors.append(message)
                else:
                    warnings.append(message)
            if status == "blocked":
                warnings.append(prefix + ": requirement is blocked")
        report = {
            "requirements": len(rows), "errors": errors, "warnings": warnings,
            "status": "fail" if errors else ("pass_with_warnings" if warnings else "pass"),
            "note": "Path existence and metadata do not prove mathematical correctness or reproduction."
        }
        print(json.dumps(report, ensure_ascii=False, indent=2 if args.json else None))
        return 1 if args.strict and errors else 0
    except (OSError, ValueError) as exc:
        print(json.dumps({"error": str(exc)}, ensure_ascii=False))
        return 2


if __name__ == "__main__":
    raise SystemExit(main())
