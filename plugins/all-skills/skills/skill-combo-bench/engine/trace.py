"""Append-only observable run traces with redaction and artifact hashes."""

from __future__ import annotations

import json
import uuid
from dataclasses import asdict, dataclass, field
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from engine.validation import redact, sha256_json


def utc_now() -> str:
    """Return an ISO-8601 timestamp with an explicit timezone."""
    return datetime.now(timezone.utc).isoformat()


@dataclass
class TraceEvent:
    """V6.0 trace event; hidden reasoning is deliberately not represented."""

    run_id: str
    experiment_id: str
    task_id: str
    condition_id: str
    event_type: str
    agent_id: str = "UNKNOWN"
    harness_id: str = "UNKNOWN"
    provider_id: str = "UNKNOWN"
    model_id: str = "UNKNOWN"
    skill_hashes: dict[str, str] = field(default_factory=dict)
    turn_index: int = 0
    timestamp: str = field(default_factory=utc_now)
    latency_ms: float | None = None
    token_usage: dict[str, int] = field(default_factory=dict)
    tool_event: dict[str, Any] | None = None
    status: str = "OBSERVED"
    error: dict[str, Any] | None = None
    artifact_hashes: dict[str, str] = field(default_factory=dict)
    details: dict[str, Any] = field(default_factory=dict)
    schema_version: str = "6.0.0"
    event_id: str = field(default_factory=lambda: str(uuid.uuid4()))


class RunTraceWriter:
    """Write one JSON object per event and never store credentials."""

    def __init__(self, directory: str | Path, *, anonymize: bool = False, no_store_raw_content: bool = False, custom_patterns: list[str] | None = None) -> None:
        self.directory = Path(directory)
        self.directory.mkdir(parents=True, exist_ok=True)
        self.path = self.directory / "trace.jsonl"
        self.anonymize = anonymize
        self.no_store_raw_content = no_store_raw_content
        self.custom_patterns = custom_patterns or []

    def append(self, event: TraceEvent) -> dict[str, Any]:
        """Validate basic fields, sanitize, and append one event atomically enough for local runs."""
        value = asdict(event)
        event_types = {"RUN_STARTED": "run_started", "RUN_FINISHED": "run_completed", "TOOL_CALL": "tool_completed",
                       "tool_call_requested": "tool_requested", "tool_call_completed": "tool_completed",
                       "turn_output": "model_response", "state_probe_evaluated": "state_read", "run_failed": "run_completed"}
        value["event_type"] = event_types.get(value["event_type"], value["event_type"])
        if value["event_type"] == "tool_completed" and (value.get("tool_event") or {}).get("status") not in {None, "PASS", "SUCCESS"}:
            value["event_type"] = "tool_failed"
        usage = value.get("token_usage") or {}
        value["details"].setdefault("token_measurement", {key: item for key, item in usage.items() if key.endswith("_tokens") is False})
        value["token_usage"] = {key: usage.get(key, usage.get(f"{key}_tokens")) for key in ("input", "output", "cached", "tool", "total")}
        if value.get("error") and "type" in value["error"]:
            value["error"] = {**value["error"], "error_type": value["error"].get("error_type", value["error"]["type"])}
        value = redact(value, self.custom_patterns, self.anonymize)
        if self.no_store_raw_content:
            for key in ("input", "output", "arguments", "result", "content"):
                if key in value.get("details", {}):
                    original = value["details"][key]
                    value["details"][f"{key}_sha256"] = sha256_json(original)
                    del value["details"][key]
        with self.path.open("a", encoding="utf-8") as handle:
            handle.write(json.dumps(value, ensure_ascii=False, sort_keys=True) + "\n")
        return value

    def read(self) -> list[dict[str, Any]]:
        """Read valid JSONL events for replay and comparison."""
        if not self.path.exists():
            return []
        with self.path.open("r", encoding="utf-8") as handle:
            return [json.loads(line) for line in handle if line.strip()]


# FILE END: engine/trace.py
