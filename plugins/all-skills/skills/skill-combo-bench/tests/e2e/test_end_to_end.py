"""End-to-end smoke test for the offline mock closed loop."""

import json
import tempfile
import unittest
from pathlib import Path

from engine.experiment import ExperimentRunner
from engine.validation import load_yaml


class EndToEndSmokeTest(unittest.TestCase):
    """Run the default mock experiment end to end and verify the report claims MOCK_ONLY."""

    def test_default_mock_run_produces_auditable_report(self) -> None:
        root = Path(__file__).resolve().parents[2]
        config = load_yaml(root / "config" / "default.yaml")
        runner = ExperimentRunner(root, config)
        with tempfile.TemporaryDirectory() as tmp:
            result = runner.run(conditions=["N", "A", "B", "AB"], task_set="datasets/tasks/task_set.json",
                                repeat=1, seed=1, output_dir=tmp)
            self.assertEqual(result["status"], "MOCK_ONLY")
            self.assertGreaterEqual(result["run_count"], 4)
            report = Path(result["report"])
            self.assertTrue(report.exists())
            text = report.read_text(encoding="utf-8")
            self.assertIn("MOCK_ONLY", text)
            self.assertNotIn("COMPLETED_WITH_UNVERIFIED_EXTERNAL_RESULTS", text)
            results_path = Path(tmp) / "results.jsonl"
            records = [json.loads(line) for line in results_path.read_text(encoding="utf-8").splitlines() if line.strip()]
            self.assertTrue(records)
            for record in records:
                self.assertEqual(record["execution_scope"], "MOCK_ONLY")
                self.assertEqual(record["result_status"], "MOCK_ONLY")


if __name__ == "__main__":
    unittest.main()

# FILE END: tests/e2e/test_end_to_end.py
