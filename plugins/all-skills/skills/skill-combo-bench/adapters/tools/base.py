"""Unified local tool contract with JSON Schema argument validation."""

from __future__ import annotations

from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from typing import Any

import jsonschema


class ToolError(RuntimeError):
    """An observable tool failure with a stable, machine-readable contract."""

    def __init__(self, error_type: str, message: str, *, retryable: bool = False, details: dict[str, Any] | None = None) -> None:
        super().__init__(message)
        self.error_type = error_type
        self.retryable = retryable
        self.details = details or {}

    def to_dict(self) -> dict[str, Any]:
        """Serialize without exposing tool arguments or secrets."""
        return {"type": self.error_type, "message": str(self), "retryable": self.retryable, "details": self.details}


@dataclass
class ToolContext:
    """Mutable per-run state supplied to a tool execution."""

    run_id: str
    turn_index: int
    session_state: dict[str, Any] = field(default_factory=dict)
    tool_state: dict[str, Any] = field(default_factory=dict)
    workspace: str = "."


@dataclass
class ToolResult:
    """Normalized result consumed by the scheduler and trace writer."""

    status: str
    value: Any = None
    error: dict[str, Any] | None = None
    metadata: dict[str, Any] = field(default_factory=dict)

    def to_dict(self) -> dict[str, Any]:
        """Return a JSON-serializable representation."""
        return {"status": self.status, "value": self.value, "error": self.error, "metadata": self.metadata}


class ToolInterface(ABC):
    """Base class for deterministic local tools and optional remote adapters."""

    name: str = "tool"
    description: str = "Abstract tool"
    input_schema: dict[str, Any] = {"type": "object"}
    timeout_seconds: float = 5.0
    side_effect_level: str = "NONE"
    idempotent: bool = True
    version: str = "1.0.0"
    error_contract: dict[str, Any] = {"errors": ["TOOL_ERROR"]}

    def validate_arguments(self, arguments: dict[str, Any]) -> None:
        """Raise ToolError instead of leaking a validator-specific exception."""
        try:
            jsonschema.validate(arguments, self.input_schema)
        except jsonschema.ValidationError as exc:
            raise ToolError("INVALID_TOOL_ARGUMENT", exc.message, details={"path": list(exc.absolute_path)}) from exc

    @abstractmethod
    def execute(self, arguments: dict[str, Any], context: ToolContext) -> dict[str, Any]:
        """Execute validated arguments and return a JSON-compatible value."""

    def descriptor(self) -> dict[str, Any]:
        """Describe the tool without implementation-specific SDK objects."""
        return {
            "name": self.name,
            "description": self.description,
            "input_schema": self.input_schema,
            "timeout_seconds": self.timeout_seconds,
            "side_effect_level": self.side_effect_level,
            "idempotent": self.idempotent,
            "version": self.version,
            "error_contract": self.error_contract,
        }


class ToolRegistry:
    """Explicit registry preventing dynamic execution of agent-provided callables."""

    def __init__(self) -> None:
        self._tools: dict[str, ToolInterface] = {}

    def register(self, tool: ToolInterface) -> None:
        """Register one unique tool name."""
        if tool.name in self._tools:
            raise ValueError(f"Duplicate tool: {tool.name}")
        self._tools[tool.name] = tool

    def get(self, name: str) -> ToolInterface:
        """Return a registered tool or raise a structured error."""
        try:
            return self._tools[name]
        except KeyError as exc:
            raise ToolError("TOOL_UNAVAILABLE", f"Tool is not registered: {name}") from exc

    def descriptors(self) -> list[dict[str, Any]]:
        """Return descriptors in stable order."""
        return [self._tools[name].descriptor() for name in sorted(self._tools)]


# FILE END: adapters/tools/base.py
