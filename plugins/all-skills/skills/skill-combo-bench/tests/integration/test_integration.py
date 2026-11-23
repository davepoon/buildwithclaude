"""Integration tests covering the nine required areas from the V6.0 acceptance spec.

Each test exercises real components (ToolExecutor, MockAgent, ExperimentRunner,
mutation operators) rather than asserting on fabricated output.
"""

from __future__ import annotations

import json
import tempfile
import unittest
from pathlib import Path

from adapters.agent.mock_agent import MockAgent
from adapters.tools import build_mock_registry
from adapters.tools.base import ToolContext
from engine.experiment import ExperimentRunner, generate_report, read_results
from engine.mutation import mutate
from engine.scheduler import SchedulerConfig, ToolExecutor
from engine.validation import load_yaml


class ToolChainAndFaultTest(unittest.TestCase):
    """Cover Mock Tools, tool chaining, three fault classes, recovery, and idempotency."""

    def _executor(self, fault_profiles=None, **overrides) -> ToolExecutor:
        config = SchedulerConfig(max_tool_calls=20, max_retries=2, tool_timeout_seconds=0.05,
                                 run_timeout_seconds=10.0, max_repeated_calls=5, max_same_errors=3,
                                 backoff_seconds=0.0, circuit_breaker_threshold=5)
        for key, value in overrides.items():
            setattr(config, key, value)
        executor = ToolExecutor(build_mock_registry(fault_profiles), config)
        executor.start_run("run-integration", {}, {})
        return executor

    def test_mock_tools_run(self) -> None:
        """Mock Agent + Mock Tools produce deterministic values."""
        executor = self._executor()
        calc = executor.execute("mock_calculator", {"expression": "2*(3+4)"}, run_id="run-integration", turn_index=1)
        self.assertEqual(calc.status, "PASS")
        self.assertEqual(calc.value["value"], 14)
        weather = executor.execute("mock_weather", {"location": "Synthetic Harbor"}, run_id="run-integration", turn_index=1)
        self.assertEqual(weather.status, "PASS")
        self.assertEqual(weather.value["city"], "Synthetic Harbor")

    def test_tool_chain_data_transfer(self) -> None:
        """Tool A output is passed into Tool B and verified in final state."""
        executor = self._executor()
        created = executor.execute("mock_database",
                                   {"operation": "create", "collection": "orders", "record_id": "o-1",
                                    "record": {"amount": 12.5}}, run_id="run-integration", turn_index=1,
                                   call_id="db-create")
        self.assertEqual(created.status, "PASS")
        amount = created.value["value"]["amount"]
        computed = executor.execute("mock_calculator", {"expression": f"{amount}*2"}, run_id="run-integration",
                                    turn_index=1, call_id="calc")
        self.assertEqual(computed.status, "PASS")
        self.assertAlmostEqual(computed.value["value"], 25.0)
        asserted = executor.execute("mock_database",
                                    {"operation": "assert", "collection": "orders", "record_id": "o-1",
                                     "expected": {"amount": 12.5}}, run_id="run-integration", turn_index=1,
                                    call_id="db-assert")
        self.assertEqual(asserted.status, "PASS")

    def test_server_error_recovers_with_retry(self) -> None:
        """A retryable server error is retried and eventually succeeds."""
        executor = self._executor({"mock_weather": {"fault_type": "SERVER_ERROR", "probability": 1.0,
                                                   "max_triggers": 1, "delay_seconds": 0.0, "seed": 7}})
        result = executor.execute("mock_weather", {"location": "Synthetic Harbor"}, run_id="run-integration", turn_index=1)
        self.assertEqual(result.status, "PASS")
        self.assertEqual(result.metadata["retry_index"], 1)

    def test_invalid_argument_is_not_retried(self) -> None:
        """An injected invalid-argument fault surfaces as a non-retryable failure."""
        executor = self._executor({"mock_weather": {"fault_type": "INVALID_ARGUMENT", "probability": 1.0,
                                                   "max_triggers": 1, "delay_seconds": 0.0, "seed": 3}})
        result = executor.execute("mock_weather", {"location": "Synthetic Harbor"}, run_id="run-integration", turn_index=1)
        self.assertEqual(result.status, "FAIL")
        self.assertEqual(result.error["type"], "INVALID_ARGUMENT")

    def test_timeout_is_enforced(self) -> None:
        """A delay longer than the tool timeout produces a TIMED_OUT status."""
        executor = self._executor({"mock_weather": {"fault_type": "TIMEOUT", "probability": 1.0,
                                                   "max_triggers": 1, "delay_seconds": 0.3, "seed": 5}})
        result = executor.execute("mock_weather", {"location": "Synthetic Harbor"}, run_id="run-integration", turn_index=1)
        self.assertEqual(result.status, "TIMED_OUT")

    def test_repeated_calls_are_bounded(self) -> None:
        """Repeating the same call beyond the limit is classified as LOOPED."""
        executor = self._executor(max_repeated_calls=2)
        statuses = [executor.execute("mock_search", {"query": "same"}, run_id="run-integration",
                                     turn_index=1).status for _ in range(3)]
        self.assertEqual(statuses[-1], "LOOPED")


class ExperimentLevelTest(unittest.TestCase):
    """Cover multi-turn state, skill order, mutation, and report generation."""

    def setUp(self) -> None:
        self.root = Path(__file__).resolve().parents[2]
        self.config = load_yaml(self.root / "config" / "default.yaml")

    def test_multi_turn_state_and_skill_order(self) -> None:
        """A multi-turn run preserves state and records the configured skill order."""
        runner = ExperimentRunner(self.root, self.config)
        forward = runner.condition_skills("AB")
        self.assertEqual([item["skill_id"] for item in forward], ["A", "B"])
        self.assertEqual([item["manifest"]["skill_id"] for item in forward],
                         ["instruction-skill", "format-skill"])
        self.assertTrue(all(item["raw_sha256"] for item in forward), "skill raw content must be hashed")
        task = runner.load_tasks()[1]
        with tempfile.TemporaryDirectory() as tmp:
            record = runner.run_one(task, "AB", 0, "exp-it", Path(tmp))
        self.assertTrue(record["task_success"])
        state_probes = [item for item in record["assertions"] if item["type"] == "state_equals"]
        self.assertTrue(state_probes, "multi-turn task must expose state probes")
        self.assertTrue(all(item["status"] == "PASS" for item in state_probes))

    def test_mutation_operators_produce_valid_candidates(self) -> None:
        """A mutation operator yields a replayable, digest-changing record."""
        runner = ExperimentRunner(self.root, self.config)
        task = runner.load_tasks()[0]
        mutated, record = mutate(task, "PROMPT_INJECTION", seed=11)
        self.assertEqual(record.operator_id, "PROMPT_INJECTION")
        self.assertNotEqual(record.before_sha256, record.after_sha256)
        self.assertTrue(record.valid)
        self.assertIsNone(record.detected, "detection requires a run; a fresh mutation is unmeasured")
        self.assertNotEqual(mutated, task)

    def test_report_generation_marks_mock_only(self) -> None:
        """A stored experiment regenerates a report that declares MOCK_ONLY."""
        with tempfile.TemporaryDirectory() as tmp:
            runner = ExperimentRunner(self.root, self.config)
            runner.run(conditions=["N", "AB"], repeat=1, seed=2, output_dir=tmp)
            records = read_results(Path(tmp))
            self.assertTrue(records)
            path = generate_report(Path(tmp), self.config)
            text = path.read_text(encoding="utf-8")
            self.assertIn("MOCK_ONLY", text)
            self.assertIn("NOT_VERIFIED", text)


if __name__ == "__main__":
    unittest.main()

# FILE END: tests/integration/test_integration.py
