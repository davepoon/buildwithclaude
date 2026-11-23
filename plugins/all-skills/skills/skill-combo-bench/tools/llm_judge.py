"""Structured semantic judge boundaries, strict parsing, and deterministic mock judge."""

from __future__ import annotations

import argparse
import json
from pathlib import Path
from typing import Any

from adapters.base import JudgeAdapter
from engine.validation import DataValidationError, load_schema, sha256_json, validate_instance


REQUIRED_JUDGE_FIELDS = {"judge_version", "task_id", "run_id", "criterion_scores", "total_score", "deductions",
                         "evidence_quotes", "uncertainty", "abstain", "abstain_reason"}
_SCHEMA_PATH = Path(__file__).resolve().parents[1] / "schemas" / "judge_result.schema.json"
_CRITERIA = ("factual_correctness", "completeness", "rule_compliance", "clarity")


def _judge_schema() -> dict[str, Any]:
    """Load the authoritative judge schema so the parser cannot drift from the contract."""
    return load_schema(_SCHEMA_PATH)


def parse_judge_json(payload: str, *, task_id: str, run_id: str) -> dict[str, Any]:
    """Parse strict JSON, enforce the judge schema, and reject mismatched identity."""
    try:
        value = json.loads(payload)
    except json.JSONDecodeError as exc:
        raise DataValidationError(f"Judge did not return strict JSON: {exc.msg}") from exc
    if not isinstance(value, dict):
        raise DataValidationError("Judge result must be a JSON object")
    if not REQUIRED_JUDGE_FIELDS.issubset(value):
        raise DataValidationError("Judge result is missing required fields")
    if value.get("task_id") != task_id or value.get("run_id") != run_id:
        raise DataValidationError("Judge result identity does not match the run")
    validate_instance(value, _judge_schema())
    if not value["abstain"] and not value["evidence_quotes"]:
        raise DataValidationError("A non-abstaining judge must cite evidence")
    return value


class MockJudge(JudgeAdapter):
    """Deterministic design-verification judge; never evidence of real model quality."""

    adapter_id = "mock_judge"

    def capabilities(self) -> dict[str, Any]:
        """Declare mock-only semantic scoring."""
        return {"mock_only": True, "input_modalities": ["text"], "calibration_status": "JUDGE_NOT_CALIBRATED"}

    def run(self, task: dict[str, Any], context: dict[str, Any]) -> dict[str, Any]:
        """Score only the presence of requested content using a fixed, schema-valid rule."""
        output = str(context.get("output", ""))
        base = {"judge_version": self.adapter_version, "task_id": task["task_id"], "run_id": context["run_id"]}
        if not output.strip():
            return {**base,
                    "criterion_scores": [{"criterion": name, "score": None, "max_score": 2.0,
                                          "rationale": "MOCK_ONLY: empty output cannot be scored"} for name in _CRITERIA],
                    "total_score": None, "deductions": [], "evidence_quotes": [],
                    "uncertainty": 1.0, "abstain": True, "abstain_reason": "EMPTY_OUTPUT"}
        criterion_scores = [{"criterion": name, "score": 2.0, "max_score": 2.0,
                             "rationale": "MOCK_ONLY: non-empty output rule; not semantic quality evidence"}
                            for name in _CRITERIA]
        return {**base, "criterion_scores": criterion_scores, "total_score": 2.0 * len(_CRITERIA),
                "deductions": [], "evidence_quotes": [{"criterion": "completeness", "quote": output[:160]}],
                "uncertainty": 1.0, "abstain": False, "abstain_reason": None}


class ProviderJudge(JudgeAdapter):
    """Use a configured provider adapter without executing judged text as instructions."""

    adapter_id = "provider_judge"

    def __init__(self, provider: Any, prompt: str) -> None:
        self.provider = provider
        self.prompt = prompt

    def capabilities(self) -> dict[str, Any]:
        """Expose provider and calibration limitations."""
        return {"provider": self.provider.capabilities(), "calibration_status": "REQUIRES_EXTERNAL_CALIBRATION"}

    def run(self, task: dict[str, Any], context: dict[str, Any]) -> dict[str, Any]:
        """Send blinded content and validate the structured response."""
        judged = {"task_id": task["task_id"], "run_id": context["run_id"], "answer": context.get("output", ""),
                  "rubric": context.get("rubric", {})}
        request = {"input": self.prompt + "\n<untrusted_judged_content>\n" + json.dumps(judged, ensure_ascii=False) + "\n</untrusted_judged_content>",
                   "metadata": {"judge_version": self.adapter_version, "prompt_sha256": sha256_json(self.prompt)}}
        response = self.provider.run(request, context)
        if response.get("status") not in {"PASS", "SUCCESS"}:
            return response
        return parse_judge_json(response.get("output", ""), task_id=task["task_id"], run_id=context["run_id"])


def main(argv: list[str] | None = None) -> int:
    """Validate a stored judge payload without making a real API request."""
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--input", required=True)
    parser.add_argument("--task-id", required=True)
    parser.add_argument("--run-id", required=True)
    args = parser.parse_args(argv)
    result = parse_judge_json(Path(args.input).read_text(encoding="utf-8"), task_id=args.task_id, run_id=args.run_id)
    print(json.dumps(result, ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

# FILE END: tools/llm_judge.py
