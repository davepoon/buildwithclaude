"""Independent tests for every safe mutation operator."""

import unittest

from engine.mutation import OPERATORS, mutate, validate_generated_candidates


class MutationTest(unittest.TestCase):
    """Verify replayability and explicit validity."""

    def base_task(self):
        return {"task_id": "t", "modalities": ["text", "structured"], "skill_order": ["A", "B"],
                "turns": [{"turn_index": 1, "input": "Do the constrained task", "state_writes": {"x": 1},
                           "tool_calls": [{"call_id": "c", "name": "mock_calculator", "arguments": {"expression": "1+1"}}]}]}

    def test_all_operators_are_valid_for_applicable_task(self) -> None:
        for operator in OPERATORS:
            with self.subTest(operator=operator):
                changed, record = mutate(self.base_task(), operator, 7)
                self.assertTrue(record.valid, record.invalid_reason)
                self.assertNotEqual(record.before_sha256, record.after_sha256)
                self.assertEqual(record.seed, 7)
                self.assertEqual(record.operator_id, operator)

    def test_missing_tool_is_invalid_not_silently_counted(self) -> None:
        task = self.base_task()
        task["turns"][0]["tool_calls"] = []
        _, record = mutate(task, "MISSING_PARAMETER", 1)
        self.assertFalse(record.valid)

    def test_generated_candidates_require_three_and_safe_schema(self) -> None:
        candidate = {"candidate_id": "c1", "target_rule": "r", "expected_failure_mode": "f", "input_modalities": ["text"],
                     "tool_dependencies": [], "assertions": [], "stimulus": "safe"}
        self.assertEqual(validate_generated_candidates([candidate])["status"], "FAIL")
        candidates = [dict(candidate, candidate_id=f"c{index}") for index in range(3)]
        self.assertEqual(validate_generated_candidates(candidates)["valid_count"], 3)
        dangerous = [dict(candidate, candidate_id=f"c{index}", requested_side_effects=["delete"]) for index in range(3)]
        self.assertEqual(validate_generated_candidates(dangerous)["valid_count"], 0)


if __name__ == "__main__":
    unittest.main()

# FILE END: tests/unit/test_mutation.py
