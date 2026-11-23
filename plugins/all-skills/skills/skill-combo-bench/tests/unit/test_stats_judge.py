"""Tests for paired statistics, sequential rules, judge parsing, and calibration."""

import unittest

from engine.validation import DataValidationError
from tools.judge_calibration import calibrate, cohen_kappa, pearson, spearman
from tools.llm_judge import parse_judge_json
from tools.stats_analysis import GroupSequentialDesign, bootstrap_mean_ci, holm_correction, paired_permutation_test, paired_t_test, wilcoxon_signed_rank


class StatsJudgeTest(unittest.TestCase):
    """Exercise statistical edge cases with synthetic values only."""

    def test_paired_methods(self) -> None:
        a, b = [2, 3, 4, 5, 6], [1, 2, 2, 3, 4]
        self.assertEqual(paired_t_test(a, b)["n"], 5)
        self.assertEqual(wilcoxon_signed_rank(a, b)["n"], 5)
        self.assertEqual(bootstrap_mean_ci([1, 1, 1], resamples=50)["ci_95"], [1, 1])
        self.assertLess(paired_permutation_test(a, b, permutations=100)["p_value"], 0.2)

    def test_unpaired_lengths_are_rejected(self) -> None:
        self.assertEqual(paired_t_test([1], [1, 2])["status"], "N/A")

    def test_holm_monotonic_adjustment(self) -> None:
        result = holm_correction([0.01, 0.02, 0.5])
        self.assertEqual(len(result["adjusted_p_values"]), 3)
        self.assertTrue(result["rejected"][0])

    def test_sequential_design_enforces_looks(self) -> None:
        design = GroupSequentialDesign(max_sample_size=6, batch_size=2, min_sample_size=2)
        self.assertEqual(design.evaluate([1.0])["status"], "WAIT")
        self.assertTrue(design.evaluate([1.0, 1.0])["stop"])

    def test_correlations_and_kappa_are_distinct(self) -> None:
        self.assertAlmostEqual(pearson([1, 2, 3], [2, 4, 6]), 1)
        self.assertAlmostEqual(spearman([1, 2, 3], [10, 20, 30]), 1)
        self.assertAlmostEqual(cohen_kappa(["a", "b"], ["a", "b"]), 1)

    def test_calibration_can_fail_gates(self) -> None:
        records = [{"human_score": 0, "judge_score": 4}, {"human_score": 4, "judge_score": 0}]
        self.assertEqual(calibrate(records)["status"], "JUDGE_NOT_CALIBRATED")

    def test_judge_json_is_strict_and_evidenced(self) -> None:
        value = {"judge_version": "1", "task_id": "t", "run_id": "r",
                 "criterion_scores": [{"criterion": "clarity", "score": 1, "max_score": 2, "rationale": "clear"}],
                 "total_score": 1, "deductions": [],
                 "evidence_quotes": [{"criterion": "clarity", "quote": "answer"}],
                 "uncertainty": 0.2, "abstain": False, "abstain_reason": None}
        import json
        self.assertEqual(parse_judge_json(json.dumps(value), task_id="t", run_id="r")["total_score"], 1)
        # A non-abstaining judge must cite evidence.
        no_evidence = dict(value, evidence_quotes=[])
        with self.assertRaises(DataValidationError):
            parse_judge_json(json.dumps(no_evidence), task_id="t", run_id="r")
        # Schema violations such as a non-numeric uncertainty must be rejected.
        bad_uncertainty = dict(value, uncertainty="LOW")
        with self.assertRaises(DataValidationError):
            parse_judge_json(json.dumps(bad_uncertainty), task_id="t", run_id="r")
        # Identity mismatch must be rejected.
        with self.assertRaises(DataValidationError):
            parse_judge_json(json.dumps(value), task_id="other", run_id="r")


if __name__ == "__main__":
    unittest.main()

# FILE END: tests/unit/test_stats_judge.py
