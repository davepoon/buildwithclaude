#!/usr/bin/env python3
"""Calculate the internal six-dimension rubric and apply explicit release gates."""
import argparse
import json
from pathlib import Path


DIMENSIONS = {
    "coverage": 20, "correctness": 20, "fit": 15,
    "reproducibility": 15, "validation": 20, "communication": 10,
}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("json_file")
    parser.add_argument("--release-gate", action="store_true")
    parser.add_argument("--strict", action="store_true")
    parser.add_argument("--output")
    parser.add_argument("--json", action="store_true")
    args = parser.parse_args()
    try:
        data = json.loads(Path(args.json_file).read_text(encoding="utf-8-sig"))
        questions = data.get("questions")
        if not isinstance(questions, list) or not questions:
            raise ValueError("questions must be a non-empty list")
        results = []
        all_p0, all_p1 = [], []
        for q in questions:
            qid = str(q.get("id", "")).strip()
            if not qid:
                raise ValueError("Every question needs an id")
            weight = float(q.get("weight", 1))
            if weight <= 0:
                raise ValueError(qid + ": weight must be positive")
            scores = q.get("scores", {})
            points = 0.0
            normalized = {}
            for dimension, dimension_weight in DIMENSIONS.items():
                score = scores.get(dimension)
                if not isinstance(score, (int, float)) or isinstance(score, bool) or not 0 <= score <= 4:
                    raise ValueError(qid + ": " + dimension + " must be numeric in [0,4]")
                normalized[dimension] = score
                points += score / 4 * dimension_weight
            p0 = [str(x) for x in q.get("p0", [])]
            p1 = [str(x) for x in q.get("p1", [])]
            all_p0.extend(qid + ": " + x for x in p0)
            all_p1.extend(qid + ": " + x for x in p1)
            results.append({"id": qid, "weight": weight, "scores": normalized, "weighted_score": points, "p0": p0, "p1": p1, "p2": q.get("p2", [])})
        total_weight = sum(q["weight"] for q in results)
        overall = sum(q["weighted_score"] * q["weight"] for q in results) / total_weight
        gate_checks = {
            "no_p0": not all_p0,
            "coverage_at_least_3": all(q["scores"]["coverage"] >= 3 for q in results),
            "correctness_at_least_3": all(q["scores"]["correctness"] >= 3 for q in results),
            "validation_at_least_3": all(q["scores"]["validation"] >= 3 for q in results),
            "weighted_score_at_least_85": overall >= 85,
        }
        release_candidate = all(gate_checks.values())
        report = {
            "questions": results, "overall_weighted_score": overall,
            "gate_checks": gate_checks, "release_candidate": release_candidate,
            "p0": all_p0, "p1_unresolved_must_be_disclosed": all_p1,
            "note": "Internal triage only. Not an official contest score, correctness proof, or award prediction."
        }
        text = json.dumps(report, ensure_ascii=False, indent=2 if args.json or args.output else None)
        if args.output:
            output = Path(args.output)
            output.parent.mkdir(parents=True, exist_ok=True)
            output.write_text(text + "\n", encoding="utf-8")
        print(text)
        return 1 if args.strict and args.release_gate and not release_candidate else 0
    except (OSError, ValueError, TypeError, json.JSONDecodeError) as exc:
        print(json.dumps({"error": str(exc)}, ensure_ascii=False))
        return 2


if __name__ == "__main__":
    raise SystemExit(main())
