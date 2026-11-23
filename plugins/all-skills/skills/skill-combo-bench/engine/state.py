"""Serializable run state and deterministic cross-turn state probes."""

from __future__ import annotations

from dataclasses import asdict, dataclass, field
from typing import Any


@dataclass
class SessionState:
    """State shared by turns inside one run, never implicitly across runs."""

    run_id: str
    task_id: str
    condition_id: str
    trace_id: str
    turn_index: int = 0
    session_state: dict[str, Any] = field(default_factory=dict)
    tool_state: dict[str, Any] = field(default_factory=dict)
    skill_manifest: list[dict[str, Any]] = field(default_factory=list)

    def write(self, values: dict[str, Any]) -> None:
        """Apply explicit observable writes from an adapter."""
        self.session_state.update(values)

    def read(self, key: str, default: Any = None) -> Any:
        """Read a dotted key without executing input as code."""
        current: Any = self.session_state
        for part in key.split("."):
            if not isinstance(current, dict) or part not in current:
                return default
            current = current[part]
        return current

    def to_dict(self) -> dict[str, Any]:
        """Serialize a checkpoint using only JSON-compatible values."""
        return asdict(self)

    @classmethod
    def from_dict(cls, value: dict[str, Any]) -> "SessionState":
        """Restore a checkpoint with no hidden process state."""
        return cls(**value)


@dataclass
class StateProbe:
    """Programmatic assertion for exact state, not an LLM judgement."""

    state_key: str
    first_write_turn: int
    read_turn: int
    expected: Any = None
    allowed_values: list[Any] | None = None
    validation_method: str = "EXACT"
    allow_user_modification: bool = False
    failure_type: str = "OMISSION"

    def evaluate(self, state: SessionState, actual: Any = ...) -> dict[str, Any]:
        """Return PASS/FAIL/N/A and a precise failure class."""
        value = state.read(self.state_key) if actual is ... else actual
        if value is None:
            return {"status": "FAIL", "failure_class": "OMISSION", "state_key": self.state_key, "actual": None}
        if self.validation_method == "EXACT":
            passed = value == self.expected
        elif self.validation_method == "ONE_OF":
            passed = value in (self.allowed_values or [])
        elif self.validation_method == "TYPE":
            expected_type = {"string": str, "number": (int, float), "object": dict, "array": list, "boolean": bool}.get(str(self.expected))
            passed = expected_type is not None and isinstance(value, expected_type)
        else:
            return {"status": "N/A", "failure_class": "NOT_APPLICABLE", "state_key": self.state_key, "actual": value}
        failure = "NONE" if passed else ("STALE_VALUE" if self.allow_user_modification else self.failure_type)
        return {"status": "PASS" if passed else "FAIL", "failure_class": failure, "state_key": self.state_key, "actual": value, "expected": self.expected}


def state_probe_from_dict(value: dict[str, Any]) -> StateProbe:
    """Validate and construct a probe from task data."""
    return StateProbe(
        state_key=value["state_key"],
        first_write_turn=int(value.get("first_write_turn", 1)),
        read_turn=int(value.get("read_turn", 1)),
        expected=value.get("expected", value.get("expected_value")),
        allowed_values=value.get("allowed_values"),
        validation_method=value.get("validation_method", "EXACT"),
        allow_user_modification=bool(value.get("allow_user_modification", False)),
        failure_type=value.get("failure_type", "INCORRECT_VALUE"),
    )


# FILE END: engine/state.py
