import csv
import json
import math
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path


ROOT = Path(__file__).resolve().parent.parent
SCRIPTS = ROOT / "scripts"


def run_script(name, *args):
    return subprocess.run([sys.executable, str(SCRIPTS / name), *map(str, args)], capture_output=True, text=True, encoding="utf-8")


def write_csv(path, fieldnames, rows):
    with path.open("w", encoding="utf-8", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(rows)


class ScriptTests(unittest.TestCase):
    def test_preflight(self):
        result = run_script("preflight.py", "--profile", "analysis", "--json")
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertEqual(json.loads(result.stdout)["status"], "pass")

    def test_regression_metrics(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "predictions.csv"
            write_csv(path, ["actual", "predicted", "lower", "upper", "region"], [
                {"actual": 1, "predicted": 1, "lower": 0, "upper": 4, "region": "a"},
                {"actual": 2, "predicted": 2, "lower": 0, "upper": 4, "region": "a"},
                {"actual": 3, "predicted": 5, "lower": 0, "upper": 4, "region": "b"},
            ])
            result = run_script("regression_metrics.py", path, "--actual", "actual", "--predicted", "predicted", "--lower", "lower", "--upper", "upper", "--group", "region", "--json")
            self.assertEqual(result.returncode, 0, result.stdout)
            report = json.loads(result.stdout)
            self.assertAlmostEqual(report["overall"]["rmse"], math.sqrt(4 / 3))
            self.assertEqual(report["overall"]["interval_coverage"], 1.0)
            self.assertEqual(report["groups"]["b"]["mae"], 2.0)

    def test_classification_metrics(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "labels.csv"
            write_csv(path, ["actual", "predicted"], [
                {"actual": "yes", "predicted": "yes"}, {"actual": "yes", "predicted": "no"},
                {"actual": "no", "predicted": "yes"}, {"actual": "no", "predicted": "no"},
            ])
            result = run_script("classification_metrics.py", path, "--actual", "actual", "--predicted", "predicted", "--positive", "yes", "--json")
            self.assertEqual(result.returncode, 0, result.stdout)
            report = json.loads(result.stdout)
            self.assertEqual(report["accuracy"], 0.5)
            self.assertEqual(report["mcc"], 0.0)

    def test_sensitivity_summary(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "sensitivity.csv"
            fields = ["question", "parameter", "baseline_input", "perturbed_input", "baseline_output", "perturbed_output", "baseline_decision", "perturbed_decision"]
            write_csv(path, fields, [{"question": "Q1", "parameter": "p", "baseline_input": 100, "perturbed_input": 110, "baseline_output": 200, "perturbed_output": 220, "baseline_decision": "A", "perturbed_decision": "A"}])
            result = run_script("sensitivity_summary.py", path, "--json")
            self.assertEqual(result.returncode, 0, result.stdout)
            record = json.loads(result.stdout)["records"][0]
            self.assertAlmostEqual(record["local_elasticity"], 1.0)
            self.assertFalse(record["decision_reversed"])

    def test_score_gate(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "review.json"
            data = {"questions": [{"id": "Q1", "scores": {key: 4 for key in ["coverage", "correctness", "fit", "reproducibility", "validation", "communication"]}, "p0": [], "p1": [], "p2": []}]}
            path.write_text(json.dumps(data), encoding="utf-8")
            passed = run_script("score_review.py", path, "--release-gate", "--strict", "--json")
            self.assertEqual(passed.returncode, 0, passed.stdout)
            data["questions"][0]["p0"] = ["wrong result"]
            path.write_text(json.dumps(data), encoding="utf-8")
            failed = run_script("score_review.py", path, "--release-gate", "--strict")
            self.assertEqual(failed.returncode, 1)
            data["questions"][0]["p0"] = []
            data["questions"][0]["scores"]["coverage"] = 0
            path.write_text(json.dumps(data), encoding="utf-8")
            incomplete = run_script("score_review.py", path, "--release-gate", "--strict")
            self.assertEqual(incomplete.returncode, 1)

    def test_evidence_audit(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            (root / "result.csv").write_text("value\n1\n", encoding="utf-8")
            (root / "verification.md").write_text("checked", encoding="utf-8")
            path = root / "requirements.csv"
            fields = ["requirement_id", "question", "status", "result_path", "verification_path", "evidence_gap", "severity"]
            write_csv(path, fields, [{"requirement_id": "R1", "question": "Q1", "status": "verified", "result_path": "result.csv", "verification_path": "verification.md", "evidence_gap": "", "severity": ""}])
            passed = run_script("evidence_audit.py", path, "--root", root, "--strict")
            self.assertEqual(passed.returncode, 0, passed.stdout)
            (root / "result.csv").unlink()
            failed = run_script("evidence_audit.py", path, "--root", root, "--strict")
            self.assertEqual(failed.returncode, 1)

    def test_hash_manifest(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            (root / "a.txt").write_text("abc", encoding="utf-8")
            result = run_script("hash_manifest.py", "a.txt", "--root", root, "--json")
            self.assertEqual(result.returncode, 0, result.stdout)
            report = json.loads(result.stdout)
            self.assertEqual(report["file_count"], 1)
            self.assertEqual(report["files"][0]["sha256"], "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad")


if __name__ == "__main__":
    unittest.main()
