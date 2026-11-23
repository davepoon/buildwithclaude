"""Fixed offline search responses with stable, auditable source identifiers."""

from __future__ import annotations

from collections.abc import Mapping, Sequence
from copy import deepcopy
from typing import Any

from .base import ToolContext, ToolInterface

_DEFAULT_RESULTS: tuple[dict[str, Any], ...] = (
    {
        "source_id": "mock-source-001",
        "title": "Reproducible tool evaluation",
        "content": "Record seeds, tool arguments, results, and state transitions for replay.",
    },
    {
        "source_id": "mock-source-002",
        "title": "Fault recovery",
        "content": "Use bounded retries and distinguish external failures from task failures.",
    },
    {
        "source_id": "mock-source-003",
        "title": "State verification",
        "content": "Verify exact identifiers and final values with deterministic assertions.",
    },
)


class MockSearch(ToolInterface):
    """Return a deterministic prefix of a fixed result collection."""

    name = "mock_search"
    description = "Return fixed offline search results with source_id fields."
    input_schema: dict[str, Any] = {
        "type": "object",
        "properties": {
            "query": {"type": "string", "minLength": 1},
            "top_k": {"type": "integer", "minimum": 1, "maximum": 10, "default": 3},
        },
        "required": ["query"],
        "additionalProperties": False,
    }
    timeout_seconds = 2.0
    side_effect_level = "NONE"
    idempotent = True
    version = "1.0.0"
    error_contract = {"errors": ["INVALID_TOOL_ARGUMENT"]}

    def __init__(self, results: Sequence[Mapping[str, Any]] | None = None) -> None:
        """Use supplied fixed results, requiring a non-empty unique source_id."""
        source = results if results is not None else _DEFAULT_RESULTS
        self._results = [deepcopy(dict(item)) for item in source]
        source_ids = [item.get("source_id") for item in self._results]
        if any(not isinstance(source_id, str) or not source_id for source_id in source_ids):
            raise ValueError("Every mock search result requires a non-empty source_id.")
        if len(set(source_ids)) != len(source_ids):
            raise ValueError("Mock search source_id values must be unique.")

    def execute(self, arguments: dict[str, Any], context: ToolContext) -> dict[str, Any]:
        """Return detached results so callers cannot mutate the fixed corpus."""
        del context
        self.validate_arguments(arguments)
        top_k = arguments.get("top_k", 3)
        return {"query": arguments["query"], "results": deepcopy(self._results[:top_k])}


# FILE END: adapters/tools/mock_search.py
