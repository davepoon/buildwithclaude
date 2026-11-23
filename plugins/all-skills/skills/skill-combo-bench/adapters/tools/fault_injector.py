"""Configurable, deterministic fault injection around any ToolInterface."""

from __future__ import annotations

import json
import math
import random
import threading
import time
from collections.abc import Mapping, Sequence
from copy import deepcopy
from typing import Any

from .base import ToolContext, ToolError, ToolInterface

_FAULT_TYPES = frozenset(
    {
        "TIMEOUT",
        "INVALID_ARGUMENT",
        "SERVER_ERROR",
        "INTERMITTENT",
        "DUPLICATE_RESPONSE",
        "STALE_STATE",
        "PARTIAL_RESULT",
    }
)
_PROTECTED_RESULT_FIELDS = frozenset({"status", "error", "metadata"})


class FaultInjector(ToolInterface):
    """Wrap one tool and inject at most ``max_triggers`` observable faults.

    ``injected`` counts calls selected by the probability draw. ``triggered``
    counts faults actually applied; duplicate and stale faults need a previous
    response for the same run and arguments, so not every selection can trigger.
    """

    def __init__(
        self,
        delegate: ToolInterface,
        fault_type: str | Mapping[str, Any] = "SERVER_ERROR",
        *,
        probability: float | None = None,
        max_triggers: int | None = None,
        delay_seconds: float | None = None,
        seed: int | None = None,
        partial_fields: Sequence[str] | None = None,
    ) -> None:
        """Copy the delegate contract and validate a fault configuration.

        The second argument may be a fault name or a mapping containing
        ``fault_type`` (aliases: ``type``, ``fault``), probability, trigger
        limit, delay, seed, and optional partial-result field names.
        """
        config = dict(fault_type) if isinstance(fault_type, Mapping) else {"fault_type": fault_type}
        configured_type = config.get("fault_type", config.get("type", config.get("fault", "SERVER_ERROR")))
        if not isinstance(configured_type, str):
            raise ValueError("fault_type must be a string.")
        self.fault_type = configured_type.upper()
        if self.fault_type not in _FAULT_TYPES:
            raise ValueError(f"Unsupported fault type: {configured_type}")

        self.probability = self._probability(config.get("probability", 1.0) if probability is None else probability)
        self.max_triggers = self._max_triggers(config.get("max_triggers", 1) if max_triggers is None else max_triggers)
        self.delay_seconds = self._delay(config.get("delay_seconds", 0.0) if delay_seconds is None else delay_seconds)
        self.seed = config.get("seed", 0) if seed is None else seed
        if isinstance(self.seed, bool) or not isinstance(self.seed, int):
            raise ValueError("seed must be an integer.")
        configured_fields = config.get("partial_fields") if partial_fields is None else partial_fields
        if configured_fields is not None:
            if isinstance(configured_fields, str) or not all(isinstance(field, str) for field in configured_fields):
                raise ValueError("partial_fields must be a sequence of strings.")
            self.partial_fields = tuple(configured_fields)
        else:
            self.partial_fields = None

        self.delegate = delegate
        self.name = delegate.name
        self.description = delegate.description
        self.input_schema = deepcopy(delegate.input_schema)
        self.timeout_seconds = delegate.timeout_seconds
        self.side_effect_level = delegate.side_effect_level
        self.idempotent = delegate.idempotent
        self.version = delegate.version
        self.error_contract = deepcopy(delegate.error_contract)
        errors = self.error_contract.setdefault("errors", [])
        if self.fault_type not in errors:
            errors.append(self.fault_type)

        self._random = random.Random(self.seed)
        self._lock = threading.Lock()
        self._calls = 0
        self._injected = 0
        self._triggered = 0
        self._response_cache: dict[str, dict[str, Any]] = {}

    @property
    def stats(self) -> dict[str, Any]:
        """Return JSON-serializable configuration and counters."""
        with self._lock:
            return {
                "tool_name": self.name,
                "fault_type": self.fault_type,
                "configured": 1,
                "calls": self._calls,
                "injected": self._injected,
                "triggered": self._triggered,
                "probability": self.probability,
                "max_triggers": self.max_triggers,
                "delay_seconds": self.delay_seconds,
                "seed": self.seed,
            }

    def get_stats(self) -> dict[str, Any]:
        """Method form of ``stats`` for schedulers that prefer accessors."""
        return self.stats

    def execute(self, arguments: dict[str, Any], context: ToolContext) -> dict[str, Any]:
        """Apply one configured fault or execute the unchanged delegate."""
        self.validate_arguments(arguments)
        with self._lock:
            self._calls += 1
        selected = self._select_for_injection()
        cache_key = self._cache_key(arguments, context)

        if self.fault_type in {"DUPLICATE_RESPONSE", "STALE_STATE"}:
            cached = deepcopy(self._response_cache.get(cache_key)) if cache_key is not None else None
            if selected and cached is not None:
                self._sleep()
                self._mark_triggered()
                return self._annotate(cached)
            result = self._execute_delegate(arguments, context)
            if cache_key is not None:
                self._response_cache[cache_key] = deepcopy(result)
            return result

        if not selected:
            return self._execute_delegate(arguments, context)

        self._sleep()
        if self.fault_type == "TIMEOUT":
            self._mark_triggered()
            return self._execute_delegate(arguments, context)
        if self.fault_type in {"INVALID_ARGUMENT", "SERVER_ERROR", "INTERMITTENT"}:
            self._mark_triggered()
            raise ToolError(
                self.fault_type,
                f"Injected {self.fault_type} for {self.name}.",
                retryable=self.fault_type in {"SERVER_ERROR", "INTERMITTENT"},
                details={"fault_type": self.fault_type, "tool_name": self.name},
            )

        result = self._execute_delegate(arguments, context)
        self._apply_partial_result(result)
        self._mark_triggered()
        return self._annotate(result)

    def _execute_delegate(self, arguments: dict[str, Any], context: ToolContext) -> dict[str, Any]:
        """Preserve the mapping return type required by ToolInterface."""
        result = self.delegate.execute(arguments, context)
        if not isinstance(result, dict):
            raise ToolError("INVALID_TOOL_RESULT", f"Delegate {self.name} did not return an object.")
        return result

    def _select_for_injection(self) -> bool:
        """Use the instance PRNG so concurrent runs do not share random state."""
        with self._lock:
            if self._triggered >= self.max_triggers:
                return False
            if self._random.random() >= self.probability:
                return False
            self._injected += 1
            return True

    def _mark_triggered(self) -> None:
        """Count an actually observable timeout, error, or modified result."""
        with self._lock:
            self._triggered += 1

    def _sleep(self) -> None:
        """Sleep in real time so an outer scheduler can enforce its timeout."""
        if self.delay_seconds > 0:
            time.sleep(self.delay_seconds)

    def _apply_partial_result(self, result: dict[str, Any]) -> None:
        """Remove payload fields while preserving status and the result type."""
        fields = self.partial_fields
        if fields is None:
            payload_fields = [key for key in result if key not in _PROTECTED_RESULT_FIELDS]
            fields = tuple(payload_fields[-1:])
        for field in fields:
            if field not in _PROTECTED_RESULT_FIELDS:
                result.pop(field, None)

    def _annotate(self, result: dict[str, Any]) -> dict[str, Any]:
        """Add serializable fault metadata without replacing the payload."""
        metadata = result.setdefault("metadata", {})
        if not isinstance(metadata, dict):
            metadata = {"original_metadata": deepcopy(metadata)}
            result["metadata"] = metadata
        metadata["fault_injection"] = {
            "type": self.fault_type,
            "trigger_index": self._triggered,
            "seed": self.seed,
        }
        if self.fault_type == "DUPLICATE_RESPONSE":
            metadata["duplicate_response"] = True
        elif self.fault_type == "STALE_STATE":
            metadata["stale_state"] = True
        elif self.fault_type == "PARTIAL_RESULT":
            metadata["partial_result"] = True
        return result

    def _cache_key(self, arguments: dict[str, Any], context: ToolContext) -> str | None:
        """Build a stable per-run key; disable caching for non-JSON values."""
        try:
            serialized = json.dumps(arguments, ensure_ascii=False, sort_keys=True, separators=(",", ":"))
        except (TypeError, ValueError):
            return None
        return f"{context.run_id}:{serialized}"

    @staticmethod
    def _probability(value: Any) -> float:
        """Validate a finite probability in the closed unit interval."""
        if isinstance(value, bool) or not isinstance(value, (int, float)):
            raise ValueError("probability must be numeric.")
        probability = float(value)
        if not math.isfinite(probability) or not 0.0 <= probability <= 1.0:
            raise ValueError("probability must be between 0 and 1.")
        return probability

    @staticmethod
    def _max_triggers(value: Any) -> int:
        """Validate a non-negative trigger bound."""
        if isinstance(value, bool) or not isinstance(value, int) or value < 0:
            raise ValueError("max_triggers must be a non-negative integer.")
        return value

    @staticmethod
    def _delay(value: Any) -> float:
        """Validate a finite, non-negative real delay."""
        if isinstance(value, bool) or not isinstance(value, (int, float)):
            raise ValueError("delay_seconds must be numeric.")
        delay = float(value)
        if not math.isfinite(delay) or delay < 0:
            raise ValueError("delay_seconds must be non-negative and finite.")
        return delay


# FILE END: adapters/tools/fault_injector.py
