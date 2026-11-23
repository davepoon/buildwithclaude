"""Unit tests for metric formulas, denominators, and missing values."""

import math
import unittest

from engine.metrics import (context_efficiency, cost_per_success, engineering_metrics, mutation_score, paired_synergy,
                            percentile, rc_breakdown, robustness_scores, skill_inactivation, synergy, turn_weighted_rc,
                            weighted_rule_compliance)


class MetricsTest(unittest.TestCase):
    """Check each metric independently of any provider."""

    def test_rc_excludes_na_and_uses_weights(self) -> None:
        result = weighted_rule_compliance([{"status": "PASS", "weight": 2}, {"status": "FAIL", "weight": 1}, {"status": "N/A", "weight": 100}])
        self.assertAlmostEqual(result["value"], 2 / 3)
        self.assertEqual(result["eligible_count"], 2)

    def test_rc_empty_is_not_success(self) -> None:
        result = weighted_rule_compliance([{"status": "N/A"}])
        self.assertIsNone(result["value"])
        self.assertEqual(result["status"], "N/A")

    def test_rc_breakdown_reports_all_dimensions(self) -> None:
        items = [{"probe_id": "p1", "skill_id": "A", "probe_family": "instruction", "turn_index": 1, "status": "PASS", "weight": 1},
                 {"probe_id": "p2", "skill_id": "A", "probe_family": "instruction", "turn_index": 2, "status": "FAIL", "weight": 3},
                 {"probe_id": "p3", "skill_id": "B", "probe_family": "state_tracking", "turn_index": 2, "status": "PASS", "weight": 1},
                 {"probe_id": "p4", "skill_id": "B", "probe_family": "state_tracking", "turn_index": 2, "status": "N/A", "weight": 99}]
        result = rc_breakdown(items)
        self.assertAlmostEqual(result["global"]["rc"], 2 / 5)
        self.assertEqual(result["global"]["eligible"], 3)
        self.assertEqual(result["na_excluded"], 1)
        self.assertAlmostEqual(result["by_skill"]["A"]["rc"], 0.25)
        self.assertAlmostEqual(result["by_skill"]["B"]["rc"], 1.0)
        self.assertAlmostEqual(result["by_turn"]["2"]["rc"], 1 / 4)
        self.assertIn("instruction", result["by_probe_family"])

    def test_turn_weighting_is_predeclared(self) -> None:
        result = turn_weighted_rc([{"turn_index": 1, "rc": 1}, {"turn_index": 2, "rc": 0}], {1: 1, 2: 3})
        self.assertEqual(result["value"], 0.25)

    def test_ti_excludes_external_and_safe_failures(self) -> None:
        probes = [{"status": "FAIL", "failure_class": "RULE_OMISSION", "skill_id": "A"},
                  {"status": "PASS", "failure_class": "NONE", "skill_id": "A"},
                  {"status": "FAIL", "failure_class": "TOOL_FAILED_EXTERNALLY", "skill_id": "A"},
                  {"status": "FAIL", "failure_class": "SAFE_REFUSAL", "skill_id": "A"}]
        result = skill_inactivation(probes)
        self.assertEqual(result["value"], 0.5)
        self.assertEqual(result["total_eligible_probes"], 2)

    def test_synergy_formula(self) -> None:
        self.assertAlmostEqual(synergy(0.2, 0.4, 0.5, 0.9), 0.2)
        records = [{"task_id": "t", "repeat_index": 0, "condition_id": c, "task_success": v} for c, v in zip(("N", "A", "B", "AB"), (0.2, 0.4, 0.5, 0.9))]
        self.assertAlmostEqual(paired_synergy(records)["value"], 0.2)

    def test_ce_and_zero_token_behavior(self) -> None:
        self.assertEqual(context_efficiency(0.8, {"total": 2000})["value"], 0.4)
        self.assertEqual(context_efficiency(1, {"total": 0})["status"], "N/A")

    def test_cps_and_unknown_cost(self) -> None:
        records = [{"task_success": True, "cost": 2}, {"task_success": False, "cost": 1}]
        self.assertEqual(cost_per_success(records)["value"], 3)
        self.assertEqual(cost_per_success(records, pricing_available=False)["status"], "COST_UNKNOWN")

    def test_rs_keeps_safe_stop_separate(self) -> None:
        records = [{"robustness_class": "RECOVERED"}, {"robustness_class": "SAFE_STOP"}, {"robustness_class": "FAILED"}]
        result = robustness_scores(records)
        self.assertAlmostEqual(result["RS_strict"], 1 / 3)
        self.assertAlmostEqual(result["RS_safe"], 2 / 3)

    def test_mutation_score_valid_denominator(self) -> None:
        result = mutation_score([{"valid": True, "detected": True, "operator_id": "X"}, {"valid": True, "detected": False, "operator_id": "X"}, {"valid": False}])
        self.assertEqual(result["value"], 0.5)
        self.assertEqual(result["invalid_mutations"], 1)

    def test_engineering_metrics_and_percentiles(self) -> None:
        self.assertEqual(percentile([1, 2, 3], 0.5), 2)
        self.assertEqual(percentile([], 0.95), None)
        result = engineering_metrics([{"task_success": True, "schema_valid": True, "latency_ms": 10, "tool_calls": [{"status": "PASS"}]}])
        self.assertEqual(result["task_success_rate"], 1)
        self.assertEqual(result["latency_p95_ms"], 10)


if __name__ == "__main__":
    unittest.main()

# FILE END: tests/unit/test_metrics.py
