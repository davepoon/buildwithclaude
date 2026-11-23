"""Bounded tool execution with retries, deadlines, loop detection, and checkpoints."""

from __future__ import annotations

import json
import time
import uuid
from concurrent.futures import ThreadPoolExecutor, TimeoutError as FutureTimeout
from dataclasses import dataclass, field
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from adapters.tools.base import ToolContext, ToolError, ToolRegistry, ToolResult
from engine.trace import TraceEvent, RunTraceWriter, utc_now
from engine.validation import redact, sha256_json


@dataclass
class SchedulerConfig:
    """Safety limits; all values can be overridden by experiment configuration."""

    max_tool_calls: int = 30
    max_retries: int = 2
    tool_timeout_seconds: float = 2.0
    run_timeout_seconds: float = 60.0
    max_repeated_calls: int = 3
    max_same_errors: int = 3
    backoff_seconds: float = 0.01
    circuit_breaker_threshold: int = 5


@dataclass
class RunBudget:
    """Mutable limits local to a complete run."""

    started_monotonic: float = field(default_factory=time.monotonic)
    calls: int = 0
    cancelled: bool = False


class ToolExecutor:
    """Execute registered tools without evaluating agent-provided shell content."""

    def __init__(self, registry: ToolRegistry, config: SchedulerConfig | None = None, tracer: RunTraceWriter | None = None) -> None:
        self.registry = registry
        self.config = config or SchedulerConfig()
        self.tracer = tracer
        self.budgets: dict[str, RunBudget] = {}
        self.contexts: dict[str, ToolContext] = {}
        self.events: list[dict[str, Any]] = []
        self.consecutive_failures = 0
        self.circuit_open = False
        self.call_counts: dict[tuple[str, str], int] = {}
        self.error_streaks: dict[str, int] = {}
        self._last_error: str | None = None

    def start_run(self, run_id: str, session_state: dict[str, Any] | None = None,
                  tool_state: dict[str, Any] | None = None, workspace: str = ".") -> None:
        """Reset per-run limits and bind explicit state shared by all turns."""
        self.budgets[run_id] = RunBudget()
        self.contexts[run_id] = ToolContext(run_id=run_id, turn_index=1,
                                            session_state=session_state if session_state is not None else {},
                                            tool_state=tool_state if tool_state is not None else {}, workspace=workspace)

    def cancel(self, run_id: str) -> dict[str, Any]:
        """Cooperatively prevent further calls in a run."""
        self.budgets.setdefault(run_id, RunBudget()).cancelled = True
        return {"status": "CANCELLED", "run_id": run_id}

    def _record(self, event: dict[str, Any], task_id: str = "UNKNOWN", condition_id: str = "UNKNOWN") -> None:
        self.events.append(event)
        if self.tracer:
            self.tracer.append(TraceEvent(
                run_id=event["run_id"], experiment_id=event.get("experiment_id", "UNKNOWN"), task_id=task_id,
                condition_id=condition_id, event_type="TOOL_CALL", turn_index=event["turn_index"],
                tool_event=event, status=event["status"], error=event.get("error"),
            ))

    def execute(self, name: str, arguments: dict[str, Any], *, run_id: str, turn_index: int, call_id: str | None = None,
                context: ToolContext | None = None, experiment_id: str = "UNKNOWN") -> ToolResult:
        """Run one logical call with bounded retries and return an observable result."""
        budget = self.budgets.setdefault(run_id, RunBudget())
        call_id = call_id or str(uuid.uuid4())
        started = time.monotonic()
        base_event: dict[str, Any] = {"tool_call_id": call_id, "run_id": run_id, "experiment_id": experiment_id,
                                      "turn_index": turn_index, "tool_name": name, "retry_index": 0,
                                      "arguments_redacted": redact(arguments)}

        def finish(status: str, value: Any = None, error: dict[str, Any] | None = None, retry_index: int = 0) -> ToolResult:
            ended = time.monotonic()
            event = dict(base_event)
            event.update({"started_at": utc_now(), "ended_at": utc_now(),
                          "latency_ms": round((ended - started) * 1000, 3), "status": status,
                          "result_digest": sha256_json(value), "error_type": error.get("type") if error else None,
                          "retry_index": retry_index, "error": error})
            self._record(event)
            return ToolResult(status=status, value=value, error=error, metadata={"tool_call_id": call_id, "retry_index": retry_index})

        if budget.cancelled:
            return finish("CANCELLED", error={"type": "CANCELLED", "message": "Run was cancelled", "retryable": False})
        if self.circuit_open:
            return finish("CIRCUIT_OPEN", error={"type": "CIRCUIT_OPEN", "message": "Circuit breaker is open", "retryable": False})
        if budget.calls >= self.config.max_tool_calls:
            return finish("LOOPED", error={"type": "MAX_TOOL_CALLS", "message": "Tool call limit reached", "retryable": False})
        if time.monotonic() - budget.started_monotonic >= self.config.run_timeout_seconds:
            return finish("TIMED_OUT", error={"type": "RUN_TIMEOUT", "message": "Run deadline exceeded", "retryable": False})
        budget.calls += 1
        signature = (name, sha256_json(arguments))
        repeat_key = (run_id, f"{signature[0]}:{signature[1]}")
        self.call_counts[repeat_key] = self.call_counts.get(repeat_key, 0) + 1
        if self.call_counts[repeat_key] > self.config.max_repeated_calls:
            return finish("LOOPED", error={"type": "REPEATED_CALL", "message": "Repeated argument/call limit reached", "retryable": False})

        try:
            tool = self.registry.get(name)
            tool.validate_arguments(arguments)
        except ToolError as exc:
            return finish("FAIL", error=exc.to_dict())

        context = context or self.contexts.get(run_id) or ToolContext(run_id=run_id, turn_index=turn_index)
        context.turn_index = turn_index
        last_error: ToolError | None = None
        for retry_index in range(self.config.max_retries + 1):
            base_event["retry_index"] = retry_index
            attempt_started = time.monotonic()
            pool = ThreadPoolExecutor(max_workers=1)
            future = pool.submit(tool.execute, arguments, context)
            try:
                timeout = min(float(tool.timeout_seconds), self.config.tool_timeout_seconds)
                value = future.result(timeout=timeout)
                pool.shutdown(wait=True)
                self.consecutive_failures = 0
                self._last_error = None
                return finish("PASS", value=value, retry_index=retry_index)
            except FutureTimeout:
                future.cancel()
                pool.shutdown(wait=False, cancel_futures=True)
                last_error = ToolError("TOOL_TIMEOUT", f"Tool exceeded {self.config.tool_timeout_seconds}s", retryable=True)
            except ToolError as exc:
                pool.shutdown(wait=False, cancel_futures=True)
                last_error = exc
            except Exception as exc:  # Adapter boundary: convert unexpected exceptions to audit events.
                pool.shutdown(wait=False, cancel_futures=True)
                last_error = ToolError("TOOL_INTERNAL_ERROR", str(exc), retryable=False)

            self.consecutive_failures += 1
            if self._last_error == last_error.error_type:
                self.error_streaks[last_error.error_type] = self.error_streaks.get(last_error.error_type, 1) + 1
            else:
                self.error_streaks[last_error.error_type] = 1
            self._last_error = last_error.error_type
            if self.consecutive_failures >= self.config.circuit_breaker_threshold:
                self.circuit_open = True
            if self.error_streaks[last_error.error_type] >= self.config.max_same_errors:
                break
            if not last_error.retryable or retry_index >= self.config.max_retries or self.circuit_open:
                break
            if time.monotonic() - budget.started_monotonic >= self.config.run_timeout_seconds:
                last_error = ToolError("RUN_TIMEOUT", "Run deadline exceeded during retry", retryable=False)
                break
            time.sleep(self.config.backoff_seconds * (2 ** retry_index))
            _ = attempt_started  # Retained for debugger inspection; total latency is in the event.

        assert last_error is not None
        status = "TIMED_OUT" if last_error.error_type in {"TOOL_TIMEOUT", "RUN_TIMEOUT"} else "FAIL"
        return finish(status, error=last_error.to_dict(), retry_index=retry_index)

    def checkpoint(self, path: str | Path, run_id: str, state: dict[str, Any]) -> None:
        """Persist enough information for explicit, non-automatic resume."""
        target = Path(path)
        target.parent.mkdir(parents=True, exist_ok=True)
        payload = {"run_id": run_id, "saved_at": utc_now(), "state": state, "events": self.events,
                   "circuit_open": self.circuit_open, "consecutive_failures": self.consecutive_failures}
        temporary = target.with_suffix(target.suffix + ".tmp")
        temporary.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
        temporary.replace(target)


# FILE END: engine/scheduler.py
