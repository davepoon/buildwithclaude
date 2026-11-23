"""Dry-run call/token/cost ranges with explicit ESTIMATE and UNKNOWN states."""

from __future__ import annotations

import argparse
import json
from pathlib import Path
from typing import Any

import yaml


def estimate_cost(task_count: int, condition_count: int, repeats: int, max_turns: int, tool_calls_per_run: int,
                  token_range_per_call: tuple[int, int], pricing: dict[str, Any] | None = None) -> dict[str, Any]:
    """Estimate workload without issuing model/tool requests."""
    runs = task_count * condition_count * repeats
    model_calls = runs * max_turns
    low_tokens = model_calls * token_range_per_call[0]
    high_tokens = model_calls * token_range_per_call[1]
    result: dict[str, Any] = {"status": "ESTIMATE", "estimated_task_count": task_count, "condition_count": condition_count,
                              "repeats_per_condition": repeats, "estimated_runs": runs, "max_turns": max_turns,
                              "estimated_model_calls": model_calls, "estimated_tool_calls": runs * tool_calls_per_run,
                              "estimated_token_range": [low_tokens, high_tokens],
                              "assumptions": ["Every run reaches max_turns", "Every turn performs one model call",
                                              "Token range is configuration-derived, not observed usage"]}
    if not pricing:
        result.update({"pricing_status": "COST_UNKNOWN", "estimated_cost_range": None, "pricing_available": False})
        return result
    try:
        input_price = float(pricing["input_per_million"])
        output_price = float(pricing["output_per_million"])
        blended = (input_price + output_price) / 2
        result.update({"pricing_status": "ESTIMATE", "estimated_cost_range": [low_tokens / 1_000_000 * blended, high_tokens / 1_000_000 * blended],
                       "pricing_available": True, "currency": pricing.get("currency", "UNKNOWN"),
                       "price_effective_date": pricing.get("effective_date", "UNKNOWN"), "price_source": pricing.get("source", "UNSPECIFIED"),
                       "estimate_not_invoice": True})
    except (KeyError, TypeError, ValueError) as exc:
        result.update({"pricing_status": "COST_UNKNOWN", "estimated_cost_range": None, "pricing_available": False, "pricing_error": str(exc)})
    return result


def main(argv: list[str] | None = None) -> int:
    """Estimate from a compact YAML workload configuration."""
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--config", required=True, help="YAML containing workload and optional pricing")
    parser.add_argument("--output")
    args = parser.parse_args(argv)
    with Path(args.config).open("r", encoding="utf-8") as handle:
        config = yaml.safe_load(handle)
    workload = config.get("workload", config)
    result = estimate_cost(int(workload["task_count"]), int(workload["condition_count"]), int(workload.get("repeats", 1)),
                           int(workload.get("max_turns", 1)), int(workload.get("tool_calls_per_run", 0)),
                           tuple(workload.get("token_range_per_call", [0, 0])), config.get("pricing"))
    payload = json.dumps(result, ensure_ascii=False, indent=2)
    if args.output:
        Path(args.output).write_text(payload + "\n", encoding="utf-8")
    print(payload)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

# FILE END: tools/cost_estimator.py
