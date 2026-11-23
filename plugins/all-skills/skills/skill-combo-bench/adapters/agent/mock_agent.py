"""Deterministic, script-driven agent used exclusively for offline tests."""

from __future__ import annotations

import copy
import json
import re
from typing import Any, Iterator, Mapping

from adapters.base import AgentAdapter


_REFERENCE_PATTERN = re.compile(r"\$\{([^{}]+)\}")
_MISSING = object()


class MockScriptError(ValueError):
    """A reproducible error in a mock task script or result reference."""


class MockAgent(AgentAdapter):
    """Replay observable turn behavior without invoking a model or loading skills."""

    adapter_id = "mock_agent"
    verification_status = "MOCK_ONLY"

    def __init__(self) -> None:
        self.config: dict[str, Any] = {}
        self._events: list[dict[str, Any]] = []

    def capabilities(self) -> dict[str, Any]:
        """Declare the narrow mock boundary rather than implying model support."""
        return {
            "adapter_id": self.adapter_id,
            "adapter_type": "AGENT",
            "execution_mode": "MOCK_ONLY",
            "verification_status": self.verification_status,
            "input_modalities": ["text", "structured_data"],
            "output_modalities": ["text", "structured_data"],
            "supported_file_types": ["application/json"],
            "max_input_bytes": None,
            "supports_tool_calls": True,
            "supports_state": True,
            "supports_cancellation": False,
            "supports_streaming": False,
            "invokes_real_model": False,
            "loads_skills": False,
            "limitations": [
                "Only task['turns'] scripts are replayed.",
                "Skills are inert context metadata and never change mock behavior.",
                "Image, audio, and video inputs are not processed.",
                "Token usage is not measured.",
            ],
        }

    def health_check(self) -> dict[str, Any]:
        """Check only the local mock object; no model health is implied."""
        return {
            "status": "PASS",
            "scope": "MOCK_ONLY",
            "adapter_id": self.adapter_id,
            "invokes_real_model": False,
        }

    def run(self, task: dict[str, Any], context: dict[str, Any]) -> dict[str, Any]:
        """Execute scripted turns, real context tool calls, writes, and state probes."""
        run_id = str(context.get("run_id") or task.get("run_id") or "mock-run")
        task_id = str(task.get("task_id") or task.get("id") or "mock-task")
        condition_id = str(context.get("condition_id") or task.get("condition_id") or "UNKNOWN")
        turns = task.get("turns", [])
        if not isinstance(turns, list):
            return self._failure_result(run_id, "INVALID_MOCK_SCRIPT", "task['turns'] must be an array")

        initial_state = context.get("session_state", task.get("initial_state", {}))
        if not isinstance(initial_state, Mapping):
            return self._failure_result(run_id, "INVALID_SESSION_STATE", "session_state must be an object")
        session_state = copy.deepcopy(dict(initial_state))
        tool_results: dict[str, Any] = {}
        run_events: list[dict[str, Any]] = []
        turn_results: list[dict[str, Any]] = []
        output: Any = None
        failure_class: str | None = None
        tool_failure = False
        robustness_class: str | None = task.get("robustness_class")
        sequence = 0

        def emit(event_type: str, **fields: Any) -> None:
            nonlocal sequence
            event = {
                "event_index": sequence,
                "event_type": event_type,
                "run_id": run_id,
                "task_id": task_id,
                "condition_id": condition_id,
                "agent_id": self.adapter_id,
                **fields,
            }
            sequence += 1
            run_events.append(event)
            self._events.append(event)

        emit("run_started", execution_mode="MOCK_ONLY", invokes_real_model=False)
        try:
            for turn_index, turn in enumerate(turns, start=1):
                if not isinstance(turn, Mapping):
                    raise MockScriptError(f"Turn {turn_index} must be an object")
                emit(
                    "turn_started",
                    turn_index=turn_index,
                    input=copy.deepcopy(turn.get("input", turn.get("user"))),
                )
                turn_tool_results: list[dict[str, Any]] = []
                tool_calls = turn.get("tool_calls", [])
                if not isinstance(tool_calls, list):
                    raise MockScriptError(f"Turn {turn_index} tool_calls must be an array")
                for call_index, raw_call in enumerate(tool_calls):
                    if not isinstance(raw_call, Mapping):
                        raise MockScriptError(f"Turn {turn_index} tool call {call_index} must be an object")
                    call_id = str(raw_call.get("call_id") or f"turn-{turn_index}-call-{call_index}")
                    if call_id in tool_results:
                        raise MockScriptError(f"Duplicate tool call_id: {call_id}")
                    tool_name = raw_call.get("name", raw_call.get("tool_name"))
                    if not isinstance(tool_name, str) or not tool_name:
                        raise MockScriptError(f"Tool call {call_id} requires a non-empty name")
                    raw_arguments = raw_call.get("arguments", raw_call.get("args", {}))
                    if not isinstance(raw_arguments, Mapping):
                        raise MockScriptError(f"Tool call {call_id} arguments must be an object")
                    arguments = self._resolve_references(raw_arguments, tool_results)
                    emit(
                        "tool_call_requested",
                        turn_index=turn_index,
                        tool_call_id=call_id,
                        tool_name=tool_name,
                        arguments_redacted=copy.deepcopy(arguments),
                        retry_index=int(raw_call.get("retry_index", 0)),
                    )
                    executor = context.get("tool_executor")
                    if executor is None or not callable(getattr(executor, "execute", None)):
                        raise MockScriptError("context['tool_executor'] must provide execute()")
                    try:
                        raw_result = executor.execute(
                            tool_name,
                            dict(arguments),
                            run_id=run_id,
                            turn_index=turn_index,
                            call_id=call_id,
                        )
                        result = self._normalise_tool_result(raw_result)
                    except Exception as exc:  # Tool failures are observable script outcomes.
                        result = {
                            "status": "ERROR",
                            "value": None,
                            "error": {
                                "type": type(exc).__name__,
                                "message": str(exc),
                                "retryable": False,
                            },
                            "metadata": {},
                        }
                    tool_results[call_id] = copy.deepcopy(result)
                    save_as = raw_call.get("save_as")
                    if isinstance(save_as, str) and save_as:
                        tool_results[save_as] = copy.deepcopy(result)
                    if result.get("status") not in {"PASS", "SUCCESS"}:
                        tool_failure = True
                        failure_class = failure_class or str((result.get("error") or {}).get("type") or "TOOL_FAILED")
                    turn_tool_results.append({"call_id": call_id, "result": copy.deepcopy(result)})
                    emit(
                        "tool_call_completed",
                        turn_index=turn_index,
                        tool_call_id=call_id,
                        tool_name=tool_name,
                        status=result.get("status"),
                        result=copy.deepcopy(result.get("value")),
                        error=copy.deepcopy(result.get("error")),
                    )

                writes = self._normalise_state_writes(turn.get("state_writes", {}))
                for state_key, raw_value in writes:
                    value = self._resolve_references(raw_value, tool_results)
                    session_state[state_key] = copy.deepcopy(value)
                    emit(
                        "state_written",
                        turn_index=turn_index,
                        state_key=state_key,
                        value=copy.deepcopy(value),
                    )

                probes = turn.get("state_probes", [])
                if not isinstance(probes, list):
                    raise MockScriptError(f"Turn {turn_index} state_probes must be an array")
                probe_results: list[dict[str, Any]] = []
                for probe_index, raw_probe in enumerate(probes):
                    probe_result = self._evaluate_state_probe(
                        raw_probe,
                        session_state,
                        tool_results,
                        turn_index,
                        probe_index,
                    )
                    probe_results.append(probe_result)
                    emit("state_probe_evaluated", **copy.deepcopy(probe_result))
                    if not probe_result["passed"] and failure_class is None:
                        failure_class = str(raw_probe.get("failure_class") or "STATE_PROBE_FAILED")

                raw_output = turn.get("mock_output")
                output = self._resolve_references(raw_output, tool_results)
                turn_failure = turn.get("failure_class")
                if turn_failure is not None:
                    failure_class = str(turn_failure)
                if turn.get("robustness_class") is not None:
                    robustness_class = str(turn["robustness_class"])
                emit("turn_output", turn_index=turn_index, output=copy.deepcopy(output))
                turn_results.append(
                    {
                        "turn_index": turn_index,
                        "output": copy.deepcopy(output),
                        "tool_results": turn_tool_results,
                        "state_probes": probe_results,
                        "failure_class": turn_failure,
                        "robustness_class": turn.get("robustness_class"),
                    }
                )
                emit("turn_completed", turn_index=turn_index)
        except (MockScriptError, TypeError, ValueError) as exc:
            failure_class = failure_class or "INVALID_MOCK_SCRIPT"
            emit("run_failed", failure_class=failure_class, error={"type": type(exc).__name__, "message": str(exc)})
            return self._result(
                status="FAIL",
                output=output,
                events=run_events,
                failure_class=failure_class,
                robustness_class=robustness_class,
                session_state=session_state,
                tool_results=tool_results,
                turns=turn_results,
                error={"type": type(exc).__name__, "message": str(exc)},
            )

        if failure_class is None:
            failure_class = task.get("failure_class")
        status = "FAIL" if tool_failure else "SUCCESS"
        emit(
            "run_completed",
            status=status,
            failure_class=failure_class,
            robustness_class=robustness_class,
        )
        return self._result(
            status=status,
            output=output,
            events=run_events,
            failure_class=failure_class,
            robustness_class=robustness_class,
            session_state=session_state,
            tool_results=tool_results,
            turns=turn_results,
        )

    def stream_events(self) -> Iterator[dict[str, Any]]:
        """Drain events in observable order; replay uses the returned event copy too."""
        pending, self._events = self._events, []
        yield from copy.deepcopy(pending)

    def _evaluate_state_probe(
        self,
        raw_probe: Any,
        session_state: dict[str, Any],
        tool_results: dict[str, Any],
        turn_index: int,
        probe_index: int,
    ) -> dict[str, Any]:
        if not isinstance(raw_probe, Mapping):
            raise MockScriptError(f"Turn {turn_index} state probe {probe_index} must be an object")
        state_key = raw_probe.get("state_key")
        if not isinstance(state_key, str) or not state_key:
            raise MockScriptError("A state probe requires a non-empty state_key")
        actual = session_state.get(state_key, _MISSING)
        expected = self._resolve_references(
            raw_probe.get("expected_value", raw_probe.get("expected")),
            tool_results,
        )
        allowed = raw_probe.get("allowed_values")
        if allowed is not None:
            if not isinstance(allowed, list):
                raise MockScriptError(f"State probe {state_key} allowed_values must be an array")
            allowed = self._resolve_references(allowed, tool_results)
            passed = actual is not _MISSING and actual in allowed
        else:
            passed = actual is not _MISSING and actual == expected
        return {
            "probe_id": str(raw_probe.get("probe_id") or f"state-probe-{turn_index}-{probe_index}"),
            "turn_index": turn_index,
            "state_key": state_key,
            "state_key_present": actual is not _MISSING,
            "expected_value": None if allowed is not None else copy.deepcopy(expected),
            "allowed_values": copy.deepcopy(allowed),
            "actual_value": None if actual is _MISSING else copy.deepcopy(actual),
            "verification_method": "EXACT_EQUALITY" if allowed is None else "ALLOWED_VALUES",
            "passed": passed,
            "failure_class": None if passed else str(raw_probe.get("failure_class") or "STATE_PROBE_FAILED"),
        }

    @staticmethod
    def _normalise_state_writes(raw_writes: Any) -> list[tuple[str, Any]]:
        if isinstance(raw_writes, Mapping):
            return [(str(key), value) for key, value in raw_writes.items()]
        if isinstance(raw_writes, list):
            writes: list[tuple[str, Any]] = []
            for item in raw_writes:
                if not isinstance(item, Mapping):
                    raise MockScriptError("Each state write must be an object")
                key = item.get("state_key", item.get("key"))
                if not isinstance(key, str) or not key:
                    raise MockScriptError("Each state write requires state_key")
                writes.append((key, item.get("value")))
            return writes
        raise MockScriptError("state_writes must be an object or an array")

    @classmethod
    def _resolve_references(cls, value: Any, results: Mapping[str, Any]) -> Any:
        if isinstance(value, Mapping):
            return {key: cls._resolve_references(item, results) for key, item in value.items()}
        if isinstance(value, list):
            return [cls._resolve_references(item, results) for item in value]
        if isinstance(value, tuple):
            return tuple(cls._resolve_references(item, results) for item in value)
        if not isinstance(value, str):
            return copy.deepcopy(value)
        full_match = _REFERENCE_PATTERN.fullmatch(value)
        if full_match:
            return copy.deepcopy(cls._lookup_reference(full_match.group(1), results))

        def replace(match: re.Match[str]) -> str:
            resolved = cls._lookup_reference(match.group(1), results)
            if isinstance(resolved, (dict, list)):
                return json.dumps(resolved, ensure_ascii=False, sort_keys=True)
            return str(resolved)

        return _REFERENCE_PATTERN.sub(replace, value)

    @staticmethod
    def _lookup_reference(expression: str, results: Mapping[str, Any]) -> Any:
        call_id, separator, path = expression.partition(".")
        if call_id not in results:
            raise MockScriptError(f"Unknown tool result reference: {call_id}")
        segments = path.split(".") if separator else []
        try:
            return MockAgent._lookup_path(results[call_id], segments)
        except (KeyError, IndexError, TypeError) as primary_error:
            # Also permit ${call_id.field} as shorthand for a normalized result's value.
            result = results[call_id]
            if isinstance(result, Mapping) and "value" in result:
                try:
                    return MockAgent._lookup_path(result["value"], segments)
                except (KeyError, IndexError, TypeError):
                    pass
            raise MockScriptError(f"Cannot resolve tool result reference: {expression}") from primary_error

    @staticmethod
    def _lookup_path(value: Any, segments: list[str]) -> Any:
        current = value
        for segment in segments:
            if isinstance(current, Mapping):
                current = current[segment]
            elif isinstance(current, list) and segment.isdigit():
                current = current[int(segment)]
            else:
                raise TypeError(f"Cannot traverse path segment: {segment}")
        return current

    @staticmethod
    def _normalise_tool_result(result: Any) -> dict[str, Any]:
        if callable(getattr(result, "to_dict", None)):
            result = result.to_dict()
        if isinstance(result, Mapping) and "status" in result:
            normalised = dict(result)
            normalised.setdefault("value", None)
            normalised.setdefault("error", None)
            normalised.setdefault("metadata", {})
            return normalised
        return {"status": "SUCCESS", "value": result, "error": None, "metadata": {}}

    @staticmethod
    def _token_usage() -> dict[str, Any]:
        return {
            "input_tokens": 0,
            "output_tokens": 0,
            "cached_tokens": 0,
            "total_tokens": 0,
            "measurement_status": "NOT_MEASURED",
            "source": "MOCK_ONLY",
        }

    def _result(self, *, status: str, output: Any, events: list[dict[str, Any]], failure_class: str | None,
                robustness_class: str | None, session_state: dict[str, Any], tool_results: dict[str, Any],
                turns: list[dict[str, Any]], error: dict[str, Any] | None = None) -> dict[str, Any]:
        return {
            "status": status,
            "output": output,
            "events": events,
            "token_usage": self._token_usage(),
            "failure_class": failure_class,
            "robustness_class": robustness_class,
            "session_state": session_state,
            "tool_results": tool_results,
            "turns": turns,
            "execution_mode": "MOCK_ONLY",
            "error": error,
        }

    def _failure_result(self, run_id: str, failure_class: str, message: str) -> dict[str, Any]:
        event = {
            "event_index": 0,
            "event_type": "run_failed",
            "run_id": run_id,
            "agent_id": self.adapter_id,
            "failure_class": failure_class,
            "error": {"type": failure_class, "message": message},
        }
        self._events.append(event)
        return self._result(
            status="FAIL",
            output=None,
            events=[event],
            failure_class=failure_class,
            robustness_class=None,
            session_state={},
            tool_results={},
            turns=[],
            error=event["error"],
        )


# FILE END: adapters/agent/mock_agent.py
