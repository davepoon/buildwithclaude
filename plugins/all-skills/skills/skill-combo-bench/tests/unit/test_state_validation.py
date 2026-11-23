"""Tests for serializable state, exact probes, validation, and redaction."""

import tempfile
import unittest
from pathlib import Path

from engine.multimodal import ModalityCapabilities, generate_synthetic_assets, inspect_asset
from engine.state import SessionState, StateProbe
from engine.validation import DataValidationError, redact, sha256_file, validate_instance


class StateValidationTest(unittest.TestCase):
    """Exercise local contracts without network access."""

    def test_state_round_trip_and_exact_probe(self) -> None:
        state = SessionState(run_id="r", task_id="t", condition_id="A", trace_id="tr")
        state.write({"order": {"id": "ORD-1"}})
        restored = SessionState.from_dict(state.to_dict())
        self.assertEqual(restored.read("order.id"), "ORD-1")
        self.assertEqual(StateProbe("order.id", 1, 2, expected="ORD-1").evaluate(restored)["status"], "PASS")

    def test_missing_state_is_failure(self) -> None:
        state = SessionState(run_id="r", task_id="t", condition_id="A", trace_id="tr")
        self.assertEqual(StateProbe("missing", 1, 1).evaluate(state)["failure_class"], "OMISSION")

    def test_secret_redaction_and_stable_pseudonym(self) -> None:
        source = {"api_key": "do-not-store", "email": "person@example.com", "nested": ["person@example.com"]}
        cleaned = redact(source, anonymize=True)
        self.assertEqual(cleaned["api_key"], "<REDACTED>")
        self.assertNotIn("person@example.com", str(cleaned))
        self.assertEqual(cleaned["email"], cleaned["nested"][0])

    def test_token_usage_is_not_redacted(self) -> None:
        """Token statistics contain 'token' but must keep their object structure."""
        source = {"token_usage": {"total_tokens": 5}, "max_tokens": 100, "api_token": "secret-value"}
        cleaned = redact(source)
        self.assertEqual(cleaned["token_usage"], {"total_tokens": 5})
        self.assertEqual(cleaned["max_tokens"], 100)
        self.assertEqual(cleaned["api_token"], "<REDACTED>")

    def test_schema_validation_reports_path(self) -> None:
        schema = {"type": "object", "required": ["x"], "properties": {"x": {"type": "integer"}}}
        validate_instance({"x": 1}, schema)
        with self.assertRaises(DataValidationError):
            validate_instance({"x": "bad"}, schema)

    def test_modality_unsupported_is_explicit(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "x.txt"
            path.write_text("ok", encoding="utf-8")
            self.assertEqual(ModalityCapabilities().check("audio", path)["status"], "UNSUPPORTED")

    def test_synthetic_asset_metadata_and_hash(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            assets = generate_synthetic_assets(directory)
            self.assertGreaterEqual(len(assets), 4)
            self.assertEqual(len(assets[0].sha256), 64)
            self.assertEqual(assets[0].sha256, sha256_file(Path(directory) / "orders.csv"))


if __name__ == "__main__":
    unittest.main()

# FILE END: tests/unit/test_state_validation.py
