"""Sanitized trace export and observable replay-diff reporting."""

from __future__ import annotations

import argparse
import json
from pathlib import Path
from typing import Any

from engine.validation import redact, sha256_json


VOLATILE_FIELDS = {"event_id", "timestamp", "latency_ms", "started_at", "ended_at", "run_id", "experiment_id", "trace_id", "tool_call_id"}


def load_trace(path: str | Path) -> list[dict[str, Any]]:
    """Load append-only JSONL events."""
    with Path(path).open("r", encoding="utf-8") as handle:
        return [json.loads(line) for line in handle if line.strip()]


def _without_volatile(value: Any) -> Any:
    """Recursively remove replay identities and timings while preserving behavior."""
    if isinstance(value, dict):
        return {key: _without_volatile(item) for key, item in value.items() if key not in VOLATILE_FIELDS}
    if isinstance(value, list):
        return [_without_volatile(item) for item in value]
    return value


def comparable_event(event: dict[str, Any]) -> dict[str, Any]:
    """Remove volatile fields while retaining observable behavior and state."""
    return _without_volatile(event)


def compare_traces(original: list[dict[str, Any]], replayed: list[dict[str, Any]]) -> dict[str, Any]:
    """Compare deterministic events; real model replay remains best-effort."""
    left = [comparable_event(event) for event in original]
    right = [comparable_event(event) for event in replayed]
    differences = []
    for index in range(max(len(left), len(right))):
        a = left[index] if index < len(left) else None
        b = right[index] if index < len(right) else None
        if sha256_json(a) != sha256_json(b):
            differences.append({"event_index": index, "original_sha256": sha256_json(a), "replayed_sha256": sha256_json(b)})
    return {"status": "MATCH" if not differences else "DIFFERENT", "original_events": len(left), "replayed_events": len(right),
            "difference_count": len(differences), "differences": differences,
            "note": "Mock replay can be deterministic; real provider replay is best-effort and not guaranteed."}


def export_trace(input_path: str | Path, output_path: str | Path, *, anonymize: bool = True) -> dict[str, Any]:
    """Export redacted events and fail closed on serialization errors."""
    events = redact(load_trace(input_path), anonymize=anonymize)
    target = Path(output_path)
    target.parent.mkdir(parents=True, exist_ok=True)
    with target.open("w", encoding="utf-8") as handle:
        for event in events:
            handle.write(json.dumps(event, ensure_ascii=False, sort_keys=True) + "\n")
    return {"status": "PASS", "event_count": len(events), "output": str(target),
            "limitation": "Common regex redaction cannot guarantee detection of all personal information."}


def main(argv: list[str] | None = None) -> int:
    """Export one trace or compare two traces."""
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--input", required=True)
    parser.add_argument("--output")
    parser.add_argument("--replayed")
    parser.add_argument("--no-anonymize", action="store_true")
    args = parser.parse_args(argv)
    if args.replayed:
        result = compare_traces(load_trace(args.input), load_trace(args.replayed))
    elif args.output:
        result = export_trace(args.input, args.output, anonymize=not args.no_anonymize)
    else:
        parser.error("Provide --output for export or --replayed for comparison")
    print(json.dumps(result, ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

# FILE END: tools/trace_export.py
